import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { RouteMap } from '@/components/RouteMap';
import { Button, Card, Chip, Empty, Header, Label, Row, Screen, Segmented, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatNumber } from '@/engine/format';
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
  const [treadmillSpeed, setTreadmillSpeed] = useState<number>(10);
  const [treadmillIncline, setTreadmillIncline] = useState<number>(1);

  useEffect(() => {
    if (params.routeId) setRouteId(params.routeId);
  }, [params.routeId]);
  useEffect(() => {
    if (!shoeId || !t.shoes.some((x) => x.id === shoeId)) setShoeId(t.shoes.find((x) => x.isDefault)?.id ?? t.shoes[0]?.id ?? null);
  }, [t.shoes]);

  // Si hay recomendación con ritmo objetivo, sugerir esa velocidad inicial en la caminadora
  useEffect(() => {
    if (t.rec?.ritmo_rango) {
      const midPaceS = (t.rec.ritmo_rango.from + t.rec.ritmo_rango.to) / 2;
      const suggestedKmh = Math.round((3600 / midPaceS) * 2) / 2;
      if (suggestedKmh >= 4 && suggestedKmh <= 22) {
        setTreadmillSpeed(suggestedKmh);
      }
    }
  }, [t.rec?.ritmo_rango?.from, t.rec?.ritmo_rango?.to]);

  const route = s.gpsMode === 'treadmill' ? null : (t.routes.find((r) => r.id === routeId) ?? null);
  const rec = t.rec;

  const start = () => {
    router.push({
      pathname: '/live',
      params: {
        routeId: s.gpsMode === 'treadmill' ? 'libre' : (route?.id ?? 'libre'),
        mode: s.gpsMode,
        speed: String(s.gpsMode === 'sim' ? speed : 1),
        treadmillSpeed: String(treadmillSpeed),
        treadmillIncline: String(treadmillIncline),
        shoeId: shoeId ?? '',
      },
    });
  };

  const addExamples = async () => {
    await repo.addExampleRoutes(db);
    t.refresh();
  };

  const adjSpeed = (delta: number) =>
    setTreadmillSpeed((v) => Math.max(2, Math.min(24, Math.round((v + delta) * 10) / 10)));
  const adjIncline = (delta: number) =>
    setTreadmillIncline((v) => Math.max(0, Math.min(15, Math.round((v + delta) * 2) / 2)));

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
        <Label>Modo de carrera</Label>
        <Segmented
          options={[
            { value: 'gps', label: 'GPS real' },
            { value: 'treadmill', label: 'Caminadora' },
            { value: 'sim', label: 'Simulado' },
          ]}
          value={s.gpsMode}
          onChange={(v) => s.set('gpsMode', v)}
        />

        {s.gpsMode === 'treadmill' ? (
          <View style={{ gap: 10 }}>
            <Row gap={10}>
              <View style={{ flex: 1, backgroundColor: colors.cardHi, borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.border }}>
                <Label>Velocidad inicial</Label>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <StepBtn icon="minus" onPress={() => adjSpeed(-0.5)} />
                  <View style={{ alignItems: 'center' }}>
                    <T size={22} weight="extrabold" color={colors.lime}>{formatNumber(treadmillSpeed, 1)}</T>
                    <T size={11} color={colors.muted}>km/h · {s.pace(3600 / treadmillSpeed)} {s.pu}</T>
                  </View>
                  <StepBtn icon="plus" onPress={() => adjSpeed(0.5)} />
                </Row>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.cardHi, borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.border }}>
                <Label>Inclinación</Label>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <StepBtn icon="minus" onPress={() => adjIncline(-0.5)} />
                  <View style={{ alignItems: 'center' }}>
                    <T size={22} weight="extrabold" color={colors.cyan}>{formatNumber(treadmillIncline, 1)} %</T>
                    <T size={11} color={colors.muted}>{treadmillIncline === 1 ? 'Equiv. exterior' : `+${Math.round(treadmillIncline * 10)} m/km`}</T>
                  </View>
                  <StepBtn icon="plus" onPress={() => adjIncline(0.5)} />
                </Row>
              </View>
            </Row>
            <T size={11} color={colors.dim} style={{ lineHeight: 16 }}>
              Corrida en casa (caminadora): sin GPS. Puedes subir o bajar la velocidad (km/h) y la inclinación (%) en vivo mientras corres.
            </T>
          </View>
        ) : (
          <>
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
          </>
        )}

        <Label>Zapatillas</Label>
        {t.shoes.length ? (
          <Segmented small options={[...t.shoes.map((x) => ({ value: x.id, label: x.model })), { value: '__none', label: 'Ninguna' }]} value={shoeId ?? '__none'} onChange={(v) => setShoeId(v === '__none' ? null : v)} />
        ) : (
          <Pressable onPress={() => router.push({ pathname: '/zapatilla/[id]', params: { id: 'nueva' } })}>
            <T size={12} color={colors.lime}>+ Añadir zapatillas para contar sus km</T>
          </Pressable>
        )}

        {s.gpsMode === 'sim' ? (
          <Row gap={8}>
            <T size={12} color={colors.muted}>Velocidad de la simulación:</T>
            <Segmented small options={[1, 10, 30].map((x) => ({ value: x, label: `x${x}` }))} value={speed} onChange={setSpeed} />
          </Row>
        ) : null}
        {s.gpsMode !== 'treadmill' ? (
          <T size={11} color={colors.dim} style={{ lineHeight: 16 }}>
            {s.gpsMode === 'gps'
              ? 'GPS del teléfono en primer plano. Deja la pantalla encendida (Pace no la deja apagar) para registrar todos los puntos.'
              : `Recorre ${route ? 'la ruta' : 'un bucle alrededor de tu zona'} a ~5:45 /km. Las carreras simuladas se marcan como tales.`}
          </T>
        ) : null}
        <Button label={s.gpsMode === 'treadmill' ? 'Comenzar en caminadora' : 'Comenzar'} icon="play" onPress={start} />
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

function StepBtn({ icon, onPress }: { icon: 'plus' | 'minus'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={16} color={colors.text} />
      </View>
    </Pressable>
  );
}
