"""Checks for the stand-in files that let a fresh clone run (run: python3 -m unittest discover -s scripts/standins)."""
import json
import struct
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VIVI = REPO / "web" / "public" / "standin" / "vivi.vrm"
ORIGINAL = "e150a8b:web/public/models/vivi/vivi.vrm"   # the CC0 file as first added (private history)
MAX_BYTES = 6 * 1024 * 1024


def glb_json(data: bytes) -> dict:
    assert data[:4] == b"glTF", "not a glTF binary"
    n = struct.unpack("<I", data[12:16])[0]
    return json.loads(data[20:20 + n])


class ViviStandin(unittest.TestCase):
    def test_vivi_standin_is_small_and_whole(self):
        data = VIVI.read_bytes()
        self.assertLessEqual(len(data), MAX_BYTES, f"{len(data)} bytes")
        doc = glb_json(data)
        self.assertIn("VRM", doc.get("extensions", {}))
        self.assertTrue(doc["images"])
        self.assertTrue(all(i.get("mimeType") == "image/webp" for i in doc["images"]))
        try:
            original = subprocess.run(["git", "show", ORIGINAL], cwd=REPO, capture_output=True, check=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.skipTest("the original Vivi file is not in this clone's history")
        before = glb_json(original)
        self.assertEqual(len(doc["meshes"]), len(before["meshes"]))
        self.assertEqual(len(doc.get("skins", [])), len(before.get("skins", [])))
        self.assertEqual(len(doc["images"]), len(before["images"]))

    def test_vivi_faces_forward_like_a_vrm1_model(self):
        doc = glb_json(VIVI.read_bytes())
        roots = doc["scenes"][doc.get("scene", 0)]["nodes"]
        self.assertEqual(len(roots), 1)
        root = doc["nodes"][roots[0]]
        self.assertEqual(root.get("name"), "LofiFacesForward")
        x, y, z, w = root["rotation"]
        self.assertAlmostEqual(abs(y), 1.0, places=6)   # half a turn about Y
        self.assertTrue(len(root["children"]) >= 2)

    def test_vivi_licence_is_recorded(self):
        credits = (VIVI.parent / "CREDITS.md").read_text()
        for needle in ("pixiv", "CC0", "AvatarSample_2", "sha256"):
            self.assertIn(needle, credits)


if __name__ == "__main__":
    unittest.main()
