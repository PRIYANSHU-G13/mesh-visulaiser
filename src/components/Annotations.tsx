// src/components/Annotations.tsx
import React from "react";
import { Line } from "@react-three/drei";
import { MeshJSON, ToothCenter } from "../types";

type Props = {
  data: MeshJSON | null;
  visible?: boolean;
  options?: { showOnlyBad?: boolean; showLabels?: boolean; showSplines?: boolean; lift?: number };
  activeToothIds?: string[];                 // <<<<< use IDs
  showAllSplines?: boolean;
  onToggleToothId?: (id: string) => void;    // <<<<< optional
  hoveredToothId?: string | null;            // optional if you later add hover by ID
};

export default function Annotations({
  data,
  visible,
  options = { showOnlyBad: false, showLabels: true, showSplines: true },
  activeToothIds = [],
  showAllSplines = false,
  onToggleToothId,
}: Props) {
  if (!visible || !data?.centers) return null;

  const { showOnlyBad = false, showLabels = true, showSplines = true } = options;
  const mapPoint = (p: [number, number, number]) => p;

  const entries = Object.entries(data.centers) as Array<[string, ToothCenter]>;

  return (
    <>
      {entries
        .filter(([, c]) => (showOnlyBad ? c.prep === 1 : true))
        .map(([id, c]) => {
          const p = mapPoint(c.center);
          const isBad = c.prep === 1;
          const color = isBad ? "crimson" : "#009c08";
          const isActive = activeToothIds.includes(id); // <<<<<

          return (
            <group key={id}>
              <mesh
                position={p}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBad && onToggleToothId) onToggleToothId(id); // <<<<<
                }}
              >
                <sphereGeometry args={[0.6, 16, 16]} />
                <meshStandardMaterial color={color} />
              </mesh>

              {showLabels && (
                <group position={p}>
                  {/* render your Html label here if desired */}
                </group>
              )}

              {showSplines && isBad && c.spline?.length > 0 && (showAllSplines || isActive) && (
                <Line
                  points={c.spline.map((pt) => mapPoint(pt))}
                  lineWidth={2}
                  dashed={false}
                  color={color}
                  renderOrder={999}
                  depthTest
                  depthWrite={false}
                />
              )}
            </group>
          );
        })}
    </>
  );
}
