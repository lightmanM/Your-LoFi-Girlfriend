"""Add explicit VRM1 controls to our verified Blender GLB; no external dependencies."""
import argparse,json,pathlib,struct,hashlib

def read_glb(path):
    b=path.read_bytes();magic,version,length=struct.unpack_from('<III',b)
    assert magic==0x46546c67 and version==2 and length==len(b)
    size,kind=struct.unpack_from('<II',b,12);assert kind==0x4e4f534a
    return json.loads(b[20:20+size]),b[20+size:]

def write_glb(path,g,binary_chunks):
    j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(j)+len(binary_chunks))+struct.pack('<II',len(j),0x4e4f534a)+j+binary_chunks)

def convert(source,report_path,dest):
    g,binary=read_glb(source);report=json.loads(report_path.read_text());nodes=g['nodes'];by_name={n['name']:i for i,n in enumerate(nodes) if 'name'in n}
    human={}
    for raw,unity in report['humanoidMapping']:
        name=unity.replace(' ','');name=name[0].lower()+name[1:]
        if 'ThumbProximal'in name:name=name.replace('ThumbProximal','ThumbMetacarpal')
        elif 'ThumbIntermediate'in name:name=name.replace('ThumbIntermediate','ThumbProximal')
        human[name]={'node':by_name[raw]}
    face=next((i,n) for i,n in enumerate(nodes) if n.get('name')=='bn0010_Face')
    target_names=g['meshes'][face[1]['mesh']]['extras']['targetNames']
    def expression(pairs,**options):
        return {'morphTargetBinds':[{'node':face[0],'index':target_names.index(name),'weight':weight} for name,weight in pairs], 'isBinary':False,**options}
    presets={
        'blink':expression([('eyeBlinkLeft',1),('eyeBlinkRight',1)]),
        'blinkLeft':expression([('eyeBlinkLeft',1)]),'blinkRight':expression([('eyeBlinkRight',1)]),
        'happy':expression([('mouthSmileLeft',.65),('mouthSmileRight',.65),('cheekSquintLeft',.2),('cheekSquintRight',.2)]),
        'relaxed':expression([('Eyelid_Relax',.25),('Mouth_Smile1',.3)]),
        'sad':expression([('mouthFrownLeft',.5),('mouthFrownRight',.5),('browInnerUp',.5)]),
        'angry':expression([('browDownLeft',.5),('browDownRight',.5)]),
        'surprised':expression([('eyeWideLeft',.6),('eyeWideRight',.6),('jawOpen',.25)])}
    for preset,key in {'aa':'vrc.v_aa','ih':'vrc.v_ih','ou':'vrc.v_ou','ee':'vrc.v_E','oh':'vrc.v_oh'}.items():presets[preset]=expression([(key,1)])
    g.setdefault('extensions',{})['VRMC_vrm']={
        'specVersion':'1.0',
        'meta':{'name':'Marycia · LoFi working conversion','version':'1.5.1-lofi.1','authors':['BeroarN'],'copyrightInformation':'©BeroarN. Purchased asset; project usage confirmed by owner. Original terms and specific permissions continue to apply.','contactInformation':'https://brn.booth.pm/','references':['https://booth.pm/ja/items/6305948'],'avatarPermission':'onlyAuthor','allowExcessivelyViolentUsage':False,'allowExcessivelySexualUsage':False,'commercialUsage':'personalNonProfit','allowPoliticalOrReligiousUsage':False,'allowAntisocialOrHateUsage':False,'creditNotation':'required','allowRedistribution':False,'modification':'allowModification','otherLicenseUrl':'https://drive.google.com/file/d/1aIdIorPdeEXE_VEFnbTOseNRVivaK3Sg/view','licenseUrl':'https://vrm.dev/licenses/1.0/'},
        'humanoid':{'humanBones':human},'expressions':{'preset':presets},
        'lookAt':{'type':'bone','offsetFromHeadBone':[0,.07,0],'rangeMapHorizontalInner':{'inputMaxValue':90,'outputScale':7},'rangeMapHorizontalOuter':{'inputMaxValue':90,'outputScale':10},'rangeMapVerticalDown':{'inputMaxValue':90,'outputScale':6},'rangeMapVerticalUp':{'inputMaxValue':90,'outputScale':6}},
        'firstPerson':{'meshAnnotations':[{'node':i,'type':'both'} for i,n in enumerate(nodes) if 'mesh'in n]}}
    for mat in g['materials']:
        settings=report['materials'][mat['name']];base=mat['pbrMetallicRoughness']['baseColorTexture']
        mat.setdefault('extensions',{})['VRMC_materials_mtoon']={'specVersion':'1.0','transparentWithZWrite':False,'renderQueueOffsetNumber':0,'shadeColorFactor':settings['shadeColor'],'shadeMultiplyTexture':base,'shadingShiftFactor':-.08,'shadingToonyFactor':.65,'giEqualizationFactor':.7,'matcapFactor':[0,0,0],'parametricRimColorFactor':[0,0,0],'rimLightingMixFactor':1,'outlineWidthMode':'none','outlineWidthFactor':0,'uvAnimationScrollXSpeedFactor':0,'uvAnimationScrollYSpeedFactor':0,'uvAnimationRotationSpeedFactor':0}
        mat['extensions']['KHR_materials_unlit']={}
    # Conservative hair-only spring chains. No promise of Unity PhysBone equivalence.
    parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
    is_hair=lambda i:nodes[i].get('name','').startswith('Hair')
    edge_nodes={i for i,n in enumerate(nodes) if is_hair(i) and len(n.get('children',[]))==1 and is_hair(n['children'][0])}
    roots=sorted(i for i in edge_nodes if parents.get(i) not in edge_nodes)
    springs=[]
    for i in roots:
        chain=[i]
        while chain[-1] in edge_nodes:chain.append(nodes[chain[-1]]['children'][0])
        if len(chain)>1:springs.append({'name':nodes[i]['name'],'center':human['hips']['node'],'joints':[{'node':j,'hitRadius':.004,'stiffness':1.5,'gravityPower':.015,'gravityDir':[0,-1,0],'dragForce':.65}for j in chain]})
    g['extensions']['VRMC_springBone']={'specVersion':'1.0','springs':springs}
    g['extensionsUsed']=list(dict.fromkeys(g.get('extensionsUsed',[])+['VRMC_vrm','VRMC_materials_mtoon','KHR_materials_unlit','VRMC_springBone']))
    # Check every reference before writing the binary.
    assert len(human)==53 and all(0<=x['node']<len(nodes) for x in human.values())
    assert all(not item.get('uri') for item in g.get('images',[])+g.get('buffers',[]))
    assert len(set(x['node'] for x in human.values()))==len(human)
    for e in presets.values():assert all(x['index']<len(target_names) for x in e['morphTargetBinds'])
    write_glb(dest,g,binary)
    result={'file':str(dest),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'humanoidBones':len(human),'faceMorphs':len(target_names),'expressionPresets':list(presets),'springChains':len(springs),'images':len(g.get('images',[])),'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])}
    dest.with_suffix('.conversion.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('report',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);a=p.parse_args();convert(a.source,a.report,a.output)
