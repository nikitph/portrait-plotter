"""Step 1: cut the sitter out of the background (GrabCut), then repair the face profile by hand.

The crop box, GrabCut rectangle and hand-traced profile are tuned to the original photo."""
import argparse, os
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("photo", help="path to the source photo (not included in this repo)")
ap.add_argument("--work", default="work", help="folder for intermediate files (git-ignored)")
args = ap.parse_args(); os.makedirs(args.work, exist_ok=True)
import cv2, numpy as np
from PIL import Image, ImageOps
im = np.array(ImageOps.exif_transpose(Image.open(args.photo)).convert('RGB'))
crop = im[740:1440, 600:1180].copy()
bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
mask = np.zeros(crop.shape[:2], np.uint8)
rect = (85, 50, 420, 650)
bg, fg = np.zeros((1,65),np.float64), np.zeros((1,65),np.float64)
cv2.grabCut(bgr, mask, rect, bg, fg, 8, cv2.GC_INIT_WITH_RECT)
m = np.where((mask==1)|(mask==3),255,0).astype(np.uint8)
# keep largest component
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
big = 1+np.argmax(st[1:,cv2.CC_STAT_AREA]); m = np.where(lab==big,255,0).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9,9),np.uint8))
cv2.imwrite(os.path.join(args.work, 'mask.png'), m)
out = crop.copy(); out[m==0] = 255
Image.fromarray(out).save(os.path.join(args.work, 'fg.jpg'))
# hand-traced face profile (crop coords): the grab-cut lost the nose, lips and chin to the leaves behind
prof = [(178,463),(195,466),(210,468),(225,469),(238,466),(248,470),(258,474),(265,477),(272,470),(277,461),(285,458),(293,456),(299,450),(305,453),(311,449),(318,441),(326,432),(334,425)]
ys = np.arange(178, 335)
xs = np.interp(ys, [p[0] for p in prof], [p[1] for p in prof])
for y, x in zip(ys, xs):
    m[y, 330:int(round(x))+1] = 255
    m[y, int(round(x))+1:] = 0
cv2.imwrite(os.path.join(args.work, 'mask.png'), m)
out = crop.copy(); out[m==0] = 255
Image.fromarray(out).save(os.path.join(args.work, 'fg.jpg'))
