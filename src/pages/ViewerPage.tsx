import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  FormControlLabel,
  Switch,
  Stack,
  Typography,
  TextField,
  Box,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import STLObject from "../components/STLObject";
import Annotations from "../components/Annotations";
import { CaseJSON, MeshJSON, ToothCenter } from "../types";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { buildToothPickersById } from "../utils/ToothPicker";

/* ------------------------ FitOnce ------------------------ */
function FitOnce({
  controlsRef,
  targets,
  margin = 1.25,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  targets: Array<React.RefObject<THREE.Object3D | null>>;
  margin?: number;
}) {
  const { camera, size } = useThree();
  const did = React.useRef(false);

  React.useEffect(() => {
    if (did.current) return;

    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    let hasAny = false;

    for (const r of targets) {
      const obj = r.current;
      if (!obj) continue;
      tmp.setFromObject(obj);
      if (!tmp.isEmpty()) {
        if (!hasAny) {
          box.copy(tmp);
          hasAny = true;
        } else {
          box.union(tmp);
        }
      }
    }
    if (!hasAny) return;

    const sizeV = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(sizeV);
    box.getCenter(center);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = size.width / size.height;
      const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z);
      const dist = (maxDim * margin) / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const dir = new THREE.Vector3(1, 1, 1).normalize();
      camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();

      const controls = controlsRef.current;
      if (controls) {
        controls.target.copy(center);
        controls.update();
      } else {
        camera.lookAt(center);
      }
    }

    did.current = true;
  }, [camera, size, controlsRef, targets, margin]);

  return null;
}

/* ------------------------ Helpers ------------------------ */
function entriesOf(mesh: MeshJSON | null): Array<[string, ToothCenter]> {
  if (!mesh?.centers) return [];
  return Object.entries(mesh.centers) as Array<[string, ToothCenter]>;
}
function activeNumsFromIds(mesh: MeshJSON | null, activeIds: string[]): number[] {
  if (!mesh?.centers) return [];
  const nums: number[] = [];
  for (const id of activeIds) {
    const t = (mesh.centers as any)[id] as ToothCenter | undefined;
    if (t && typeof t.num === "number") nums.push(t.num);
  }
  return nums;
}

function ToothAccordion({
  title,
  mesh,
  activeIds,
  onToggleToothId,
  onChangeNumForId,
  autoExpandSignal,
}: {
  title: string;
  mesh: MeshJSON | null;
  activeIds: string[];
  onToggleToothId: (id: string) => void;
  onChangeNumForId: (id: string, newNum: number) => void;
  autoExpandSignal: number; // use activeIds.length as signal
}) {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand when any bad tooth becomes selected
  useEffect(() => {
    if (autoExpandSignal > 0) setExpanded(true);
  }, [autoExpandSignal]);

  const teeth = useMemo(
    () =>
      entriesOf(mesh)
        .filter(([, t]) => true) // show all teeth
        .sort((a, b) => (b[1].prep - a[1].prep) || (a[1].num - b[1].num)),
    [mesh]
  );

  // Draft values & errors per tooth ID (so field can be cleared)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Keep drafts in sync when mesh changes (initialize to current nums)
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [id, t] of teeth) next[id] = String(t.num ?? "");
    setDrafts(next);
    setErrors({});
  }, [teeth.map(([id]) => id).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (id: string, val: string, selected: boolean) => {
    // Allow clearing; allow only digits
    if (val === "" || /^[0-9]+$/.test(val)) {
      setDrafts((d) => ({ ...d, [id]: val }));
      // Real-time clear error while typing
      setErrors((e) => ({ ...e, [id]: null }));
    }
  };

  const handleBlur = (id: string, selected: boolean, currentNum: number) => {
    if (!selected) return; // editing only when selected
    const raw = drafts[id] ?? "";
    if (raw.trim() === "") {
      setErrors((e) => ({ ...e, [id]: "Required (1–16)" }));
      // do not commit
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 16) {
      setErrors((e) => ({ ...e, [id]: "Must be 1–16" }));
      return;
    }
    if (n !== currentNum) onChangeNumForId(id, n);
  };

  return (
    <Accordion expanded={expanded} onChange={(_, exp) => setExpanded(exp)} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {!expanded && autoExpandSignal > 0 && (
            <Alert severity="info" sx={{ p: 0.5, m: 0, fontSize: 11 }}>
              {autoExpandSignal} selected
            </Alert>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Box
          sx={{
            maxHeight: 280,
            overflow: "auto",
            pr: 0.5,
          }}
        >
          {teeth.map(([id, t]) => {
            const selected = activeIds.includes(id);
            const color =
              t.prep === 1
                ? selected
                  ? "error.main"
                  : "error.light"
                : selected
                ? "success.main"
                : "success.light";

            return (
              <Box
                key={`${title}-id-${id}`}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px",
                  alignItems: "center",
                  gap: 1,
                  mb: 0.75,
                }}
              >
                <Button
                  variant={selected ? "contained" : "outlined"}
                  color={t.prep === 1 ? "error" : "success"}
                  onClick={() => {
                    if (t.prep === 1) onToggleToothId(id);
                  }}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  <Box sx={{ textAlign: "left" }}>
                    <Typography sx={{ fontSize: 13, lineHeight: 1.1 }}>
                      Tooth #{t.num} {t.prep === 1 ? "(bad)" : ""}
                    </Typography>
                    <Typography sx={{ fontSize: 10, opacity: 0.7 }}>id: {id}</Typography>
                  </Box>
                </Button>

                <TextField
                  size="small"
                  label="Num"
                  placeholder="1–16"
                  value={drafts[id] ?? ""}
                  onChange={(e) => handleChange(id, e.target.value, selected)}
                  onBlur={() => handleBlur(id, selected, t.num)}
                  disabled={!selected}
                  error={!!errors[id]}
                  helperText={errors[id] ?? " "}
                  inputProps={{ inputMode: "numeric" }}
                />
              </Box>
            );
          })}
        </Box>
        <Divider sx={{ mt: 1 }} />
      </AccordionDetails>
    </Accordion>
  );
}

/* ------------------------ Page ------------------------ */
const REFRESH_FLAG = "viewer-refresh-confirmed";

type NavState = {
  meshAUrl: string;
  meshBUrl: string;
  jsonData: CaseJSON;
};

export default function ViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as Partial<NavState>;
  const { meshAUrl, meshBUrl, jsonData } = state;

  const mesh1JSON: MeshJSON | null = jsonData?.mesh1 ?? null;
  const mesh2JSON: MeshJSON | null = jsonData?.mesh2 ?? null;

  // Editable copies (to change .num for each tooth ID)
  const [mesh1Local, setMesh1Local] = useState<MeshJSON | null>(mesh1JSON);
  const [mesh2Local, setMesh2Local] = useState<MeshJSON | null>(mesh2JSON);

  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [showOnlyBad, setShowOnlyBad] = useState(false);
  const [showSplines, setShowSplines] = useState(true);
  const [showAllSplinesA, setShowAllSplinesA] = useState(false);
  const [showAllSplinesB, setShowAllSplinesB] = useState(false);

  // Hover remains by num (for point-only hover in Annotations)
  const [hoveredToothA, setHoveredToothA] = useState<number | null>(null);
  const [hoveredToothB, setHoveredToothB] = useState<number | null>(null);

  // Selections by ID (JSON key)
  const [activeIdsA, setActiveIdsA] = useState<string[]>([]);
  const [activeIdsB, setActiveIdsB] = useState<string[]>([]);

  // Derived nums for Annotations
  const activeNumsA = activeNumsFromIds(mesh1Local, activeIdsA);
  const activeNumsB = activeNumsFromIds(mesh2Local, activeIdsB);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const groupARef = useRef<THREE.Object3D>(null) as React.RefObject<THREE.Object3D>;
  const groupBRef = useRef<THREE.Object3D>(null) as React.RefObject<THREE.Object3D>;

  // Invisible picker groups (custom-raycast targets)
  const pickersARef = useRef<THREE.Group | null>(null);
  const pickersBRef = useRef<THREE.Group | null>(null);
  const [pickersAReady, setPickersAReady] = useState(false);
  const [pickersBReady, setPickersBReady] = useState(false);
  const setPickersA = useCallback((node: THREE.Group | null) => {
    pickersARef.current = node; setPickersAReady(!!node);
  }, []);
  const setPickersB = useCallback((node: THREE.Group | null) => {
    pickersBRef.current = node; setPickersBReady(!!node);
  }, []);

  // Build pickers on JSON change
  useEffect(() => {
    if (!mesh1Local || !pickersAReady || !pickersARef.current) return;
    pickersARef.current.clear();
    const pickers = buildToothPickersById(mesh1Local, /* transformA */ undefined, 1.0);
    pickers.forEach((p) => pickersARef.current!.add(p));
    // console.log("[Pickers A] built:", pickers.length);
  }, [mesh1Local, pickersAReady]);
  useEffect(() => {
    if (!mesh2Local || !pickersBReady || !pickersBRef.current) return;
    pickersBRef.current.clear();
    const pickers = buildToothPickersById(mesh2Local, /* transformB */ undefined, 1.0);
    pickers.forEach((p) => pickersBRef.current!.add(p));
    // console.log("[Pickers B] built:", pickers.length);
  }, [mesh2Local, pickersBReady]);

  // Toggle selection by ID
  const toggleIdA = (id: string) =>
    setActiveIdsA((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleIdB = (id: string) =>
    setActiveIdsB((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Change Num for a given ID (validated in Accordion)
  const changeNumA = (id: string, newNum: number) => {
    setMesh1Local((prev) => {
      if (!prev?.centers) return prev;
      const next: MeshJSON = { ...prev, centers: { ...(prev.centers as any) } as any };
      const t = (next.centers as any)[id] as ToothCenter | undefined;
      if (t) (t as any).num = newNum;
      return next;
    });
  };
  const changeNumB = (id: string, newNum: number) => {
    setMesh2Local((prev) => {
      if (!prev?.centers) return prev;
      const next: MeshJSON = { ...prev, centers: { ...(prev.centers as any) } as any };
      const t = (next.centers as any)[id] as ToothCenter | undefined;
      if (t) (t as any).num = newNum;
      return next;
    });
  };

  // Custom-raycast click handlers against pickers (map num -> id)
  const handleMeshClickA = (e: any) => {
    e.stopPropagation();
    if (!pickersARef.current) return;

    const rc = new THREE.Raycaster();
    rc.ray.copy(e.ray);
    rc.near = e.camera.near;
    rc.far = e.camera.far;

    const hits = rc.intersectObjects(pickersARef.current.children as THREE.Object3D[], false);
    if (hits.length) {
      const id = (hits[0].object as any).userData.toothId as string; // <<<<<
      if (id) setActiveIdsA((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const handleMeshClickB = (e: any) => {
    e.stopPropagation();
    if (!pickersBRef.current) return;

    const rc = new THREE.Raycaster();
    rc.ray.copy(e.ray);
    rc.near = e.camera.near;
    rc.far = e.camera.far;

    const hits = rc.intersectObjects(pickersBRef.current.children as THREE.Object3D[], false);
    if (hits.length) {
      const id = (hits[0].object as any).userData.toothId as string; // <<<<<
      if (id) setActiveIdsB((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };


  // Refresh warning + redirect
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      sessionStorage.setItem(REFRESH_FLAG, "1");
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  useEffect(() => {
    if (sessionStorage.getItem(REFRESH_FLAG) === "1") {
      sessionStorage.removeItem(REFRESH_FLAG);
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Clear selections when hiding a mesh
  useEffect(() => {
    if (!showA) { setActiveIdsA([]); setShowAllSplinesA(false); }
  }, [showA]);
  useEffect(() => {
    if (!showB) { setActiveIdsB([]); setShowAllSplinesB(false); }
  }, [showB]);

  if (!meshAUrl || !meshBUrl || !jsonData) {
    return (
      <div style={{ padding: 24 }}>
        <Typography>Missing inputs — please upload again.</Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate("/")}>
          Go to Upload
        </Button>
      </div>
    );
  }

  const groupAPosition: [number, number, number] = [0, 0, 0];
  const groupBPosition: [number, number, number] = [0, 0, 0];

  // Sticky footer handlers
  const handleBack = () => navigate("/");
  const handleSaveContinue = () => {
  navigate("/review", {
    state: {
      meshAUrl,
      meshBUrl,
      mesh1: mesh1Local,          // includes updated nums
      mesh2: mesh2Local,
      selectedIdsA: activeIdsA,   // ID-based selection
      selectedIdsB: activeIdsB,
    },
  });
};

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left Panel */}
      <div
        style={{
          width: 360,
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          borderRight: "1px solid #eee",
        }}
      >
        {/* Header & toggles */}
        <div style={{ padding: 16 }}>
          <Typography variant="h6" gutterBottom>Viewer Controls</Typography>
          <Stack spacing={1}>
            <FormControlLabel control={<Switch checked={showA} onChange={(_, v) => setShowA(v)} />} label="Show Mesh A" />
            <FormControlLabel control={<Switch checked={showB} onChange={(_, v) => setShowB(v)} />} label="Show Mesh B" />
            <FormControlLabel control={<Switch checked={showOnlyBad} onChange={(_, v) => setShowOnlyBad(v)} />} label="Show Only Bad Teeth (prep=1)" />
            <FormControlLabel control={<Switch checked={showSplines} onChange={(_, v) => setShowSplines(v)} />} label="Show Splines" />
            <FormControlLabel control={<Switch checked={showAllSplinesA} onChange={(_, v) => setShowAllSplinesA(v)} />} label="Show ALL splines (Mesh A)" />
            <FormControlLabel control={<Switch checked={showAllSplinesB} onChange={(_, v) => setShowAllSplinesB(v)} />} label="Show ALL splines (Mesh B)" />
            <Typography variant="body2" sx={{ mt: 1, color: "#666" }}>
              Edit <code>num</code> only after selecting a tooth (ID). Lists are collapsed by default and open when you select a bad tooth.
            </Typography>
          </Stack>
        </div>

        {/* Accordions area (scrollable) */}
        <div style={{ overflow: "auto", padding: "0 16px 8px 16px" }}>
          <ToothAccordion
            title={`Mesh A Teeth (${mesh1Local?.is_lower ? "Lower" : "Upper"})`}
            mesh={mesh1Local}
            activeIds={activeIdsA}
            onToggleToothId={toggleIdA}
            onChangeNumForId={changeNumA}
            autoExpandSignal={activeIdsA.length}
          />
          <ToothAccordion
            title={`Mesh B Teeth (${mesh2Local?.is_lower ? "Lower" : "Upper"})`}
            mesh={mesh2Local}
            activeIds={activeIdsB}
            onToggleToothId={toggleIdB}
            onChangeNumForId={changeNumB}
            autoExpandSignal={activeIdsB.length}
          />
        </div>

        {/* Sticky footer */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            borderTop: "1px solid #eee",
            background: "#fff",
            padding: 12,
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <Button variant="outlined" onClick={handleBack} fullWidth>
            Back to Upload
          </Button>
          <Button variant="contained" onClick={handleSaveContinue} fullWidth>
            Save & Continue
          </Button>
        </div>
      </div>

      {/* Scene */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [3, 3, 5], fov: 50 }} shadows>
          <pointLight position={[1, 1, 1]} intensity={1} castShadow />
          <OrbitControls ref={controlsRef} makeDefault />
          <Environment preset="city" />
          <FitOnce controlsRef={controlsRef} targets={[groupARef, groupBRef]} />

          {/* Mesh A */}
          <group ref={groupARef} position={groupAPosition} onClick={handleMeshClickA}>
            <STLObject
                url={meshAUrl}
                color="#eef155"
                visible={showA}
                // onTransformReady={(fn) => setTransformA(() => fn)}
                controlsRef={controlsRef}
            />
            <group ref={setPickersA} />
            {showA && (
              <Annotations
                data={mesh1Local}
                visible
                activeToothIds={activeIdsA}             // <<<<<
                showAllSplines={showAllSplinesA}
                onToggleToothId={(id) => toggleIdA(id)} // <<<<<
                options={{ showOnlyBad, showSplines, showLabels: true }}
              />
            )}
          </group>

          {/* Mesh B */}
          <group ref={groupBRef} position={groupBPosition} onClick={handleMeshClickB}>
            <STLObject
                url={meshBUrl}
                color="#afd7f9"
                visible={showB}
                // onTransformReady={(fn) => setTransformB(() => fn)}
                controlsRef={controlsRef}
            />
            <group ref={setPickersB} />
            {showB && (
              <Annotations
                data={mesh2Local}
                visible
                activeToothIds={activeIdsB}
                showAllSplines={showAllSplinesB}
                onToggleToothId={(id) => toggleIdB(id)}
                options={{ showOnlyBad, showSplines, showLabels: true }}
              />
            )}
          </group>
        </Canvas>
      </div>
    </div>
  );
}
