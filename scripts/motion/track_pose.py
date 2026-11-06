"""Track a reference video with MediaPipe PoseLandmarker (VIDEO mode) and save per-frame
world landmarks (metres, hip-centred) + image landmarks + visibility as JSON.
Usage: python track_pose.py <video> <model.task> <out.json> [overlay_dir]"""
import sys, json, cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions
video, model, out = sys.argv[1:4]; overlay = sys.argv[4] if len(sys.argv) > 4 else None
opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=model), running_mode=vision.RunningMode.VIDEO,
    num_poses=1, min_pose_detection_confidence=.5, min_tracking_confidence=.5, output_segmentation_masks=False)
cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS); frames = []
names = [n.name for n in vision.PoseLandmark]
conn = [(a, b) for a, b in [(11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28),(0,11),(0,12)]]
with vision.PoseLandmarker.create_from_options(opts) as lm:
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok: break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(i * 1000 / fps))
        if res.pose_world_landmarks:
            w = res.pose_world_landmarks[0]; n = res.pose_landmarks[0]
            frames.append({'t': i / fps, 'world': [[p.x, p.y, p.z] for p in w], 'image': [[p.x, p.y] for p in n], 'vis': [p.visibility for p in w]})
            if overlay and i % 25 == 0:
                h, wd = frame.shape[:2]
                for a, b in conn: cv2.line(frame, (int(n[a].x*wd), int(n[a].y*h)), (int(n[b].x*wd), int(n[b].y*h)), (0,255,0), 4)
                cv2.imwrite(f'{overlay}/ov{i:04d}.jpg', cv2.resize(frame, (480, 270)))
        else:
            frames.append({'t': i / fps, 'world': None})
        i += 1
json.dump({'fps': fps, 'landmarks': names, 'frames': frames}, open(out, 'w'))
good = sum(1 for f in frames if f['world']); print(json.dumps({'frames': len(frames), 'tracked': good, 'fps': fps}))
