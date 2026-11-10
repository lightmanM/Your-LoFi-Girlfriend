"""Compress the stand-in character (Vivi, pixiv VRoid beta AvatarSample_2, CC0) for the public repo: every texture is
re-encoded as WebP (quality 85, at most 2048 px on its longest side) and the model is repacked byte for byte otherwise
(scripts/marycia/repack_vrm.py). Her scene is then wrapped in one root turned half a turn about Y, so this VRM 0.x
model faces +Z like a VRM 1 model and the page's motion turns her bones the right way (web/public/standin/standin.json
says "facesForward"). Needs cwebp (brew install webp).
  python3 scripts/standins/compress_vivi.py <original vivi.vrm> web/public/standin/vivi.vrm"""
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPACK = HERE.parent / "marycia" / "repack_vrm.py"
QUALITY, LONGEST = 85, 2048


def read_glb(path: Path) -> tuple[dict, bytes]:
    b = path.read_bytes()
    if b[:4] != b"glTF":
        raise SystemExit(f"{path}: not a glTF binary")
    n = struct.unpack("<I", b[12:16])[0]
    m = struct.unpack("<I", b[20 + n:24 + n])[0]
    return json.loads(b[20:20 + n]), b[28 + n:28 + n + m]


def write_glb(path: Path, doc: dict, binary: bytes) -> None:
    """A glTF binary from its JSON and BIN chunks (each padded to 4 bytes)."""
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<I", len(js)) + b"JSON" + js
                     + struct.pack("<I", len(binary)) + b"BIN\0" + binary)


def face_forward(doc: dict) -> dict:
    """A copy of the document whose scene hangs from one new root turned half a turn about Y."""
    scene_index = doc.get("scene", 0)
    roots = doc["scenes"][scene_index]["nodes"]
    nodes = [*doc["nodes"], {"name": "LofiFacesForward", "rotation": [0, 1, 0, 0], "children": list(roots)}]
    scenes = [dict(sc, nodes=[len(nodes) - 1]) if i == scene_index else sc for i, sc in enumerate(doc["scenes"])]
    return {**doc, "nodes": nodes, "scenes": scenes}


def image_size(data: bytes) -> tuple[int, int]:
    """Width and height of a PNG or JPEG."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    i = 2
    while i < len(data):   # JPEG: walk the markers to a start-of-frame
        marker, size = data[i + 1], struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        i += 2 + size
    raise SystemExit("an image is neither PNG nor JPEG")


def to_webp(data: bytes, folder: Path, index: int) -> Path:
    src, out = folder / f"image{index}.src", folder / f"image{index}.webp"
    src.write_bytes(data)
    w, h = image_size(data)
    resize = ["-resize", str(LONGEST), "0"] if w >= h and w > LONGEST else ["-resize", "0", str(LONGEST)] if h > LONGEST else []
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), *resize, str(src), "-o", str(out)], check=True)
    return out


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    doc, binary = read_glb(src)
    with tempfile.TemporaryDirectory() as d:
        webps = []
        for k, img in enumerate(doc["images"]):
            view = doc["bufferViews"][img["bufferView"]]
            start = view.get("byteOffset", 0)
            webps.append(to_webp(binary[start:start + view["byteLength"]], Path(d), k))
        dst.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, str(REPACK), str(src), str(dst), *map(str, webps)], check=True)
    packed, binary = read_glb(dst)
    write_glb(dst, face_forward(packed), binary)
    print(f"{dst}: {dst.stat().st_size / 1048576:.1f} MB (from {src.stat().st_size / 1048576:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
