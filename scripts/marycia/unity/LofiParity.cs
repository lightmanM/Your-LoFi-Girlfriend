// LofiParity: dump Unity's own evaluation of the Marycia humanoid/face clips
// as world rotations per humanoid bone per frame, so the portable converter
// (scripts/marycia/convert_muscles.gd) can be checked against the real
// Unity runtime. Editor-only; run with
//   Unity -batchmode -nographics -quit -projectPath <proj>
//         -executeMethod Lofi.LofiParity.Dump -lofiOut <json> [-lofiTimes <txt>]
// Writes only numbers and bone/morph names (no purchased geometry).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace Lofi
{
    public static class LofiParity
    {
        const string FbxPath = "Assets/BeroarN/bn0010_Marycia/fbx/bn0010_Marycia.fbx";
        const string AnimatorDir = "Assets/BeroarN/bn0010_Marycia/animation/Anim_Animator/";
        const string FaceDir = "Assets/BeroarN/bn0010_Marycia/animation/Anim/";
        const string FaceObject = "bn0010_Face";
        const float SampleRate = 60f;
        const float PoseChangeThresholdDeg = 5f;

        // key, file name, humanoid body clip?
        static readonly (string key, string file, bool body)[] Clips =
        {
            ("sit", "bn0010_sit", true),
            ("stand", "bn0010_stand_still", true),
            ("afk", "bn0010_AFK", true),
            ("handsIdle", "bn0010_hands_idle", true),
            ("peace", "bn0010_hands_peace", true),
            ("thumbsUp", "bn0010_hands_thumbs_up", true),
            ("heart", "bn0010_hands_Heart", true),
            ("fingerHeart", "bn0010_hands_Heart_Tip", true),
            ("fist", "bn0010_hands_fist", true),
            ("gun", "bn0010_hands_gun", true),
            ("open", "bn0010_hands_open", true),
            ("point", "bn0010_hands_point", true),
            ("rock", "bn0010_hands_rock", true),
            ("faceIdle", "bn0010_Face1_Default", false),
            ("smile", "bn0010_Face1_Smile1", false),
            ("wink", "bn0010_Face1_Wink", false),
            ("relax", "bn0010_Face1_Relax", false),
            ("ahoge", "bn0010_Face1_Ahoge", false),
            ("anger", "bn0010_Face1_Anger", false),
            ("ask", "bn0010_Face1_Ask", false),
            ("cry", "bn0010_Face1_Cry", false),
            ("laugh", "bn0010_Face1_D_Laugh", false),
            ("sad", "bn0010_Face1_D_Sad", false),
            ("serious", "bn0010_Face1_D_Serious", false),
            ("eyesClosed", "bn0010_Face1_EyeClose_0", false),
            ("eyesClosedSoft", "bn0010_Face1_EyeClose_1", false),
            ("eyeClosedLeft", "bn0010_Face1_EyeClose_L", false),
            ("eyeClosedRight", "bn0010_Face1_EyeClose_R", false),
            ("scared", "bn0010_Face1_Scared", false),
            ("smile2", "bn0010_Face1_Smile2", false),
            ("smug", "bn0010_Face1_Smug", false),
            ("star", "bn0010_Face1_Star", false),
            ("faceAfk", "bn0010_Face_AFK", false),
        };

        // Unity HumanBodyBones -> VRM1 humanoid name (note the thumb shift).
        static readonly (HumanBodyBones bone, string vrm)[] BoneMap =
        {
            (HumanBodyBones.Hips, "hips"), (HumanBodyBones.Spine, "spine"), (HumanBodyBones.Chest, "chest"),
            (HumanBodyBones.UpperChest, "upperChest"), (HumanBodyBones.Neck, "neck"), (HumanBodyBones.Head, "head"),
            (HumanBodyBones.LeftEye, "leftEye"), (HumanBodyBones.RightEye, "rightEye"), (HumanBodyBones.Jaw, "jaw"),
            (HumanBodyBones.LeftShoulder, "leftShoulder"), (HumanBodyBones.LeftUpperArm, "leftUpperArm"),
            (HumanBodyBones.LeftLowerArm, "leftLowerArm"), (HumanBodyBones.LeftHand, "leftHand"),
            (HumanBodyBones.RightShoulder, "rightShoulder"), (HumanBodyBones.RightUpperArm, "rightUpperArm"),
            (HumanBodyBones.RightLowerArm, "rightLowerArm"), (HumanBodyBones.RightHand, "rightHand"),
            (HumanBodyBones.LeftUpperLeg, "leftUpperLeg"), (HumanBodyBones.LeftLowerLeg, "leftLowerLeg"),
            (HumanBodyBones.LeftFoot, "leftFoot"), (HumanBodyBones.LeftToes, "leftToes"),
            (HumanBodyBones.RightUpperLeg, "rightUpperLeg"), (HumanBodyBones.RightLowerLeg, "rightLowerLeg"),
            (HumanBodyBones.RightFoot, "rightFoot"), (HumanBodyBones.RightToes, "rightToes"),
            (HumanBodyBones.LeftThumbProximal, "leftThumbMetacarpal"), (HumanBodyBones.LeftThumbIntermediate, "leftThumbProximal"),
            (HumanBodyBones.LeftThumbDistal, "leftThumbDistal"),
            (HumanBodyBones.LeftIndexProximal, "leftIndexProximal"), (HumanBodyBones.LeftIndexIntermediate, "leftIndexIntermediate"),
            (HumanBodyBones.LeftIndexDistal, "leftIndexDistal"),
            (HumanBodyBones.LeftMiddleProximal, "leftMiddleProximal"), (HumanBodyBones.LeftMiddleIntermediate, "leftMiddleIntermediate"),
            (HumanBodyBones.LeftMiddleDistal, "leftMiddleDistal"),
            (HumanBodyBones.LeftRingProximal, "leftRingProximal"), (HumanBodyBones.LeftRingIntermediate, "leftRingIntermediate"),
            (HumanBodyBones.LeftRingDistal, "leftRingDistal"),
            (HumanBodyBones.LeftLittleProximal, "leftLittleProximal"), (HumanBodyBones.LeftLittleIntermediate, "leftLittleIntermediate"),
            (HumanBodyBones.LeftLittleDistal, "leftLittleDistal"),
            (HumanBodyBones.RightThumbProximal, "rightThumbMetacarpal"), (HumanBodyBones.RightThumbIntermediate, "rightThumbProximal"),
            (HumanBodyBones.RightThumbDistal, "rightThumbDistal"),
            (HumanBodyBones.RightIndexProximal, "rightIndexProximal"), (HumanBodyBones.RightIndexIntermediate, "rightIndexIntermediate"),
            (HumanBodyBones.RightIndexDistal, "rightIndexDistal"),
            (HumanBodyBones.RightMiddleProximal, "rightMiddleProximal"), (HumanBodyBones.RightMiddleIntermediate, "rightMiddleIntermediate"),
            (HumanBodyBones.RightMiddleDistal, "rightMiddleDistal"),
            (HumanBodyBones.RightRingProximal, "rightRingProximal"), (HumanBodyBones.RightRingIntermediate, "rightRingIntermediate"),
            (HumanBodyBones.RightRingDistal, "rightRingDistal"),
            (HumanBodyBones.RightLittleProximal, "rightLittleProximal"), (HumanBodyBones.RightLittleIntermediate, "rightLittleIntermediate"),
            (HumanBodyBones.RightLittleDistal, "rightLittleDistal"),
        };

        sealed class Rig
        {
            public GameObject Root;
            public Animator Animator;
            public SkinnedMeshRenderer Face;
            public List<(string vrm, Transform t)> Bones = new List<(string, Transform)>();
            public Dictionary<Transform, string> ByTransform = new Dictionary<Transform, string>();
            public List<(Transform t, SkeletonBone sk)> Skeleton;
        }

        enum Method { SampleAnimation, PlayableGraph, AnimationMode }

        public static void Dump()
        {
            string outPath = Arg("-lofiOut") ?? Path.Combine(Directory.GetCurrentDirectory(), "lofi-parity-dump.json");
            string timesPath = Arg("-lofiTimes") ?? Path.Combine(Directory.GetCurrentDirectory(), "lofi-times.txt");
            var times = ReadTimes(timesPath);
            var log = new StringBuilder();
            try
            {
                var json = Run(times, log);
                File.WriteAllText(outPath, json);
                File.WriteAllText(Path.Combine(Directory.GetCurrentDirectory(), "lofi-parity-dump.json"), json);
                Debug.Log("[LofiParity] wrote " + outPath + "\n" + log);
            }
            catch (Exception e)
            {
                Debug.LogError("[LofiParity] FAILED: " + e + "\n" + log);
                EditorApplication.Exit(2);
            }
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i + 1 < args.Length; i++) if (args[i] == name) return args[i + 1];
            return null;
        }

        // key -> times; file lines are "<key> <sourceFile> t0 t1 ...".
        static Dictionary<string, double[]> ReadTimes(string path)
        {
            var map = new Dictionary<string, double[]>();
            if (!File.Exists(path)) return map;
            foreach (var line in File.ReadAllLines(path))
            {
                var parts = line.Split(' ');
                if (parts.Length < 3) continue;
                var ts = new double[parts.Length - 2];
                for (int i = 2; i < parts.Length; i++) ts[i - 2] = double.Parse(parts[i], CultureInfo.InvariantCulture);
                map[parts[0]] = ts;
            }
            return map;
        }

        static string Run(Dictionary<string, double[]> times, StringBuilder log)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(FbxPath);
            if (prefab == null) throw new Exception("FBX prefab not found at " + FbxPath);
            var rig = BuildRig(prefab, log);
            try
            {
                var sb = new StringBuilder();
                sb.Append("{\"unityVersion\":").Append(Q(Application.unityVersion));
                sb.Append(",\"fbx\":").Append(Q(FbxPath));
                sb.Append(",\"avatar\":{\"isHuman\":").Append(rig.Animator.avatar.isHuman ? "true" : "false");
                sb.Append(",\"isValid\":").Append(rig.Animator.avatar.isValid ? "true" : "false");
                sb.Append(",\"humanScale\":").Append(F(rig.Animator.humanScale)).Append('}');
                sb.Append(",\"hierarchy\":").Append(HierarchyJson(rig.Root.transform));
                sb.Append(",\"boneMap\":{");
                bool first = true;
                foreach (var (vrm, t) in rig.Bones) { if (!first) sb.Append(','); first = false; sb.Append(Q(vrm)).Append(':').Append(Q(t.name)); }
                sb.Append("},\"parents\":{");
                first = true;
                foreach (var (vrm, t) in rig.Bones)
                {
                    if (!first) sb.Append(','); first = false;
                    sb.Append(Q(vrm)).Append(':').Append(Q(MappedParent(rig, t)));
                }
                sb.Append('}');

                ApplyTPose(rig, log);
                var rest = Capture(rig);
                sb.Append(",\"rest\":").Append(RotJson(rig, rest.rot));
                sb.Append(",\"restPosition\":").Append(PosJson(rig, rest.pos));
                sb.Append(",\"restLocalRotation\":").Append(LocalRotJson(rig));
                sb.Append(",\"restSource\":\"avatar.humanDescription.skeleton\"");
                sb.Append(",\"tposeMuscles\":").Append(MusclesJson(rig));
                ApplyMuscleZeroPose(rig);
                sb.Append(",\"muscleZeroPose\":").Append(RotJson(rig, Capture(rig).rot));
                sb.Append(",\"muscleZeroPosition\":").Append(PosJson(rig, Capture(rig).pos));
                ApplyTPose(rig, log);

                var method = ChooseMethod(rig, rest.rot, log);
                sb.Append(",\"samplingMethod\":").Append(Q(method.ToString()));
                sb.Append(",\"clips\":{");
                first = true;
                foreach (var (key, file, body) in Clips)
                {
                    string path = (body ? AnimatorDir : FaceDir) + file + ".anim";
                    var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(path);
                    if (clip == null) throw new Exception("clip not found: " + path);
                    double[] ts = times.TryGetValue(key, out var found) ? found : DefaultTimes(clip.length);
                    if (!first) sb.Append(','); first = false;
                    sb.Append(Q(key)).Append(':');
                    DumpClip(sb, rig, clip, file + ".anim", ts, body, method, log);
                    log.Append(key).Append(": ").Append(ts.Length).Append(" frames, clip.length=").Append(clip.length)
                       .Append(" humanMotion=").Append(clip.humanMotion).Append(" legacy=").Append(clip.legacy).Append('\n');
                }
                sb.Append("}}");
                return sb.ToString();
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(rig.Root);
            }
        }

        static double[] DefaultTimes(float length)
        {
            if (length <= 0) return new[] { 0.0 };
            int n = (int)Math.Ceiling(length * SampleRate);
            var ts = new double[n + 1];
            for (int i = 0; i < n; i++) ts[i] = i / (double)SampleRate;
            ts[n] = length;
            return ts;
        }

        static Rig BuildRig(GameObject prefab, StringBuilder log)
        {
            var rig = new Rig();
            rig.Root = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            rig.Root.transform.position = Vector3.zero;
            rig.Root.transform.rotation = Quaternion.identity;
            rig.Animator = rig.Root.GetComponent<Animator>() ?? rig.Root.GetComponentInChildren<Animator>();
            if (rig.Animator == null) throw new Exception("no Animator on FBX instance");
            if (rig.Animator.avatar == null || !rig.Animator.avatar.isHuman) throw new Exception("Animator avatar is not humanoid");
            rig.Animator.applyRootMotion = false;
            rig.Animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            foreach (var (bone, vrm) in BoneMap)
            {
                var t = rig.Animator.GetBoneTransform(bone);
                if (t == null) { log.Append("unmapped humanoid bone: ").Append(bone).Append('\n'); continue; }
                rig.Bones.Add((vrm, t));
                rig.ByTransform[t] = vrm;
            }
            foreach (var smr in rig.Root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                if (smr.name == FaceObject) rig.Face = smr;
            log.Append("face renderer: ").Append(rig.Face != null ? rig.Face.sharedMesh.blendShapeCount + " blendshapes" : "NOT FOUND").Append('\n');
            return rig;
        }

        // Nearest ancestor that is a mapped humanoid bone (UpperChest/Jaw are not
        // mapped on this avatar, so this already matches the converter's folding).
        static string MappedParent(Rig rig, Transform t)
        {
            for (var p = t.parent; p != null; p = p.parent)
                if (rig.ByTransform.TryGetValue(p, out var vrm)) return vrm;
            return "";
        }

        // Rest = the avatar's configured T-pose (humanDescription.skeleton), which is
        // what Unity's muscle space is defined against. NOTE: a HumanPose with all
        // muscles 0 is NOT the T-pose on this avatar (knees bent, arms forward);
        // see MuscleZeroPose() and tposeMuscles in the dump.
        static void ApplyTPose(Rig rig, StringBuilder log)
        {
            if (rig.Skeleton == null)
            {
                rig.Skeleton = new List<(Transform, SkeletonBone)>();
                var all = rig.Root.GetComponentsInChildren<Transform>(true);
                foreach (var sk in rig.Animator.avatar.humanDescription.skeleton)
                    foreach (var t in all)
                        if (t != rig.Root.transform && t.name == sk.name) { rig.Skeleton.Add((t, sk)); break; }
                log.Append("T-pose: applied ").Append(rig.Skeleton.Count).Append(" of ")
                   .Append(rig.Animator.avatar.humanDescription.skeleton.Length).Append(" skeleton entries\n");
            }
            foreach (var (t, sk) in rig.Skeleton)
            {
                t.localPosition = sk.position; t.localRotation = sk.rotation; t.localScale = sk.scale;
            }
            rig.Root.transform.position = Vector3.zero;
            rig.Root.transform.rotation = Quaternion.identity;
        }

        static void ApplyMuscleZeroPose(Rig rig)
        {
            var handler = new HumanPoseHandler(rig.Animator.avatar, rig.Root.transform);
            var pose = new HumanPose();
            handler.GetHumanPose(ref pose);
            var zero = new HumanPose { bodyPosition = pose.bodyPosition, bodyRotation = Quaternion.identity, muscles = new float[pose.muscles.Length] };
            handler.SetHumanPose(ref zero);
            handler.Dispose();
        }

        // Muscle readback of the current pose (only |value| > eps), for auditing.
        static string MusclesJson(Rig rig)
        {
            var handler = new HumanPoseHandler(rig.Animator.avatar, rig.Root.transform);
            var pose = new HumanPose();
            handler.GetHumanPose(ref pose);
            handler.Dispose();
            var sb = new StringBuilder("{");
            bool first = true;
            for (int i = 0; i < pose.muscles.Length; i++)
            {
                if (Mathf.Abs(pose.muscles[i]) < 1e-4f) continue;
                if (!first) sb.Append(','); first = false;
                sb.Append(Q(HumanTrait.MuscleName[i])).Append(':').Append(F(pose.muscles[i]));
            }
            return sb.Append('}').ToString();
        }

        static (Quaternion[] rot, Vector3[] pos) Capture(Rig rig)
        {
            var rot = new Quaternion[rig.Bones.Count];
            var pos = new Vector3[rig.Bones.Count];
            for (int i = 0; i < rig.Bones.Count; i++) { rot[i] = rig.Bones[i].t.rotation; pos[i] = rig.Bones[i].t.position; }
            return (rot, pos);
        }

        static float MaxAngle(Quaternion[] a, Quaternion[] b)
        {
            float m = 0;
            for (int i = 0; i < a.Length; i++) m = Mathf.Max(m, Quaternion.Angle(a[i], b[i]));
            return m;
        }

        // Verify a sampling method actually retargets the humanoid clip onto the rig:
        // sit at t=0 must move the pose away from the T-pose.
        static Method ChooseMethod(Rig rig, Quaternion[] rest, StringBuilder log)
        {
            var sit = AssetDatabase.LoadAssetAtPath<AnimationClip>(AnimatorDir + "bn0010_sit.anim");
            foreach (Method m in new[] { Method.SampleAnimation, Method.PlayableGraph, Method.AnimationMode })
            {
                try
                {
                    ApplyTPose(rig, log);
                    using (var s = new Sampler(rig, sit, m)) s.Sample(0f);
                    float changed = MaxAngle(rest, Capture(rig).rot);
                    log.Append("method ").Append(m).Append(": max bone change from T-pose at sit t=0 = ").Append(changed).Append(" deg\n");
                    if (changed > PoseChangeThresholdDeg) { ApplyTPose(rig, log); return m; }
                }
                catch (Exception e) { log.Append("method ").Append(m).Append(" threw: ").Append(e.Message).Append('\n'); }
            }
            throw new Exception("no sampling method changed the pose");
        }

        sealed class Sampler : IDisposable
        {
            readonly Rig rig; readonly AnimationClip clip; readonly Method method;
            PlayableGraph graph; AnimationClipPlayable playable;

            public Sampler(Rig rig, AnimationClip clip, Method method)
            {
                this.rig = rig; this.clip = clip; this.method = method;
                if (method == Method.PlayableGraph)
                {
                    graph = PlayableGraph.Create("LofiParity");
                    graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
                    playable = AnimationClipPlayable.Create(graph, clip);
                    playable.SetApplyFootIK(false);
                    playable.SetApplyPlayableIK(false);
                    var output = AnimationPlayableOutput.Create(graph, "out", rig.Animator);
                    output.SetSourcePlayable(playable);
                    graph.Play();
                }
                else if (method == Method.AnimationMode)
                {
                    AnimationMode.StartAnimationMode();
                }
            }

            public void Sample(float t)
            {
                switch (method)
                {
                    case Method.SampleAnimation:
                        clip.SampleAnimation(rig.Root, t);
                        break;
                    case Method.PlayableGraph:
                        playable.SetTime(t);
                        playable.Play();
                        graph.Evaluate(0f);
                        break;
                    case Method.AnimationMode:
                        AnimationMode.BeginSampling();
                        AnimationMode.SampleAnimationClip(rig.Root, clip, t);
                        AnimationMode.EndSampling();
                        break;
                }
            }

            public void Dispose()
            {
                if (method == Method.PlayableGraph && graph.IsValid()) graph.Destroy();
                if (method == Method.AnimationMode && AnimationMode.InAnimationMode()) AnimationMode.StopAnimationMode();
            }
        }

        static void DumpClip(StringBuilder sb, Rig rig, AnimationClip clip, string sourceFile, double[] ts, bool body, Method method, StringBuilder log)
        {
            int n = rig.Bones.Count;
            var rots = new List<Quaternion>[n];
            var hips = new List<Vector3>();
            var bodyRot = new List<Quaternion>();
            var bodyPos = new List<Vector3>();
            var face = new Dictionary<string, float[]>();
            for (int i = 0; i < n; i++) rots[i] = new List<Quaternion>(ts.Length);
            int hipsIndex = rig.Bones.FindIndex(b => b.vrm == "hips");
            var handler = new HumanPoseHandler(rig.Animator.avatar, rig.Root.transform);
            var pose = new HumanPose();
            string[] morphNames = null;
            string frame0Muscles = "{}";
            if (rig.Face != null)
            {
                morphNames = new string[rig.Face.sharedMesh.blendShapeCount];
                for (int i = 0; i < morphNames.Length; i++) morphNames[i] = rig.Face.sharedMesh.GetBlendShapeName(i);
            }
            // Face clips are plain generic clips; SampleAnimation binds their
            // blendShape.* curves directly. Body clips use the verified method.
            var m = body ? method : Method.SampleAnimation;
            ApplyTPose(rig, log);
            if (rig.Face != null) for (int i = 0; i < morphNames.Length; i++) rig.Face.SetBlendShapeWeight(i, 0f);
            using (var s = new Sampler(rig, clip, m))
            {
                for (int f = 0; f < ts.Length; f++)
                {
                    s.Sample((float)ts[f]);
                    if (f == 0) frame0Muscles = MusclesJson(rig);
                    for (int i = 0; i < n; i++) rots[i].Add(rig.Bones[i].t.rotation);
                    if (hipsIndex >= 0) hips.Add(rig.Bones[hipsIndex].t.position);
                    handler.GetHumanPose(ref pose);
                    bodyRot.Add(pose.bodyRotation); bodyPos.Add(pose.bodyPosition);
                    if (rig.Face != null)
                        for (int i = 0; i < morphNames.Length; i++)
                        {
                            float w = rig.Face.GetBlendShapeWeight(i);
                            if (Mathf.Abs(w) < 1e-6f && !face.ContainsKey(morphNames[i])) continue;
                            if (!face.TryGetValue(morphNames[i], out var arr)) { arr = new float[ts.Length]; face[morphNames[i]] = arr; }
                            arr[f] = w;
                        }
                }
            }
            handler.Dispose();
            ApplyTPose(rig, log);

            sb.Append("{\"sourceFile\":").Append(Q(sourceFile));
            sb.Append(",\"length\":").Append(F(clip.length));
            sb.Append(",\"humanMotion\":").Append(clip.humanMotion ? "true" : "false");
            sb.Append(",\"method\":").Append(Q(m.ToString()));
            sb.Append(",\"frame0Muscles\":").Append(frame0Muscles);
            sb.Append(",\"times\":[");
            for (int f = 0; f < ts.Length; f++) { if (f > 0) sb.Append(','); sb.Append(ts[f].ToString("R", CultureInfo.InvariantCulture)); }
            sb.Append("],\"bones\":{");
            for (int i = 0; i < n; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append(Q(rig.Bones[i].vrm)).Append(":[");
                for (int f = 0; f < rots[i].Count; f++)
                {
                    var q = rots[i][f];
                    if (f > 0) sb.Append(',');
                    sb.Append(F(q.x)).Append(',').Append(F(q.y)).Append(',').Append(F(q.z)).Append(',').Append(F(q.w));
                }
                sb.Append(']');
            }
            sb.Append("},\"hipsPosition\":[");
            for (int f = 0; f < hips.Count; f++) { if (f > 0) sb.Append(','); sb.Append(F(hips[f].x)).Append(',').Append(F(hips[f].y)).Append(',').Append(F(hips[f].z)); }
            sb.Append("],\"bodyRotation\":[");
            for (int f = 0; f < bodyRot.Count; f++) { var q = bodyRot[f]; if (f > 0) sb.Append(','); sb.Append(F(q.x)).Append(',').Append(F(q.y)).Append(',').Append(F(q.z)).Append(',').Append(F(q.w)); }
            sb.Append("],\"bodyPosition\":[");
            for (int f = 0; f < bodyPos.Count; f++) { var p = bodyPos[f]; if (f > 0) sb.Append(','); sb.Append(F(p.x)).Append(',').Append(F(p.y)).Append(',').Append(F(p.z)); }
            sb.Append("],\"face\":{");
            bool first = true;
            foreach (var kv in face)
            {
                if (!first) sb.Append(','); first = false;
                sb.Append(Q(kv.Key)).Append(":[");
                for (int f = 0; f < kv.Value.Length; f++) { if (f > 0) sb.Append(','); sb.Append(F(kv.Value[f])); }
                sb.Append(']');
            }
            sb.Append("}}");
        }

        static string RotJson(Rig rig, Quaternion[] rot)
        {
            var sb = new StringBuilder("{");
            for (int i = 0; i < rig.Bones.Count; i++)
            {
                if (i > 0) sb.Append(',');
                var q = rot[i];
                sb.Append(Q(rig.Bones[i].vrm)).Append(":[").Append(F(q.x)).Append(',').Append(F(q.y)).Append(',').Append(F(q.z)).Append(',').Append(F(q.w)).Append(']');
            }
            return sb.Append('}').ToString();
        }

        static string LocalRotJson(Rig rig)
        {
            var sb = new StringBuilder("{");
            for (int i = 0; i < rig.Bones.Count; i++)
            {
                if (i > 0) sb.Append(',');
                var q = rig.Bones[i].t.localRotation;
                sb.Append(Q(rig.Bones[i].vrm)).Append(":[").Append(F(q.x)).Append(',').Append(F(q.y)).Append(',').Append(F(q.z)).Append(',').Append(F(q.w)).Append(']');
            }
            return sb.Append('}').ToString();
        }

        static string PosJson(Rig rig, Vector3[] pos)
        {
            var sb = new StringBuilder("{");
            for (int i = 0; i < rig.Bones.Count; i++)
            {
                if (i > 0) sb.Append(',');
                var p = pos[i];
                sb.Append(Q(rig.Bones[i].vrm)).Append(":[").Append(F(p.x)).Append(',').Append(F(p.y)).Append(',').Append(F(p.z)).Append(']');
            }
            return sb.Append('}').ToString();
        }

        static string HierarchyJson(Transform t)
        {
            var sb = new StringBuilder("[");
            Walk(t, 0, sb, true);
            return sb.Append(']').ToString();
        }

        static bool Walk(Transform t, int depth, StringBuilder sb, bool first)
        {
            if (!first) sb.Append(',');
            sb.Append(Q(new string(' ', depth) + t.name));
            first = false;
            for (int i = 0; i < t.childCount; i++) Walk(t.GetChild(i), depth + 1, sb, false);
            return first;
        }

        static string F(float v) => ((double)v).ToString("R", CultureInfo.InvariantCulture);

        static string Q(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }
    }
}
