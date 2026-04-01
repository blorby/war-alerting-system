import type { LngLatBoundsLike } from "maplibre-gl";

export type FocusArea = "israel" | "iran" | "gulf" | "redSea" | "region";

export const FOCUS_AREAS: Record<
  FocusArea,
  { label: string; bounds: LngLatBoundsLike }
> = {
  israel: {
    label: "Israel",
    bounds: [
      [34.0, 29.0],
      [36.5, 33.5],
    ],
  },
  iran: {
    label: "Iran",
    bounds: [
      [44.0, 25.0],
      [63.0, 40.0],
    ],
  },
  gulf: {
    label: "Gulf",
    bounds: [
      [47.0, 23.0],
      [57.0, 31.0],
    ],
  },
  redSea: {
    label: "Red Sea",
    bounds: [
      [32.0, 12.0],
      [44.0, 30.0],
    ],
  },
  region: {
    label: "Region",
    bounds: [
      [25.0, 12.0],
      [65.0, 42.0],
    ],
  },
};

export const DEFAULT_CENTER: [number, number] = [35.2, 31.5];
export const DEFAULT_ZOOM = 5;
