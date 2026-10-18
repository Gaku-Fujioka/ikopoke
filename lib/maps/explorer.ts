export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  position: { lat: number; lng: number };
  attributions: { name: string; uri: string | null }[];
};
export type PlaceAuthor = { name: string; uri: string | null; avatar: string | null };
export type PlaceDetails = {
  rating: number | null;
  ratingCount: number | null;
  photo: { uri: string; source: string; authors: PlaceAuthor[] } | null;
  reviews: { text: string; original: string | null; rating: number | null; relativeTime: string; source: string; author: PlaceAuthor }[];
  attributions: PlaceResult["attributions"];
};

export type MapSession = {
  search(query: string): Promise<PlaceResult[]>;
  select(place: PlaceResult): void;
  details(place: PlaceResult, signal: AbortSignal): Promise<PlaceDetails>;
  dispose(): void;
};
export type MapStarter = (host: HTMLElement, onFailure: () => void, signal: AbortSignal, onSelect: (id: string) => void) => Promise<MapSession>;
export type ExplorerState = {
  phase: "closed" | "loading" | "ready" | "failed";
  searching: boolean;
  results: PlaceResult[];
  selected: string | null;
  searched: string | null;
  error: string | null;
  details: PlaceDetails | null;
  detailStatus: "idle" | "loading" | "ready" | "error";
};
export const initialExplorerState: ExplorerState = {
  phase: "closed", searching: false, results: [], selected: null, searched: null, error: null, details: null, detailStatus: "idle",
};
const queryError = "場所の名前やエリアを1〜100文字で入力してください。";

// Google responses live only in this mounted view. No storage, URL, logs or DB.
export function createMapExplorer(start: MapStarter) {
  let state = initialExplorerState;
  let session: MapSession | null = null;
  let generation = 0;
  let aborter: AbortController | null = null;
  let detailAborter: AbortController | null = null;
  let detailGeneration = 0;
  const listeners = new Set<() => void>();
  function update(patch: Partial<ExplorerState>) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  function fail() {
    generation++;
    aborter?.abort();
    detailAborter?.abort(); detailGeneration++;
    session?.dispose(); session = null;
    update({ phase: "failed", searching: false, results: [], selected: null, searched: null, details: null, detailStatus: "idle",
      error: "地図を読み込めませんでした。ページを再読み込みしてお試しください。候補の検索や手入力は引き続き使えます。" });
  }
  const explorer = {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async open(host: HTMLElement) {
      if (state.phase !== "closed") return;
      const current = ++generation;
      aborter = new AbortController();
      update({ phase: "loading", error: null });
      try {
        const loaded = await start(host, () => { if (current === generation) fail(); }, aborter.signal, id => { void explorer.select(id); });
        if (current !== generation) { loaded.dispose(); return; }
        session = loaded;
        update({ phase: "ready" });
      } catch { if (current === generation) fail(); }
    },
    async search(value: string) {
      if (state.phase !== "ready" || state.searching || !session) return;
      const query = value.trim();
      if (!query || [...query].length > 100) {
        update({ error: queryError }); return;
      }
      const current = generation;
      detailAborter?.abort(); detailGeneration++;
      update({ searching: true, error: null, results: [], selected: null, searched: null, details: null, detailStatus: "idle" });
      try {
        const results = await session.search(query);
        if (current !== generation) return;
        update({ results, searching: false, searched: query });
      } catch {
        if (current === generation) update({ searching: false, results: [], searched: null,
          error: "場所を検索できませんでした。時間をおいて再度お試しください。保存した候補の検索や手入力も使えます。" });
      }
    },
    async searchOnMap(host: HTMLElement, value: string): Promise<void> {
      if (state.phase === "loading" || state.phase === "failed" || state.searching) return;
      const query = value.trim();
      if (!query || [...query].length > 100) { update({ error: queryError }); return; }
      // Submit is an explicit user action too; no navigation to saved candidates.
      if (state.phase === "closed") await explorer.open(host);
      await explorer.search(query);
    },
    async select(id: string): Promise<void> {
      if (state.phase !== "ready" || state.searching || !session) return;
      const place = state.results.find(result => result.id === id);
      if (!place) return;
      if (state.selected === id && (state.detailStatus === "loading" || state.detailStatus === "ready")) return;
      try { session.select(place); } catch { fail(); return; }
      detailAborter?.abort(); detailAborter = new AbortController();
      const current = ++detailGeneration;
      update({ selected: id, details: null, detailStatus: "loading" });
      try {
        const details = await session.details(place, detailAborter.signal);
        if (current === detailGeneration) update({ details, detailStatus: "ready" });
      } catch { if (current === detailGeneration) update({ details: null, detailStatus: "error" }); }
    },
    dispose() {
      generation++;
      aborter?.abort(); aborter = null;
      detailAborter?.abort(); detailGeneration++;
      session?.dispose(); session = null;
      // Allows React's development effect cleanup/setup cycle without an API call.
      state = initialExplorerState;
    },
  };
  return explorer;
}

export function googleMapsPlaceHref(place: Pick<PlaceResult, "id" | "name">): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place.name, query_place_id: place.id })}`;
}

// A user-authored title is only a search query, never a verified location.
export function googleMapsSearchHref(title: string): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: title })}`;
}
