import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { BarChart, LineChart } from '@/components/charts';
import { Button, Card, Empty, Header, Label, ProgressBar, Row, Screen, Stat, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { distValue, formatDuration, formatNumber, paceValue } from '@/engine/format';
import { paceTrend, sleepVsPace, totals, weeklyStats, type RunLite } from '@/engine/metrics';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

export default function Metricas() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const s = useSettings();
  const [runs, setRuns] = useState<RunLite[] | null>(null);
  const [health, setHealth] = useState<repo.HealthRow[]>([]);
  const [shoes, setShoes] = useState<repo.Shoe[]>([]);

  useFocusEffect(
    useCallback(() => {
      repo.listRuns(db).then((r) => setRuns(r.map((x) => ({ startedAt: x.started_at, distanceM: x.distance_m, movingS: x.moving_s, sessionType: x.session_type }))));
      repo.getHealthHistory(db, 60).then(setHealth);
      repo.getShoes(db, true).then(setShoes);
    }, [db]),
  );

  const now = new Date();
  const rd = t.rec?.recuperacion ?? null;
  const rdColor = !t.healthData ? colors.dim : (rd ?? 0) >= 70 ? colors.lime : (rd ?? 0) >= 50 ? colors.amber : colors.coral;

  if (runs && runs.length === 0) {
    return (
      <Screen>
        <Header eyebrow="Métricas" title="Tu progreso" />
        <RecoveryCard rd={t.healthData ? rd : null} color={rdColor} text={t.rec?.razones.filter((r) => r.id === 'R3' || r.id === 'R4').map((r) => r.text).join(' ')} />
        <Empty icon="bar-chart-2" title="Aún no hay carreras" text="El volumen semanal, el ritmo medio, la tendencia y los km por zapatilla se calculan con tus carreras guardadas." action={<Button label="Salir a correr" onPress={() => router.navigate('/carrera')} />} />
      </Screen>
    );
  }
  const list = runs ?? [];
  const weeks = weeklyStats(list, now, 8);
  const labels = weeks.map((w) => `${Number(w.monday.slice(8))}/${Number(w.monday.slice(5, 7))}`);
  const tot = totals(list);
  const last4 = totals(list.filter((r) => r.startedAt >= now.getTime() - 28 * 86400000));
  const trend = paceTrend(list, now);
  const pairs = sleepVsPace(list, health.map((h) => ({ date: h.date, sleepMin: h.sleep_min }))).slice(-7);
  const paceWeeks = weeks.map((w) => paceValue(w.avgPace, s.units));

  return (
    <Screen>
      <Header eyebrow="Métricas" title="Tu progreso" />
      <RecoveryCard rd={t.healthData ? rd : null} color={rdColor} text={t.rec?.razones.filter((r) => r.id === 'R3' || r.id === 'R4').map((r) => r.text).join(' ')} />

      <Card>
        <Label>Totales</Label>
        <Row>
          <Stat label="Carreras" value={String(tot.runs)} />
          <Stat label={s.du} value={s.dist(tot.km * 1000, 0)} />
          <Stat label="Tiempo" value={formatDuration(tot.movingS, true)} />
        </Row>
        <Row>
          <Stat label="Ritmo medio" value={s.pace(tot.avgPace)} unit={s.pu} />
          <Stat label="Más larga" value={s.dist(tot.longestKm * 1000, 1)} unit={s.du} />
          <Stat label="Mejor ritmo" value={s.pace(tot.bestPace)} unit={s.pu} />
        </Row>
        <T size={11} color={colors.dim}>Últimas 4 semanas: {last4.runs} carreras · {s.dist(last4.km * 1000, 1)} {s.du} · {s.pace(last4.avgPace)} {s.pu}</T>
      </Card>

      <Card>
        <T weight="bold">Volumen semanal</T>
        <T size={12} color={colors.muted}>Últimas 8 semanas ({s.du}) · esta semana {s.dist(weeks[7].km * 1000, 1)}</T>
        <BarChart values={weeks.map((w) => distValue(w.km * 1000, s.units))} labels={labels} />
      </Card>

      <Card>
        <T weight="bold">Ritmo medio por semana</T>
        {paceWeeks.filter((x) => x != null).length >= 2 ? (
          <LineChart values={paceWeeks} labels={labels} invert format={(v) => s.pace(v / (s.units === 'mi' ? 1.609344 : 1))} />
        ) : (
          <T size={12} color={colors.muted}>Hace falta correr en al menos 2 semanas distintas.</T>
        )}
        {trend ? (
          <T size={13} color={trend.slopePerWeek < 0 ? colors.lime : colors.amber}>
            Tendencia (90 días, {trend.n} carreras): {trend.slopePerWeek < 0 ? 'más rápido' : 'más lento'} {formatNumber(Math.abs(paceValue(trend.slopePerWeek, s.units) ?? 0), 1)} s{s.pu} por semana.
          </T>
        ) : (
          <T size={12} color={colors.dim}>La tendencia aparece con 4 carreras de 1 km o más en los últimos 90 días.</T>
        )}
      </Card>

      <Card>
        <T weight="bold">Km por zapatilla</T>
        {shoes.length === 0 ? <T size={12} color={colors.muted}>Sin zapatillas registradas.</T> : null}
        {shoes.map((x) => (
          <View key={x.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={13} weight="semibold" color={x.retiredAt ? colors.dim : colors.text}>{x.name}{x.retiredAt ? ' (retirada)' : ''}</T>
              <T mono size={12} color={colors.muted}>{Math.round(x.totalKm)} / {x.retireKm} km · {x.runs} carreras</T>
            </Row>
            <ProgressBar value={x.totalKm / x.retireKm} color={x.totalKm >= x.retireKm ? colors.coral : x.totalKm >= x.retireKm - 50 ? colors.amber : colors.lime} />
          </View>
        ))}
      </Card>

      <Card>
        <T weight="bold">Sueño vs ritmo</T>
        {pairs.length >= 3 ? (
          <>
            <T size={12} color={colors.muted}>Horas de sueño la noche anterior y ritmo de ese día</T>
            <BarChart values={pairs.map((p) => p.sleepH)} labels={pairs.map((p) => p.date.slice(8))} color={colors.cyan} highlightLast={false} height={110} />
            <LineChart values={pairs.map((p) => paceValue(p.pace, s.units))} labels={pairs.map((p) => p.date.slice(8))} color={colors.lime} invert format={(v) => s.pace(v / (s.units === 'mi' ? 1.609344 : 1))} height={110} />
          </>
        ) : (
          <T size={12} color={colors.dim}>Aparece cuando haya al menos 3 días con sueño registrado y una carrera ese día ({pairs.length}/3).</T>
        )}
      </Card>
    </Screen>
  );
}

function RecoveryCard({ rd, color, text }: { rd: number | null; color: string; text?: string }) {
  return (
    <Card>
      <Label>Recuperación de hoy</Label>
      <Row gap={14}>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 7, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <T size={26} weight="extrabold">{rd ?? '—'}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={13} color={colors.muted} style={{ lineHeight: 19 }}>
            {rd == null ? 'Sin sueño ni FC de hoy. Regístralos en Hoy.' : text || 'Sueño y FC en reposo dentro de lo normal.'}
          </T>
        </View>
      </Row>
    </Card>
  );
}
