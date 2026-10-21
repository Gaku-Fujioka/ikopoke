export type PwaState={installed:boolean;ios:boolean;offline:boolean;canInstall:boolean;waiting:boolean;busy:boolean;error:string|null};
export const initialPwaState:PwaState={installed:false,ios:false,offline:false,canInstall:false,waiting:false,busy:false,error:null};
type InstallEvent=Event & {prompt:()=>Promise<unknown>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

/** Browser lifecycle isolated so install/update/offline behaviour can be tested without real accounts. */
export function startPwa(win:Window,nav:Navigator,doc:Document,onChange:(state:PwaState)=>void){
  let active=true,prompt:InstallEvent|null=null,registration:ServiceWorkerRegistration|undefined,reloadRequested=false;
  let state={...initialPwaState},updateTimer:number|undefined;
  const cleanups:(()=>void)[]=[];
  const emit=(patch:Partial<PwaState>)=>{if(active){state={...state,...patch};onChange(state);}};
  function listen(target:EventTarget,event:string,callback:EventListener){target.addEventListener(event,callback);cleanups.push(()=>target.removeEventListener(event,callback));}
  const standalone=win.matchMedia("(display-mode: standalone)");
  const installed=()=>standalone.matches||Boolean((nav as Navigator & {standalone?:boolean}).standalone);
  emit({installed:installed(),offline:!nav.onLine,ios:/iPad|iPhone|iPod/.test(nav.userAgent)||(nav.platform==="MacIntel"&&nav.maxTouchPoints>1)});
  listen(standalone,"change",()=>emit({installed:installed()}));
  listen(win,"online",()=>emit({offline:false}));listen(win,"offline",()=>emit({offline:true}));
  listen(win,"beforeinstallprompt",event=>{event.preventDefault();prompt=event as InstallEvent;emit({canInstall:!state.installed});});
  listen(win,"appinstalled",()=>{prompt=null;emit({installed:true,canInstall:false,busy:false,error:null});});
  if("serviceWorker" in nav&&win.isSecureContext){
    listen(nav.serviceWorker,"controllerchange",()=>{
      if(registration&&!registration.waiting)emit({waiting:false,busy:false,error:null});
      if(reloadRequested){reloadRequested=false;win.clearTimeout(updateTimer);win.location.reload();}
    });
    void nav.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).then(result=>{
      if(!active)return;registration=result;
      const check=()=>emit({waiting:Boolean(result.waiting)});
      const track=()=>{check();if(result.installing)listen(result.installing,"statechange",check);};
      track();listen(result,"updatefound",track);
      listen(doc,"visibilitychange",()=>{if(doc.visibilityState==="visible")void result.update().catch(()=>{});});
    }).catch(()=>emit({error:"追加の準備ができませんでした。接続を確認して、ページを開き直してください。"}));
  }
  return {
    async install(){
      if(!prompt||state.busy||state.installed)return;
      const event=prompt;prompt=null;emit({busy:true,canInstall:false,error:null});
      try{await event.prompt();await event.userChoice;}catch{emit({error:"ホーム画面への追加を完了できませんでした。ブラウザのメニューからも追加できます。"});}
      finally{emit({busy:false});}
    },
    update(){
      if(!registration?.waiting||state.busy)return;
      reloadRequested=true;emit({busy:true,error:null});
      updateTimer=win.setTimeout(()=>{reloadRequested=false;emit({busy:false,error:"更新に時間がかかっています。接続を確認して、もう一度お試しください。"});},10000);
      try{registration.waiting.postMessage({type:"SKIP_WAITING"});}
      catch{win.clearTimeout(updateTimer);reloadRequested=false;emit({busy:false,error:"更新できませんでした。ページを開き直してお試しください。"});}
    },
    dispose(){active=false;win.clearTimeout(updateTimer);for(const cleanup of cleanups)cleanup();},
  };
}
