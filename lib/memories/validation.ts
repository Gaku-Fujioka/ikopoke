import {isGroupId} from "../groups/validation";
export function memoryContext(form:FormData){
  const groupId=form.get("groupId"),id=form.get("id"),revision=Number(form.get("revision"));
  if(!isGroupId(groupId)||!isGroupId(id)||!Number.isSafeInteger(revision)||revision<1)throw new Error("画面を開き直して、もう一度お試しください。");
  return {groupId,id,revision};
}
export function memoryFields(form:FormData){
  const title=form.get("title"),note=form.get("note");
  if(typeof title!=="string"||!title.trim()||Array.from(title.trim()).length>120)throw new Error("タイトルを120文字以内で入力してください。");
  if(typeof note!=="string"||Array.from(note).length>2000)throw new Error("あとがきは2,000文字以内で入力してください。");
  return {title:title.trim(),note};
}
