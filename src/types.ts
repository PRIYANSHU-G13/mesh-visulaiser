export type ToothCenter = {
  prep: 0 | 1;      // 1 => bad tooth
  num: number;      // tooth number
  center: [number, number, number];
  spline: [number, number, number][];
};

export type MeshJSON = {
  is_lower: boolean;
  centers: Record<string, ToothCenter>;
};

export type CaseJSON = {
  mesh1: MeshJSON;
  mesh2?: MeshJSON; // optional if you sometimes only have one
};
