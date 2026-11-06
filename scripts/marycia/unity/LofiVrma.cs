// LofiVrma: export the Marycia humanoid clips as VRM Animation (.vrma) with
// UniVRM's VrmAnimationExporter (UniVRM >= v0.131, VRM10 package), driven
// headlessly. The approach mirrors malaybaku/AnimationClipToVrmaSample
// (MIT) AnimationClipToVrmaCore, but samples at 60 Hz, keeps pose clips
// (length 0) as a 2-key constant animation, and drives the clip on a
// bone-only copy of the Marycia FBX that keeps Marycia's own Avatar asset
// (so her twist/limit settings are used, not a default-built avatar).
// Run: Unity -batchmode -nographics -quit -projectPath <proj>
//      -executeMethod Lofi.LofiVrma.Export -lofiVrmaOut <dir>
// Output stays outside the repo: it embeds the skeleton node names/positions.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UniGLTF;
using UnityEditor;
using UnityEngine;
using UniVRM10;

namespace Lofi
{
    public static class LofiVrma
    {
        const string FbxPath = "Assets/BeroarN/bn0010_Marycia/fbx/bn0010_Marycia.fbx";
        const string AnimatorDir = "Assets/BeroarN/bn0010_Marycia/animation/Anim_Animator/";
        const float SampleRate = 60f;
        static readonly string[] BodyClips =
        {
            "bn0010_sit", "bn0010_stand_still", "bn0010_AFK", "bn0010_hands_idle",
            "bn0010_hands_peace", "bn0010_hands_thumbs_up", "bn0010_hands_Heart", "bn0010_hands_Heart_Tip",
        };

        public static void Export()
        {
            string outDir = Arg("-lofiVrmaOut") ?? Path.Combine(Directory.GetCurrentDirectory(), "vrma");
            var log = new StringBuilder();
            GameObject skeleton = null;
            try
            {
                Directory.CreateDirectory(outDir);
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(FbxPath);
                if (prefab == null) throw new Exception("FBX prefab not found: " + FbxPath);
                skeleton = BuildBoneOnlyCopy(prefab, log);
                var animator = skeleton.GetComponent<Animator>();
                foreach (var name in BodyClips)
                {
                    var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(AnimatorDir + name + ".anim");
                    if (clip == null) throw new Exception("clip not found: " + name);
                    var bytes = Create(animator, clip, log);
                    var path = Path.Combine(outDir, name + ".vrma");
                    File.WriteAllBytes(path, bytes);
                    log.Append("wrote ").Append(path).Append(" (").Append(bytes.Length).Append(" bytes)\n");
                }
                File.WriteAllText(Path.Combine(outDir, "export-log.txt"), log.ToString());
                Debug.Log("[LofiVrma] done\n" + log);
            }
            catch (Exception e)
            {
                Debug.LogError("[LofiVrma] FAILED: " + e + "\n" + log);
                EditorApplication.Exit(2);
            }
            finally
            {
                if (skeleton != null) UnityEngine.Object.DestroyImmediate(skeleton);
            }
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i + 1 < args.Length; i++) if (args[i] == name) return args[i + 1];
            return null;
        }

        // Instantiate the FBX, drop every component except Transform/Animator and
        // every branch that holds no humanoid bone, then re-attach the FBX's own
        // Avatar (bone names and T-pose are unchanged, so it stays valid).
        static GameObject BuildBoneOnlyCopy(GameObject prefab, StringBuilder log)
        {
            var src = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            PrefabUtility.UnpackPrefabInstance(src, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);
            var srcAnimator = src.GetComponent<Animator>();
            var avatar = srcAnimator.avatar;
            var keep = new HashSet<Transform>();
            for (var b = HumanBodyBones.Hips; b < HumanBodyBones.LastBone; b++)
            {
                var t = srcAnimator.GetBoneTransform(b);
                for (; t != null; t = t.parent) keep.Add(t);
            }
            foreach (var sk in avatar.humanDescription.skeleton)
                foreach (var t in src.GetComponentsInChildren<Transform>(true))
                    if (t.name == sk.name && t != src.transform) { t.localPosition = sk.position; t.localRotation = sk.rotation; t.localScale = sk.scale; }
            int removedBranches = 0;
            foreach (var t in src.GetComponentsInChildren<Transform>(true))
                if (t != null && !keep.Contains(t) && (t.parent == null || keep.Contains(t.parent))) { UnityEngine.Object.DestroyImmediate(t.gameObject); removedBranches++; }
            int removedComponents = 0;
            foreach (var t in src.GetComponentsInChildren<Transform>(true))
            {
                removedComponents += GameObjectUtility.RemoveMonoBehavioursWithMissingScript(t.gameObject);
                foreach (var c in t.GetComponents<Component>())
                    if (c != null && !(c is Transform) && !(c is Animator)) { UnityEngine.Object.DestroyImmediate(c); removedComponents++; }
            }
            src.transform.position = Vector3.zero;
            src.transform.rotation = Quaternion.identity;
            srcAnimator.avatar = avatar;
            srcAnimator.applyRootMotion = false;
            if (!srcAnimator.isHuman || srcAnimator.GetBoneTransform(HumanBodyBones.Hips) == null)
                throw new Exception("bone-only copy lost its humanoid avatar");
            log.Append("bone-only copy: removed ").Append(removedBranches).Append(" branches, ").Append(removedComponents)
               .Append(" components; nodes left ").Append(src.GetComponentsInChildren<Transform>(true).Length).Append('\n');
            return src;
        }

        static byte[] Create(Animator humanoid, AnimationClip clip, StringBuilder log)
        {
            var data = new ExportingGltfData();
            using var exporter = new VrmAnimationExporter(data, new GltfExportSettings());
            exporter.Prepare(humanoid.gameObject);
            var go = humanoid.gameObject;
            exporter.Export(anim =>
            {
                var map = new Dictionary<HumanBodyBones, Transform>();
                for (var b = HumanBodyBones.Hips; b < HumanBodyBones.LastBone; b++)
                {
                    var t = humanoid.GetBoneTransform(b);
                    if (t != null) map.Add(b, t);
                }
                var root = humanoid.avatarRoot != null ? humanoid.avatarRoot.transform : humanoid.transform;
                anim.SetPositionBoneAndParent(map[HumanBodyBones.Hips], root);
                foreach (var kv in map)
                {
                    var vrmBone = Vrm10HumanoidBoneSpecification.ConvertFromUnityBone(kv.Key);
                    anim.AddRotationBoneAndParent(kv.Key, kv.Value, ParentBone(map, vrmBone) ?? root);
                }
                int frames = Mathf.Max(2, Mathf.CeilToInt(clip.length * SampleRate) + 1);
                for (int i = 0; i < frames; i++)
                {
                    float t = Mathf.Min(i / SampleRate, Mathf.Max(clip.length, (frames - 1) / SampleRate));
                    clip.SampleAnimation(go, t);
                    anim.AddFrame(TimeSpan.FromSeconds(t));
                }
                log.Append(clip.name).Append(": ").Append(frames).Append(" frames, ").Append(map.Count).Append(" bones\n");
            });
            return data.ToGlbBytes();
        }

        static Transform ParentBone(Dictionary<HumanBodyBones, Transform> map, Vrm10HumanoidBones bone)
        {
            while (bone != Vrm10HumanoidBones.Hips)
            {
                var parent = Vrm10HumanoidBoneSpecification.GetDefine(bone).ParentBone.Value;
                if (map.TryGetValue(Vrm10HumanoidBoneSpecification.ConvertToUnityBone(parent), out var found)) return found;
                bone = parent;
            }
            return null;
        }
    }
}
