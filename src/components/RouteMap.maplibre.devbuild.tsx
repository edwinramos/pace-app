/**
 * MAPA REAL — MapLibre RN v11 + tiles de OpenFreeMap. Solo dev build.
 * Excluido de tsconfig y del bundle. Para activarlo:
 *   npx expo install @maplibre/maplibre-react-native
 *   app.json → plugins: ["@maplibre/maplibre-react-native"]
 *   y sustituir <RouteMap> por <RouteMapLibre> en las pantallas.
 * Verificar los nombres de componentes de la v11 al instalar.
 */
import { Camera, LineLayer, MapView, ShapeSource } from '@maplibre/maplibre-react-native';
import React from 'react';
import { colors } from '../theme';

const STYLE = 'https://tiles.openfreemap.org/styles/dark';

export function RouteMapLibre({ path, live, height = 220 }: { path: [number, number][]; live?: { lat: number; lon: number }[]; height?: number }) {
  const line = (coords: [number, number][]) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords.map(([lat, lon]) => [lon, lat]) },
  });
  const lons = path.map((p) => p[1]);
  const lats = path.map((p) => p[0]);
  return (
    <MapView style={{ height, borderRadius: 18 }} mapStyle={STYLE} attributionEnabled logoEnabled={false}>
      <Camera bounds={{ ne: [Math.max(...lons), Math.max(...lats)], sw: [Math.min(...lons), Math.min(...lats)] }} padding={{ paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 }} />
      <ShapeSource id="route" shape={line(path)}>
        <LineLayer id="route-line" style={{ lineColor: colors.lime, lineWidth: 4, lineOpacity: live ? 0.4 : 1 }} />
      </ShapeSource>
      {live && live.length > 1 ? (
        <ShapeSource id="live" shape={line(live.map((p) => [p.lat, p.lon]))}>
          <LineLayer id="live-line" style={{ lineColor: colors.lime, lineWidth: 5 }} />
        </ShapeSource>
      ) : null}
    </MapView>
  );
}
