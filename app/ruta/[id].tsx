import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { ElevationProfile } from '@/components/charts';
import { RouteMap } from '@/components/RouteMap';
import { Button, Card, Field, Header, Label, Row, Screen, Segmented, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatNumber, shortDate, localDate } from '@/engine/format';
import { densify, gainLoss } from '@/engine/geo';
import { fetchElevations } from '@/services/weather/openMeteo';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

const SURFACES = ['asfalto', 'mixta', 'tierra', 'pista'] as const;
const SHADES = ['baja', 'media', 'alta'] as const;

export default function RutaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const s = useSettings();
  const [route, setRoute] = useState<repo.StoredRoute | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [surface, setSurface] = useState<string>('asfalto');
  const [shade, setShade] = useState<string>('media');
  const [fav, setFav] = useState(false);
  const [desc, setDesc] = useState('');
  const [elevStatus, setElevStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [runs, setRuns] = useState<repo.RunRow[]>([]);

  const load = async () => {
    const r = await repo.getRoute(db, id);
    setRoute(r);
    if (r) {
      setName(r.name);
      setSurface(r.surface);
      setShade(r.shade);
      setFav(r.isFavorite);
      setDesc(r.description);
    }
    const all = await repo.listRuns(db);
    setRuns(all.filter((x) => x.route_id === id));
    return r;
  };

  useEffect(() => {
    load().then((r) => {
      if (r && !r.elevation) loadElevation(r);
    });
  }, [id]);

  const loadElevation = async (r: repo.StoredRoute) => {
    setElevStatus('loading');
    try {
      const pts = densify(r.path, 100).map(([lat, lon]) => ({ lat, lon }));
      const e = await fetchElevations(pts.slice(0, 300));
      const full = r.outAndBack ? [...e, ...e.slice(0, -1).reverse()] : e;
      await repo.saveRouteElevation(db, r.id, e, Math.round(gainLoss(full).gain));
      setElevStatus('idle');
      await load();
      t.refresh();
    } catch {
      setElevStatus('error');
    }
  };

  if (!route) return <Screen><Header title="Ruta" back /><T color={colors.muted}>Cargando…</T></Screen>;

  const gainPerKm = route.gainM / route.distanceKm;
  const elevFull = route.elevation ? (route.outAndBack ? [...route.elevation, ...route.elevation.slice(0, -1).reverse()] : route.elevation) : null;

  const save = async () => {
    if (!name.trim()) return Alert.alert('Ponle un nombre');
    await repo.updateRoute(db, route.id, { name: name.trim(), surface, shade, isFavorite: fav, description: desc.trim() });
    setEditing(false);
    await load();
    t.refresh();
  };
  const remove = () =>
    Alert.alert('Borrar ruta', 'Las carreras hechas en esta ruta se conservan.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await repo.deleteRoute(db, route.id); t.refresh(); router.back(); } },
    ]);

  return (
    <Screen bottomPad={40}>
      <Header eyebrow={route.source === 'example' ? 'Ruta de ejemplo' : 'Ruta'} title={route.name} back right={<Pressable onPress={() => setEditing((v) => !v)} hitSlop={10}><Feather name={editing ? 'x' : 'edit-2'} size={18} color={colors.lime} /></Pressable>} />
      <RouteMap path={route.path} />

      {editing ? (
        <Card>
          <Field label="Nombre" value={name} onChangeText={setName} />
          <Field label="Descripción" value={desc} onChangeText={setDesc} placeholder="Opcional" />
          <Label>Superficie</Label>
          <Segmented small options={SURFACES.map((x) => ({ value: x, label: x }))} value={surface} onChange={setSurface} />
          <Label>Sombra</Label>
          <Segmented small options={SHADES.map((x) => ({ value: x, label: x }))} value={shade} onChange={setShade} />
          <Pressable onPress={() => setFav((v) => !v)}>
            <Row gap={8}>
              <Feather name={fav ? 'check-square' : 'square'} size={18} color={fav ? colors.lime : colors.muted} />
              <T>Favorita (el motor solo propone favoritas si hay alguna)</T>
            </Row>
          </Pressable>
          <Button label="Guardar cambios" icon="check" onPress={save} />
          <Button label="Borrar ruta" icon="trash-2" variant="ghost" onPress={remove} />
        </Card>
      ) : (
        <Card>
          <Row>
            <Stat label="Distancia" value={`${s.dist(route.distanceKm * 1000)} ${s.du}`} />
            <Stat label="Desnivel +" value={`${Math.round(route.gainM)} m`} sub={`${formatNumber(gainPerKm, 1)} m/km`} />
          </Row>
          <Row>
            <Stat label="Superficie" value={route.surface} />
            <Stat label="Sombra" value={route.shade} />
          </Row>
          {route.description ? <T size={13} color={colors.muted}>{route.description}</T> : null}
          <T size={11} color={colors.dim}>{route.isFavorite ? '★ Favorita · ' : ''}{route.outAndBack ? 'Ida y vuelta' : 'Recorrido completo'} · creada {shortDate(localDate(new Date(route.createdAt)))}</T>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T weight="bold">Perfil altimétrico</T>
          {elevFull ? <T mono size={11} color={colors.muted}>{Math.round(Math.min(...elevFull))}–{Math.round(Math.max(...elevFull))} m</T> : null}
        </Row>
        {elevFull ? <ElevationProfile values={elevFull} /> : (
          <T size={12} color={elevStatus === 'error' ? colors.coral : colors.muted}>
            {elevStatus === 'error' ? 'No se pudo leer la elevación.' : 'Leyendo elevación de Open-Meteo…'}
          </T>
        )}
        {elevStatus === 'error' ? <Button label="Reintentar" variant="secondary" onPress={() => loadElevation(route)} style={{ height: 40 }} /> : null}
        <T size={11} color={colors.dim}>Open-Meteo Elevation (DEM 90 m): aproximado.</T>
      </Card>

      <Button label="Correr esta ruta" icon="play" onPress={() => router.navigate({ pathname: '/carrera', params: { routeId: route.id } })} />

      <Card>
        <Label>Carreras en esta ruta ({runs.length})</Label>
        {runs.length === 0 ? <T size={12} color={colors.muted}>Ninguna todavía.</T> : null}
        {runs.slice(0, 10).map((r) => (
          <Pressable key={r.id} onPress={() => router.push({ pathname: '/resumen/[id]', params: { id: r.id } })}>
            <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
              <T size={13}>{shortDate(localDate(new Date(r.started_at)))}</T>
              <T mono size={12} color={colors.muted}>{s.dist(r.distance_m)} {s.du} · {s.pace(r.avg_pace_s)} {s.pu}</T>
            </Row>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, gap: 3, paddingVertical: 4 }}>
      <Label>{label}</Label>
      <T size={17} weight="extrabold">{value}</T>
      {sub ? <T size={11} color={colors.muted}>{sub}</T> : null}
    </View>
  );
}
