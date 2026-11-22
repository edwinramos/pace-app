import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { RouteMap } from '@/components/RouteMap';
import { Button, Card, Chip, Field, Header, Label, ProgressBar, Row, Screen, Segmented, SimBadge, Stat, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { diagnose } from '@/engine/diagnosis';
import { formatDuration, formatPace, localDate, longDate } from '@/engine/format';
import { pathLength, simplify } from '@/engine/geo';
import { toGPX, toJSON } from '@/engine/gpx';
import { SESSION_LABEL } from '@/engine/rules';
import { goodPoints, splitPace } from '@/engine/run';
import { safeFileName, shareText } from '@/services/export';
import { health } from '@/services/health';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

type Loaded = NonNullable<Awaited<ReturnType<typeof repo.getRun>>>;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Resumen() {
  const { id, alert, marked } = useLocalSearchParams<{ id: string; alert?: string; marked?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const st = useSettings();
  const [data, setData] = useState<Loaded | null>(null);
  const [shoes, setShoes] = useState<repo.Shoe[]>([]);
  const [route, setRoute] = useState<repo.StoredRoute | null>(null);
  const [saving, setSaving] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);

  const load = async () => {
    const d = await repo.getRun(db, id);
    setData(d);
    setShoes(await repo.getShoes(db, true));
    setRoute(d?.run.route_id ? await repo.getRoute(db, d.run.route_id) : null);
  };
  useEffect(() => {
    load();
  }, [id]);

  if (!data) return <Screen><Header title="Resumen" back /><T color={colors.muted}>Cargando…</T></Screen>;
  const { run, splits, points } = data;
  const shoe = shoes.find((x) => x.id === run.shoe_id) ?? null;
  const target = run.target_from && run.target_to ? { from: run.target_from, to: run.target_to } : null;
  const full = splits.filter((s) => !s.partialKm);
  const fastest = full.length ? full.reduce((a, b) => (splitPace(b) < splitPace(a) ? b : a)) : null;
  const slowest = full.length > 1 ? full.reduce((a, b) => (splitPace(b) > splitPace(a) ? b : a)) : null;
  const isTreadmill = run.gps_mode === 'treadmill';
  const text = diagnose({ splits, target, humidity: run.weather_humidity ?? undefined, apparent: run.weather_apparent ?? undefined, shoe });
  const title = `${run.session_type ? cap(SESSION_LABEL[run.session_type as keyof typeof SESSION_LABEL] ?? run.session_type) : 'Carrera'} · ${isTreadmill ? 'caminadora' : (route?.name ?? 'libre')}`;
  const trace = points.map((p) => ({ lat: p.lat, lon: p.lon }));

  const saveHC = async () => {
    setSaving(true);
    try {
      const ok = (await health.hasPermissions()) || (await health.requestPermissions());
      if (!ok) throw new Error('Permiso denegado');
      const recId = await health.saveExercise({ startTime: run.started_at, endTime: run.ended_at, distanceM: run.distance_m, title: `Pace · ${route?.name ?? 'Carrera'}`, kcal: run.kcal ?? undefined });
      await repo.setRunHcRecord(db, run.id, recId);
      await load();
    } catch (e: any) {
      Alert.alert('No se pudo guardar', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const exportAs = async (kind: 'gpx' | 'json') => {
    const base = safeFileName(`pace_${localDate(new Date(run.started_at))}_${route?.name ?? 'carrera'}`);
    try {
      if (kind === 'gpx') await shareText(`${base}.gpx`, toGPX({ name: title, startedAt: run.started_at }, points), 'application/gpx+xml');
      else await shareText(`${base}.json`, toJSON({ ...run }, points, splits), 'application/json');
    } catch (e: any) {
      Alert.alert('No se pudo exportar', String(e?.message ?? e));
    }
  };

  const saveAsRoute = async () => {
    const good = goodPoints(points);
    if (good.length < 5) return Alert.alert('Pocos puntos', 'La traza es demasiado corta para guardarla como ruta.');
    setSavingRoute(true);
    const path = simplify(good.map((p) => [p.lat, p.lon] as [number, number]), 6);
    const rid = await repo.createRoute(db, { name: routeName.trim() || `Ruta del ${longDate(new Date(run.started_at))}`, path, distanceM: pathLength(path), gainM: Math.round(run.gain_m ?? 0), source: 'run', isFavorite: true });
    await repo.setRunRoute(db, run.id, rid);
    await t.refresh();
    setSavingRoute(false);
    router.push({ pathname: '/ruta/[id]', params: { id: rid } });
  };

  const changeShoe = async (v: string) => {
    await repo.setRunShoe(db, run.id, v === '__none' ? null : v);
    await load();
    t.refresh();
  };

  const remove = () =>
    Alert.alert('Borrar carrera', 'Se borran la traza y los parciales. Si estaba asociada a una sesión del plan, la sesión vuelve a pendiente o perdida.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await repo.deleteRun(db, run.id, t.date); await t.refresh(); router.back(); } },
    ]);

  return (
    <Screen bottomPad={40}>
      <Header eyebrow="Resumen de sesión" title={title} back />
      <T size={13} color={colors.muted}>
        {longDate(new Date(run.started_at))} · {new Date(run.started_at).toTimeString().slice(0, 5)}
        {run.gps_mode === 'sim' ? ' · GPS simulado' : run.gps_mode === 'treadmill' ? ' · Caminadora' : ''}
      </T>
      {alert ? (
        <Card accent={colors.coral}>
          <Row gap={8}><Feather name="alert-triangle" size={16} color={colors.coral} /><T weight="bold" color={colors.coral}>Zapatillas</T></Row>
          <T size={13}>{alert}</T>
        </Card>
      ) : null}
      {marked ? <Chip label="Sesión del plan marcada como hecha" color={colors.lime} /> : null}

      {!isTreadmill && trace.length > 1 ? <RouteMap path={route?.path ?? []} live={trace} caption={fastest && slowest ? `Km más rápido: ${fastest.km} · más lento: ${slowest.km}` : 'Traza'} /> : null}

      <View style={{ gap: 2 }}>
        <Label>Distancia total</Label>
        <T size={54} weight="extrabold" style={{ letterSpacing: -1 }}>
          {st.dist(run.distance_m)} <T size={22} color={colors.lime}>{st.du}</T>
        </T>
      </View>
      <Row gap={10}>
        <Card style={{ flex: 1 }}><Stat label="Tiempo" value={formatDuration(run.moving_s, true)} sub="en movimiento" /></Card>
        <Card style={{ flex: 1 }}><Stat label="Ritmo medio" value={st.pace(run.avg_pace_s)} unit={st.pu} sub={target ? `Objetivo ${st.pace(target.from)}–${st.pace(target.to)}` : undefined} /></Card>
      </Row>
      <Row gap={10}>
        <Card style={{ flex: 1 }}><Stat label="Desnivel +" value={`${Math.round(run.gain_m ?? 0)} m`} sub={isTreadmill ? 'por inclinación' : 'del GPS'} /></Card>
        <Card style={{ flex: 1 }}><Stat label="Calorías" value={run.kcal != null ? `${Math.round(run.kcal)}` : '—'} sub={run.kcal != null ? 'estimadas' : 'pon tu peso en Perfil'} /></Card>
      </Row>

      <Card accent={colors.lime}>
        <Row gap={6}><Feather name="cpu" size={14} color={colors.lime} /><Label color={colors.lime}>Diagnóstico</Label></Row>
        <T size={14} style={{ lineHeight: 21 }}>{text}</T>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Parciales por km</Label>
          <Label>Ritmo /km · desnivel</Label>
        </Row>
        {splits.map((s) => (
          <Row key={s.km} style={{ justifyContent: 'space-between' }}>
            <T mono size={13} color={colors.muted} style={{ width: 60 }}>{s.partialKm ? `+${Math.round(s.partialKm * 1000)} m` : `km ${s.km}`}</T>
            <T mono size={13} weight="bold" color={s === fastest ? colors.lime : s === slowest ? colors.amber : colors.text}>{formatPace(splitPace(s))}</T>
            <T mono size={12} color={colors.muted} style={{ width: 50, textAlign: 'right' }}>+{s.gainM} m</T>
          </Row>
        ))}
        {splits.length === 0 ? <T size={12} color={colors.muted}>Sin parciales.</T> : null}
      </Card>

      <Card>
        <Label>Zapatillas de esta carrera</Label>
        <Segmented small options={[...shoes.filter((x) => !x.retiredAt || x.id === run.shoe_id).map((x) => ({ value: x.id, label: x.model })), { value: '__none', label: 'Ninguna' }]} value={run.shoe_id ?? '__none'} onChange={changeShoe} />
        {shoe ? (
          <>
            <T size={12} color={colors.muted}>{shoe.name}: {Math.round(shoe.totalKm)} de {shoe.retireKm} km</T>
            <ProgressBar value={shoe.totalKm / shoe.retireKm} color={shoe.totalKm >= shoe.retireKm ? colors.coral : shoe.totalKm >= shoe.retireKm - 50 ? colors.amber : colors.lime} />
          </>
        ) : null}
      </Card>

      {!run.route_id && !isTreadmill ? (
        <Card>
          <Label>Guardar como ruta</Label>
          <Field value={routeName} onChangeText={setRouteName} placeholder={`Ruta del ${longDate(new Date(run.started_at))}`} />
          <Button label="Guardar como ruta" icon="map" variant="secondary" onPress={saveAsRoute} loading={savingRoute} />
        </Card>
      ) : null}

      <Row gap={10}>
        <Button label="GPX" icon="share-2" variant="secondary" onPress={() => exportAs('gpx')} style={{ flex: 1 }} />
        <Button label="JSON" icon="share-2" variant="secondary" onPress={() => exportAs('json')} style={{ flex: 1 }} />
      </Row>

      {run.hc_record_id ? (
        <Card accent={colors.lime}>
          <Row gap={8}>
            <Feather name="check-circle" size={16} color={colors.lime} />
            <T weight="bold" color={colors.lime}>Guardada en Health Connect</T>
            {health.simulated ? <SimBadge /> : null}
          </Row>
        </Card>
      ) : (
        <Button label="Guardar en Health Connect" icon="heart" variant="secondary" onPress={saveHC} loading={saving} />
      )}
      {health.simulated && !run.hc_record_id ? <T size={11} color={colors.dim} style={{ textAlign: 'center' }}>Simulado en Expo Go; en el dev build escribirá una sesión de ejercicio real.</T> : null}

      <Button label="Listo" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Pressable onPress={remove}>
        <T size={13} color={colors.coral} style={{ textAlign: 'center', paddingVertical: 8 }}>Borrar carrera</T>
      </Pressable>
    </Screen>
  );
}
