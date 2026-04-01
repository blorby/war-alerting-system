export type LayerName =
  | 'alerts'
  | 'flights'
  | 'ships'
  | 'strikes'
  | 'seismic'
  | 'thermal'
  | 'heatmap'
  | 'news'
  | 'missiles'
  | 'social';

export type FocusArea = 'israel' | 'iran' | 'gulf' | 'redSea' | 'region';

export interface Viewport {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapState {
  layers: Record<LayerName, boolean>;
  focusArea: FocusArea;
  viewport: Viewport;
}
