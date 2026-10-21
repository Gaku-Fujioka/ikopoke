/* Network-only app: cache the public connection guide, never authenticated content. */
const CACHE_NAME = "ikopoke-shell-v1";
const OFFLINE_URL = "/offline.html";
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.add(OFFLINE_URL)));
});
self.addEventListener("activate",event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("ikopoke-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||request.mode!=="navigate"||url.origin!==self.location.origin||!(url.pathname==="/app"||url.pathname.startsWith("/app/")))return;
  event.respondWith(fetch(request,{cache:"no-store"}).catch(async()=>{
    const response=await caches.open(CACHE_NAME).then(cache=>cache.match(OFFLINE_URL)).catch(()=>undefined);
    return response??new Response("通信できません。接続を確認して開き直してください。",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }));
});
