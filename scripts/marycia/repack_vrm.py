"""Write a copy of a VRM (glTF binary) with its texture images replaced, e.g. by WebP files. Everything else (mesh,
skin, expressions, VRM and MToon extensions) is copied byte for byte. The original file is only read.
  python3 scripts/marycia/repack_vrm.py in.vrm out.vrm image0.webp image1.webp ...   (one file per image, in order)
Images are declared through EXT_texture_webp (supported by three.js GLTFLoader)."""
import json, struct, sys


def read_glb(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF', 'not a glTF binary'
    n = struct.unpack('<I', b[12:16])[0]
    doc = json.loads(b[20:20 + n])
    m = struct.unpack('<I', b[20 + n:24 + n])[0]
    return doc, b[28 + n:28 + n + m]


def write_glb(path, doc, binary):
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4); binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(binary), b'BIN\0')); f.write(binary)


def repack(src, dst, images):
    doc, binary = read_glb(src)
    assert len(images) == len(doc['images']), f"{len(doc['images'])} images in the model, {len(images)} given"
    replace = {doc['images'][i]['bufferView']: open(p, 'rb').read() for i, p in enumerate(images)}
    out = bytearray(); views = []
    for i, v in enumerate(doc['bufferViews']):
        data = replace.get(i, binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])
        out += b'\0' * (-len(out) % 4)
        nv = {**v, 'byteOffset': len(out), 'byteLength': len(data)}; views.append(nv); out += data
    doc['bufferViews'] = views; doc['buffers'][0]['byteLength'] = len(out)
    webp = any(p.endswith('.webp') for p in images)
    for i, p in enumerate(images):
        if p.endswith('.webp'): doc['images'][i]['mimeType'] = 'image/webp'
    if webp:
        for t in doc.get('textures', []):
            if 'source' in t and doc['images'][t['source']].get('mimeType') == 'image/webp':
                t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': t['source']}
        doc.setdefault('extensionsUsed', [])
        if 'EXT_texture_webp' not in doc['extensionsUsed']: doc['extensionsUsed'].append('EXT_texture_webp')
    write_glb(dst, doc, bytes(out))
    return len(open(dst, 'rb').read())


if __name__ == '__main__':
    print(repack(sys.argv[1], sys.argv[2], sys.argv[3:]))
