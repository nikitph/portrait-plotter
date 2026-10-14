"""Write the strokes as a plot-ready SVG in millimetres, one Inkscape layer per pass, in plotting order.

    python export/to_svg.py                     # A4 portrait, 0.282 mm per traced pixel
    python export/to_svg.py --paper 148x210     # A5

Feed the result to the AxiDraw / iDraw Inkscape extension, or to vpype, e.g.
    vpype read export/portrait.svg linemerge linesimplify reloop linesort write out.svg
"""
import argparse, json

PASSES = [("line", "1 contour lines"), ("h1", "2 hatching -38deg light"), ("h2", "3 hatching -38deg"),
          ("h3", "4 hatching 52deg"), ("h4", "5 hatching 52deg dark"), ("h5", "6 hatching 8deg darkest")]

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--data", default="data/portrait.json")
ap.add_argument("--out", default="export/portrait.svg")
ap.add_argument("--paper", default="210x297", help="sheet size in mm, WxH")
ap.add_argument("--scale", type=float, default=0.282, help="mm per traced pixel")
ap.add_argument("--pen", type=float, default=0.4, help="stroke width in mm, for preview only")
a = ap.parse_args()

d = json.load(open(a.data))
pw, ph = map(float, a.paper.lower().split("x"))
w, h = d["w"] * a.scale, d["h"] * a.scale
if w > pw or h > ph:
    raise SystemExit(f"portrait is {w:.0f} x {h:.0f} mm and does not fit on {pw:.0f} x {ph:.0f} mm; lower --scale")
ox, oy = (pw - w) / 2, (ph - h) / 2

layers = {k: [] for k, _ in PASSES}
for kind, s in zip(d["kinds"], d["strokes"]):
    pts = " ".join(f"{ox + s[i] * a.scale:.2f},{oy + s[i + 1] * a.scale:.2f}" for i in range(0, len(s), 2))
    layers[kind].append(f'<polyline points="{pts}"/>')

out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
       f'width="{pw}mm" height="{ph}mm" viewBox="0 0 {pw} {ph}">',
       f'<g fill="none" stroke="black" stroke-width="{a.pen}" stroke-linecap="round" stroke-linejoin="round">']
for i, (k, label) in enumerate(PASSES, 1):
    out.append(f'<g inkscape:groupmode="layer" inkscape:label="{label}" id="layer{i}">' + "".join(layers[k]) + "</g>")
out.append("</g></svg>")
open(a.out, "w").write("\n".join(out))
n = sum(len(v) for v in layers.values())
print(f"wrote {a.out}: {n} strokes, {w:.0f} x {h:.0f} mm on {pw:.0f} x {ph:.0f} mm")
