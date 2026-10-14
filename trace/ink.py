"""Step 2: turn the photo and mask into ordered pen strokes: outline, contour lines, then five hatching passes."""
import argparse, os
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("photo", help="path to the source photo (not included in this repo)")
ap.add_argument("--work", default="work", help="folder for intermediate files (git-ignored)")
ap.add_argument("--out", default="data/portrait.json")
ap.add_argument("--preview", default="docs/trace.png")
args = ap.parse_args()
import cv2, numpy as np, json, math, sys
from PIL import Image, ImageOps
from skimage.morphology import skeletonize
im = np.array(ImageOps.exif_transpose(Image.open(args.photo)).convert('RGB'))
crop = im[740:1440, 600:1180]
H, W = crop.shape[:2]
mask = cv2.imread(os.path.join(args.work, 'mask.png'), 0)
mask = cv2.GaussianBlur(mask, (0,0), 3.5) > 127
gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
gray = cv2.createCLAHE(2.0, (8,8)).apply(gray)
soft = cv2.GaussianBlur(cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY), (0,0), 2.5).astype(float)/255
inner = cv2.erode(mask.astype(np.uint8), np.ones((7,7),np.uint8)) > 0

import sys; sys.setrecursionlimit(20000)
def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); ab = b-a; L = np.hypot(*ab)
    P = np.array(pts)
    d = np.abs(ab[0]*(P[:,1]-a[1]) - ab[1]*(P[:,0]-a[0]))/L if L > 0 else np.hypot(*(P-a).T)
    i = int(np.argmax(d))
    if d[i] > eps: return rdp(pts[:i+1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

strokes = []  # list of (kind, points)
# 1 silhouette
cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
c = max(cs, key=len)[:,0,:].tolist()
# drop the parts of the silhouette that lie on the crop border
seg, out = [], []
for p in c:
    edge = p[0] <= 1 or p[1] <= 1 or p[0] >= W-2 or p[1] >= H-2
    if edge:
        if len(seg) > 8: out.append(seg)
        seg = []
    else: seg.append(p)
if len(seg) > 8: out.append(seg)
for s in out: strokes.append(('line', rdp(s, 1.2)))

# 2 interior ink lines (difference of gaussians on the photo)
g = gray.astype(float)/255
def inkmap(s1, s2, th, region, minarea):
    d = cv2.GaussianBlur(g,(0,0),s1) - cv2.GaussianBlur(g,(0,0),s2)
    L = ((d < th) & region).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(L)
    k = np.zeros_like(L)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= minarea: k[lab == i] = 1
    return k
face = np.zeros_like(inner); face[180:430, 285:490] = True
hands = np.zeros_like(inner); hands[320:420, 360:470] = True; hands[470:610, 370:480] = True
near = cv2.dilate(mask.astype(np.uint8), np.ones((3,3),np.uint8)) > 0
keep = inkmap(1.6, 3.2, -0.03, ~face & ~hands & inner, 110) | inkmap(1.0, 2.0, -0.009, face & near, 10) | inkmap(1.1, 2.2, -0.016, hands & inner, 16)
sk = skeletonize(keep > 0)
ys, xs = np.nonzero(sk); S = set(zip(xs.tolist(), ys.tolist()))
nb = [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]
deg = lambda p: sum((p[0]+dx, p[1]+dy) in S for dx, dy in nb)
seen = set()
def walk(p):
    path = [p]; seen.add(p)
    while True:
        nxt = [(p[0]+dx, p[1]+dy) for dx, dy in nb if (p[0]+dx, p[1]+dy) in S and (p[0]+dx, p[1]+dy) not in seen]
        if not nxt: return path
        p = nxt[0]; seen.add(p); path.append(p)
for p in sorted(S, key=deg):
    if p in seen: continue
    path = walk(p)
    fine = any(face[q[1], q[0]] or hands[q[1], q[0]] for q in path)
    if len(path) >= (5 if fine else 26): strokes.append(('line', rdp([list(q) for q in path], 0.7 if fine else 1.1)))

# 3 hatching: five tone passes, each drawn only where the photo is darker than its threshold
def hatch(angle, spacing, thresh, minrun=5, phase=0.0):
    out = []
    ca, sa = math.cos(angle), math.sin(angle)
    R = math.hypot(W, H)
    k = 0
    for off in np.arange(-R + phase, R, spacing):
        k += 1
        pts = []
        run = []
        for t in np.arange(-R, R, 1.0):
            x = W/2 + ca*t - sa*off; y = H/2 + sa*t + ca*off
            xi, yi = int(x), int(y)
            ok = 0 <= xi < W and 0 <= yi < H and inner[yi, xi] and soft[yi, xi] < thresh
            if ok: run.append([x, y])
            else:
                if len(run) >= minrun: out.append(run)
                run = []
        if len(run) >= minrun: out.append(run)
    # alternate direction (boustrophedon) by line order
    res = []
    for i, r in enumerate(out):
        r = [r[0], r[-1]]
        res.append(r[::-1] if i % 2 else r)
    return res
LAYERS = [('h1', -38, 9.0, 0.40, 0.0), ('h2', -38, 9.0, 0.29, 4.5), ('h3', 52, 8.6, 0.21, 0.0), ('h4', 52, 8.6, 0.13, 4.3), ('h5', 8, 10.0, 0.075, 0.0)]
for name, ang, sp, th, ph in LAYERS:
    for r in hatch(math.radians(ang), sp, th, 5, ph): strokes.append((name, r))
# order: lines first (nearest neighbour), then each hatch layer in its scan order
def nn(group):
    if not group: return group
    rest = group[:]; out = [rest.pop(0)]
    while rest:
        e = out[-1][-1]; best, bi, flip = 1e9, 0, False
        for i, s in enumerate(rest):
            d0 = (s[0][0]-e[0])**2 + (s[0][1]-e[1])**2; d1 = (s[-1][0]-e[0])**2 + (s[-1][1]-e[1])**2
            if d0 < best: best, bi, flip = d0, i, False
            if d1 < best: best, bi, flip = d1, i, True
        s = rest.pop(bi); out.append(s[::-1] if flip else s)
    return out
order = []
for kind in ['line', 'h1', 'h2', 'h3', 'h4', 'h5']:
    grp = [s for k2, s in strokes if k2 == kind]
    grp = nn(grp) if kind == 'line' else grp
    order += [(kind, s) for s in grp]

total = sum(sum(math.dist(s[i], s[i+1]) for i in range(len(s)-1)) for _, s in order)
npts = sum(len(s) for _, s in order)
print('strokes', len(order), 'points', npts, 'ink px', round(total))
for kind in ['line','h1','h2','h3','h4','h5']: print(kind, sum(1 for k2,_ in order if k2==kind))
json.dump({'w': W, 'h': H, 'strokes': [[round(v,1) for p in s for v in p] for _, s in order], 'kinds': [k2 for k2,_ in order]}, open(args.out,'w'))
# preview
canvas = np.full((H*2, W*2), 255, np.uint8)
for kind, s in order:
    p = (np.array(s)*2).astype(np.int32)
    cv2.polylines(canvas, [p], False, 0, 1, cv2.LINE_AA)
cv2.imwrite(args.preview, canvas)
