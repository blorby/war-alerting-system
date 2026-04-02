import { describe, it, expect } from 'vitest';
import { convertOrefMapPolygons, swapLatLng, generateVoronoiFeatures } from './generate-city-polygons';

describe('swapLatLng', () => {
  it('swaps [lat, lng] to [lng, lat]', () => {
    expect(swapLatLng([31.5, 35.2])).toEqual([35.2, 31.5]);
  });
});

describe('convertOrefMapPolygons', () => {
  it('converts oref-map polygon entries to GeoJSON features', () => {
    const polygonsData: Record<string, [number, number][]> = {
      'אילת': [[34.95, 29.55], [34.96, 29.56], [34.94, 29.56], [34.95, 29.55]],
    };
    const districts: Record<string, { areaid: number; migun_time: number }> = {
      'אילת': { areaid: 1, migun_time: 30 },
    };

    const features = convertOrefMapPolygons(polygonsData, districts);

    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({
      name: 'אילת',
      areaid: 1,
      migun_time: 30,
      source: 'oref-map',
    });
    expect(features[0].geometry.type).toBe('Polygon');
    expect(features[0].geometry.coordinates[0]).toEqual([
      [34.95, 29.55], [34.96, 29.56], [34.94, 29.56], [34.95, 29.55],
    ]);
  });

  it('closes unclosed polygon rings', () => {
    const polygonsData: Record<string, [number, number][]> = {
      'test': [[34.0, 31.0], [34.1, 31.1], [34.0, 31.1]],
    };
    const districts: Record<string, { areaid: number; migun_time: number }> = {};

    const features = convertOrefMapPolygons(polygonsData, districts);
    const coords = features[0].geometry.coordinates[0] as [number, number][];
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });

  it('skips the _copyright key', () => {
    const polygonsData: Record<string, [number, number][]> = {
      '_copyright': [] as unknown as [number, number][],
      'אילת': [[34.95, 29.55], [34.96, 29.56], [34.94, 29.56], [34.95, 29.55]],
    };
    const districts: Record<string, { areaid: number; migun_time: number }> = {};

    const features = convertOrefMapPolygons(polygonsData, districts);
    expect(features).toHaveLength(1);
    expect(features[0].properties!.name).toBe('אילת');
  });
});

describe('generateVoronoiFeatures', () => {
  it('generates polygon features for points without existing polygons', () => {
    const points: Record<string, [number, number]> = {
      'cityA': [35.0, 31.0],  // [lng, lat] — already swapped
      'cityB': [35.1, 31.1],
      'cityC': [35.2, 31.0],
    };
    const existingNames = new Set<string>(); // none have polygons yet
    const districts: Record<string, { areaid?: number; migun_time?: number }> = {};

    const features = generateVoronoiFeatures(points, existingNames, districts);

    expect(features).toHaveLength(3);
    for (const f of features) {
      expect(f.geometry.type).toBe('Polygon');
      expect(f.properties!.source).toBe('voronoi');
      // Each polygon should have a closed ring
      const ring = (f.geometry as GeoJSON.Polygon).coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });

  it('skips points that already have polygons', () => {
    const points: Record<string, [number, number]> = {
      'cityA': [35.0, 31.0],
      'cityB': [35.1, 31.1],
    };
    const existingNames = new Set(['cityA']);
    const districts: Record<string, { areaid?: number; migun_time?: number }> = {};

    const features = generateVoronoiFeatures(points, existingNames, districts);

    expect(features).toHaveLength(1);
    expect(features[0].properties!.name).toBe('cityB');
  });
});
