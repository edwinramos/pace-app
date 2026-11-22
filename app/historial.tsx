import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Empty, Header, Label, Row, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatDuration, longDate } from '@/engine/format';
import { totals } from '@/engine/metrics';
import { SESSION_LABEL } from '@/engine/rules';
import { useSettings } from '@/state/settings';
import { colors } from '@/theme';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Historial() {
  const db = useSQLiteContext();
  const router = useRouter();
  const s = useSettings();
  const [runs, setRuns] = useState<repo.RunRow[] | null>(null);
  const [routes, setRoutes] = useState<Map<string, string>>(new Map());

  useFocusEffect(
    useCallback(() => {
      repo.listRuns(db).then(setRuns);
      repo.getRoutes(db).then((r) => setRoutes(new Map(r.map((x) => [x.id, x.name]))));
    }, [db]),
  );

  const groups = new Map<string, repo.RunRow[]>();
  for (const r of runs ?? []) {
    const d = new Date(r.started_at);
    const k = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  return (
    <Screen bottomPad={40}>
      <Header eyebrow="Carreras" title="Historial" back />
      {runs && runs.length === 0 ? (
        <Empty icon="activity" title="Sin carreras" text="Cuando termines una carrera aparecerá aquí, con su traza, parciales y exportación GPX." action={<Button label="Salir a correr" onPress={() => router.navigate('/carrera')} />} />
      ) : null}
      {[...groups.entries()].map(([month, list]) => {
        const tt = totals(list.map((r) => ({ startedAt: r.started_at, distanceM: r.distance_m, movingS: r.moving_s })));
        return (
          <View key={month} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label>{month}</Label>
              <T mono size={11} color={colors.muted}>{tt.runs} · {s.dist(tt.km * 1000, 1)} {s.du} · {formatDuration(tt.movingS, true)}</T>
            </Row>
            {list.map((r) => (
              <Pressable key={r.id} onPress={() => router.push({ pathname: '/resumen/[id]', params: { id: r.id } })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="bold">{s.dist(r.distance_m)} {s.du} · {s.pace(r.avg_pace_s)} {s.pu}</T>
                    <T size={12} color={colors.muted}>
                      {longDate(new Date(r.started_at))} · {r.gps_mode === 'treadmill' ? 'caminadora' : (r.route_id ? routes.get(r.route_id) ?? 'ruta' : 'libre')}
                      {r.session_type ? ` · ${SESSION_LABEL[r.session_type as keyof typeof SESSION_LABEL] ?? r.session_type}` : ''}
                      {r.gps_mode === 'sim' ? ' · simulada' : ''}
                    </T>
                  </View>
                  {r.plan_session_id ? <Feather name="check-circle" size={16} color={colors.lime} /> : null}
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </Card>
              </Pressable>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
