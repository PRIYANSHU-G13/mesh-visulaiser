// src/utils/ToothPicker.ts
import * as THREE from "three";
import { MeshJSON, ToothCenter } from "../types";

/** Newell plane + centroid */
function newellPlane(points: THREE.Vector3[]) {
  const n = new THREE.Vector3();
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i], pj = points[j];
    n.x += (pj.y - pi.y) * (pj.z + pi.z);
    n.y += (pj.z - pi.z) * (pj.x + pi.x);
    n.z += (pj.x - pi.x) * (pj.y + pi.y);
    cx += pi.x; cy += pi.y; cz += pi.z;
  }
  const origin = new THREE.Vector3(cx / points.length, cy / points.length, cz / points.length);
  n.normalize();
  return { normal: n, origin };
}

/** Orthonormal basis on plane */
function buildBasis(normal: THREE.Vector3, origin: THREE.Vector3) {
  const n = normal.clone().normalize();
  const t = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(n, t).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const toWorld = new THREE.Matrix4().makeBasis(u, v, n).setPosition(origin);
  const toLocal = new THREE.Matrix4().copy(toWorld).invert();
  return { u, v, n, origin, toWorld, toLocal };
}

/** 2D point-in-polygon (ray crossing) */
function pointInPolygon2D(p: THREE.Vector2, poly: THREE.Vector2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const intersect = (a.y > p.y) !== (b.y > p.y) &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** NEW: shortest distance from a point to a segment (2D) */
function pointToSegmentDistance2D(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const abLen2 = abx * abx + aby * aby || 1e-8;
  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx, cy = a.y + t * aby;
  const dx = p.x - cx, dy = p.y - cy;
  return Math.hypot(dx, dy);
}

/** NEW: distance from point to polygon edges (min) */
function distanceToPolygon2D(p: THREE.Vector2, poly: THREE.Vector2[]) {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = pointToSegmentDistance2D(p, poly[j], poly[i]);
    if (d < min) min = d;
  }
  return min;
}

export class ToothPicker extends THREE.Object3D {
  toothNum: number;
  plane: THREE.Plane;
  poly2: THREE.Vector2[];      // polygon in local 2D (u,v)
  toWorld: THREE.Matrix4;
  toLocal: THREE.Matrix4;
  /** NEW: selection tolerance in plane units */
  edgeBuffer: number;

  constructor(toothNum: number, polyWorld3: THREE.Vector3[], edgeBuffer = 1.0) {
    super();
    this.toothNum = toothNum;
    this.edgeBuffer = edgeBuffer;

    const { normal, origin } = newellPlane(polyWorld3);
    const { toWorld, toLocal } = buildBasis(normal, origin);
    this.toWorld = toWorld;
    this.toLocal = toLocal;
    this.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);

    // project polygon to 2D
    this.poly2 = polyWorld3.map((p) => {
      const lp = p.clone().applyMatrix4(this.toLocal);
      return new THREE.Vector2(lp.x, lp.y);
    });

    this.name = `ToothPicker-${toothNum}`;
    this.userData.toothNum = toothNum;
  }

  override raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(this.plane, hit)) return;

    const dist = raycaster.ray.origin.distanceTo(hit);
    if (dist < raycaster.near || dist > raycaster.far) return;

    const lp = hit.clone().applyMatrix4(this.toLocal);
    const p2 = new THREE.Vector2(lp.x, lp.y);

    const inside = pointInPolygon2D(p2, this.poly2);
    const edgeDist = distanceToPolygon2D(p2, this.poly2);

    // Accept if inside OR within edgeBuffer of boundary
    if (!(inside || edgeDist <= this.edgeBuffer)) return;

    intersects.push({
      object: this,
      distance: dist,
      point: hit,
      face: null as any,
      faceIndex: 0,
      uv: new THREE.Vector2(),
    });
  }
}

/** Optionally sort polygon points around centroid for robustness */
function sortLoop(points: THREE.Vector3[]) {
  const c = points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);
  return points
    .map(p => ({ p, angle: Math.atan2(p.y - c.y, p.x - c.x) }))
    .sort((a, b) => a.angle - b.angle)
    .map(o => o.p);
}

export function buildToothPickers(
  json: MeshJSON,
  transformPoint?: (p: [number, number, number]) => [number, number, number],
  edgeBuffer = 1.0   // expose buffer here too
) {
  const arr: ToothPicker[] = [];
  const list = Object.values(json.centers) as ToothCenter[];
  for (const t of list) {
    if (t.prep !== 1) continue;
    if (!t.spline || t.spline.length < 3) continue;

    let pts3 = t.spline.map((pt) => {
      const p = transformPoint ? transformPoint(pt) : pt;
      return new THREE.Vector3(p[0], p[1], p[2]);
    });

    // (Optional) enforce loop order if your data is unordered
    // pts3 = sortLoop(pts3);

    arr.push(new ToothPicker(t.num, pts3, edgeBuffer));
  }
  return arr;
}

export function buildToothPickersById(
  json: MeshJSON,
  transformPoint?: (p: [number, number, number]) => [number, number, number],
  edgeBuffer = 1.0
) {
  const pickers: ToothPicker[] = [];
  const entries = Object.entries(json.centers || {}) as Array<[string, ToothCenter]>;

  for (const [id, t] of entries) {
    if (t.prep !== 1) continue;
    if (!t.spline || t.spline.length < 3) continue;

    const pts3 = t.spline.map((pt) => {
      const p = transformPoint ? transformPoint(pt) : pt;
      return new THREE.Vector3(p[0], p[1], p[2]);
    });

    const picker = new ToothPicker(t.num, pts3, edgeBuffer);
    picker.userData.toothId = id;     // <<<<< store ID
    picker.userData.toothNum = t.num; // optional (debug/inspection)
    pickers.push(picker);
  }

  return pickers;
}
