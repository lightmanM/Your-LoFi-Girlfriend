"""Build the wind layers for the web from the renders of render_web_plate.py (STEPS=['wind']). Runs in Blender's
Python (numpy), live via MCP: exec(open(...).read(), {'OUT': '<balcony-toon folder>'}).
Writes:
  plate-clean-a.png  the plate without the swaying plants, alpha = how much of each pixel is plant (any group)
  wind-field.png     half size; R: flex (0 anchor .. 1 tips), smoothly extended a little past each plant so the
                     displacement field has no edges; G palm, B ivy, A balcony plants (roses and pots): soft weights
"""
import bpy, numpy as np, pathlib
OUT = pathlib.Path(globals()['OUT'])
SPREAD = 110         # px at full size: how far the weights and flex reach past a plant's silhouette (> largest swing)


def load(name):
    im = bpy.data.images.load(str(OUT / name), check_existing=False); im.colorspace_settings.name = 'Non-Color'
    a = np.empty(im.size[0] * im.size[1] * 4, np.float32); im.pixels.foreach_get(a); w, h = im.size; bpy.data.images.remove(im)
    return a.reshape(h, w, 4)


def save(name, arr, srgb=False):
    h, w = arr.shape[:2]; im = bpy.data.images.new(name, w, h, alpha=True, float_buffer=False)
    im.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    im.pixels.foreach_set(np.ascontiguousarray(arr, np.float32).ravel()); im.filepath_raw = str(OUT / name); im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)


def box(a, r):
    """Box blur of radius r along both axes (cumulative sums); three passes approximate a gaussian."""
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(a.ndim)], mode='edge'), axis=axis)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis); lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        a = (hi - lo) / (2 * r + 1)
    return a


def soft(a, r):
    for _ in range(3): a = box(a, r)
    return a


mask = load('plant-mask.png')                       # R palm, G ivy, B roses, A pots (coverage)
flex = load('plant-flex.png')[..., 0]
clean = load('plate-clean.png')
any_ = np.clip(mask.max(axis=2), 0, 1)
clean[..., 3] = any_
save('plate-clean-a.png', clean, srgb=True)

half = lambda a: a.reshape(a.shape[0] // 2, 2, a.shape[1] // 2, 2).mean(axis=(1, 3))
r = SPREAD // 2 // 3 + 1                             # per box pass, at half size
groups = [mask[..., 0], mask[..., 1], np.maximum(mask[..., 2], (mask[..., 3] > .8) * mask[..., 3])]   # palm, ivy, balcony
weights = []
for g in groups:
    b = half((g > .5).astype(np.float32))
    weights.append(np.clip(soft(b, r) * 2.2, 0, 1))
solid = half((any_ > .5).astype(np.float32)); fl = half(flex * (any_ > .5))
num, den = soft(fl, r), soft(solid, r)
F = np.where(den > 1e-4, num / np.maximum(den, 1e-4), 0)
field = np.stack([np.clip(F, 0, 1), weights[0], weights[1], weights[2]], axis=2)
save('wind-field.png', field)
print({'clean_alpha_mean': float(any_.mean()), 'field': field.shape, 'flex_max': float(F.max())})

# depth: widen near surfaces by 3 px so the dithered sheer curtain reads as solid (plants.js uses depth-min.png)
if (OUT / 'depth.png').exists():
    d = load('depth.png')[..., 0]; r = 3; p = np.pad(d, r, mode='edge'); m = d.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1): m = np.minimum(m, p[r + dy:r + dy + d.shape[0], r + dx:r + dx + d.shape[1]])
    save('depth-min.png', np.stack([m, m, m, np.ones_like(m)], axis=2))

# --- full plants and cover maps (render_web_plate.py STEPS 'full' and 'cover') ---
#   palm-full.png    the palm alone, whole, half size, rendered OVERSCAN wider than the picture (fronds past the edge)
#   plants-full.png  ivy, roses and pots alone, whole, half size each, stacked bottom to top (row = mask channel - 1)
#   cover.png        R + G/255: distance to the first opaque surface (no plants, no sheer), as log2(d)/log2(64);
#                    B: how much the sheer curtain covers (every plant behind it is past sheer_near_m); full size, lossless
def half_rgba(im):
    """Half size without light fringes: colour averaged by coverage (the renders' transparent pixels are white)."""
    a = half(im[..., 3]); sa = soft(a, 3); rgb = []
    for c in range(3):           # colour also spread a little past the edge, so filtering never mixes in black
        pre = half(im[..., c] * im[..., 3]); rgb.append(np.where(a > .02, pre / np.maximum(a, 1e-4), soft(pre, 3) / np.maximum(sa, 1e-4)))
    return np.stack([np.clip(c, 0, 1) for c in rgb] + [a], axis=2)


if (OUT / 'plant-full-ivy.png').exists():
    pf = load('plant-full-palm.png'); pf = pf[:pf.shape[0] // 2 * 2, :pf.shape[1] // 2 * 2]
    save('palm-full.png', half_rgba(pf), srgb=True)
    rows = []
    for g in ('ivy', 'roses', 'pots'):
        rows.append(half_rgba(load(f'plant-full-{g}.png')))
    save('plants-full.png', np.concatenate(rows, axis=0), srgb=True)
if (OUT / 'cover-sheer.png').exists():
    op = load('cover-opaque.png')[..., 0]; sh = load('cover-sheer.png'); cov = np.clip(sh[..., 1], 0, 1)
    cov = np.clip(soft(cov, 2), 0, 1)
    sd = np.where(sh[..., 1] > .02, sh[..., 0], 1.0)
    for axis in (0, 1):            # min filter, 5 px: fill the gaps of the dithered sheer
        sd = np.min(np.stack([np.roll(sd, k, axis=axis) for k in range(-2, 3)]), axis=0)
    sd = np.where(cov > .02, sd, 1.0)
    hi = np.floor(np.clip(op, 0, 1) * 255) / 255; lo = (np.clip(op, 0, 1) - hi) * 255   # 16-bit distance: R coarse, G fine
    save('cover.png', np.stack([hi, lo, cov, np.ones_like(op)], axis=2))
    print({'sheer_near_m': float(64 ** sd[cov > .05].min()) if (cov > .05).any() else None})
    print({'sheer_cov_max': float(cov.max()), 'sheer_cov_mean_where': float(cov[cov > .05].mean()) if (cov > .05).any() else 0})
