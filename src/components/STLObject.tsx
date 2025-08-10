import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";


type Props = {
  url: string;
  color?: string;
  visible?: boolean;
  onClick?: (e: any) => void;
  onTransformReady?: (fn: (p: [number, number, number]) => [number, number, number]) => void;
  controlsRef?: React.RefObject<OrbitControlsImpl | null>;
};

export default function STLObject({ url, color, visible = true, onClick, onTransformReady, controlsRef }: Props) {
  const geometry = useLoader(STLLoader, url);
  const material = useMemo(
  () => new THREE.MeshStandardMaterial({
    color,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide, 
  }),
  [color]
);
  const { camera, size } = useThree(); // controls comes from OrbitControls if you pass makeDefault
  const didFit = useRef<string | null>(null);

  useEffect(() => {
    if (!geometry) return;
    if (didFit.current === url) return;

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return; // guard: bbox could be null

    // size & center
    const sizeVec = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(sizeVec);
    box.getCenter(center);

    // We assume a PerspectiveCamera (default in R3F)
    if (camera instanceof THREE.PerspectiveCamera) {
      // Make sure aspect is up-to-date
      camera.aspect = size.width / size.height;

      const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
      const fitHeightDistance = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const fitWidthDistance = fitHeightDistance / camera.aspect;
      const distance = Math.max(fitHeightDistance, fitWidthDistance);

      // Position camera back from the center on a diagonal
      const dir = new THREE.Vector3(1, 1, 1).normalize();
      camera.position.copy(center.clone().add(dir.multiplyScalar(distance * 1.2)));

      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      // Aim controls at the center if available
      const controls = controlsRef?.current;
      if (controls) {
        controls.target.copy(center);
        controls.update();
      } else {
        // fallback: lookAt
        camera.lookAt(center);
      }
    } else {
      // If someone switched to orthographic, just center/zoom approximately
      camera.position.set(center.x + 1, center.y + 1, center.z + 1);
      camera.lookAt(center);
    }

    didFit.current = url;
  }, [geometry,url, camera, size, controlsRef]);

  if (!visible) return null;
  return <mesh renderOrder={1} geometry={geometry} material={material} onClick={onClick} castShadow receiveShadow />;
}
