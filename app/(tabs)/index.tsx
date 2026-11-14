import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Card, Chip, Empty, initials, Label, ProgressBar, Row, Screen, SimBadge, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatSleep, greeting, hourLabel, hourOf, localDate, longDate } from '@/engine/format';
import { GOAL_INFO, mondayIso, weekOf } from '@/engine/plans';
import { SESSION_LABEL } from '@/engine/rules';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors, sessionColor } from '@/theme';

function uvLabel(uv: number) {
  return uv >= 8 ? 'Alto' : uv >= 6 ? 'Mod.' : 'Bajo';
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Hoy() {
  const t = useToday();
  const s = useSettings();
  const router = useRouter();
  const db = useSQLiteContext();
  const [showWhy, setShowWhy] = useState(false);
  const [weekM, setWeekM] = useState(0);
  const now = new Date();

  useFocusEffect(
    useCallback(() => {
      const monday = new Date(mondayIso(localDate(new Date())) + 'T00:00:00').getTime();
      repo.listRuns(db, monday).then((runs) => setWeekM(runs.reduce((a, r) => a + r.distance_m, 0)));
    }, [db]),
  );

  if (t.loading && !t.rec) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.lime} />
        <T color={colors.muted}>Leyendo clima y tu plan…</T>
      </View>
    );
  }

  const rec = t.rec;
  const w = t.weather;
  const h = t.healthData;
  const route = t.routes.find((r) => r.id === rec?.ruta_id) ?? null;
  const first = (t.profile?.name ?? '').split(' ')[0];
  const week = t.plan ? weekOf(t.sessions, mondayIso(t.date)) : [];
  const weekTarget = week.reduce((a, x) => a + x.km, 0) * 1000;
  const done = t.todaySession?.status === 'done';
  const hours = (w?.hourly ?? []).filter((x) => x.time.startsWith(t.date) && hourOf(x.time) >= Math.max(5, now.getHours()) && hourOf(x.time) <= 20);
  const rd = rec?.recuperacion ?? 0;
  const rdColor = !h ? colors.dim : rd >= 70 ? colors.lime : rd >= 50 ? colors.amber : colors.coral;
  const heatLead = !rec ? '' : rec.nivel_calor === 2 ? 'Calor alto' : rec.nivel_calor === 1 ? ((w?.current.humidity ?? 0) >= 80 ? 'Caluroso y húmedo' : 'Caluroso') : 'Buen día para correr';
  const headline = !rec
    ? ''
    : rec.sesion === 'descanso'
      ? 'Hoy toca descanso o 20–30 min muy suaves.'
      : `${heatLead}: ${SESSION_LABEL[rec.sesion]} de ${s.dist(rec.distancia_km * 1000, 1)} ${s.du}${route ? ` por ${route.name}` : ''}.`;

  return (
    <Screen onRefresh={() => t.refresh(true)} refreshing={t.loading}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Row gap={6}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime }} />
            <Label>Hoy</Label>
          </Row>
          <T size={28} weight="extrabold" style={{ letterSpacing: -0.5 }}>¡{greeting(now)}{first ? `, ${first}` : ''}!</T>
          <Row gap={6}>
            <Feather name="map-pin" size={12} color={colors.lime} />
            <T size={13} color={colors.muted}>{t.profile?.home_label ?? '—'} · {longDate(now)}</T>
          </Row>
        </View>
        <Avatar initials={initials(t.profile?.name)} onPress={() => router.navigate('/perfil')} />
      </Row>

      {/* Recuperación + clima */}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Recuperación</Label>
          {t.healthOrigin === 'mock' ? <SimBadge /> : t.healthOrigin === 'manual' ? <Chip label="Manual" color={colors.cyan} /> : <Chip label="Sin datos" color={colors.dim} />}
        </Row>
        {h ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <Metric label="Sueño" value={formatSleep(h.sleepHours)} sub={h.sleepHours == null ? 'Sin dato' : h.sleepHours < 7 ? 'Corto' : 'Suficiente'} color={colors.amber} />
            <Metric label="FC reposo" value={h.restingHr != null ? `${Math.round(h.restingHr)}` : '—'} sub={h.restingHrBaseline ? `Base ${Math.round(h.restingHrBaseline)} lpm` : 'Base: faltan días'} />
            <Metric label="Estado" value={`${rd}`} sub={rd >= 70 ? 'Buena' : rd >= 50 ? 'Moderada' : 'Baja'} color={rdColor} />
          </Row>
        ) : (
          <T size={13} color={colors.muted}>Sin sueño ni FC de hoy: la recomendación no penaliza y baja la confianza.</T>
        )}
        <Button label={t.healthOrigin === 'manual' ? 'Editar sueño y FC de hoy' : 'Registrar sueño y FC de hoy'} icon="edit-3" variant="secondary" onPress={() => router.push('/recuperacion')} style={{ height: 44 }} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        {w ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <MiniWeather icon="thermometer" label="Temp" value={`${Math.round(w.current.temperature)} °C`} />
            <MiniWeather icon="droplet" label="Humedad" value={`${Math.round(w.current.humidity)} %`} color={colors.cyan} />
            <MiniWeather icon="wind" label="Viento" value={`${Math.round(w.current.windKmh)} km/h`} />
            <MiniWeather icon="sun" label="UV máx" value={`${Math.round(w.uvMax)} ${uvLabel(w.uvMax)}`} color={w.uvMax >= 8 ? colors.amber : colors.text} />
          </Row>
        ) : (
          <T size={13} color={colors.coral}>No se pudo leer el clima de Open-Meteo. Desliza hacia abajo para reintentar.</T>
        )}
        <Label color={colors.dim} style={{ fontSize: 9 }}>
          {t.weatherStatus === 'live' ? 'Clima en vivo · Open-Meteo (CC BY 4.0)' : t.weatherStatus === 'cache' ? 'Clima de caché (< 1 h) · Open-Meteo' : t.weatherStatus === 'stale' ? 'Sin conexión: última lectura' : 'Sin clima'}
        </Label>
      </Card>

      {/* Veredicto */}
      {rec ? (
        <Card accent={done ? colors.cyan : colors.lime} style={{ backgroundColor: done ? colors.card : '#171C12' }}>
          <Row gap={6}>
            <Feather name={done ? 'check-circle' : 'zap'} size={14} color={done ? colors.cyan : colors.lime} />
            <Label color={done ? colors.cyan : colors.lime}>{done ? 'Sesión de hoy completada' : 'Recomendación del día'}</Label>
            <View style={{ flex: 1 }} />
            <Chip label={`Confianza ${rec.confianza}`} color={rec.confianza === 'alta' ? colors.lime : rec.confianza === 'media' ? colors.amber : colors.coral} />
          </Row>
          <T size={17} weight="bold" style={{ lineHeight: 25 }}>{headline}</T>
          {rec.ritmo_rango ? (
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Chip label={`Ritmo ${s.pace(rec.ritmo_rango.from)}–${s.pace(rec.ritmo_rango.to)} ${s.pu}`} color={colors.cyan} />
              {rec.ajuste_ritmo !== 'sin ajuste' ? <Chip label={rec.ajuste_ritmo} color={colors.amber} /> : null}
              {rec.ventana ? <Chip label={`${rec.ventana.desde}–${rec.ventana.hasta}`} color={colors.amber} /> : null}
            </Row>
          ) : null}
          {rec.alertas.map((a, i) => (
            <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}>
              <Feather name="alert-triangle" size={14} color={a.id === 'S1' ? colors.coral : colors.amber} style={{ marginTop: 2 }} />
              <T size={13} color={colors.muted} style={{ flex: 1 }}>{a.text}</T>
            </Row>
          ))}
          <Pressable onPress={() => setShowWhy((v) => !v)}>
            <Row gap={6}>
              <Feather name={showWhy ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
              <T size={13} color={colors.muted} weight="semibold">¿Por qué? ({rec.razones.length})</T>
            </Row>
          </Pressable>
          {showWhy
            ? rec.razones.map((r, i) => (
                <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}>
                  <T mono size={11} color={colors.lime} style={{ width: 38 }}>{r.id}</T>
                  <T size={13} color={colors.muted} style={{ flex: 1 }}>{r.text}</T>
                </Row>
              ))
            : null}
          {!done && rec.sesion !== 'descanso' ? (
            <Button label="Ir a correr" icon="play" onPress={() => router.navigate({ pathname: '/carrera', params: { routeId: rec.ruta_id ?? 'libre' } })} />
          ) : null}
        </Card>
      ) : null}

      {/* Ventana térmica */}
      {hours.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Row gap={8}>
            <Feather name="clock" size={16} color={colors.lime} />
            <T size={17} weight="bold">Ventana térmica hoy</T>
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {hours.map((x) => {
              const best = rec?.ventana?.desde === hourLabel(x.time);
              return (
                <View key={x.time} style={{ width: best ? 140 : 90, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: best ? colors.lime : colors.border, padding: 12, gap: 6 }}>
                  {best ? <Chip label="Mejor hora" filled /> : null}
                  <T mono size={12} color={best ? colors.text : colors.muted}>{hourLabel(x.time)}</T>
                  <T size={best ? 30 : 24} weight="extrabold">{Math.round(x.temperature)}°</T>
                  <T size={11} color={colors.muted}>ST {Math.round(x.apparent)}°</T>
                  <T size={11} color={x.uv >= 6 ? colors.amber : x.precipProb >= 60 ? colors.cyan : colors.muted}>
                    {x.uv >= 6 ? `UV ${Math.round(x.uv)} evitar` : x.precipProb >= 60 ? `Lluvia ${x.precipProb} %` : `${Math.round(x.humidity)} % hum.`}
                  </T>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Plan */}
      {t.plan ? (
        <Pressable onPress={() => router.navigate('/planes')}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label>Plan {GOAL_INFO[t.plan.goal].label}</Label>
              {t.todaySession ? <Chip label={`Sem ${t.todaySession.week} / ${t.plan.weeks}`} color={colors.cyan} /> : null}
            </Row>
            <Row gap={10}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: sessionColor[t.planned.type] }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={12} color={colors.muted}>Según el plan</T>
                <T size={15} weight="semibold">
                  {t.planned.type === 'descanso' ? 'Descanso' : `${cap(SESSION_LABEL[t.planned.type])} · ${s.dist(t.planned.km * 1000, 1)} ${s.du}`}
                </T>
                {t.todaySession?.note ? <T size={11} color={colors.amber}>{t.todaySession.note}</T> : null}
              </View>
            </Row>
            {rec && !done && (rec.sesion !== t.planned.type || Math.abs(rec.distancia_km - t.planned.km) > 0.3) && t.planned.type !== 'descanso' ? (
              <T size={13} color={colors.muted} style={{ lineHeight: 19 }}>
                <T size={13} weight="bold" color={colors.amber}>Adaptación: </T>
                las reglas la cambian a {rec.sesion === 'descanso' ? 'descanso' : `${SESSION_LABEL[rec.sesion]} de ${s.dist(rec.distancia_km * 1000, 1)} ${s.du}`}. Si corres hoy, la sesión original se intenta mover a otro día de la semana.
              </T>
            ) : null}
            {t.planChanges.length ? <T size={11} color={colors.dim}>{t.planChanges.map((c) => c.text).join(' ')}</T> : null}
            {weekTarget > 0 ? (
              <>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={12} color={colors.muted}>Semana: {s.dist(weekM, 1)} / {s.dist(weekTarget, 1)} {s.du}</T>
                  <T mono size={11} color={colors.muted}>{Math.round((weekM / weekTarget) * 100)} %</T>
                </Row>
                <ProgressBar value={weekM / weekTarget} />
              </>
            ) : null}
          </Card>
        </Pressable>
      ) : (
        <Empty icon="calendar" title="Sin plan activo" text="Crea un plan desde tu meta y fecha." action={<Button label="Crear plan" onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} />} />
      )}

      {t.error ? <T size={12} color={colors.coral}>Error: {t.error}</T> : null}
    </Screen>
  );
}

function Metric({ label, value, sub, color = colors.text }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Label>{label}</Label>
      <T size={22} weight="extrabold" color={color}>{value}</T>
      <T size={12} color={colors.muted} numberOfLines={1}>{sub}</T>
    </View>
  );
}

function MiniWeather({ icon, label, value, color = colors.text }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Feather name={icon} size={14} color={colors.lime} />
      <Label style={{ fontSize: 9 }}>{label}</Label>
      <T size={13} weight="bold" color={color}>{value}</T>
    </View>
  );
}
