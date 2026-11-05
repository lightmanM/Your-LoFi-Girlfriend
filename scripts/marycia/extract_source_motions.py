"""Read supplied Unity .anim data without executing Unity/package code.
Samples actual float curves at 60 Hz, including weighted tangent interpolation.
"""
import pathlib,re,json,argparse,math,hashlib,bisect
CLIPS={'sit':'bn0010_sit','stand':'bn0010_stand_still','afk':'bn0010_AFK','handsIdle':'bn0010_hands_idle','peace':'bn0010_hands_peace','thumbsUp':'bn0010_hands_thumbs_up','heart':'bn0010_hands_Heart','fingerHeart':'bn0010_hands_Heart_Tip','faceIdle':'bn0010_Face1_Default','smile':'bn0010_Face1_Smile1','wink':'bn0010_Face1_Wink','relax':'bn0010_Face1_Relax'}
def evaluate_curve(keys,t):
 if len(keys)==1 or t<=keys[0]['time']:return keys[0]['value']
 if t>=keys[-1]['time']:return keys[-1]['value']
 i=bisect.bisect_right([k['time'] for k in keys],t)-1;a,b=keys[i:i+2];dt=b['time']-a['time'];x=(t-a['time'])/dt
 so=a.get('outSlope',0);si=b.get('inSlope',0)
 if not math.isfinite(so) or not math.isfinite(si):return a['value']
 wo=a.get('outWeight',1/3) if int(a.get('weightedMode',0))&2 else 1/3
 wi=b.get('inWeight',1/3) if int(b.get('weightedMode',0))&1 else 1/3
 def bez(u,p0,p1,p2,p3):return (1-u)**3*p0+3*(1-u)**2*u*p1+3*(1-u)*u*u*p2+u**3*p3
 lo=0.;hi=1.
 for _ in range(35):
  u=(lo+hi)/2
  if bez(u,0,wo,1-wi,1)<x:lo=u
  else:hi=u
 return bez((lo+hi)/2,a['value'],a['value']+dt*wo*so,b['value']-dt*wi*si,b['value'])
def parse_clip(path):
 s=path.read_text();section=s[s.index('  m_FloatCurves:'):s.index('  m_PPtrCurves:')];tracks=[]
 for c in re.split(r'\n  - serializedVersion: 2\n    curve:',section)[1:]:
  attr=re.search(r'^    attribute: (.+)$',c,re.M);target=re.search(r'^    path: *(.*)$',c,re.M);kind=re.search(r'^    classID: (\d+)',c,re.M)
  if not attr or not kind:continue
  name=attr[1];name=json.loads(name) if name.startswith('"') else name
  keys=[]
  for raw in re.split(r'\n      - serializedVersion: \d+\n',c)[1:]:
   key={}
   for k,v in re.findall(r'^        (time|value|inSlope|outSlope|weightedMode|inWeight|outWeight): (.+)$',raw,re.M):
    key[k]=float(v.replace('.inf','inf').replace('.nan','nan'))
   if 'time'in key and 'value'in key:keys.append(key)
  if keys:tracks.append({'attribute':name,'path':target[1].strip() if target else '', 'classID':int(kind[1]),'keys':keys})
 duration=max([float(re.search(r'm_StopTime: (.+)',s)[1])]+[k['time'] for tr in tracks for k in tr['keys']])
 times=[0] if duration==0 else [i/60 for i in range(math.ceil(duration*60))]+[duration]
 muscles={};face={};ignored=[]
 for tr in tracks:
  values=[round(evaluate_curve(tr['keys'],t),7) for t in times]
  assert all(math.isfinite(v) for v in values),(path,tr['attribute'])
  if tr['classID']==95:muscles[tr['attribute']]=values
  elif tr['classID']==137 and tr['path']=='bn0010_Face' and tr['attribute'].startswith('blendShape.'):
   name=tr['attribute'][11:]
   if any(abs(v)>1e-7 for v in values):face[name]=[round(max(0,min(1,v/100)),7)for v in values]
  else:ignored.append({'path':tr['path'],'attribute':tr['attribute']})
 return {'sourceFile':path.name,'sourceSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'duration':duration,'times':times,'muscles':muscles,'face':face,'ignoredBindings':ignored}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);a=p.parse_args()
 clips={key:parse_clip(next(a.source.rglob(name+'.anim'))) for key,name in CLIPS.items()}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps({'sampleRate':60,'clips':clips},separators=(',',':'),ensure_ascii=False))
 print(json.dumps({k:{'duration':v['duration'],'samples':len(v['times']),'muscleCurves':len(v['muscles']),'activeFaceCurves':len(v['face'])} for k,v in clips.items()},indent=2))
