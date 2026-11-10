// Which of the owner's private files this copy has. A fresh clone of the public repo has none of them: suites tuned to
// the owner's character, or that play the music, skip there; the stand-in suite (standin.spec.js) runs instead.
const firstBytes=async(request,url)=>{
 const r=await request.get(url,{headers:{Range:'bytes=0-15'}});
 return r.ok()&&!(r.headers()['content-type']??'').includes('text/html')?await r.body():null;
};
/** The balcony scene with the owner's character (Marycia), as the page shows it on the owner's machine. */
export async function ownerFiles(request){
 if(!(await request.get('/environment/balcony-toon/scene.json')).ok())return false;
 const head=await firstBytes(request,'/models/marycia/marycia-web.vrm');
 return !!head&&head.subarray(0,4).toString('latin1')==='glTF';
}
/** The music: the playlist and its first track's audio. */
export async function musicFiles(request){
 const r=await request.get('/music/playlist.json');if(!r.ok())return false;
 const track=(await r.json()).tracks?.[0];if(!track)return false;
 return !!(await firstBytes(request,'/music/'+(track.file??track.url?.split('/').pop())));
}
/** A glTF binary at `url` (not a dev server's or host's page answered in its place). */
export async function glbAt(request,url){
 const head=await firstBytes(request,url);
 return !!head&&head.subarray(0,4).toString('latin1')==='glTF';
}
