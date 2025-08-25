// src/pages/ReviewPage.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Line } from "@react-three/drei";
import * as THREE from "three";
import STLObject from "../components/STLObject";
import { Button, Stack, Typography, Slider } from "@mui/material";
import { MeshJSON, ToothCenter } from "../types";

/* ---------------- math helpers ---------------- */

function toVec3Array(pts: [number, number, number][]) {
  return pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
}

// Newell: robust plane normal + centroid
function newellNormalAndCentroid(points: THREE.Vector3[]) {
  const n = new THREE.Vector3();
  let cx = 0,
    cy = 0,
    cz = 0;
  const len = points.length;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const pi = points[i],
      pj = points[j];
    n.x += (pj.y - pi.y) * (pj.z + pi.z);
    n.y += (pj.z - pi.z) * (pj.x + pi.x);
    n.z += (pj.x - pi.x) * (pj.y + pi.y);
    cx += pi.x;
    cy += pi.y;
    cz += pi.z;
  }
  n.normalize();
  const centroid = new THREE.Vector3(cx / len, cy / len, cz / len);
  return { normal: n, centroid };
}

/* ---------------- hollow sleeve (annulus extruded) ---------------- */

type HollowSleeveProps = {
  idKey: string; // unique per mesh (e.g., "A:3")
  spline: [number, number, number][];
  color?: string;
  wall?: number;
  height?: number;
  opacity?: number;
  hovered?: boolean;
  onPointerOver?: (idKey: string) => void;
  onPointerOut?: (idKey: string) => void;
};

function HollowSleeveOnSpline({
  idKey,
  spline,
  color = "crimson",
  wall = 0.8,
  height = 3.0,
  opacity = 0.35,
  hovered = false,
  onPointerOver,
  onPointerOut,
}: HollowSleeveProps) {
  const { geom, matrix } = React.useMemo(() => {
    const pts3 = spline.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    if (pts3.length < 3) return { geom: null as THREE.ExtrudeGeometry | null, matrix: new THREE.Matrix4() };

    // Newell normal + centroid
    const n = new THREE.Vector3();
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0, j = pts3.length - 1; i < pts3.length; j = i++) {
      const pi = pts3[i], pj = pts3[j];
      n.x += (pj.y - pi.y) * (pj.z + pi.z);
      n.y += (pj.z - pi.z) * (pj.x + pi.x);
      n.z += (pj.x - pi.x) * (pj.y + pi.y);
      cx += pi.x; cy += pi.y; cz += pi.z;
    }
    n.normalize();
    const centroid = new THREE.Vector3(cx / pts3.length, cy / pts3.length, cz / pts3.length);

    // basis + transforms
    const t = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, t).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    const toWorld = new THREE.Matrix4().makeBasis(u, v, n).setPosition(centroid);
    const toLocal = new THREE.Matrix4().copy(toWorld).invert();

    // project to 2D plane
    const pts2 = pts3.map((p) => p.clone().applyMatrix4(toLocal)).map((p) => new THREE.Vector2(p.x, p.y));

    // order outer loop
    const c2 = new THREE.Vector2(pts2.reduce((s, p) => s + p.x, 0) / pts2.length, pts2.reduce((s, p) => s + p.y, 0) / pts2.length);
    const outer = pts2
      .map((p) => ({ p, a: Math.atan2(p.y - c2.y, p.x - c2.x) }))
      .sort((A, B) => A.a - B.a)
      .map((o) => o.p);

    // inner loop (approx inward offset)
    const inner = outer.map((p) => {
      const dir = new THREE.Vector2().subVectors(p, c2);
      const len = dir.length() || 1e-8;
      return c2.clone().add(dir.multiplyScalar(Math.max(0, 1 - wall / len)));
    });

    const shape = new THREE.Shape(outer);
    shape.holes.push(new THREE.Path(inner.slice().reverse()));

    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
    return { geom, matrix: toWorld };
  }, [spline, wall, height]);

  if (!geom) return null;

  return (
    <mesh
      geometry={geom}
      matrixAutoUpdate={false}
      matrix={matrix}
      renderOrder={998}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver?.(idKey); }}
      onPointerOut={(e) => { e.stopPropagation(); onPointerOut?.(idKey); }}
    >
      <meshStandardMaterial
        color={color}
        transparent
        opacity={hovered ? Math.min(1, opacity + 0.15) : opacity}
        metalness={0.1}
        roughness={0.4}
        side={THREE.DoubleSide}
        depthTest
        depthWrite
        emissive={hovered ? new THREE.Color(color) : new THREE.Color(0x000000)}
        emissiveIntensity={hovered ? 0.5 : 0}
      />
    </mesh>
  );
}


/* ---------------- spline line (slightly lifted) ---------------- */

function SplineLine({
  spline,
  color = "#ffffff",
  width = 2,
  lift = 0.12, // small lift along normal to avoid z-fighting
}: {
  spline: [number, number, number][];
  color?: string;
  width?: number;
  lift?: number;
}) {
  const points = React.useMemo(() => {
    const v3 = toVec3Array(spline);
    if (v3.length < 2) return v3.map((p) => [p.x, p.y, p.z]) as [number, number, number][];
    const { normal } = newellNormalAndCentroid(v3);
    const lifted = v3.map((p) => p.clone().add(normal.clone().multiplyScalar(lift)));
    return lifted.map((p) => [p.x, p.y, p.z]) as [number, number, number][];
  }, [spline, lift]);

  return <Line points={points} lineWidth={width} color={color} dashed={false} renderOrder={999} />;
}

/* ------------- render sleeves + splines for selected teeth ------------- */

function MarkupForSelection({
  meshJson,
  selectedIds,
  prefix, // "A" or "B"
  hoveredKey,
  setHoveredKey,
  sleeveColor = "crimson",
  splineColor = "#ffffff",
  wall = 0.8,
  height = 3.0,
  splineWidth = 2,
}: {
  meshJson: MeshJSON | null;
  selectedIds: string[];
  prefix: "A" | "B";
  hoveredKey: string | null;
  setHoveredKey: (k: string | null) => void;
  sleeveColor?: string;
  splineColor?: string;
  wall?: number;
  height?: number;
  splineWidth?: number;
}) {
  if (!meshJson?.centers || !selectedIds.length) return null;

  const items = selectedIds
    .map((id) => [id, (meshJson.centers as any)[id] as ToothCenter | undefined] as const)
    .filter(([, t]) => !!t && (t as ToothCenter).prep === 1 && (t as ToothCenter).spline?.length >= 3);

  return (
    <>
      {items.map(([id, t]) => {
        const spline = (t as ToothCenter).spline as [number, number, number][];
        const key = `${prefix}:${id}`;
        const isHovered = hoveredKey === key;
        return (
          <group key={key}>
            <HollowSleeveOnSpline
              idKey={key}
              spline={spline}
              color={sleeveColor}
              wall={wall}
              height={height}
              opacity={0.7}
              hovered={isHovered}
              onPointerOver={(k) => setHoveredKey(k)}
              onPointerOut={() => setHoveredKey(null)}
            />
            <SplineLine spline={spline} color={splineColor} width={splineWidth} />
          </group>
        );
      })}
    </>
  );
}

/* ---------------- page ---------------- */

type NavState = {
  meshAUrl: string;
  meshBUrl: string;
  mesh1: MeshJSON | null;
  mesh2: MeshJSON | null;
  selectedIdsA: string[];
  selectedIdsB: string[];
};

export default function ReviewPage() {
  const nav = useNavigate();
  const { state } = useLocation();
  const { meshAUrl, meshBUrl, mesh1, mesh2, selectedIdsA, selectedIdsB } = (state || {}) as Partial<NavState>;

  // Hover state (keys look like "A:3" / "B:7")
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);

  // Cursor circle radius (px)
  const [cursorRadius, setCursorRadius] = React.useState<number>(10);

  // Custom cursor overlay position
  const [cursorPos, setCursorPos] = React.useState<{ x: number; y: number } | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  if (!meshAUrl || !meshBUrl || !mesh1 || !mesh2) {
    return (
      <div style={{ padding: 24 }}>
        <Typography>Missing inputs — please go back.</Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => nav("/")}>
          Back to Upload
        </Button>
      </div>
    );
  }

  // optional small separation
  const groupAPosition: [number, number, number] = [0, mesh1.is_lower ? -5 : 5, 0];
  const groupBPosition: [number, number, number] = [0, mesh2.is_lower ? -5 : 5, 0];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left panel */}
      <div style={{ width: 320, padding: 16, borderRight: "1px solid #eee", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
        <div>
          <Typography variant="h6" gutterBottom>
            Review
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Hover over the sleeves to highlight. Adjust the cursor ring size.
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Cursor ring radius
          </Typography>
          <Slider
            size="small"
            min={1}
            max={50}
            step={1}
            value={cursorRadius}
            onChange={(_, v) => setCursorRadius(v as number)}
            valueLabelDisplay="auto"
          />
        </div>

        <div />

        <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => nav(-1)}>
            Back
          </Button>
          <Button variant="contained" onClick={() => nav("/")}>
            Finish
          </Button>
        </Stack>
      </div>

      {/* 3D viewport + cursor overlay */}
      <div
        ref={viewportRef}
        style={{ position: "relative", flex: 1 }}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setCursorPos(null)}
      >
        {/* The 3D Canvas; hide default cursor in this area */}
        <div style={{ position: "absolute", inset: 0 }}>
          <Canvas camera={{ position: [3, 3, 6], fov: 50 }} shadows>
            <ambientLight intensity={0.65} />
            <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
            <OrbitControls makeDefault />
            <Environment preset="city" />

            {/* Mesh A */}
            <group position={groupAPosition}>
              <STLObject url={meshAUrl} color="#eef155" visible />
              <MarkupForSelection
                meshJson={mesh1}
                selectedIds={selectedIdsA || []}
                prefix="A"
                hoveredKey={hoveredKey}
                setHoveredKey={setHoveredKey}
                sleeveColor="crimson"
                splineColor="#f80303"
                wall={0.8}
                height={3.0}
                splineWidth={2}
              />
            </group>

            {/* Mesh B */}
            <group position={groupBPosition}>
              <STLObject url={meshBUrl} color="#afd7f9" visible />
              <MarkupForSelection
                meshJson={mesh2}
                selectedIds={selectedIdsB || []}
                prefix="B"
                hoveredKey={hoveredKey}
                setHoveredKey={setHoveredKey}
                sleeveColor="crimson"
                splineColor="#f50707"
                wall={0.8}
                height={3.0}
                splineWidth={2}
              />
            </group>
          </Canvas>
        </div>

        {/* Custom cursor ring overlay */}
        {hoveredKey && cursorPos && (
            <div
                style={{
                position: "absolute",
                left: cursorPos.x - cursorRadius,
                top:  cursorPos.y - cursorRadius,
                width: cursorRadius * 2,
                height: cursorRadius * 2,
                pointerEvents: "none",
                borderRadius: "50%",
                backgroundColor: "rgba(0, 123, 255, 0.75)", // solid blue fill w/ some transparency
                border: "2px solid rgba(0, 123, 255, 0.8)", // optional blue border
                boxShadow: "0 0 10px rgba(0, 123, 255, 0.5)", // optional glow
                // transition: "left 80ms linear, top 80ms linear", // smooth follow
                filter: "blur(0.2px)",   // tiny blur so it blends with any background
                }}
            />
            )}
      </div>
    </div>
  );
}
