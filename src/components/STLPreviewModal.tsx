import React from "react";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import { Canvas } from "@react-three/fiber";
import CloseIcon from "@mui/icons-material/Close";
import STLObject from "./STLObject";
import { OrbitControls, Environment } from "@react-three/drei";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  stlUrl: string | null;
  title?: string;
};


export default function STLPreviewModal({ open, onClose, stlUrl, title = "Preview" }: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  console.log("STLPreviewModal render", { open, stlUrl });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {title}
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ height: 500 }}>
        {stlUrl ? (
          <Canvas camera={{ position: [2.5, 2.5, 2.5], fov: 45 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 10, 5]} intensity={1} />
            {/* <primitive object={new THREE.GridHelper(10, 10)} /> */}
            <OrbitControls ref={controlsRef} makeDefault />
            <Environment preset="city" />
            <STLObject url={stlUrl} color="#ffaa00" controlsRef={controlsRef} />
          </Canvas>
        ) : (
          "No file selected"
        )}
      </DialogContent>
    </Dialog>
  );
}
