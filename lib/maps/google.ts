import type { MapSession, PlaceResult } from "./explorer";

export type MapsConfig = { enabled: boolean; placesEnabled: boolean; apiKey: string; mapId: string };
type Point = { lat: number; lng: number };
type MapHandle = { panTo(point: Point): void; setZoom(zoom: number): void };
type Listener = { remove(): void };
type RawPlace = {
  id?: string; displayName?: string; formattedAddress?: string;
  location?: { lat(): number; lng(): number };
  attributions?: { provider?: string; providerURI?: string }[];
};
type SearchRequest = { textQuery: string; fields: string[]; maxResultCount: number; language: string; region: string };
type MapsLibrary = { Map: new (host: HTMLElement, options: object) => MapHandle };
type MarkerHandle = { map: MapHandle | null };
type MarkerLibrary = { AdvancedMarkerElement: new (options: { map: MapHandle; position: Point; title: string }) => MarkerHandle };
type PlacesLibrary = { Place: { searchByText(request: SearchRequest): Promise<{ places?: RawPlace[] }> } };
type MapsSDK = {
  importLibrary(name: "maps"): Promise<MapsLibrary>;
  importLibrary(name: "marker"): Promise<MarkerLibrary>;
  importLibrary(name: "places"): Promise<PlacesLibrary>;
  event: { addListenerOnce(instance: MapHandle, event: string, callback: () => void): Listener; clearInstanceListeners(instance: MapHandle): void };
};
type Browser = Window & {
  google?: { maps?: MapsSDK };
  __kokoikoMapsReady?: () => void;
  gm_authFailure?: () => void;
};

export const PLACE_SEARCH_FIELDS = ["id", "displayName", "formattedAddress", "location", "attributions"];
const genericFailure = () => new Error("maps_unavailable");

export function deadline<T>(operation: Promise<T>, milliseconds = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(genericFailure()), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); reject(genericFailure()); });
  });
}

function safeProviderURI(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function placeResult(place: RawPlace): PlaceResult | null {
  const lat = place.location?.lat(), lng = place.location?.lng();
  if (typeof place.id !== "string" || !place.id || typeof place.displayName !== "string" || !place.displayName ||
    typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id: place.id, name: place.displayName, address: place.formattedAddress ?? "", position: { lat, lng },
    attributions: (place.attributions ?? []).filter(value => typeof value.provider === "string" && value.provider.length > 0)
      .map(value => ({ name: value.provider!, uri: safeProviderURI(value.providerURI) })) };
}

// One script/promise per document, including failures. A failed SDK requires a
// page reload rather than silently retrying paid initialization in the background.
export function createGoogleLoader(browser: Browser, document: Document) {
  let pending: Promise<MapsSDK> | null = null;
  let failed = false;
  const failures = new Set<() => void>();
  function notifyFailure() { if (failed) return; failed = true; failures.forEach(listener => listener()); }
  return {
    subscribeFailure(listener: () => void) { failures.add(listener); return () => { failures.delete(listener); }; },
    get failed() { return failed; },
    load(apiKey: string) {
      if (pending) return pending;
      pending = new Promise<MapsSDK>((resolve, reject) => {
        if (!apiKey || browser.google?.maps || document.getElementById("kokoiko-google-maps")) { reject(genericFailure()); return; }
        let settled = false;
        const script = document.createElement("script");
        const timer = setTimeout(rejectLoad, 20000);
        function rejectLoad() {
          if (settled) return;
          settled = true; clearTimeout(timer); notifyFailure(); reject(genericFailure());
        }
        browser.gm_authFailure = () => { if (settled) notifyFailure(); else rejectLoad(); };
        browser.__kokoikoMapsReady = () => {
          if (settled) return;
          const sdk = browser.google?.maps;
          if (!sdk?.importLibrary) { rejectLoad(); return; }
          settled = true; clearTimeout(timer); resolve(sdk);
        };
        script.id = "kokoiko-google-maps";
        script.async = true;
        script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: apiKey, loading: "async", callback: "__kokoikoMapsReady", v: "quarterly", language: "ja", region: "JP", auth_referrer_policy: "origin" })}`;
        script.onerror = rejectLoad;
        document.head.append(script);
      });
      return pending;
    },
  };
}
export function createGoogleMapStarter(pageLoader: ReturnType<typeof createGoogleLoader>) {
  return async function start(host: HTMLElement, config: MapsConfig, onFailure: () => void, signal?: AbortSignal): Promise<MapSession> {
    if (!config.enabled || !config.apiKey || !config.mapId || signal?.aborted) throw genericFailure();
    const unsubscribe = pageLoader.subscribeFailure(onFailure);
    let map: MapHandle | null = null;
    let marker: MarkerHandle | null = null;
    let idleListener: Listener | null = null;
    let sdk: MapsSDK | null = null;
    let disposed = false;
    let selection = 0;
    function dispose() {
      if (disposed) return;
      disposed = true; signal?.removeEventListener("abort", dispose); unsubscribe(); idleListener?.remove();
      if (marker) marker.map = null;
      if (map && sdk) sdk.event.clearInstanceListeners(map);
      host.replaceChildren();
    }
    signal?.addEventListener("abort", dispose, { once: true });
    try {
      sdk = await pageLoader.load(config.apiKey);
      if (pageLoader.failed || disposed) throw genericFailure();
      const maps = await deadline(sdk.importLibrary("maps"));
      if (pageLoader.failed || disposed) throw genericFailure();
      // Japan-wide view; no geolocation request and no assumption about the user's home.
      map = new maps.Map(host, { center: { lat: 36.2, lng: 138.25 }, zoom: 5, mapId: config.mapId,
        gestureHandling: "cooperative", streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
        clickableIcons: false });
      const currentMap = map;
      await deadline(new Promise<void>(resolve => { idleListener = sdk!.event.addListenerOnce(currentMap, "idle", resolve); }));
      if (pageLoader.failed || disposed) throw genericFailure();
      let places: PlacesLibrary | null = null;
      let markers: Promise<MarkerLibrary> | null = null;
      return {
        async search(query) {
          if (disposed || !config.placesEnabled || pageLoader.failed) throw genericFailure();
          selection++;
          if (marker) { marker.map = null; marker = null; }
          const library = places ?? await deadline(sdk!.importLibrary("places"));
          places = library;
          if (disposed || pageLoader.failed) throw genericFailure();
          const result = await deadline(library.Place.searchByText({ textQuery: query, fields: [...PLACE_SEARCH_FIELDS], maxResultCount: 5, language: "ja", region: "jp" }));
          if (disposed || pageLoader.failed) throw genericFailure();
          return (result.places ?? []).map(placeResult).filter((value): value is PlaceResult => value !== null).slice(0, 5);
        },
        select(place) {
          if (disposed || pageLoader.failed) return;
          const currentSelection = ++selection;
          currentMap.panTo(place.position); currentMap.setZoom(16);
          // Markers do not request Place Details or photos.
          markers ??= sdk!.importLibrary("marker");
          void deadline(markers).then(library => {
            if (disposed || pageLoader.failed || selection !== currentSelection) return;
            if (marker) marker.map = null;
            marker = new library.AdvancedMarkerElement({ map: currentMap, position: place.position, title: place.name });
          }).catch(() => { if (!disposed) onFailure(); });
        },
        dispose,
      };
    } catch { dispose(); throw genericFailure(); }
  };
}
let starter: ReturnType<typeof createGoogleMapStarter> | null = null;
export function startGoogleMap(host: HTMLElement, config: MapsConfig, onFailure: () => void, signal?: AbortSignal): Promise<MapSession> {
  starter ??= createGoogleMapStarter(createGoogleLoader(window as Browser, document));
  return starter(host, config, onFailure, signal);
}
