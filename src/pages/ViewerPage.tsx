// src/pages/ViewerPage.tsx
import React, {  useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, FormControlLabel, Switch, Stack, Typography } from "@mui/material";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import STLObject from "../components/STLObject";
import Annotations from "../components/Annotations";
import { CaseJSON, MeshJSON } from "../types";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRef, useEffect } from "react";

type NavState = {
  meshAUrl: string;
  meshBUrl: string;
  jsonData: CaseJSON;
};

function FitOnce({
  controlsRef,
  targets,
  margin = 1.25, // a bit of padding
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  targets: Array<React.RefObject<THREE.Object3D | null>>;
  margin?: number;
}) {
  const { camera, size } = useThree();
  const did = React.useRef(false);

  React.useEffect(() => {
    if (did.current) return;

    // Union bounding box of all targets
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

    did.current = true; // <- run only once
  }, [camera, size, controlsRef, targets, margin]);

  return null;
}


export default function ViewerPage() {
  const nav = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as Partial<NavState>;
  const { meshAUrl, meshBUrl, jsonData } = state;

  const mesh1JSON: MeshJSON | null = jsonData?.mesh1 ?? null;
  const mesh2JSON: MeshJSON | null = jsonData?.mesh2 ?? null;

  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [showOnlyBad, setShowOnlyBad] = useState(false);
  const [showSplines, setShowSplines] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const groupARef = useRef<THREE.Group>(null);
  const groupBRef = useRef<THREE.Group>(null);

  const [activeTeethA, setActiveTeethA] = useState<number[]>([]);
  const [activeTeethB, setActiveTeethB] = useState<number[]>([]);
  const [showAllSplinesA, setShowAllSplinesA] = useState(false);
  const [showAllSplinesB, setShowAllSplinesB] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; 
    };

    const handleUnload = () => {
      window.location.href = "/";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, []);

  // Toggle one tooth (A)
  const toggleToothA = (num: number) => {
    setShowAllSplinesA(false); // optional: auto-disable "Show all" when user picks manually
    setActiveTeethA(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  // Toggle one tooth (B)
  const toggleToothB = (num: number) => {
    setShowAllSplinesB(false);
    setActiveTeethB(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  // When hiding a mesh, clear its selections
  useEffect(() => { if (!showA) { setActiveTeethA([]); setShowAllSplinesA(false); } }, [showA]);
  useEffect(() => { if (!showB) { setActiveTeethB([]); setShowAllSplinesB(false); } }, [showB]);

  if (!meshAUrl || !meshBUrl || !jsonData) {
    return (
      <div style={{ padding: 24 }}>
        <Typography>Missing inputs — please upload again.</Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => nav("/")}>Go to Upload</Button>
      </div>
    );
  }

  const groupAPosition: [number, number, number] = [0, 0, 0];
  const groupBPosition: [number, number, number] = [0, 0, 0];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Controls */}
      <div style={{ width: 360, padding: 16, borderRight: "1px solid #eee", overflow: "auto" }}>
        <Typography variant="h6" gutterBottom>Viewer Controls</Typography>
        <Stack spacing={1}>
          <FormControlLabel control={<Switch checked={showA} onChange={(_, v) => setShowA(v)} />} label="Show Mesh A" />
          <FormControlLabel control={<Switch checked={showB} onChange={(_, v) => setShowB(v)} />} label="Show Mesh B" />
          <FormControlLabel control={<Switch checked={showOnlyBad} onChange={(_, v) => setShowOnlyBad(v)} />} label="Show Only Bad Teeth (prep=1)" />
          <FormControlLabel control={<Switch checked={showSplines} onChange={(_, v) => setShowSplines(v)} />} label="Show Splines" />
          <FormControlLabel
            control={<Switch checked={showAllSplinesA} onChange={(_, v) => setShowAllSplinesA(v)} />}
            label="Show ALL splines (Mesh A)"
          />
          <FormControlLabel
            control={<Switch checked={showAllSplinesB} onChange={(_, v) => setShowAllSplinesB(v)} />}
            label="Show ALL splines (Mesh B)"
          />

          <Typography variant="body2" sx={{ mt: 2, color: "#666" }}>
            Jaws are separated vertically based on <code>is_lower</code> in the JSON.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => nav("/")}>Back to Upload</Button>

          {mesh1JSON && (
            <Typography variant="caption" display="block" sx={{ mt: 2 }}>
              Mesh A: {mesh1JSON.is_lower ? "Lower jaw" : "Upper jaw"}
            </Typography>
          )}
          {mesh2JSON && (
            <Typography variant="caption" display="block">
              Mesh B: {mesh2JSON.is_lower ? "Lower jaw" : "Upper jaw"}
            </Typography>
          )}
        </Stack>
      </div>

      {/* Scene */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [3, 3, 5], fov: 50 }} shadows>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
          {/* <primitive object={new THREE.GridHelper(12, 12)} /> */}
          <OrbitControls ref={controlsRef} makeDefault />
          <Environment preset="city" />

          <FitOnce controlsRef={controlsRef} targets={[groupARef, groupBRef]} />

          {/* --- Mesh A + its annotations live in the same group so offsets match --- */}
          <group ref={groupARef} position={groupAPosition} onClick={(e) => { e.stopPropagation(); }}>
            <STLObject
                url={meshAUrl}
                color="#eef155"
                visible={showA}
                // onTransformReady={(fn) => setTransformA(() => fn)}
                controlsRef={controlsRef}
            />
            {showA && 
            <Annotations
                data={mesh1JSON ?? null}
                visible={true}
                // transformPoint={composeTransform(transformA, axisMap)}  // see section 2
                options={{ showOnlyBad, showSplines }}
                activeToothNums={activeTeethA}
                showAllSplines={showAllSplinesA}
                onToggleTooth={toggleToothA}
            />}
            </group>

            <group ref={groupBRef} position={groupBPosition} onClick={(e) => { e.stopPropagation(); }}>
            <STLObject
                url={meshBUrl}
                color="#afd7f9"
                visible={showB}
                // onTransformReady={(fn) => setTransformB(() => fn)}
                controlsRef={controlsRef}
            />
            {showB && 
              <Annotations
                  data={mesh2JSON ?? null}
                  visible={true}
                  // transformPoint={composeTransform(transformB, axisMap)}  // see section 2
                  options={{ showOnlyBad, showSplines }}
                  activeToothNums={activeTeethB}
                  showAllSplines={showAllSplinesB}
                  onToggleTooth={toggleToothB}
              />
              }
            </group>
        </Canvas>
      </div>
    </div>
  );
}
