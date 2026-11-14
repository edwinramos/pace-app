import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { Label } from './ui';

/**
 * PLACEHOLDER DE MAPA para Expo Go: dibuja el trazado proyectado en SVG sobre
 * una cuadrícula, sin tiles. MapLibre RN + OpenFreeMap necesita módulo nativo
 * (dev build); ver RouteMap.maplibre.devbuild.tsx.
 */
export function RouteMap({
  path,
  live,
  height = 190,
  caption,
  kmMarks = true,
}: {
  path: [number, number][];
  /** traza recorrida (en vivo o del resumen) */
  live?: { lat: number; lon: number }[];
  height?: number;
  caption?: string;
  kmMarks?: boolean;
}) {
  const width = 340;
  const all: [number, number][] = [...path, ...(live ?? []).map((p) => [p.lat, p.lon] as [number, number])];
  if (all.length === 0) return <View style={{ height }} />;
  const lats = all.map((p) => p[0]);
  const lons = all.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  // proyección equirectangular con corrección por latitud
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = Math.max((maxLon - minLon) * k, 1e-5);
  const spanY = Math.max(maxLat - minLat, 1e-5);
  const pad = 24;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const ox = (width - spanX * scale) / 2;
  const oy = (height - spanY * scale) / 2;
  const px = (lat: number, lon: number) => ({
    x: ox + (lon - minLon) * k * scale,
    y: height - (oy + (lat - minLat) * scale),
  });
  const routePts = path.map(([a, b]) => px(a, b));
  const livePts = (live ?? []).map((p) => px(p.lat, p.lon));
  const toStr = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const start = routePts[0] ?? livePts[0];
  const cur = livePts[livePts.length - 1];

  return (
    <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: '#12161A' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#12161A" />
            <Stop offset="1" stopColor="#0B2530" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sea)" />
        {Array.from({ length: 9 }, (_, i) => (
          <Line key={'v' + i} x1={(i * width) / 8} x2={(i * width) / 8} y1={0} y2={height} stroke="#1E242A" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <Line key={'h' + i} y1={(i * height) / 5} y2={(i * height) / 5} x1={0} x2={width} stroke="#1E242A" strokeWidth={1} />
        ))}
        {routePts.length > 1 ? (
          <>
            <Polyline points={toStr(routePts)} fill="none" stroke={colors.lime + '33'} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline points={toStr(routePts)} fill="none" stroke={live ? colors.lime + '66' : colors.lime} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={live ? '6 6' : undefined} />
          </>
        ) : null}
        {livePts.length > 1 ? (
          <Polyline points={toStr(livePts)} fill="none" stroke={colors.lime} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {kmMarks && !live && routePts.length > 2
          ? [0.25, 0.5, 0.75].map((f, i) => {
              const p = routePts[Math.round(f * (routePts.length - 1))];
              return (
                <React.Fragment key={f}>
                  <Circle cx={p.x} cy={p.y} r={9} fill={colors.lime} />
                  <SvgText x={p.x} y={p.y + 3.5} fontSize={8.5} fontFamily={fonts.monoBold} fill={colors.limeInk} textAnchor="middle">
                    {`${i + 1}K`}
                  </SvgText>
                </React.Fragment>
              );
            })
          : null}
        {start ? <Circle cx={start.x} cy={start.y} r={6} fill={colors.bg} stroke={colors.lime} strokeWidth={3} /> : null}
        {cur ? <Circle cx={cur.x} cy={cur.y} r={7} fill={colors.cyan} stroke="#fff" strokeWidth={2} /> : null}
      </Svg>
      <View style={{ position: 'absolute', bottom: 8, right: 10 }}>
        <Label color={colors.dim} style={{ fontSize: 8.5 }}>
          {caption ?? 'Vista previa · mapa real en el dev build'}
        </Label>
      </View>
    </View>
  );
}
