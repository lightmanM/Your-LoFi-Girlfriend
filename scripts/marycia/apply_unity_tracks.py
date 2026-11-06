"""Replace the body tracks in source-motions.json with Unity's own evaluation.

Reads assets/characters/marycia/unity-dump.json (written by scripts/marycia/unity/LofiParity.cs),
rebuilds each clip's parent-local T-pose deltas exactly as the runtime expects (see
compare_parity.unity_local_deltas), mirrors them into the glTF frame, and writes them
over the existing tracks. Face curves and the per-clip bone selection are kept.
Usage: python3 -I scripts/marycia/apply_unity_tracks.py <unity-dump.json> <source-motions.json> [--backup <path>]
"""
import sys, json, pathlib, argparse
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import compare_parity as cp

MIRROR_X = (1, -1, -1)

def main():
    p = argparse.ArgumentParser(); p.add_argument('dump'); p.add_argument('motions'); p.add_argument('--backup'); a = p.parse_args()
    dump = json.loads(pathlib.Path(a.dump).read_text()); motions = json.loads(pathlib.Path(a.motions).read_text())
    rest, parents = dump['rest'], dump['parents']
    report = {}
    for key, clip in motions['clips'].items():
        if not clip['tracks']: continue
        u = dump['clips'][key]
        assert len(u['times']) == len(clip['times']) and all(abs(x - y) < 1e-6 for x, y in zip(u['times'], clip['times'])), key
        tracks = {t['bone']: [] for t in clip['tracks']}
        worst = 0.0
        for i in range(len(u['times'])):
            local, _ = cp.unity_local_deltas(u, rest, parents, i)
            for bone, out in tracks.items():
                q = cp.q_mirror(local[bone], MIRROR_X)
                old = clip['tracks'][[t['bone'] for t in clip['tracks']].index(bone)]['rotations'][i * 4:i * 4 + 4]
                worst = max(worst, cp.q_angle_deg(q, old))
                out.extend(round(v, 7) for v in q)
        clip['tracks'] = [{'bone': b, 'rotations': r} for b, r in tracks.items()]
        clip['rootTranslationPolicy'] = 'Seat anchored; Unity hips position retained in assets/characters/marycia/unity-dump.json only.'
        report[key] = {'frames': len(u['times']), 'bones': len(tracks), 'maxChangeDeg': round(worst, 2)}
    motions['conversion'] = {'decoder': 'Unity Editor evaluation of the supplied clips on the purchased Avatar (scripts/marycia/unity/LofiParity.cs)',
        'unityVersion': dump['unityVersion'], 'sampling': dump['samplingMethod'], 'rest': dump['restSource'], 'coordinateFrame': 'normalized VRM1 (mirror-X from Unity)',
        'unityParityVerified': True, 'previous': 'Unidot/Godot portable decoder, kept for reference in scripts/marycia/convert_muscles.gd'}
    if a.backup: pathlib.Path(a.backup).write_text(pathlib.Path(a.motions).read_text())
    pathlib.Path(a.motions).write_text(json.dumps(motions, separators=(',', ':'), ensure_ascii=False))
    print(json.dumps(report, indent=1))

if __name__ == '__main__': main()
