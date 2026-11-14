import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Button, Card, Header, Label, ListRow, Row, Screen, Stat, T, initials } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatDuration, shortDate } from '@/engine/format';
import { totals } from '@/engine/metrics';
import { LEVEL_LABEL } from '@/engine/paces';
import { GOAL_INFO } from '@/engine/plans';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function Perfil() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const s = useSettings();
  const [tot, setTot] = useState<ReturnType<typeof totals> | null>(null);
  useFocusEffect(
    useCallback(() => {
      repo.listRuns(db).then((r) => setTot(totals(r.map((x) => ({ startedAt: x.started_at, distanceM: x.distance_m, movingS: x.moving_s })))));
    }, [db]),
  );
  const p = t.profile;
  const plan = t.plan;
  const active = t.shoes.filter((x) => !x.retiredAt);
  const def = active.find((x) => x.isDefault);

  return (
    <Screen>
      <Header eyebrow="Perfil" title={p?.name || 'Corredor'} right={<Avatar initials={initials(p?.name)} />} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Datos</Label>
          <Pressable onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} hitSlop={10}><T size={12} color={colors.lime}>Editar</T></Pressable>
        </Row>
        <Row>
          <Stat label="Nivel" value={p ? LEVEL_LABEL[p.level] : '—'} />
          <Stat label="Edad" value={p?.age ? String(p.age) : '—'} />
          <Stat label="FC máx" value={p?.max_hr ? String(p.max_hr) : '—'} unit="ppm" />
        </Row>
        <Row>
          <Stat label="Peso" value={p?.weight_kg ? String(p.weight_kg) : '—'} unit={p?.weight_kg ? 'kg' : undefined} />
          <Stat label="Mejor 5K" value={p?.five_k_s ? formatDuration(p.five_k_s) : '—'} />
          <Stat label="Ubicación" value={p?.home_label ?? '—'} />
        </Row>
      </Card>

      <Card accent={colors.lime}>
        <Label color={colors.lime}>Objetivo</Label>
        {plan ? (
          <>
            <T size={20} weight="extrabold">{GOAL_INFO[plan.goal].label} · {shortDate(plan.goal_date)}</T>
            <T size={12} color={colors.muted}>{plan.weeks} semanas · días {plan.days.map((d) => DIAS[d]).join(' ')}</T>
            {plan.warnings.map((w) => <T key={w} size={12} color={colors.amber}>{w}</T>)}
          </>
        ) : (
          <T size={13} color={colors.muted}>Sin plan activo.</T>
        )}
        <Button label={plan ? 'Cambiar objetivo' : 'Crear plan'} variant="secondary" onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} />
      </Card>

      {tot ? (
        <Card>
          <Label>Total histórico</Label>
          <Row>
            <Stat label="Carreras" value={String(tot.runs)} />
            <Stat label={s.du} value={s.dist(tot.km * 1000, 0)} />
            <Stat label="Tiempo" value={formatDuration(tot.movingS, true)} />
          </Row>
        </Card>
      ) : null}

      <View style={{ gap: 8 }}>
        <ListRow icon="list" title="Historial de carreras" sub={tot ? `${tot.runs} guardadas` : undefined} onPress={() => router.push('/historial')} />
        <ListRow icon="moon" title="Recuperación" sub="Sueño y FC en reposo" color={colors.cyan} onPress={() => router.push('/recuperacion')} />
        <ListRow icon="box" title="Zapatillas" sub={def ? `${def.name} · ${Math.round(def.totalKm)} km` : `${active.length} activas`} color={colors.amber} onPress={() => router.navigate('/equipo')} />
        <ListRow icon="watch" title="Fuentes de datos" sub={s.healthSource === 'manual' ? 'Registro manual' : 'Simulado'} color={colors.cyan} onPress={() => router.navigate('/dispositivos')} />
        <ListRow icon="settings" title="Ajustes" sub={`${s.du} · voz ${s.voice ? 'activada' : 'desactivada'}`} color={colors.muted} onPress={() => router.push('/ajustes')} />
      </View>
    </Screen>
  );
}
