"use client";
import { PlaceExplorer } from "./place-explorer";
import { PlaceSaveForm, AttachPlaceForm } from "./place-save-form";
import type { MapsConfig } from "@/lib/maps/google";
import type { PlaceGroup } from "@/lib/maps/saved";
export function SearchWorkspace({ config, groups, groupId, attach }: { config: MapsConfig; groups: PlaceGroup[]; groupId?: string; attach?: { itemId: string; placeId: string | null } }) {
  return <PlaceExplorer config={config} addHref={groupId ? `/app/groups/${groupId}/items/new` : "/app/new?type=item"} renderPlaceAction={(place, query) => attach && groupId ? <AttachPlaceForm key={place.id} groupId={groupId} itemId={attach.itemId} placeId={place.id} expectedPlaceId={attach.placeId} label="この場所を候補に紐づける" /> : <PlaceSaveForm key={place.id} place={place} query={query} groups={groups} defaultGroupId={groupId} />} />;
}
