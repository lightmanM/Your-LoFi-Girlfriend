"""Build the runtime motion library from the curve extraction and Unity's evaluation.

  python3 -I scripts/marycia/build_motion_library.py assets/characters/marycia/source-curves.json \
      assets/characters/marycia/unity-dump.json web/public/models/marycia/source-motions.json [--vrm web/public/models/marycia/marycia.vrm]

Per clip: times/duration/face come from the extraction (sampled Hermite curves); body
tracks come from the Unity dump (parent-local T-pose deltas, mirror-X into glTF).
A clip drives only the bones its own muscle curves touch, the way Unity would.
"""
import sys, json, pathlib, argparse, struct
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import compare_parity as cp

MIRROR_X = (1, -1, -1)
EXCLUDED = {'upperChest', 'jaw'}
FINGERS = {'Thumb': ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'], 'Index': ['IndexProximal', 'IndexIntermediate', 'IndexDistal'],
           'Middle': ['MiddleProximal', 'MiddleIntermediate', 'MiddleDistal'], 'Ring': ['RingProximal', 'RingIntermediate', 'RingDistal'],
           'Little': ['LittleProximal', 'LittleIntermediate', 'LittleDistal']}
BODY = [('Left Upper Leg', 'leftUpperLeg'), ('Right Upper Leg', 'rightUpperLeg'), ('Left Lower Leg', 'leftLowerLeg'), ('Right Lower Leg', 'rightLowerLeg'),
        ('Left Foot', 'leftFoot'), ('Right Foot', 'rightFoot'), ('Left Toes', 'leftToes'), ('Right Toes', 'rightToes'),
        ('Left Shoulder', 'leftShoulder'), ('Right Shoulder', 'rightShoulder'), ('Left Arm', 'leftUpperArm'), ('Right Arm', 'rightUpperArm'),
        ('Left Forearm', 'leftLowerArm'), ('Right Forearm', 'rightLowerArm'), ('Left Hand', 'leftHand'), ('Right Hand', 'rightHand'),
        ('Left Eye', 'leftEye'), ('Right Eye', 'rightEye'), ('UpperChest', 'upperChest'), ('Spine', 'spine'), ('Chest', 'chest'),
        ('Neck', 'neck'), ('Head', 'head'), ('Jaw', 'jaw')]

def muscle_bone(name):
    """Unity muscle/curve name -> VRM1 humanoid bone, or None."""
    for side in ('Left', 'Right'):
        if name.startswith(side + 'Hand.'):
            finger, joint = name.split('.')[1], name.split('.')[2].split(' ')[0]
            index = int(joint) - 1 if joint.isdigit() else 0  # "Spread" belongs to the first joint
            return side.lower() + FINGERS[finger][index]
    for prefix, bone in BODY:
        if name.startswith(prefix + ' ') or name == prefix: return bone
    return None

def affected_bones(muscles):
    bones = {muscle_bone(m) for m in muscles}; bones.discard(None)
    if 'Spine Front-Back' in muscles: bones.add('hips')
    return [b for b in bones if b not in EXCLUDED]

def vrm_morphs(path):
    b = pathlib.Path(path).read_bytes(); length = struct.unpack_from('<I', b, 12)[0]; g = json.loads(b[20:20 + length])
    names = set()
    for mesh in g['meshes']: names.update(mesh.get('extras', {}).get('targetNames', []))
    return names

def main():
    p = argparse.ArgumentParser(); p.add_argument('curves'); p.add_argument('dump'); p.add_argument('out'); p.add_argument('--vrm'); p.add_argument('--keep-order', action='store_true')
    a = p.parse_args()
    curves = json.loads(pathlib.Path(a.curves).read_text()); dump = json.loads(pathlib.Path(a.dump).read_text())
    rest, parents = dump['rest'], dump['parents']; morphs = vrm_morphs(a.vrm) if a.vrm else None
    order = sorted(curves['clips']) if not a.keep_order else list(curves['clips'])
    clips, report = {}, {}
    for key in order:
        c = curves['clips'][key]; u = dump['clips'].get(key)
        if u is None: raise SystemExit(f'{key}: missing from the Unity dump; rerun scripts/marycia/unity/run_parity.sh')
        assert len(u['times']) == len(c['times']) and all(abs(x - y) < 1e-6 for x, y in zip(u['times'], c['times'])), key
        bones = sorted(affected_bones(c['muscles']))
        tracks = {b: [] for b in bones}
        for i in range(len(c['times'])):
            local, _ = cp.unity_local_deltas(u, rest, parents, i)
            for b in bones: tracks[b].extend(round(v, 7) for v in cp.q_mirror(local[b], MIRROR_X))
        face = c['face']; dropped = []
        if morphs is not None:
            dropped = [n for n in face if n not in morphs]; face = {n: v for n, v in face.items() if n in morphs}
        clips[key] = {'sourceFile': c['sourceFile'], 'sourceSHA256': c['sourceSHA256'], 'duration': c['duration'], 'times': c['times'],
                      'tracks': [{'bone': b, 'rotations': tracks[b]} for b in bones], 'face': face, 'ignoredBindings': c.get('ignoredBindings', []),
                      'rootTranslationPolicy': 'Seat anchored; Unity hips position retained in assets/characters/marycia/unity-dump.json only.'}
        report[key] = {'frames': len(c['times']), 'bones': len(bones), 'faceChannels': len(face), 'droppedMorphs': dropped}
    out = {'sampleRate': curves['sampleRate'], 'source': 'Marycia 1.5.1 supplied Unity clips / ©BeroarN', 'clips': clips,
           'conversion': {'decoder': 'Unity Editor evaluation of the supplied clips on the purchased Avatar (scripts/marycia/unity/LofiParity.cs)',
                          'unityVersion': dump['unityVersion'], 'sampling': dump['samplingMethod'], 'rest': dump['restSource'],
                          'coordinateFrame': 'normalized VRM1 (mirror-X from Unity)', 'unityParityVerified': True,
                          'faceSampling': 'extract_source_motions.py (weighted Hermite, 60 Hz)'}}
    pathlib.Path(a.out).write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))
    print(json.dumps(report, indent=1))

if __name__ == '__main__': main()
