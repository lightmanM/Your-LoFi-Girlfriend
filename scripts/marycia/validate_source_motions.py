"""Validate generated local curve data and destination morph coverage without Blender."""
import json,pathlib,math,struct,hashlib
root=pathlib.Path(__file__).resolve().parents[2]
p=root/'web/public/models/marycia/source-motions.json';data=json.loads(p.read_text())
b=(root/'web/public/models/marycia/marycia.vrm').read_bytes();length=struct.unpack_from('<I',b,12)[0];vrm=json.loads(b[20:20+length]);names=set()
for mesh in vrm['meshes']:names.update(mesh.get('extras',{}).get('targetNames',[]))
report={'librarySHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'libraryBytes':len(p.read_bytes()),'vrmBytes':len(b),'clips':{},'unityParityVerified':False}
for key,c in data['clips'].items():
 times=c['times'];assert times and times[0]==0
 assert all(math.isfinite(t) for t in times) and all(b>a for a,b in zip(times,times[1:]))
 assert abs(times[-1]-c['duration'])<1e-7
 max_error=0
 for track in c['tracks']:
  values=track['rotations'];assert len(values)==4*len(times)
  assert all(math.isfinite(v) for v in values)
  for i in range(0,len(values),4):max_error=max(max_error,abs(math.sqrt(sum(v*v for v in values[i:i+4]))-1))
 assert max_error<1e-5,(key,max_error)
 assert not set(c['face'])-names,(key,set(c['face'])-names)
 for values in c['face'].values():assert len(values)==len(times) and all(math.isfinite(v) and 0<=v<=1 for v in values)
 report['clips'][key]={'duration':c['duration'],'samples':len(times),'bones':len(c['tracks']),'facialChannels':len(c['face']),'maxQuaternionNormError':max_error,'source':c['sourceFile'],'sourceSHA256':c['sourceSHA256']}
out=root/'docs/marycia-source-motions/conversion-validation.json';out.write_text(json.dumps(report,indent=2));print(f"Validated {len(report['clips'])} clips, all quaternion samples and facial targets; library {report['libraryBytes']} bytes.")
