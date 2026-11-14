import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

export function BarChart({
  values,
  labels,
  height = 140,
  width = 320,
  highlightLast = true,
  color = colors.lime,
}: {
  values: number[];
  labels: string[];
  height?: number;
  width?: number;
  highlightLast?: boolean;
  color?: string;
}) {
  const max = Math.max(1, ...values) * 1.15;
  const n = values.length;
  const gap = 10;
  const bw = (width - gap * (n + 1)) / n;
  const chartH = height - 22;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const h = (v / max) * chartH;
        const x = gap + i * (bw + gap);
        const last = highlightLast && i === n - 1;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={chartH - h} width={bw} height={Math.max(2, h)} rx={6} fill={last ? color : color + '40'} />
            <SvgText x={x + bw / 2} y={chartH - h - 5} fill={colors.text} fontSize={10} fontFamily={fonts.mono} textAnchor="middle">
              {Math.round(v)}
            </SvgText>
            <SvgText x={x + bw / 2} y={height - 4} fill={colors.dim} fontSize={9.5} fontFamily={fonts.mono} textAnchor="middle">
              {labels[i]}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function LineChart({
  values,
  labels,
  height = 130,
  width = 320,
  color = colors.cyan,
  invert = false,
  format = (v: number) => String(v),
}: {
  values: (number | null)[];
  labels: string[];
  height?: number;
  width?: number;
  color?: string;
  /** para ritmo: menor es mejor, se dibuja arriba */
  invert?: boolean;
  format?: (v: number) => string;
}) {
  const vals = values.filter((v): v is number => v != null);
  if (vals.length === 0) return <View style={{ height }} />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.2 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const chartH = height - 22;
  const n = values.length;
  const x = (i: number) => 18 + (i * (width - 36)) / Math.max(1, n - 1);
  const y = (v: number) => {
    const f = (v - lo) / (hi - lo);
    return invert ? 8 + f * (chartH - 16) : chartH - 8 - f * (chartH - 16);
  };
  const pts = values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={f} x1={0} x2={width} y1={chartH * f} y2={chartH * f} stroke={colors.border} strokeDasharray="3 5" />
      ))}
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) =>
        v == null ? null : (
          <React.Fragment key={i}>
            <Circle cx={x(i)} cy={y(v)} r={i === n - 1 ? 5 : 3.5} fill={i === n - 1 ? color : colors.bg} stroke={color} strokeWidth={2} />
            <SvgText x={x(i)} y={y(v) - 9} fill={colors.muted} fontSize={9.5} fontFamily={fonts.mono} textAnchor="middle">
              {format(v)}
            </SvgText>
          </React.Fragment>
        ),
      )}
      {labels.map((l, i) => (
        <SvgText key={l + i} x={x(i)} y={height - 4} fill={colors.dim} fontSize={9.5} fontFamily={fonts.mono} textAnchor="middle">
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Perfil altimétrico simple. */
export function ElevationProfile({ values, height = 90, width = 320 }: { values: number[]; height?: number; width?: number }) {
  if (values.length < 2) return <View style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 5);
  const x = (i: number) => (i * width) / (values.length - 1);
  const y = (v: number) => height - 6 - ((v - min) / (max - min)) * (height - 16);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={`${d} L${width},${height} L0,${height} Z`} fill={colors.lime + '22'} />
      <Path d={d} fill="none" stroke={colors.lime} strokeWidth={2.5} />
    </Svg>
  );
}
