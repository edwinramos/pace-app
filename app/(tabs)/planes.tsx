import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Card, Chip, Empty, Header, Label, ProgressBar, Row, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { shortDate } from '@/engine/format';
import { addDays, daysBetween, GOAL_INFO, mondayIso, weekOf, type PlanSession } from '@/engine/plans';
import { SESSION_LABEL } from '@/engine/rules';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors, sessionColor } from '@/theme';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Planes() {
  const t = useToday();
  const s = useSettings();
  const db = useSQLiteContext();
  const router = useRouter();
  const [monday, setMonday] = useState(mondayIso(t.date));

  useEffect(() => setMonday(mondayIso(t.date)), [t.date]);

  if (!t.plan) {
    return (
      <Screen>
        <Header eyebrow="Planes" title="Tu entrenamiento" />
        <Empty icon="calendar" title="Sin plan activo" text="Elige meta, fecha y días disponibles para generar el plan." action={<Button label="Crear plan" onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} />} />
      </Screen>
    );
  }

  const plan = t.plan;
  const all = t.sessions;
  const running = all.filter((x) => x.type !== 'descanso');
  const doneN = running.filter((x) => x.status === 'done').length;
  const missedN = running.filter((x) => x.status === 'missed').length;
  const week = weekOf(all, monday);
  const firstMonday = mondayIso(all[0]?.date ?? plan.start_date);
  const lastMonday = mondayIso(plan.goal_date);
  const weekNo = week[0]?.week ?? Math.floor(daysBetween(firstMonday, monday) / 7) + 1;
  const weekKm = week.reduce((a, x) => a + x.km, 0);
  const daysLeft = daysBetween(t.date, plan.goal_date);

  const onSession = (x: PlanSession) => {
    if (x.status === 'done' && x.runId) return router.push({ pathname: '/resumen/[id]', params: { id: x.runId } });
    if (x.type === 'descanso') return;
    const opts: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [{ text: 'Cerrar', style: 'cancel' }];
    if (x.status !== 'skipped') opts.push({ text: 'Marcar como saltada', onPress: () => setStatus(x, 'skipped') });
    if (x.status !== 'planned' && x.date >= t.date) opts.push({ text: 'Volver a pendiente', onPress: () => setStatus(x, 'planned') });
    if (x.date === t.date && x.status === 'planned') opts.push({ text: 'Correr ahora', onPress: () => router.navigate('/carrera') });
    Alert.alert(`${cap(SESSION_LABEL[x.type])} · ${shortDate(x.date)}`, `${s.dist(x.km * 1000, 1)} ${s.du}${x.note ? `\n${x.note}` : ''}`, opts);
  };
  const setStatus = async (x: PlanSession, st: PlanSession['status']) => {
    if (!x.id) return;
    await repo.setSessionStatus(db, x.id, st, null);
    t.refresh();
  };

  return (
    <Screen>
      <Header eyebrow="Planes" title={`Plan ${GOAL_INFO[plan.goal].label}`} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold">Carrera: {shortDate(plan.goal_date)}</T>
          <Chip label={daysLeft >= 0 ? `Faltan ${daysLeft} días` : 'Terminado'} color={colors.cyan} />
        </Row>
        <ProgressBar value={running.length ? doneN / running.length : 0} />
        <T size={12} color={colors.muted}>
          {doneN} de {running.length} sesiones hechas · {missedN} perdidas · {plan.weeks} semanas · días {plan.days.map((d) => DAYS[d]).join(', ')}
        </T>
        {plan.warnings.map((w, i) => (
          <T key={i} size={12} color={colors.amber}>{w}</T>
        ))}
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable disabled={monday <= firstMonday} onPress={() => setMonday(addDays(monday, -7))} hitSlop={10} style={{ opacity: monday <= firstMonday ? 0.3 : 1 }}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setMonday(mondayIso(t.date))}>
          <View style={{ alignItems: 'center' }}>
            <T weight="bold">Semana {weekNo} de {plan.weeks}</T>
            <T size={11} color={colors.muted}>{shortDate(monday)} · {s.dist(weekKm * 1000, 1)} {s.du}</T>
          </View>
        </Pressable>
        <Pressable disabled={monday >= lastMonday} onPress={() => setMonday(addDays(monday, 7))} hitSlop={10} style={{ opacity: monday >= lastMonday ? 0.3 : 1 }}>
          <Feather name="chevron-right" size={22} color={colors.text} />
        </Pressable>
      </Row>

      <Card style={{ gap: 4 }}>
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(monday, i);
          const x = week.find((w) => w.date === date);
          const isToday = date === t.date;
          const type = x?.type ?? 'descanso';
          const c = sessionColor[type];
          const st = x?.status;
          return (
            <Pressable key={date} onPress={() => x && onSession(x)}>
              <Row gap={12} style={{ paddingVertical: 9, paddingHorizontal: 8, borderRadius: 12, backgroundColor: isToday ? colors.lime + '12' : 'transparent', borderWidth: isToday ? 1 : 0, borderColor: colors.lime + '66' }}>
                <View style={{ width: 38 }}>
                  <T mono size={11} color={colors.muted}>{DAYS[i]}</T>
                  <T weight="bold">{Number(date.slice(8))}</T>
                </View>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: x ? c : colors.border }} />
                <View style={{ flex: 1 }}>
                  <T weight="semibold" color={!x || type === 'descanso' ? colors.dim : colors.text}>
                    {!x ? '—' : type === 'descanso' ? 'Descanso' : `${cap(SESSION_LABEL[type])} · ${s.dist(x.km * 1000, 1)} ${s.du}`}
                  </T>
                  {x?.note ? <T size={11} color={colors.amber} numberOfLines={2}>{x.note}</T> : null}
                </View>
                {st === 'done' ? <Feather name="check-circle" size={18} color={colors.lime} /> : st === 'missed' ? <Feather name="x-circle" size={18} color={colors.coral} /> : st === 'skipped' ? <Feather name="slash" size={18} color={colors.dim} /> : isToday && type !== 'descanso' ? <Chip label="Hoy" filled /> : null}
              </Row>
            </Pressable>
          );
        })}
      </Card>

      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        {(['suave', 'tempo', 'series', 'larga', 'carrera'] as const).map((k) => (
          <Row key={k} gap={4}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sessionColor[k] }} />
            <T size={11} color={colors.muted}>{cap(SESSION_LABEL[k])}</T>
          </Row>
        ))}
      </Row>

      <Card>
        <Label>Cómo se adapta</Label>
        <T size={12} color={colors.muted} style={{ lineHeight: 18 }}>
          R10: una sesión clave perdida se mueve a un rodaje suave posterior de la misma semana. R11: con 2 o más perdidas en 7 días, los próximos 7 días bajan un 10 %. R8/R1: si la recuperación o el calor cambian la sesión de hoy y corres, la original se intenta mover.
        </T>
      </Card>
      <Button label="Cambiar meta o regenerar" icon="refresh-cw" variant="secondary" onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} />
    </Screen>
  );
}
