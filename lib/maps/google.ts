import type { MapSession, PlaceResult, PlaceDetails, PlaceAuthor } from "./explorer";

export type MapsConfig = { enabled: boolean; placesEnabled: boolean; apiKey: string; mapId: string };
type Point = { lat: number; lng: number };
type Bounds = { extend(point: Point): void };
type MapHandle = { panTo(point: Point): void; setZoom(zoom: number): void; fitBounds(bounds: Bounds, padding: number): void };
type Listener = { remove(): void };
type RawPlace = {
  id?: string; displayName?: string; formattedAddress?: string;
  location?: { lat(): number; lng(): number };
  attributions?: { provider?: string; providerURI?: string }[];
};
type SearchRequest = { textQuery: string; fields: string[]; maxResultCount: number; language: string; region: string };
type MapsLibrary = { Map: new (host: HTMLElement, options: object) => MapHandle; LatLngBounds: new () => Bounds };
type MarkerHandle = { map: MapHandle | null; zIndex: number; addEventListener(event: string, callback: () => void): void; removeEventListener(event: string, callback: () => void): void };
type MarkerLibrary = { AdvancedMarkerElement: new (options: { map: MapHandle; position: Point; title: string; gmpClickable: boolean }) => MarkerHandle };
type RawAuthor = { displayName?: string; uri?: string; photoURI?: string };
type RawReview = { text?: string; originalText?: string; rating?: number; relativePublishTimeDescription?: string; googleMapsURI?: string; authorAttribution?: RawAuthor };
type RawPhoto = { googleMapsURI?: string; authorAttributions?: RawAuthor[]; getURI(options: { maxWidth: number; maxHeight: number }): string };
type DetailedPlace = { rating?: number; userRatingCount?: number; photos?: RawPhoto[]; reviews?: RawReview[]; attributions?: RawPlace["attributions"]; fetchFields(request: { fields: string[] }): Promise<unknown> };
type PlacesLibrary = { Place: { new (options: { id: string; requestedLanguage: string }): DetailedPlace; searchByText(request: SearchRequest): Promise<{ places?: RawPlace[] }> } };
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
export const PLACE_DETAIL_FIELDS = ["rating", "userRatingCount", "photos", "reviews", "attributions"];
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

function placeAuthor(author: RawAuthor): PlaceAuthor {
  return { name: author.displayName || "Googleマップの投稿者", uri: safeProviderURI(author.uri), avatar: safeProviderURI(author.photoURI) };
}
function validRating(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5 ? value : null; }
export function detailResult(place: DetailedPlace): PlaceDetails {
  // Source links are required. Never replace a missing individual source with
  // a generic place link and pretend it links to that photo or review.
  const selectedPhoto = place.photos?.find(photo => safeProviderURI(photo.googleMapsURI));
  let photo: PlaceDetails["photo"] = null;
  if (selectedPhoto) {
    try {
      const uri = safeProviderURI(selectedPhoto.getURI({ maxWidth: 800, maxHeight: 800 }));
      if (uri) photo = { uri, source: safeProviderURI(selectedPhoto.googleMapsURI)!, authors: (selectedPhoto.authorAttributions ?? []).map(placeAuthor) };
    } catch { /* Reviews remain usable when a photo cannot be loaded. */ }
  }
  return {
    rating: validRating(place.rating),
    ratingCount: Number.isSafeInteger(place.userRatingCount) && place.userRatingCount! >= 0 ? place.userRatingCount! : null,
    photo,
    reviews: (place.reviews ?? []).slice(0, 5).filter(review => safeProviderURI(review.googleMapsURI) && review.authorAttribution?.displayName)
      .map(review => ({ text: review.text ?? review.originalText ?? "", original: review.originalText && review.text && review.originalText !== review.text ? review.originalText : null,
        rating: validRating(review.rating), relativeTime: review.relativePublishTimeDescription ?? "", source: safeProviderURI(review.googleMapsURI)!, author: placeAuthor(review.authorAttribution!) })),
    attributions: (place.attributions ?? []).filter(value => value.provider).map(value => ({ name: value.provider!, uri: safeProviderURI(value.providerURI) })),
  };
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
  return async function start(host: HTMLElement, config: MapsConfig, onFailure: () => void, signal?: AbortSignal, onSelect: (id: string) => void = () => {}): Promise<MapSession> {
    if (!config.enabled || !config.apiKey || !config.mapId || signal?.aborted) throw genericFailure();
    const unsubscribe = pageLoader.subscribeFailure(onFailure);
    let map: MapHandle | null = null;
    let pins: { marker: MarkerHandle; click: () => void; id: string }[] = [];
    let idleListener: Listener | null = null;
    let sdk: MapsSDK | null = null;
    let disposed = false;
    let selection = 0;
    function clearPins() {
      for (const pin of pins) { pin.marker.removeEventListener("gmp-click", pin.click); pin.marker.map = null; }
      pins = [];
    }
    function dispose() {
      if (disposed) return;
      disposed = true; signal?.removeEventListener("abort", dispose); unsubscribe(); idleListener?.remove();
      selection++; clearPins();
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
          const currentSelection = ++selection;
          clearPins();
          const library = places ?? await deadline(sdk!.importLibrary("places"));
          places = library;
          if (disposed || pageLoader.failed) throw genericFailure();
          const result = await deadline(library.Place.searchByText({ textQuery: query, fields: [...PLACE_SEARCH_FIELDS], maxResultCount: 5, language: "ja", region: "jp" }));
          if (disposed || pageLoader.failed) throw genericFailure();
          const results = (result.places ?? []).map(placeResult).filter((value): value is PlaceResult => value !== null).slice(0, 5);
          if (results.length) {
            markers ??= sdk!.importLibrary("marker");
            const markerLibrary = await deadline(markers);
            if (disposed || pageLoader.failed || selection !== currentSelection) throw genericFailure();
            try {
              for (const place of results) {
                const marker = new markerLibrary.AdvancedMarkerElement({ map: currentMap, position: place.position, title: place.name, gmpClickable: true });
                const click = () => { if (!disposed && selection === currentSelection) onSelect(place.id); };
                marker.addEventListener("gmp-click", click); pins.push({ marker, click, id: place.id });
              }
              if (results.length === 1) { currentMap.panTo(results[0].position); currentMap.setZoom(15); }
              else { const bounds = new maps.LatLngBounds(); results.forEach(place => bounds.extend(place.position)); currentMap.fitBounds(bounds, 32); }
            } catch { clearPins(); throw genericFailure(); }
          }
          return results;
        },
        select(place) {
          if (disposed || pageLoader.failed) return;
          currentMap.panTo(place.position); currentMap.setZoom(16);
          pins.forEach(pin => { pin.marker.zIndex = pin.id === place.id ? 100 : 0; });
        },
        async details(place, detailSignal) {
          if (disposed || pageLoader.failed || detailSignal.aborted || !config.placesEnabled) throw genericFailure();
          const library = places ?? await deadline(sdk!.importLibrary("places")); places = library;
          if (disposed || pageLoader.failed || detailSignal.aborted) throw genericFailure();
          const details = new library.Place({ id: place.id, requestedLanguage: "ja" });
          await deadline(details.fetchFields({ fields: [...PLACE_DETAIL_FIELDS] }));
          // In particular, do not even produce a photo URI for a selection that
          // the user has already left while the details request was in flight.
          if (disposed || pageLoader.failed || detailSignal.aborted) throw genericFailure();
          return detailResult(details);
        },
        dispose,
      };
    } catch { dispose(); throw genericFailure(); }
  };
}
let starter: ReturnType<typeof createGoogleMapStarter> | null = null;
export function startGoogleMap(host: HTMLElement, config: MapsConfig, onFailure: () => void, signal?: AbortSignal, onSelect: (id: string) => void = () => {}): Promise<MapSession> {
  starter ??= createGoogleMapStarter(createGoogleLoader(window as Browser, document));
  return starter(host, config, onFailure, signal, onSelect);
}
