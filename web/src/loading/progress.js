// First load: how much of her room has arrived. Every file the page needs before it can start goes through one
// tracked fetch, which counts the bytes as they come in against the size the server announced, so the stand-by
// display (standby.js) can show a real percentage. A file that has fully arrived is kept until the page is ready and
// handed to whoever asks for it again: the check for the owner's files (standin/resolve.js) and the load itself then
// share one download, also on a host that ignores Range and sends the whole file to the check (Cloudflare Pages).

const MB=1e6;

/** The size a response announces for its file, or 0 when it gives none that matches the bytes that will arrive. */
function announcedSize(response){
 if(response.status===206){
  const total=/\/(\d+)\s*$/.exec(response.headers.get('content-range')??'');
  return total?+total[1]:0;
 }
 if(response.headers.get('content-encoding'))return 0;   // its length is of the packed bytes
 return +(response.headers.get('content-length')??0)||0;
}

/**
 * @typedef {{loaded:number,total:number,fraction:number,pending:number}} Snapshot bytes arrived, bytes in all (as far
 *  as known), how far along the load is (0 to 1), and how many files have been asked for with no answer yet
 * @param {{fetcher?:typeof fetch,onChange?:(s:Snapshot)=>void}} [o]
 * @returns {{fetch:(url:string,init?:RequestInit)=>Promise<Response>,snapshot:()=>Snapshot,release:()=>void}}
 */
export function createProgress({fetcher=(...a)=>globalThis.fetch(...a),onChange=()=>{}}={}){
 // url -> {loaded, size, answered, kept}: `kept` is a promise of the file's whole body ({blob,status,statusText,
 // headers}), or of null when the answer was not a whole file (a ranged answer, or a file that is not there)
 let files=new Map(),released=false,told='';
 const snapshot=()=>{
  let loaded=0,total=0,pending=0;
  for(const f of files.values()){loaded+=f.loaded;total+=Math.max(f.size,f.loaded);if(!f.answered)pending++;}
  // a file with no answer yet has no size: count it at the average of the ones that have answered, so one slow
  // answer neither freezes the percentage nor lets it run to the end early
  const answered=files.size-pending,expected=answered?total+pending*total/answered:0;
  return {loaded,total,fraction:expected?loaded/expected:0,pending};
 };
 const tell=()=>{const s=snapshot(),key=`${s.loaded}/${s.total}/${s.pending}`;if(key!==told){told=key;onChange(s);}};
 const put=(url,patch)=>{files=new Map(files).set(url,{...files.get(url),...patch});tell();};
 const drop=url=>{files=new Map(files);files.delete(url);tell();};
 const respond=({blob,status,statusText,headers})=>new Response(blob,{status,statusText,headers});

 async function download(url,init){
  let response;
  try{response=await fetcher(url,init);}catch(e){drop(url);throw e;}
  if(!response.ok){drop(url);return {untouched:response};}
  if(response.status===206){put(url,{answered:true,size:announcedSize(response),kept:null});return {untouched:response};}
  put(url,{answered:true,size:announcedSize(response)});
  try{
   const parts=[];
   if(response.body){
    const reader=response.body.getReader();
    for(;;){
     const {done,value}=await reader.read();
     if(done)break;
     parts.push(value);put(url,{loaded:files.get(url).loaded+value.byteLength});
    }
   }
   const blob=new Blob(parts,{type:response.headers.get('content-type')??''});
   put(url,{loaded:blob.size,size:blob.size});
   return {body:{blob,status:response.status,statusText:response.statusText,headers:response.headers}};
  }catch(e){drop(url);throw e;}
 }

 async function tracked(url,init){
  if(released)return fetcher(url,init);
  const known=files.get(url);
  if(known?.kept){const body=await known.kept;return body?respond(body):tracked(url,init);}
  // the file is on the books before its request leaves, so a failure always finds its entry to clear
  const work=Promise.resolve().then(()=>download(url,init)),kept=work.then(o=>o.body??null);
  kept.catch(()=>{});                                     // whoever asked gets the failure; nobody else has to
  files=new Map(files).set(url,{loaded:0,size:known?.size??0,answered:!!known?.answered,kept});
  tell();
  const {body,untouched}=await work;
  return body?respond(body):untouched;
 }

 return {
  fetch:tracked,
  snapshot,
  /** Let the kept files go, once the page has everything; later requests are no longer counted. */
  release(){released=true;files=new Map([...files].map(([url,f])=>[url,{...f,kept:null}]));},
 };
}

/**
 * The whole percentage to show: it stops at 99 until the page is ready and never runs backwards (a file found late
 * grows the total).
 * @param {{fraction:number}} snapshot
 * @param {{done?:boolean,shown?:number}} [o] `shown` is the percentage on screen now
 * @returns {number}
 */
export function percent(snapshot,{done=false,shown=0}={}){
 if(done)return 100;
 return Math.max(shown,Math.min(99,Math.floor(snapshot.fraction*100)));
}

/**
 * "7.8 / 18.6 mb": megabytes arrived of megabytes in all; empty while nothing is known yet.
 * @param {{loaded:number,total:number}} snapshot
 * @returns {string}
 */
export function detail({loaded,total}){
 return total?`${(loaded/MB).toFixed(1)} / ${(total/MB).toFixed(1)} mb`:'';
}
