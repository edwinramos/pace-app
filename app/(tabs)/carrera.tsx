import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { RouteMap } from '@/components/RouteMap';
import { Button, Card, Chip, Empty, Header, Label, Row, Screen, Segmented, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { SESSION_LABEL } from '@/engine/rules';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

export default function Carrera() {
  const params = useLocalSearchParams<{ routeId?: string }>();
  const t = useToday();
  const s = useSettings();
  const db = useSQLiteContext();
  const router = useRouter();
  const [routeId, setRouteId] = useState<string>(params.routeId ?? t.rec?.ruta_id ?? 'libre');
  const [shoeId, setShoeId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(10);

  useEffect(() => {
    if (params.routeId) setRouteId(params.routeId);
  }, [params.routeId]);
  useEffect(() => {
    if (!shoeId || !t.shoes.some((x) => x.id === shoeId)) setShoeId(t.shoes.find((x) => x.isDefault)?.id ?? t.shoes[0]?.id ?? null);
  }, [t.shoes]);

  const route = t.routes.find((r) => r.id === routeId) ?? null;
  const rec = t.rec;

  const start = () => {
    router.push({
      pathname: '/live',
      params: { routeId: route?.id ?? 'libre', mode: s.gpsMode, speed: String(s.gpsMode === 'sim' ? speed : 1), shoeId: shoeId ?? '' },
    });
  };

  const addExamples = async () => {
    await repo.addExampleRoutes(db);
    t.refresh();
  };

  return (
    <Screen>
      <Header eyebrow="Carrera" title="Salir a correr" right={<Pressable onPress={() => router.push('/historial')} hitSlop={10}><Row gap={6}><Feather name="list" size={16} color={colors.lime} /><T size={13} color={colors.lime} weight="semibold">Historial</T></Row></Pressable>} />

      {rec && rec.sesion !== 'descanso' && t.todaySession?.status !== 'done' ? (
        <Card accent={colors.lime}>
          <Label color={colors.lime}>Hoy toca</Label>
          <T weight="bold" size={16}>
            {SESSION_LABEL[rec.sesion]} · {s.dist(rec.distancia_km * 1000, 1)} {s.du}
            {rec.ritmo_rango ? ` · ${s.pace(rec.ritmo_rango.from)}–${s.pace(rec.ritmo_rango.to)} ${s.pu}` : ''}
          </T>
        </Card>
      ) : null}

      <Card>
        <Label>Ruta</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pill label="Carrera libre" on={routeId === 'libre'} onPress={() => setRouteId('libre')} />
          {t.routes.map((r) => (
            <Pill key={r.id} label={`${r.isFavorite ? '★ ' : ''}${r.name} · ${s.dist(r.distanceKm * 1000, 1)}`} on={r.id === routeId} onPress={() => setRouteId(r.id)} />
          ))}
        </ScrollView>
        {route ? (
          <Pressable onPress={() => router.push({ pathname: '/ruta/[id]', params: { id: route.id } })}>
            <RouteMap path={route.path} height={150} caption="Toca para ver o editar la ruta" />
          </Pressable>
        ) : (
          <T size={12} color={colors.muted}>Sin ruta: graba por donde vayas y, al terminar, guárdala como ruta si quieres repetirla.</T>
        )}

        <Label>Zapatillas</Label>
        {t.shoes.length ? (
          <Segmented small options={[...t.shoes.map((x) => ({ value: x.id, label: x.model })), { value: '__none', label: 'Ninguna' }]} value={shoeId ?? '__none'} onChange={(v) => setShoeId(v === '__none' ? null : v)} />
        ) : (
          <Pressable onPress={() => router.push({ pathname: '/zapatilla/[id]', params: { id: 'nueva' } })}>
            <T size={12} color={colors.lime}>+ Añadir zapatillas para contar sus km</T>
          </Pressable>
        )}

        <Label>GPS</Label>
        <Segmented options={[{ value: 'gps', label: 'GPS real' }, { value: 'sim', label: 'Simulado' }]} value={s.gpsMode} onChange={(v) => s.set('gpsMode', v)} />
        {s.gpsMode === 'sim' ? (
          <Row gap={8}>
            <T size={12} color={colors.muted}>Velocidad de la simulación:</T>
            <Segmented small options={[1, 10, 30].map((x) => ({ value: x, label: `x${x}` }))} value={speed} onChange={setSpeed} />
          </Row>
        ) : null}
        <T size={11} color={colors.dim} style={{ lineHeight: 16 }}>
          {s.gpsMode === 'gps'
            ? 'GPS del teléfono en primer plano. En Expo Go deja la pantalla encendida (Pace no la deja apagar): con la pantalla apagada Android deja de mandar puntos.'
            : `Recorre ${route ? 'la ruta' : 'un bucle alrededor de tu zona'} a ~5:45 /km. Las carreras simuladas se marcan como tales.`}
        </T>
        <Button label="Comenzar" icon="play" onPress={start} />
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <T size={17} weight="bold">Mis rutas</T>
        <T size={12} color={colors.muted}>{t.routes.length}</T>
      </Row>
      {t.routes.length === 0 ? (
        <Empty
          icon="map"
          title="Aún no tienes rutas"
          text="Haz una carrera y, en el resumen, toca «Guardar como ruta». También puedes cargar rutas de ejemplo de Santo Domingo."
          action={<Button label="Añadir rutas de ejemplo" variant="secondary" onPress={addExamples} />}
        />
      ) : (
        t.routes.map((r) => (
          <Pressable key={r.id} onPress={() => router.push({ pathname: '/ruta/[id]', params: { id: r.id } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Feather name={r.isFavorite ? 'star' : 'map'} size={18} color={r.isFavorite ? colors.lime : colors.muted} />
              <View style={{ flex: 1 }}>
                <T weight="bold">{r.name}</T>
                <T size={12} color={colors.muted}>
                  {s.dist(r.distanceKm * 1000)} {s.du} · +{Math.round(r.gainM)} m · {r.surface} · sombra {r.shade}
                </T>
              </View>
              {r.id === rec?.ruta_id ? <Chip label="Sugerida" filled /> : null}
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        ))
      )}
      {t.routes.length > 0 && !t.routes.some((r) => r.source === 'example') ? (
        <Pressable onPress={addExamples}>
          <T size={12} color={colors.dim} style={{ textAlign: 'center' }}>+ Añadir rutas de ejemplo</T>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? colors.lime : colors.border, backgroundColor: on ? colors.lime + '18' : colors.card }}>
        <T size={13} weight="semibold" color={on ? colors.lime : colors.muted}>{label}</T>
      </View>
    </Pressable>
  );
}
