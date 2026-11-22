import { Feather } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteMap } from '@/components/RouteMap';
import { Button, Card, Label, Row, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatDuration, formatNumber, formatPace } from '@/engine/format';
import { loopAround } from '@/engine/geo';
import { estimateKcal, splitPace } from '@/engine/run';
import { finishRun } from '@/state/actions';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { useRunSession } from '@/state/useRunSession';
import { colors, fonts } from '@/theme';

export default function Live() {
  useKeepAwake();
  const params = useLocalSearchParams<{
    routeId?: string;
    mode?: string;
    speed?: string;
    treadmillSpeed?: string;
    treadmillIncline?: string;
    shoeId?: string;
  }>();
  const t = useToday();
  const st = useSettings();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mode = params.mode === 'sim' ? 'sim' : params.mode === 'treadmill' ? 'treadmill' : 'gps';
  const route = mode === 'treadmill' ? null : (t.routes.find((r) => r.id === params.routeId) ?? null);
  const shoeId = params.shoeId || null;
  const [voice, setVoice] = useState(st.voice);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  // carrera libre simulada: bucle alrededor de tu zona
  const [freeLoop] = useState(() => loopAround(t.profile?.home_lat ?? 18.4655, t.profile?.home_lon ?? -69.8863));

  const run = useRunSession({
    mode,
    route: route ? { path: route.path, outAndBack: route.outAndBack } : { path: freeLoop, outAndBack: false },
    speedup: Number(params.speed ?? 1) || 1,
    initialSpeedKmh: Number(params.treadmillSpeed ?? 10) || 10,
    initialInclinePct: Number(params.treadmillIncline ?? 1) || 0,
    origin: { lat: t.profile?.home_lat ?? 18.4655, lon: t.profile?.home_lon ?? -69.8863 },
    voice,
  });

  const target = t.rec && t.rec.sesion !== 'descanso' ? t.rec.ritmo_rango : null;
  const goalKm = route ? route.distanceKm : t.rec?.distancia_km || 5;
  const inRange = run.pace != null && target ? run.pace >= target.from - 15 && run.pace <= target.to + 10 : null;
  const kcal = estimateKcal(run.distanceM, t.profile?.weight_kg ?? 70);
  const fmtD = (m: number) => st.dist(m);

  const save = async () => {
    run.finish();
    if (run.distanceM < 50) {
      Alert.alert('Carrera muy corta', 'Menos de 50 m: no se guarda.', [{ text: 'Salir', onPress: () => router.back() }]);
      return;
    }
    setSaving(true);
    try {
      const res = await finishRun(
        db,
        {
          started_at: run.startedAt ?? Date.now(),
          ended_at: Date.now(),
          distance_m: run.distanceM,
          moving_s: run.movingS,
          avg_pace_s: run.avgPace,
          avg_hr: null,
          max_hr: null,
          gain_m: run.gainM,
          kcal: t.profile?.weight_kg ? kcal : null,
          route_id: route?.id ?? null,
          shoe_id: shoeId,
          session_type: t.rec?.sesion ?? null,
          target_from: target?.from ?? null,
          target_to: target?.to ?? null,
          recommendation_date: t.rec?.fecha ?? null,
          gps_mode: mode,
          weather_apparent: mode === 'treadmill' ? null : (t.weather?.current.apparent ?? null),
          weather_humidity: mode === 'treadmill' ? null : (t.weather?.current.humidity ?? null),
        },
        run.points,
        run.splits,
        { planId: t.plan?.id ?? null, rec: t.rec },
      );
      if (t.rec && route?.id === t.rec.ruta_id) await repo.markRecommendationAccepted(db, t.rec.fecha, true);
      await t.refresh();
      router.replace({ pathname: '/resumen/[id]', params: { id: res.id, alert: res.shoeAlert ?? '', marked: res.sessionMarked ? '1' : '' } });
    } catch (e: any) {
      setSaving(false);
      Alert.alert('No se pudo guardar', String(e?.message ?? e));
    }
  };

  const cancel = () => {
    if (run.status === 'idle') return router.back();
    Alert.alert('¿Descartar la carrera?', 'No se guardará nada.', [
      { text: 'Seguir', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => { run.finish(); router.back(); } },
    ]);
  };

  const live = useMemo(() => run.points.map((p) => ({ lat: p.lat, lon: p.lon })), [run.points.length]);
  const splitsShown = run.splits.slice(-5);

  const modeLabel = mode === 'treadmill' ? 'Caminadora (en casa)' : mode === 'sim' ? 'GPS simulado' : 'GPS trabajando';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 200, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: run.status === 'running' ? colors.lime : run.status === 'paused' ? colors.amber : colors.dim }} />
            <Label color={run.status === 'running' ? colors.lime : colors.muted}>
              {modeLabel} · {run.status === 'running' ? 'En curso' : run.status === 'paused' ? 'En pausa' : 'Listo'}
            </Label>
          </Row>
          <Pressable onPress={cancel} hitSlop={10} disabled={locked}>
            <Feather name="x" size={20} color={colors.muted} />
          </Pressable>
        </Row>
        <Label>{mode === 'treadmill' ? 'Corrida en caminadora' : (route?.name ?? 'Carrera libre')} · meta {st.dist(goalKm * 1000)} {st.du}</Label>

        <Card>
          <Label>Tiempo activo</Label>
          <T mono weight="bold" size={46} style={{ letterSpacing: -1 }}>{formatDuration(run.movingS)}</T>
          <Label>Distancia recorrida</Label>
          <T size={44} weight="extrabold">
            {fmtD(run.distanceM)} <T size={18} color={colors.muted}>{st.du}</T>
          </T>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
            <View style={{ width: `${Math.min(100, (run.distanceM / 1000 / goalKm) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.lime }} />
          </View>
        </Card>

        {mode === 'treadmill' ? (
          <Card accent={colors.lime}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label color={colors.lime}>Control de caminadora</Label>
              <T mono size={11} color={colors.muted}>+{Math.round(run.gainM)} m desnivel</T>
            </Row>
            <Row gap={10}>
              <View style={{ flex: 1, backgroundColor: colors.cardHi, borderRadius: 14, padding: 10, gap: 8, borderWidth: 1, borderColor: colors.border }}>
                <Label>Velocidad (km/h)</Label>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <StepBtn icon="minus" disabled={locked} onPress={() => run.setTreadmillSpeed(run.treadmillSpeedKmh - 0.5)} />
                  <View style={{ alignItems: 'center' }}>
                    <T size={24} weight="extrabold" color={colors.lime}>{formatNumber(run.treadmillSpeedKmh, 1)}</T>
                    <T size={11} color={colors.muted}>{st.pace(3600 / run.treadmillSpeedKmh)} {st.pu}</T>
                  </View>
                  <StepBtn icon="plus" disabled={locked} onPress={() => run.setTreadmillSpeed(run.treadmillSpeedKmh + 0.5)} />
                </Row>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.cardHi, borderRadius: 14, padding: 10, gap: 8, borderWidth: 1, borderColor: colors.border }}>
                <Label>Inclinación (%)</Label>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <StepBtn icon="minus" disabled={locked} onPress={() => run.setTreadmillIncline(run.treadmillInclinePct - 0.5)} />
                  <View style={{ alignItems: 'center' }}>
                    <T size={24} weight="extrabold" color={colors.cyan}>{formatNumber(run.treadmillInclinePct, 1)} %</T>
                    <T size={11} color={colors.muted}>+{Math.round(run.treadmillInclinePct * 10)} m/km</T>
                  </View>
                  <StepBtn icon="plus" disabled={locked} onPress={() => run.setTreadmillIncline(run.treadmillInclinePct + 0.5)} />
                </Row>
              </View>
            </Row>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {[8, 9, 10, 11, 12, 14].map((v) => {
                const active = Math.abs(run.treadmillSpeedKmh - v) < 0.05;
                return (
                  <Pressable key={v} disabled={locked} onPress={() => run.setTreadmillSpeed(v)} style={{ flex: 1 }}>
                    <View style={{ paddingVertical: 6, borderRadius: 10, alignItems: 'center', backgroundColor: active ? colors.lime + '22' : colors.cardHi, borderWidth: 1, borderColor: active ? colors.lime : colors.border }}>
                      <T mono size={11} weight="bold" color={active ? colors.lime : colors.muted}>{v} km/h</T>
                    </View>
                  </Pressable>
                );
              })}
            </Row>
          </Card>
        ) : null}

        <Row gap={10}>
          <Card style={{ flex: 1 }}>
            <Label>Ritmo actual</Label>
            <T size={26} weight="extrabold">{st.pace(run.pace)} <T size={12} color={colors.muted}>{st.pu}</T></T>
            <T size={11} color={inRange == null ? colors.muted : inRange ? colors.lime : colors.amber}>
              {target ? `${inRange == null ? 'Objetivo' : inRange ? 'En rango' : 'Fuera de rango'} · ${st.pace(target.from)}–${st.pace(target.to)}` : 'Sin objetivo'}
            </T>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Frecuencia</Label>
            <T size={26} weight="extrabold" color={colors.cyan}>— <T size={12} color={colors.muted}>bpm</T></T>
            <T size={11} color={colors.muted}>Tras sincronizar el reloj</T>
          </Card>
        </Row>
        <Row gap={10}>
          <Card style={{ flex: 1 }}>
            <Label>Ritmo medio</Label>
            <T size={22} weight="extrabold">{st.pace(run.avgPace)} <T size={12} color={colors.muted}>{st.pu}</T></T>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label>Calorías (est.)</Label>
            <T size={22} weight="extrabold">{t.profile?.weight_kg ? kcal : '—'} <T size={12} color={colors.muted}>kcal</T></T>
          </Card>
        </Row>

        {mode !== 'treadmill' ? (
          route || live.length > 1 ? (
            <RouteMap path={route?.path ?? []} live={live} height={150} caption={`Traza GPS ${mode === 'sim' ? 'simulada' : 'en vivo'} · +${Math.round(run.gainM)} m`} />
          ) : (
            <Card><T size={12} color={colors.muted}>{run.status === 'idle' ? 'La traza aparecerá al empezar.' : 'Esperando señal GPS…'}</T></Card>
          )
        ) : null}
        {run.error ? (
          <Card accent={colors.coral}>
            <T size={13} color={colors.coral}>{run.error}</T>
          </Card>
        ) : null}

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Parciales por kilómetro</Label>
            <T mono size={11} color={colors.muted}>Promedio: {formatPace(run.avgPace)} /km</T>
          </Row>
          {splitsShown.length === 0 ? <T size={12} color={colors.muted}>Aún sin parciales.</T> : null}
          {splitsShown.map((s) => {
            const p = splitPace(s);
            const w = Math.max(0.15, Math.min(1, (420 - p) / 150));
            return (
              <Row key={s.km} gap={10}>
                <T mono size={11} color={colors.muted} style={{ width: 44 }}>KM {s.km}</T>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border }}>
                  <View style={{ width: `${w * 100}%`, height: 6, borderRadius: 3, backgroundColor: s.partialKm ? colors.cyan : colors.muted }} />
                </View>
                <T mono size={12} weight="bold" color={s.partialKm ? colors.cyan : colors.text}>
                  {formatPace(p)}{s.partialKm ? ' proy.' : ''}
                </T>
              </Row>
            );
          })}
        </Card>

        <Row gap={10}>
          <Card style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <T weight="bold">Coach IA</T>
              <T size={11} color={colors.muted}>Voz c/ 1 km</T>
            </View>
            <Switch
              value={voice}
              onValueChange={(v) => { setVoice(v); st.set('voice', v); }}
              disabled={locked}
              trackColor={{ true: colors.lime, false: colors.border }}
              thumbColor={colors.bg}
            />
          </Card>
          <Card style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <T weight="bold">Anti-sudor</T>
              <T size={11} color={locked ? colors.amber : colors.muted}>{locked ? 'Bloqueado' : 'Desbloqueado'}</T>
            </View>
            <Switch value={locked} onValueChange={setLocked} trackColor={{ true: colors.amber, false: colors.border }} thumbColor={colors.bg} />
          </Card>
        </Row>
      </ScrollView>

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 14, gap: 10 }}>
        {run.status === 'idle' ? (
          <Button label="Empezar" icon="play" onPress={run.start} />
        ) : (
          <>
            {run.status === 'running' ? (
              <Button label="Pausar carrera" icon="pause" onPress={run.pause} disabled={locked} />
            ) : (
              <Button label="Reanudar" icon="play" onPress={run.resume} disabled={locked} />
            )}
            <SwipeToFinish onDone={save} disabled={locked || saving} />
            {saving ? <T size={12} color={colors.muted} style={{ textAlign: 'center' }}>Guardando…</T> : null}
          </>
        )}
      </View>
    </View>
  );
}

function StepBtn({ icon, onPress, disabled }: { icon: 'plus' | 'minus'; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
        <Feather name={icon} size={16} color={colors.text} />
      </View>
    </Pressable>
  );
}

function SwipeToFinish({ onDone, disabled }: { onDone: () => void; disabled?: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(300);
  const knob = 50;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const max = w - knob - 8;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(max, g.dx))),
        onPanResponderRelease: (_, g) => {
          if (g.dx >= max * 0.85) {
            Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: false }).start(() => doneRef.current());
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
          }
        },
      }),
    [max, disabled],
  );
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 58, borderRadius: 29, backgroundColor: colors.coral + '22', borderWidth: 1, borderColor: colors.coral + '66', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <T mono size={12} color={colors.coral} style={{ textAlign: 'center', letterSpacing: 1.5, fontFamily: fonts.monoBold }}>
        DESLIZA PARA FINALIZAR
      </T>
      <Animated.View
        {...responder.panHandlers}
        style={{ position: 'absolute', left: 4, width: knob, height: knob, borderRadius: knob / 2, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: x }] }}
      >
        <Feather name="square" size={18} color="#fff" />
      </Animated.View>
    </View>
  );
}
