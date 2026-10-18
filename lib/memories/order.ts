import type {SavedVisit} from "../visits/repository";
import {visitTimeMinutes} from "../visits/time";
export function orderMemoryVisits(visits:SavedVisit[],positions:{item_id:string;position:number}[]):SavedVisit[]{
  const planOrder=new Map(positions.map(slot=>[slot.item_id,slot.position]));
  return [...visits].sort((a,b)=>a.visited_on.localeCompare(b.visited_on)||visitTimeMinutes(a)-visitTimeMinutes(b)||
    (planOrder.get(a.item_id)??Number.MAX_SAFE_INTEGER)-(planOrder.get(b.item_id)??Number.MAX_SAFE_INTEGER)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
}
