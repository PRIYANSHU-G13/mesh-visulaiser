// src/components/Annotations.tsx
import React from "react";
import { Line } from "@react-three/drei";
import { MeshJSON, ToothCenter } from "../types";

type Props = {
  data: MeshJSON | null;
  visible?: boolean;
  options?: {
    showOnlyBad?: boolean;
    showLabels?: boolean;
    showSplines?: boolean;
    lift?: number; 
  };
  activeToothNums?: number[] | null;
  showAllSplines?: boolean;
  onToggleTooth?: (num: number) => void;
};

export default function Annotations({
  data,
  visible,
  options = { showOnlyBad: false,  showSplines: true },
  activeToothNums = [],
  showAllSplines = false,
  onToggleTooth,
}: Props) {
  if (!visible || !data?.centers) return null;

  const { showOnlyBad = false, showSplines = true } = options;
  const items = Object.values(data.centers) as ToothCenter[];

  const mapPoint = (p: [number, number, number]) => p;


  return (
    <>
      {items
        .filter((c) => (showOnlyBad ? c.prep === 1 : true))
        .map((c, i) => {
          const p = mapPoint(c.center);
          const color = c.prep === 1 ? "crimson" : "#009c08";
          const isBad = c.prep === 1;
          const isActive = activeToothNums?.includes(c.num);

          return (
            <group key={i}>
              {/* Center marker */}
              <mesh position={p}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBad && onToggleTooth) onToggleTooth(c.num); // toggle only bad teeth
                }}
                onPointerOver={(e) => (document.body.style.cursor = isBad ? "pointer" : "default")}
                onPointerOut={(e) => (document.body.style.cursor = "default")}
              >
                <sphereGeometry args={[0.6, 16, 16]} />
                <meshStandardMaterial color={color} />
              </mesh>

              {/* Spline line */}
              {showSplines && isBad && c.spline && c.spline.length > 0 && (showAllSplines || isActive) && (
                <Line
                  points={c.spline.map((pt) => mapPoint(pt))}
                  lineWidth={2}
                  dashed={false}
                  color={color}
                  renderOrder={1}
                  depthTest={false}
                  depthWrite={false}
                  transparent
                />
              )}
            </group>
          );
        })}
    </>
  );
}
