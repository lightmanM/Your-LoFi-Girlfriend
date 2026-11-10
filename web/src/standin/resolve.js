// Which files the page uses. The owner's character and the balcony's chair and plant meshes are private (they are not
// in the public repo); when one is missing, its stand-in is used instead (web/public/standin/: Vivi, a two-panel chair,
// plant cards cut from the shared plant mask). Each file decides on its own; ?standin=1 forces every stand-in.
// A static host may answer a missing file with the page itself (Cloudflare Pages does, with status 200), so a file
// counts only when its first bytes are the right kind: a glTF binary, or JSON.

export const PRIVATE=Object.freeze({chair:'/environment/balcony-toon/chair-visible.glb',base:'/environment/balcony-toon/'});

/** Up to the first `n` bytes of a response's body; the rest is not downloaded (a host may ignore Range and send it all). */
async function firstBytes(response,n=64){
 const reader=response.body?.getReader();if(!reader)return new Uint8Array(0);
 const head=new Uint8Array(n);let got=0;
 try{
  while(got<n){const {done,value}=await reader.read();if(done)break;const take=value.subarray(0,n-got);head.set(take,got);got+=take.length;}
 }finally{reader.cancel().catch(()=>{/* the body is already gone: nothing left to stop */});}
 return head.subarray(0,got);
}

/** Whether a response is really a file of `kind` (its status, its type, and its first bytes). */
export async function isFile(response,kind){
 if(!response?.ok)return false;
 if((response.headers.get('content-type')??'').includes('text/html'))return false;
 const head=await firstBytes(response);
 if(kind==='glb')return head.length>=4&&String.fromCharCode(...head.subarray(0,4))==='glTF';
 if(kind==='json'){const s=new TextDecoder().decode(head).trimStart();return s.startsWith('{')||s.startsWith('[');}
 return true;
}

/**
 * Ask for the first bytes of a file and tell whether it is there (for resolveAssets). Only a real "not here" counts as
 * missing (404 or 410, or a page or wrong kind of file answered in its place): a network error or a server error keeps
 * the owner's file, whose own load then reports any failure, so a hiccup never swaps in a stand-in.
 */
export async function probeFile(url,kind,fetcher=fetch){
 let r;try{r=await fetcher(url,{headers:{Range:'bytes=0-63'}});}catch{return true;}
 if(r.status===404||r.status===410)return false;
 if(!r.ok)return true;
 return isFile(r,kind);
}

/**
 * @param {{vrm:string,pose:string,character:object,wind:{plants:string}}} scene scene.json
 * @param {{vrm:string,pose:string,character:object,book:{offset:number[]},chair:string}|null} standin standin.json, or
 *  null when it could not be read (fine while the owner's character and chair are present)
 * @param {{probe:(url:string,kind:string)=>Promise<boolean>,force?:boolean,base?:string,chair?:string}} o
 */
export async function resolveAssets(scene,standin,{probe,force=false,base=PRIVATE.base,chair=PRIVATE.chair}){
 const has=async(url,kind)=>!force&&await probe(url,kind);
 const plantsUrl=base+scene.wind.plants;
 const [own,ownChair,ownPlants]=await Promise.all([has(scene.vrm,'glb'),has(chair,'glb'),has(plantsUrl,'glb')]);
 const using=[...(own?[]:['character']),...(ownChair?[]:['chair']),...(ownPlants?[]:['plants'])];
 if(!standin&&(!own||!ownChair))throw Error(`missing ${using.join(', ')} and no /standin/standin.json to stand in`);
 return {
  using,
  vrm:own?scene.vrm:standin.vrm,
  pose:own?scene.pose:standin.pose,
  character:own?scene.character:standin.character,
  poseFix:own?{}:standin.poseFix??{},
  facesForward:!own&&!!standin.facesForward,   // a VRM 0.x stand-in turned in its file to face +Z (compress_vivi.py)
  book:{offset:own?[0,0,0]:standin.book?.offset??[0,0,0]},
  chair:{standin:!ownChair,url:ownChair?chair:standin.chair},
  plants:{standin:!ownPlants,url:ownPlants?plantsUrl:null},
 };
}
