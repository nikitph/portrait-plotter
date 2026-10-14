import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../vendor/anatomy/kit/iso-kit.mjs";
import * as G from "../vendor/anatomy/kit/lathe.mjs";
import { kitScript } from "../vendor/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const portrait = JSON.parse(readFileSync(join(HERE, "..", "data", "portrait.json"), "utf8"));

const WIDTH = 760;
const HEIGHT = 470;

// ---------- world (1 unit ≈ 1 mm) ----------
const BASE = { x: -44, y: -96, w: 342, d: 386, r: 10 };
const BASE_H = 10;
const FOOT_H = 5;
const PAPER = { x: 40, y: 30, w: 212, d: 172, r: 0.6 };
const PZ = 0.5;
const S = 0.282; // image px → mm
const XC = PAPER.x + PAPER.w / 2;
const YC = PAPER.y + PAPER.d / 2;
const toWorld = (u, v) => [XC + (v - portrait.h / 2) * S, YC - (u - portrait.w / 2) * S];

const RAIL = { x: 9, y: -42, w: 12, d: 280, r: 1 }; // along y, z 39..49
const RAIL_Z = 39, RAIL_TOP = 49;
const TOWER_A = [15, -56]; // drive motor, carriage belt
const TOWER_B = [15, 252]; // idler
const BELT_Z = [50.5, 54];
const PITCH = 2;

const ARM_W = 12, ARM_Z = 57, ARM_TOP = 65;
const ARM_FROM = -30, ARM_TO = 266;
const PEN_OFF = 24; // pen centre sits this far +y of the arm centreline
const PEN_UP = 5;
const HOME = [48, 38];

const armY0 = HOME[1] - PEN_OFF;
const px0 = HOME[0];
const pz0 = PZ + PEN_UP;

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [ARM_FROM, armY0, 90], [TOWER_B[0], TOWER_B[1], 60], [TOWER_A[0], TOWER_A[1], 60], [ARM_TO, armY0, 70]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 30 },
);

const at = (p) => k.iso(p, P);
const Sd = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const depth2 = (x, y) => k.depthOf([x, y, 0], P);
const byDepth = (pts) => [...pts].sort((a, b) => depth2(a[0], a[1]) - depth2(b[0], b[1]));
const screw = (x, y, z, r = 1.8) => L(k.ring(x, y, r, z, P, 14), { tone: "lo" }) + D([at([x, y, z])], { size: 0.45 });

// ---------- base ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 24))) {
    out.push(Sd(k.cylinder(x, y, 8, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(Sd(k.cylinder(x, y, 6.2, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(Sd(k.slabOf(BASE, -BASE_H, BASE_H, P, 9, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 3.2, P, 9), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P, 9), { tone: "lo" }));
  for (const [x, y] of k.corners(BASE, 11)) out.push(screw(x, y, 0, 2.2));
  // ruler along the front edge (y) and along the left edge (x)
  const r1 = { x: BASE.x + BASE.w - 15, y: BASE.y + 20, w: 8, d: BASE.d - 44, r: 1 };
  out.push(Sd(k.slabOf(r1, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t1 = k.topTicks(r1.y + 4, r1.y + r1.d - 4, 4, 5, r1.x + 0.8, 0.6, [2, 3.8], P, "y");
  out.push(L(t1.minor, { tone: "lo" }), L(t1.major, { tone: "mid" }));
  out.push(D([at([r1.x + 4, r1.y + 2, 0.6]), at([r1.x + 4, r1.y + r1.d - 2, 0.6])], { size: 0.45 }));
  const r2 = { x: BASE.x + 20, y: BASE.y + BASE.d - 15, w: BASE.w - 44, d: 8, r: 1 };
  out.push(Sd(k.slabOf(r2, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t2 = k.topTicks(r2.x + 4, r2.x + r2.w - 4, 4, 5, r2.y + 0.8, 0.6, [2, 3.8], P, "x");
  out.push(L(t2.minor, { tone: "lo" }), L(t2.major, { tone: "mid" }));
  out.push(D([at([r2.x + 2, r2.y + 4, 0.6]), at([r2.x + r2.w - 2, r2.y + 4, 0.6])], { size: 0.45 }));
  // paper registration corner marks engraved in the bed
  for (const [cx, cy, sx, sy] of [[PAPER.x, PAPER.y, -1, -1], [PAPER.x + PAPER.w, PAPER.y, 1, -1], [PAPER.x, PAPER.y + PAPER.d, -1, 1], [PAPER.x + PAPER.w, PAPER.y + PAPER.d, 1, 1]]) {
    out.push(L(k.onTop([[cx + sx * 4, cy - sy * 10], [cx + sx * 4, cy + sy * 4], [cx - sx * 10, cy + sy * 4]], 0, P), { tone: "faint" }));
  }
  return out.join("");
}

function labelPlate() {
  const plan = { x: 262, y: 206, w: 18, d: 64, r: 1.5 };
  const out = [Sd(k.slabOf(plan, 0, 0.9, P, 3, 0.3), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2), 0.9, P, 3), { tone: "faint" }));
  for (const [i, len] of [[0, 46], [1, 34], [2, 52]]) {
    const x = plan.x + 6 + i * 4.5;
    out.push(L(k.lineOnTop([x, plan.y + plan.d - 8], [x, plan.y + plan.d - 8 - len], 0.9, P), { tone: "lo", free: true }));
  }
  out.push(D([at([plan.x + 3, plan.y + 3, 0.9]), at([plan.x + plan.w - 3, plan.y + 3, 0.9]), at([plan.x + 3, plan.y + plan.d - 3, 0.9]), at([plan.x + plan.w - 3, plan.y + plan.d - 3, 0.9])], { size: 0.4 }));
  return out.join("");
}

function penTray() {
  const plan = { x: 258, y: -82, w: 26, d: 96, r: 4 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 2, P)}" style="filter:blur(5px)"/>`];
  out.push(Sd(k.slabOf(plan, 0, 5, P, 6, 0.8), { tone: "mid" }));
  const well = k.insetPlan(plan, 2.4);
  out.push(L(k.planOutline(well, 5, P, 6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 0.9), 5, P, 6), { tone: "faint" }));
  // three spare pens lying in the well, back to front
  for (const [i, x] of [plan.x + 6.5, plan.x + 13, plan.x + 19.5].entries()) {
    const F = G.frameAlong([x, plan.y + 10 + i * 3, 6.6], [0, 1, 0]);
    out.push(Sd(G.solidOf([[0, 0.25], [2.6, 1.1], [5, 1.9], [6.4, 2.4], [52, 2.4], [52, 2.7], [62, 2.7, 1], [64, 2.0, 1]], F, P), { tone: "hi", crease: "lo", inner: L(G.arcOf(F, 52, 2.7, P), { tone: "faint" }) + L(G.arcOf(F, 6.4, 2.4, P), { tone: "faint" }) }));
  }
  return out.join("");
}

function paper() {
  const out = [Sd(k.slabOf(PAPER, 0, PZ, P, 2), { tone: "lo", crease: "none" })];
  return out.join("");
}

function magnets() {
  const out = [];
  for (const [x, y] of byDepth(k.corners(PAPER, 0))) {
    out.push(Sd(k.cylinder(x, y, 3.6, PZ, 1.8, P, 24, 0.4), { tone: "mid" }));
    out.push(L(k.ring(x, y, 1.6, PZ + 1.8, P, 14), { tone: "faint" }));
  }
  return out.join("");
}

// ---------- ink: drawn in image space, mapped onto the sheet by one affine matrix ----------
const o = at([...toWorld(0, 0), PZ]);
const ux = at([...toWorld(1, 0), PZ]);
const vy = at([...toWorld(0, 1), PZ]);
const INK_M = [ux[0] - o[0], ux[1] - o[1], vy[0] - o[0], vy[1] - o[1], o[0], o[1]].map((n) => +n.toFixed(5));
const strokeD = (s) => {
  let d = "";
  for (let i = 0; i < s.length; i += 2) d += (i ? "L" : "M") + s[i] + " " + s[i + 1];
  return d;
};
function ink() {
  const paths = portrait.strokes.map((s, i) => `<path data-i="${i}" d="${strokeD(s)}"/>`).join("");
  return `<g data-part="ink" class="pl-ink" transform="matrix(${INK_M.join(" ")})">${paths}</g><g transform="matrix(${INK_M.join(" ")})"><path data-part="wet" class="pl-wet" d=""/></g>`;
}

// ---------- towers and rail ----------
function motorBody(plan, z0, z1, { shaft = true } = {}) {
  const out = [];
  const cap = 6;
  out.push(Sd(k.slabOf(plan, z0, cap, P, 3, 0.6), { tone: "mid" }));
  const core = k.insetPlan(plan, 1.2);
  const seams = [];
  for (let z = z0 + cap + 2.2; z < z1 - cap - 1; z += 2.2) seams.push(k.sideSeam(core, z, P, 3));
  out.push(Sd(k.slabOf(core, z0 + cap, z1 - z0 - cap * 2, P, 3), { tone: "mid", inner: L(seams.join(""), { tone: "faint" }) }));
  out.push(Sd(k.slabOf(plan, z1 - cap, cap, P, 3, 0.6), { tone: "mid" }));
  const [cx, cy] = [plan.x + plan.w / 2, plan.y + plan.d / 2];
  out.push(L(k.ring(cx, cy, 8, z1, P, 32), { tone: "lo" }));
  for (const [x, y] of k.corners(plan, 4)) out.push(screw(x, y, z1, 1.3));
  if (shaft) out.push(Sd(k.cylinder(cx, cy, 4.6, z1, 1, P, 28), { tone: "mid" }));
  return out.join("");
}

function towerA() {
  const [cx, cy] = TOWER_A;
  const out = [];
  const foot = { x: cx - 24, y: cy - 24, w: 48, d: 48, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(foot, 0, 2, P)}" style="filter:blur(5px)"/>`);
  out.push(Sd(k.slabOf(foot, 0, 3, P, 3, 0.5), { tone: "mid" }));
  for (const [x, y] of k.corners(foot, 3.6)) out.push(screw(x, y, 3, 1.2));
  out.push(motorBody({ x: cx - 21, y: cy - 21, w: 42, d: 42, r: 3 }, 3, 36));
  // top plate the rail bolts to
  const top = { x: cx - 22, y: cy - 22, w: 44, d: 44, r: 3 };
  out.push(Sd(k.slabOf(top, 36, 3, P, 3, 0.5), { tone: "mid" }));
  return out.join("");
}

function towerB() {
  const [cx, cy] = TOWER_B;
  const out = [];
  const foot = { x: cx - 24, y: cy - 24, w: 48, d: 48, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(foot, 0, 2, P)}" style="filter:blur(5px)"/>`);
  out.push(Sd(k.slabOf(foot, 0, 3, P, 3, 0.5), { tone: "mid" }));
  for (const [x, y] of k.corners(foot, 3.6)) out.push(screw(x, y, 3, 1.2));
  const block = { x: cx - 19, y: cy - 19, w: 38, d: 38, r: 2.5 };
  const ribs = [10, 18, 26].map((z) => k.sideSeam(block, z, P, 3)).join("");
  out.push(Sd(k.slabOf(block, 3, 34, P, 3, 0.5), { tone: "mid", inner: L(ribs, { tone: "faint" }) }));
  const top = { x: cx - 22, y: cy - 22, w: 44, d: 44, r: 3 };
  out.push(Sd(k.slabOf(top, 37, 2, P, 3, 0.5), { tone: "mid" }));
  for (const [x, y] of k.corners(top, 4)) out.push(screw(x, y, 39, 1.2));
  return out.join("");
}

function pulley(cx, cy, zb) {
  const out = [];
  out.push(Sd(k.cylinder(cx, cy, 1.6, 39, zb - 39, P, 16), { tone: "mid", crease: "none" }));
  out.push(Sd(k.cylinder(cx, cy, 6.6, zb - 0.6, 0.6, P, 36), { tone: "mid" }));
  out.push(Sd(k.cylinder(cx, cy, 5.2, zb, BELT_Z[1] - zb, P, 36), { tone: "mid", crease: "none" }));
  out.push(L(k.knurl(cx, cy, 5.2, zb + 0.4, BELT_Z[1] - 0.4, 30, P, 0.3), { tone: "faint" }));
  out.push(Sd(k.cylinder(cx, cy, 6.6, BELT_Z[1], 0.7, P, 36, 0.3), { tone: "mid" }));
  out.push(Sd(k.cylinder(cx, cy, 2.4, BELT_Z[1] + 0.7, 1.4, P, 16), { tone: "mid" }));
  out.push(D([at([cx, cy, BELT_Z[1] + 2.1])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function rail() {
  const out = [];
  out.push(Sd(k.slabOf(RAIL, RAIL_Z, RAIL_TOP - RAIL_Z, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(RAIL, RAIL_Z + 3.4, P, 2) + k.sideSeam(RAIL, RAIL_TOP - 3.4, P, 2), { tone: "faint" }) }));
  // scale on the near face
  const tk = k.sideTicks(RAIL.y + 6, RAIL.y + RAIL.d - 6, 5, 5, RAIL.x + RAIL.w, RAIL_TOP - 3.4, [1.4, 2.6], P, "y");
  out.push(L(tk.minor, { tone: "lo" }), L(tk.major, { tone: "mid" }));
  // end caps
  for (const y of [RAIL.y - 2, RAIL.y + RAIL.d]) {
    out.push(Sd(k.slabOf({ x: RAIL.x - 0.6, y, w: RAIL.w + 1.2, d: 2, r: 0.6 }, RAIL_Z - 0.4, RAIL_TOP - RAIL_Z + 0.8, P, 2), { tone: "mid" }));
  }
  // belt: far run then near run (the near run is clamped to the carriage)
  for (const x of [15 - 5.6, 15 + 4.4]) {
    out.push(Sd(k.slabOf({ x, y: TOWER_A[1], w: 1.2, d: TOWER_B[1] - TOWER_A[1], r: 0.2 }, BELT_Z[0], BELT_Z[1] - BELT_Z[0], P, 1), { tone: "lo", crease: "none" }));
  }
  return out.join("");
}

// teeth on the near belt run's outer face; they slide with the carriage
const RAIL_TEETH_X = 15 + 5.6;
function railTeeth() {
  const clip = k.pathOf([at([RAIL_TEETH_X, TOWER_A[1] + 7, BELT_Z[0]]), at([RAIL_TEETH_X, TOWER_B[1] - 7, BELT_Z[0]]), at([RAIL_TEETH_X, TOWER_B[1] - 7, BELT_Z[1]]), at([RAIL_TEETH_X, TOWER_A[1] + 7, BELT_Z[1]])], true);
  let d = "";
  for (let y = TOWER_A[1] + 7 - PITCH * 2; y <= TOWER_B[1] - 7 + PITCH * 2; y += PITCH) d += k.segment([RAIL_TEETH_X, y, BELT_Z[0] + 0.5], [RAIL_TEETH_X, y, BELT_Z[1] - 0.5], P);
  return `<clipPath id="pl-rail-teeth"><path d="${clip}"/></clipPath><g clip-path="url(#pl-rail-teeth)"><g data-part="railTeeth">${L(d, { tone: "lo", free: true })}</g></g>`;
}

// ---------- controller ----------
function controller() {
  const plan = { x: 56, y: -86, w: 40, d: 34, r: 3 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 3, P)}" style="filter:blur(5px)"/>`];
  for (const [x, y] of byDepth(k.corners(plan, 4))) out.push(Sd(k.cylinder(x, y, 2.6, 0, 1.4, P, 16), { tone: "lo" }));
  out.push(Sd(k.slabOf(plan, 1.4, 14, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 4), { tone: "faint" }) }));
  const lid = k.insetPlan(plan, 3);
  out.push(L(k.planOutline(lid, 15.4, P, 4), { tone: "faint" }));
  for (const [x, y] of k.corners(lid, 2.4)) out.push(D([at([x, y, 15.4])], { size: 0.4 }));
  // vent slots: closed rounded slots on the lid
  for (let i = 0; i < 5; i++) {
    const vx = plan.x + 9 + i * 3.2;
    out.push(L(k.planOutline({ x: vx, y: plan.y + 8, w: 1.4, d: 12, r: 0.7 }, 15.4, P, 3), { tone: "lo" }));
  }
  // status lamp and speed knob
  out.push(L(k.ring(plan.x + 30, plan.y + 9, 1.8, 15.4, P, 14), { tone: "lo" }));
  out.push(`<g data-part="lamp">${D([at([plan.x + 30, plan.y + 9, 15.4])], { size: 1.1, tone: "hi" })}</g>`);
  const kc = [plan.x + 29, plan.y + 23];
  out.push(Sd(k.cylinder(kc[0], kc[1], 4.4, 15.4, 4, P, 32, 0.3), { tone: "mid" }));
  out.push(L(k.knurl(kc[0], kc[1], 4.4, 15.6, 19.2, 30, P), { tone: "lo" }));
  out.push(L(k.lineOnTop(kc, [kc[0] + 3.4, kc[1] - 1.6], 19.4, P), { tone: "hi" }));
  // USB port on the near face
  const face = plan.x + plan.w;
  out.push(L(k.pathOf([at([face, plan.y + 22, 8]), at([face, plan.y + 29, 8]), at([face, plan.y + 29, 11]), at([face, plan.y + 22, 11])], true), { tone: "lo" }));
  return out.join("");
}

// ---------- carriage (moves in y) ----------
const CY = armY0;
function carriageBack() {
  // arm motor hangs under the carriage plate, behind the rail
  const plan = { x: -27, y: CY - 14, w: 28, d: 28, r: 2.5 };
  return motorBody(plan, 21, 49, { shaft: false });
}
const CPLATE = { x: -30, y: CY - 17, w: 55, d: 34, r: 2.5 };
function carriage() {
  const out = [];
  // V-wheels riding the near face of the rail
  for (const y of [CY - 11, CY + 11]) {
    out.push(Sd(k.cylinder(RAIL.x + RAIL.w + 2.4, y, 2.4, 41, 6, P, 20), { tone: "mid" }));
    out.push(L(k.sideArc(RAIL.x + RAIL.w + 2.4, y, 2.4, 44, P, 12), { tone: "faint" }));
    out.push(Sd(k.cylinder(RAIL.x + RAIL.w + 2.4, y, 1, 47, 2, P, 12), { tone: "mid", crease: "none" }));
  }
  out.push(Sd(k.slabOf(CPLATE, RAIL_TOP + 0.6, ARM_Z - RAIL_TOP - 0.6, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(CPLATE, RAIL_TOP + 3.6, P, 3), { tone: "faint" }) }));
  // belt clamp
  const clamp = { x: RAIL.x + RAIL.w - 3, y: CY - 7, w: 7, d: 14, r: 1 };
  out.push(Sd(k.slabOf(clamp, ARM_Z, 3, P, 2, 0.4), { tone: "mid" }));
  out.push(D([at([clamp.x + 3.5, clamp.y + 3, ARM_Z + 3]), at([clamp.x + 3.5, clamp.y + 11, ARM_Z + 3])], { size: 0.45 }));
  for (const [x, y] of [[CPLATE.x + 4, CPLATE.y + 4], [CPLATE.x + 4, CPLATE.y + CPLATE.d - 4]]) out.push(screw(x, y, ARM_Z, 1.2));
  return out.join("");
}

const ARM = { x: ARM_FROM, y: CY - ARM_W / 2, w: ARM_TO - ARM_FROM, d: ARM_W, r: 1 };
function arm() {
  const out = [];
  out.push(Sd(k.slabOf(ARM, ARM_Z, ARM_TOP - ARM_Z, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(ARM, ARM_Z + 2.6, P, 2), { tone: "faint" }) }));
  // belt slot along the top
  const slot = { x: ARM.x + 8, y: CY - 2, w: ARM.w - 16, d: 4, r: 1.2 };
  out.push(L(k.planOutline(slot, ARM_TOP, P, 3), { tone: "lo" }));
  // tip idler housing
  const tip = { x: ARM_TO, y: CY - 7.5, w: 5, d: 15, r: 1.4 };
  out.push(Sd(k.slabOf(tip, ARM_Z - 1.5, ARM_TOP - ARM_Z + 3, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([tip.x + 2.5, CY, ARM_TOP + 1.5])], { size: 0.5 }));
  out.push(L(k.sideRing([tip.x + 5, CY, (ARM_Z + ARM_TOP) / 2], 2, "x", P), { tone: "lo" }));
  // root cap
  const root = { x: ARM_FROM - 3, y: CY - 7.5, w: 3, d: 15, r: 1 };
  out.push(Sd(k.slabOf(root, ARM_Z - 1, ARM_TOP - ARM_Z + 2, P, 2, 0.4), { tone: "mid" }));
  // millimetre scale on the arm's near side face
  const tk = k.sideTicks(PAPER.x, PAPER.x + PAPER.w, 5, 5, ARM.y + ARM.d, ARM_TOP - 0.2, [1.2, 2.2], P, "x");
  out.push(L(tk.minor, { tone: "lo" }), L(tk.major, { tone: "mid" }));
  return out.join("");
}
function armTeeth() {
  const slot = { x: ARM.x + 8, y: CY - 2, w: ARM.w - 16, d: 4, r: 1.2 };
  const clip = k.onTop(k.ringOf(k.insetPlan(slot, 0.6), 3), ARM_TOP, P, true);
  let d = "";
  for (let x = slot.x - PITCH * 2; x <= slot.x + slot.w + PITCH * 2; x += PITCH) d += k.lineOnTop([x, CY - 1.2], [x, CY + 1.2], ARM_TOP - 0.2, P);
  return `<clipPath id="pl-arm-teeth"><path d="${clip}"/></clipPath><g clip-path="url(#pl-arm-teeth)"><g data-part="armTeeth">${L(d, { tone: "lo", free: true })}</g></g>`;
}

// ---------- head (moves in x and y) ----------
const PX = px0;
const PY = CY + PEN_OFF;
function head() {
  const out = [];
  const saddle = { x: PX - 10, y: CY - 7.5, w: 20, d: 22, r: 2 };
  const body = { x: PX - 10, y: CY + 6.4, w: 20, d: 10, r: 1.6 };
  out.push(Sd(k.slabOf(body, 38, ARM_TOP - 38 + 0.5, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([PX + 10, CY + 11.4, 44]), at([PX + 10, CY + 11.4, 58])], { size: 0.45 }));
  out.push(Sd(k.slabOf(saddle, ARM_TOP + 0.5, 4, P, 3, 0.6), { tone: "mid" }));
  out.push(D(k.corners(saddle, 2.6).map(([x, y]) => at([x, y, ARM_TOP + 4.5])), { size: 0.4 }));
  // lift servo on the saddle
  const servo = { x: PX - 6, y: CY + 1, w: 12, d: 9, r: 1 };
  out.push(Sd(k.slabOf(servo, ARM_TOP + 4.5, 8, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(servo, ARM_TOP + 7, P, 2), { tone: "faint" }) }));
  const hub = [PX + 2, CY + 5.5];
  out.push(Sd(k.cylinder(hub[0], hub[1], 1.8, ARM_TOP + 12.5, 1.2, P, 16), { tone: "mid" }));
  out.push(`<g data-part="horn"></g>`);
  // guide rails for the pen slide on the body's near face
  for (const x of [PX - 6.5, PX + 6.5]) {
    out.push(Sd(k.cylinder(x, body.y + body.d + 1.2, 1, 30, ARM_TOP - 30, P, 12), { tone: "mid", crease: "none" }));
  }
  out.push(Sd(k.slabOf({ x: PX - 8, y: body.y + body.d - 0.2, w: 16, d: 3, r: 0.6 }, 28, 2, P, 2), { tone: "mid" }));
  return out.join("");
}

const PEN_LEN = 58;
function pen() {
  const out = [];
  const F = G.frameAlong([PX, PY, pz0], [0, 0, 1]);
  out.push(Sd(G.solidOf([[0, 0.3], [2.4, 0.9], [4.6, 1.8], [6.4, 2.6], [40, 2.6], [40, 2.85], [PEN_LEN - 2, 2.85, 1], [PEN_LEN, 2.1, 1]], F, P), { tone: "hi", lit: true, crease: "lo", inner: L(G.arcOf(F, 40, 2.85, P) + G.arcOf(F, 6.4, 2.6, P), { tone: "faint" }) }));
  // carriage block on the slide that grips the pen
  const zc = pz0 + 24;
  const collar = { x: PX - 8, y: PY - 7.8, w: 16, d: 11.6, r: 1.6 };
  out.push(Sd(k.slabOf(collar, zc, 9, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(collar, zc + 4.5, P, 3), { tone: "faint" }) }));
  out.push(L(k.ring(PX, PY, 3.2, zc + 9, P, 20), { tone: "lo" }));
  const TF = G.frameAlong([PX + 8, PY - 2, zc + 4.5], [1, 0, 0]);
  out.push(Sd(G.disc(0, 1.2, 1.4, TF, P), { tone: "mid" }));
  out.push(Sd(G.disc(1.2, 4.4, 2.6, TF, P), { tone: "mid", inner: L(G.ribsOf(TF, 1.4, 4.2, 2.6, 18, P), { tone: "faint" }) }));
  return out.join("");
}

const hornAt = (lift) => {
  const a = -0.6 + lift * 1.4;
  const c = [PX + 2, CY + 5.5];
  return k.lineOnTop([c[0] - Math.cos(a) * 1.5, c[1] - Math.sin(a) * 1.5], [c[0] + Math.cos(a) * 6, c[1] + Math.sin(a) * 6], ARM_TOP + 13.7, P);
};

// ---------- figure ----------
const nStrokes = portrait.strokes.length;
const kinds = portrait.kinds;
const count = (kind) => kinds.filter((x) => x === kind).length;
const inkLen = portrait.strokes.reduce((sum, s) => { let l = 0; for (let i = 2; i < s.length; i += 2) l += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]); return sum + l; }, 0);
const inkMetres = (inkLen * S) / 1000;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: `A pen plotter on a bed: a rail between a stepper motor and an idler carries a carriage, the carriage carries an arm, and a head on the arm holds a pen over a sheet. The pen draws an ink portrait traced from a photograph in ${nStrokes} strokes.`,
  body: [
    base(),
    labelPlate(),
    penTray(),
    paper(),
    ink(),
    magnets(),
    towerA(),
    controller(),
    `<g data-part="carriageBack" transform="${k.translateAlong(P, [0, 0, 0])}">${carriageBack()}</g>`,
    rail(),
    railTeeth(),
    pulley(TOWER_A[0], TOWER_A[1], BELT_Z[0] - 0.6),
    pulley(TOWER_B[0], TOWER_B[1], BELT_Z[0] - 0.6),
    towerB(),
    `<g data-part="carriage">${carriage()}${arm()}${armTeeth()}</g>`,
    `<g data-part="head">${head()}</g>`,
    `<g data-part="pen">${pen()}</g>`,
  ],
});

const CSS = `
.pl-ink path{fill:none;stroke:var(--anatomy-hi);stroke-width:.5px;stroke-linecap:round;stroke-linejoin:round}
.pl-ink path[data-off]{display:none}
.pl-wet{fill:none;stroke:var(--anatomy-lit);stroke-width:.9px;stroke-linecap:round;stroke-linejoin:round}
`;

const live = `
const P = ${JSON.stringify(P)};
const DATA = ${JSON.stringify({ w: portrait.w, h: portrait.h, strokes: portrait.strokes, kinds })};
const S = ${S}, XC = ${XC}, YC = ${YC}, PZ = ${PZ}, PEN_UP = ${PEN_UP}, PEN_OFF = ${PEN_OFF}, PITCH = ${PITCH};
const HOME = ${JSON.stringify(HOME)}, PX0 = ${px0}, ARMY0 = ${armY0}, PZ0 = ${pz0};
const PXC = ${PX}, CYC = ${CY}, HORN_Z = ${ARM_TOP + 13.7};
const KIND = { line: "outline", h1: "hatching 1", h2: "hatching 2", h3: "hatching 3", h4: "hatching 4", h5: "hatching 5" };
const toWorld = (u, v) => [XC + (v - DATA.h / 2) * S, YC - (u - DATA.w / 2) * S];
const fromWorld = (x, y) => [DATA.w / 2 - (y - YC) / S, DATA.h / 2 + (x - XC) / S];

// --- the plot as a timeline: travel (pen up), lower, draw, raise ---
const V_DRAW = 1500, V_TRAVEL = 5200, LIFT = 0.008; // image px per second, seconds
const N = DATA.strokes.length;
const T0 = new Float64Array(N + 1), T1 = new Float64Array(N), T2 = new Float64Array(N), T3 = new Float64Array(N);
const CUM = [];
let t = 0, prev = fromWorld(HOME[0], HOME[1]);
for (let i = 0; i < N; i++) {
  const s = DATA.strokes[i];
  const cum = [0];
  for (let j = 2; j < s.length; j += 2) cum.push(cum[cum.length - 1] + Math.hypot(s[j] - s[j - 2], s[j + 1] - s[j - 1]));
  CUM.push(cum);
  T0[i] = t; t += Math.hypot(s[0] - prev[0], s[1] - prev[1]) / V_TRAVEL;
  T1[i] = t; t += LIFT;
  T2[i] = t; t += cum[cum.length - 1] / V_DRAW;
  T3[i] = t; t += LIFT;
  prev = [s[s.length - 2], s[s.length - 1]];
}
T0[N] = t;
const HOME_IMG = fromWorld(HOME[0], HOME[1]);
const T_HOME = Math.hypot(prev[0] - HOME_IMG[0], prev[1] - HOME_IMG[1]) / V_TRAVEL;
const T_END = t + T_HOME;
const HOLD = 3.2, FADE = 1.4, LOOP = T_END + HOLD + FADE;
const smooth = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

function stateAt(time) {
  if (time >= t) {
    const f = Math.min(1, (time - t) / T_HOME);
    return { done: N, i: -1, u: prev[0] + (HOME_IMG[0] - prev[0]) * f, v: prev[1] + (HOME_IMG[1] - prev[1]) * f, lift: 1, wet: null, phase: time >= T_END ? "parked" : "homing" };
  }
  let lo = 0, hi = N - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T0[m] <= time) lo = m; else hi = m - 1; }
  const i = lo, s = DATA.strokes[i], cum = CUM[i];
  const from = i ? DATA.strokes[i - 1].slice(-2) : fromWorld(HOME[0], HOME[1]);
  if (time < T1[i]) {
    const f = T1[i] > T0[i] ? (time - T0[i]) / (T1[i] - T0[i]) : 1;
    return { done: i, i, u: from[0] + (s[0] - from[0]) * f, v: from[1] + (s[1] - from[1]) * f, lift: 1, wet: null, phase: "travel" };
  }
  if (time < T2[i]) return { done: i, i, u: s[0], v: s[1], lift: 1 - smooth((time - T1[i]) / LIFT), wet: null, phase: "lowering" };
  if (time < T3[i]) {
    const along = (time - T2[i]) * V_DRAW;
    let j = 1; while (j < cum.length - 1 && cum[j] < along) j++;
    const seg = cum[j] - cum[j - 1], f = seg > 0 ? Math.min(1, (along - cum[j - 1]) / seg) : 1;
    const u = s[2 * j - 2] + (s[2 * j] - s[2 * j - 2]) * f, v = s[2 * j - 1] + (s[2 * j + 1] - s[2 * j - 1]) * f;
    let d = "M" + s[0] + " " + s[1];
    for (let q = 1; q < j; q++) d += "L" + s[2 * q] + " " + s[2 * q + 1];
    d += "L" + u.toFixed(1) + " " + v.toFixed(1);
    return { done: i, i, u, v, lift: 0, wet: d, phase: "drawing" };
  }
  return { done: i + 1, i, u: s[s.length - 2], v: s[s.length - 1], lift: smooth((time - T3[i]) / LIFT), wet: null, phase: "raising" };
}

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (n) => svg.querySelector('[data-part="' + n + '"]');
const carriageBack = part("carriageBack"), carriage = part("carriage"), head = part("head"), pen = part("pen");
const railTeeth = part("railTeeth"), armTeeth = part("armTeeth"), horn = part("horn"), wet = part("wet"), inkG = part("ink");
const inkPaths = [...inkG.children];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const mod = (a, n) => ((a % n) + n) % n;
let shown = N;
function showInk(done) {
  if (done === shown) return;
  if (done > shown) for (let q = shown; q < done; q++) inkPaths[q].removeAttribute("data-off");
  else for (let q = done; q < shown; q++) inkPaths[q].setAttribute("data-off", "");
  shown = done;
}
const fmt = (n) => n.toLocaleString("en-US");
let lastText = "";
function draw(time, fade) {
  const st = stateAt(time);
  const [px, py] = toWorld(st.u, st.v);
  const armY = py - PEN_OFF;
  const dy = armY - ARMY0, dx = px - PX0, dz = st.lift * PEN_UP + PZ - PZ0;
  carriageBack.setAttribute("transform", translateAlong(P, [0, dy, 0]));
  carriage.setAttribute("transform", translateAlong(P, [0, dy, 0]));
  head.setAttribute("transform", translateAlong(P, [dx, dy, 0]));
  pen.setAttribute("transform", translateAlong(P, [dx, dy, dz]));
  railTeeth.setAttribute("transform", translateAlong(P, [0, mod(dy, PITCH), 0]));
  armTeeth.setAttribute("transform", translateAlong(P, [mod(dx, PITCH), 0, 0]));
  const a = -0.6 + st.lift * 1.4, c = [PXC + 2, CYC + 5.5];
  horn.innerHTML = '<path class="iso-line" data-tone="hi" d="' + lineOnTop([c[0] - Math.cos(a) * 1.5, c[1] - Math.sin(a) * 1.5], [c[0] + Math.cos(a) * 6, c[1] + Math.sin(a) * 6], HORN_Z, P) + '"/>';
  showInk(st.done);
  wet.setAttribute("d", st.wet || "");
  inkG.style.opacity = fade;
  let text;
  if (fade < 1) text = "fresh sheet";
  else if (st.phase === "parked") text = fmt(N) + " strokes · sheet done";
  else if (st.phase === "homing") text = "all " + fmt(N) + " strokes · pen up, homing";
  else text = "stroke " + fmt(st.i + 1) + " / " + fmt(N) + " · " + KIND[DATA.kinds[st.i]] + " · " + (st.lift > 0.5 ? "pen up" : "pen down");
  text += " · x " + (px - ${PAPER.x}).toFixed(0) + " y " + (py - ${PAPER.y}).toFixed(0) + " mm";
  if (text !== lastText) { readout.textContent = text; lastText = text; }
  stage.setAttribute("aria-valuenow", String(Math.round(st.done / N * 100)));
  stage.setAttribute("aria-valuetext", text);
}

let frame = 0, last = 0, clock = T_END, touring = true, visible = false, idle = 0;
let shownT = T_END, target = T_END;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  let fade = 1;
  if (touring) {
    clock += dt;
    if (clock >= LOOP) clock -= LOOP;
    if (clock > T_END + HOLD) { fade = 1 - smooth((clock - T_END - HOLD) / FADE); shownT = T_END; }
    else shownT = Math.min(clock, T_END);
    if (clock < 0.05) showInk(0);
  } else {
    shownT += (target - shownT) * (1 - Math.exp(-dt / 0.22));
    if (Math.abs(target - shownT) < 0.002) shownT = target;
  }
  draw(shownT, fade);
  const settled = !touring && shownT === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (to) => {
  if (touring) { target = shownT; touring = false; }
  target = Math.max(0, Math.min(T_END, to));
  clearTimeout(idle);
  idle = setTimeout(() => { if (still.matches) return; touring = true; clock = shownT >= T_END ? T_END : shownT; run(); }, 3600);
  if (still.matches) { shownT = target; draw(shownT, 1); } else run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.max(0, Math.min(1, ((event.clientX - box.left) / box.width - 0.12) / 0.76));
  steer(share * T_END);
});
stage.addEventListener("keydown", (event) => {
  const step = T_END / 50;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = (touring ? shownT : target) + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = (touring ? shownT : target) - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = T_END;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
window.__plot = { T_END, LOOP, seek: (time) => steer(time) };
draw(T_END, 1);
`;

const plotSeconds = null;
const body = k.plateHtml({
  fig: "Fig 1",
  title: "Pen plotter",
  hint: "Hover to scrub the plot · ← → to step",
  readout: `${nStrokes.toLocaleString("en-US")} strokes · sheet done`,
  keys: [
    { mark: "lit", label: "Pen and the stroke it is laying down" },
    { mark: "raised", label: "Carriage on the rail sets y; head on the arm sets x" },
    { mark: "edge", label: `Ink: ${count("line")} contour lines, then ${["h1", "h2", "h3", "h4", "h5"].map(count).join(" + ")} hatch lines` },
  ],
  caption: `An ink portrait traced from a photograph and drawn by a two-axis pen plotter. The photo was reduced to ${nStrokes.toLocaleString("en-US")} strokes: an outline and contour lines from its edges, then five hatching passes, each laid only where the photo is darker than that pass's threshold, so shadows collect more lines. The carriage runs the rail for y, the head runs the arm for x, and a servo lifts the pen between strokes; about ${inkMetres.toFixed(1)} m of ink on a ${PAPER.d} × ${PAPER.w} mm sheet.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Pen plotter: arrow keys move the plot forward and back" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">${svg}</div>`,
});

const name = theme === "dark" ? "dark.html" : "index.html";
const html = k.pageHtml({ title: "Pen plotter", theme, body, script: kitScript() + live, width: 820 }).replace("</style>", CSS + "</style>");
writeFileSync(join(HERE, "..", "docs", name), html);
console.log("wrote", name, Math.round(html.length / 1024) + " KB", "strokes", nStrokes, "ink m", inkMetres.toFixed(2));
