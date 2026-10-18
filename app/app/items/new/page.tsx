import { redirect } from "next/navigation";
export default function NewItemEntry() { redirect("/app/new?type=item"); }
