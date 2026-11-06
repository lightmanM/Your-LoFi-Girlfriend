"""Compare the portable muscle converter output with Unity's own evaluation.

Inputs
  --unity   docs/marycia-parity/unity-dump.json   (written by scripts/marycia/unity/LofiParity.cs)
  --source  web/public/models/marycia/source-motions.json (written by convert_muscles.gd)
Output
  --out     docs/marycia-parity/parity.json

For every humanoid bone the converter stores, per frame,
  delta_world = world(bone) * inverse(rest_world(bone))           (rest = T-pose)
  delta       = inverse(delta_world(parent)) * delta_world        (parent = nearest kept humanoid ancestor)
in a right-handed glTF frame. This script rebuilds the same quantity from
Unity world rotations (left-handed), using Unity's muscle-0 T-pose as rest,
then conjugates by a mirror to reach the right-handed frame. The mirror is
chosen on the `sit` clip among {identity, X, Y, Z} and reported.
Run with: python3 -I scripts/marycia/compare_parity.py
"""
import argparse
import json
import math
import pathlib

SKIPPED_PARENTS = {"upperChest", "jaw", ""}
CANDIDATES = {
    "identity": (1, 1, 1),
    "mirrorX (x,-y,-z,w)": (1, -1, -1),
    "mirrorY (-x,y,-z,w)": (-1, 1, -1),
    "mirrorZ (-x,-y,z,w)": (-1, -1, 1),
}
REGIONS = {
    "torso": {"hips", "spine", "chest", "neck", "head", "leftEye", "rightEye"},
    "arms": {"leftShoulder", "rightShoulder", "leftUpperArm", "rightUpperArm",
             "leftLowerArm", "rightLowerArm", "leftHand", "rightHand"},
    "legs": {"leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg",
             "leftFoot", "rightFoot", "leftToes", "rightToes"},
}
WORST_BONE_COUNT = 8
END_EFFECTORS = ("head", "leftHand", "rightHand", "leftFoot", "rightFoot")


def region_of(bone):
    for name, bones in REGIONS.items():
        if bone in bones:
            return name
    if bone.startswith("left"):
        return "leftFingers"
    if bone.startswith("right"):
        return "rightFingers"
    return "other"


def q_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def q_inv(q):
    x, y, z, w = q
    return (-x, -y, -z, w)


def q_norm(q):
    n = math.sqrt(sum(c * c for c in q)) or 1.0
    return tuple(c / n for c in q)


def q_angle_deg(a, b):
    d = abs(sum(x * y for x, y in zip(q_norm(a), q_norm(b))))
    return math.degrees(2 * math.acos(min(1.0, d)))


def q_mirror(q, signs):
    sx, sy, sz = signs
    return (q[0] * sx, q[1] * sy, q[2] * sz, q[3])


def frame_quat(flat, i):
    return tuple(flat[4 * i:4 * i + 4])


def kept_parent(parents, bone):
    p = parents.get(bone, "")
    while p and p in SKIPPED_PARENTS:
        p = parents.get(p, "")
    return p


def unity_local_deltas(uclip, rest, parents, frame):
    """Per-bone parent-local delta (Unity frame) for one frame."""
    world = {b: q_norm(q_mul(frame_quat(flat, frame), q_inv(rest[b])))
             for b, flat in uclip["bones"].items()}
    local = {}
    for b, dw in world.items():
        p = kept_parent(parents, b)
        local[b] = q_norm(q_mul(q_inv(world[p]), dw)) if p in world else dw
    return local, world


def compare_clip(uclip, cclip, rest, parents, signs):
    times = cclip["times"]
    if len(times) != len(uclip["times"]):
        raise SystemExit(f"frame count mismatch: converter {len(times)} vs unity {len(uclip['times'])}")
    tracks = {t["bone"]: t["rotations"] for t in cclip["tracks"]}
    per_bone = {}
    per_bone_world = {}
    hips_relative = {}
    for f in range(len(times)):
        local, world = unity_local_deltas(uclip, rest, parents, f)
        conv_world = converter_world_deltas(tracks, parents, f)
        hips_u = q_mirror(world.get("hips", (0, 0, 0, 1)), signs)
        hips_c = conv_world.get("hips", (0, 0, 0, 1))
        for bone, rots in tracks.items():
            if bone not in local:
                continue
            qc = frame_quat(rots, f)
            per_bone.setdefault(bone, []).append(q_angle_deg(q_mirror(local[bone], signs), qc))
            wu = q_mirror(world[bone], signs)
            per_bone_world.setdefault(bone, []).append(q_angle_deg(wu, conv_world[bone]))
            if bone in END_EFFECTORS:
                hips_relative.setdefault(bone, []).append(
                    q_angle_deg(q_mul(q_inv(hips_u), wu), q_mul(q_inv(hips_c), conv_world[bone])))
    return per_bone, per_bone_world, hips_relative, sorted(set(tracks) - set(local))


def converter_world_deltas(tracks, parents, frame):
    """Chain the converter's parent-local deltas back into world deltas."""
    world = {}

    def resolve(bone):
        if bone in world:
            return world[bone]
        q = frame_quat(tracks[bone], frame)
        p = kept_parent(parents, bone)
        world[bone] = q_norm(q_mul(resolve(p), q)) if p in tracks else q_norm(q)
        return world[bone]

    for bone in tracks:
        resolve(bone)
    return world


def summarize(per_bone, per_bone_world, hips_relative):
    all_err = [e for errs in per_bone.values() for e in errs]
    bones = {b: {"meanDeg": round(sum(e) / len(e), 3), "maxDeg": round(max(e), 3),
                 "worldDeltaMeanDeg": round(sum(per_bone_world[b]) / len(per_bone_world[b]), 3)}
             for b, e in per_bone.items()}
    regions = {}
    for b, e in per_bone.items():
        regions.setdefault(region_of(b), []).extend(e)
    return {
        "meanDeg": round(sum(all_err) / len(all_err), 3) if all_err else None,
        "maxDeg": round(max(all_err), 3) if all_err else None,
        "boneFrames": len(all_err),
        "regions": {r: {"meanDeg": round(sum(e) / len(e), 3), "maxDeg": round(max(e), 3), "bones": len({b for b in per_bone if region_of(b) == r})}
                    for r, e in sorted(regions.items())},
        "worstBones": sorted(bones.items(), key=lambda kv: -kv[1]["meanDeg"])[:WORST_BONE_COUNT],
        # world orientation error of the end effectors measured relative to the hips,
        # i.e. what the pose looks like once a root-orientation offset is discounted
        "endEffectorsHipsRelativeMeanDeg": {b: round(sum(e) / len(e), 3) for b, e in hips_relative.items()},
        "perBone": bones,
    }


def compare_face(uclip, cclip):
    uface = {k: [max(0.0, min(1.0, v / 100.0)) for v in vals] for k, vals in uclip.get("face", {}).items()}
    cface = cclip.get("face", {})
    n = len(cclip["times"])
    morphs = {}
    for name in sorted(set(uface) | set(cface)):
        u = uface.get(name, [0.0] * n)
        c = cface.get(name, [0.0] * n)
        morphs[name] = {"maxAbsDiff": round(max(abs(a - b) for a, b in zip(u, c)), 6),
                        "inUnity": name in uface, "inConverter": name in cface,
                        "unityMax": round(max(u), 4), "converterMax": round(max(c), 4)}
    worst = max((m["maxAbsDiff"] for m in morphs.values()), default=0.0)
    return {"morphCount": len(morphs), "maxAbsDiff": worst,
            "onlyInUnity": [m for m, v in morphs.items() if not v["inConverter"]],
            "onlyInConverter": [m for m, v in morphs.items() if not v["inUnity"]],
            "morphs": morphs}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--unity", type=pathlib.Path, default=pathlib.Path("docs/marycia-parity/unity-dump.json"))
    ap.add_argument("--source", type=pathlib.Path, default=pathlib.Path("web/public/models/marycia/source-motions.json"))
    ap.add_argument("--out", type=pathlib.Path, default=pathlib.Path("docs/marycia-parity/parity.json"))
    ap.add_argument("--calibrate-on", default="sit")
    args = ap.parse_args()
    unity = json.loads(args.unity.read_text())
    source = json.loads(args.source.read_text())
    rest = {b: q_norm(tuple(q)) for b, q in unity["rest"].items()}
    parents = unity["parents"]

    cal_u, cal_c = unity["clips"][args.calibrate_on], source["clips"][args.calibrate_on]
    candidates = {}
    for name, signs in CANDIDATES.items():
        per_bone, _, _, _ = compare_clip(cal_u, cal_c, rest, parents, signs)
        candidates[name] = round(sum(e for errs in per_bone.values() for e in errs), 3)
    chosen = min(candidates, key=candidates.get)
    signs = CANDIDATES[chosen]

    clips = {}
    for key, cclip in source["clips"].items():
        uclip = unity["clips"][key]
        entry = {"sourceFile": cclip["sourceFile"], "frames": len(cclip["times"]), "samplingMethod": uclip["method"]}
        if cclip["tracks"]:
            per_bone, per_bone_world, hips_relative, missing = compare_clip(uclip, cclip, rest, parents, signs)
            entry.update(summarize(per_bone, per_bone_world, hips_relative))
            entry["bonesMissingInUnity"] = missing
        if cclip.get("face") or uclip.get("face"):
            entry["face"] = compare_face(uclip, cclip)
        clips[key] = entry

    body = [c for c in clips.values() if "perBone" in c]
    total_frames = sum(c["boneFrames"] for c in body)
    overall = {
        "meanDeg": round(sum(c["meanDeg"] * c["boneFrames"] for c in body) / total_frames, 3),
        "maxDeg": max(c["maxDeg"] for c in body),
        "regions": {},
    }
    region_acc = {}
    for c in body:
        for r, v in c["regions"].items():
            # weight region means by that clip's bone-frames in the region
            acc = region_acc.setdefault(r, [0.0, 0, 0.0])
            weight = sum(1 for b in c["perBone"] if region_of(b) == r) * c["frames"]
            acc[0] += v["meanDeg"] * weight
            acc[1] += weight
            acc[2] = max(acc[2], v["maxDeg"])
    overall["regions"] = {r: {"meanDeg": round(a[0] / a[1], 3), "maxDeg": round(a[2], 3)} for r, a in sorted(region_acc.items())}

    result = {
        "unityVersion": unity["unityVersion"],
        "samplingMethod": unity["samplingMethod"],
        "frameConversion": {"chosen": chosen, "candidatesTotalDegOnCalibrationClip": candidates, "calibrationClip": args.calibrate_on},
        "overall": overall,
        "clips": clips,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=1, ensure_ascii=False))
    print_report(result)


def print_report(result):
    print(f"Unity {result['unityVersion']} sampling={result['samplingMethod']}")
    print("frame conversion candidates (total deg on", result["frameConversion"]["calibrationClip"] + "):")
    for k, v in result["frameConversion"]["candidatesTotalDegOnCalibrationClip"].items():
        print(f"  {'*' if k == result['frameConversion']['chosen'] else ' '} {k:22s} {v:12.3f}")
    print(f"{'clip':12s} {'frames':>6s} {'mean':>8s} {'max':>8s}  worst bones")
    for key, c in result["clips"].items():
        if "meanDeg" in c:
            worst = ", ".join(f"{b} {v['meanDeg']:.2f}" for b, v in c["worstBones"][:4])
            ee = " ".join(f"{b}={v:.1f}" for b, v in c["endEffectorsHipsRelativeMeanDeg"].items())
            print(f"{key:12s} {c['frames']:6d} {c['meanDeg']:8.3f} {c['maxDeg']:8.3f}  {worst}\n{'':12s} hips {c['perBone'].get('hips', {}).get('meanDeg', 'n/a')}  end-effectors vs hips: {ee}")
        else:
            f = c["face"]
            print(f"{key:12s} {c['frames']:6d}  face morphs={f['morphCount']} maxAbsDiff={f['maxAbsDiff']:.4f} onlyUnity={f['onlyInUnity']} onlyConv={f['onlyInConverter']}")
    print("overall mean %.3f deg, max %.3f deg" % (result["overall"]["meanDeg"], result["overall"]["maxDeg"]))
    for r, v in result["overall"]["regions"].items():
        print(f"  {r:14s} mean {v['meanDeg']:8.3f}  max {v['maxDeg']:8.3f}")


if __name__ == "__main__":
    main()
