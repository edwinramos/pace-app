import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Button, Card, Field, Header, Label, Row, Screen, Segmented, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatPace, localDate, parseDmy, toDmy } from '@/engine/format';
import { derivePaces, estimateMaxHr, LEVEL_LABEL, type Level } from '@/engine/paces';
import { addDays, GOAL_INFO, generatePlan, type Goal } from '@/engine/plans';
import { currentPlace } from '@/services/location/current';
import { searchPlaces, type Place } from '@/services/weather/openMeteo';
import { createPlanFromConfig } from '@/state/actions';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Onboarding (primera vez) y edición del perfil/meta (?edit=1). */
export default function Onboarding() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1';
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const today = localDate(new Date());

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [weight, setWeight] = useState('');
  const [level, setLevel] = useState<Level>('intermedio');
  const [fiveK, setFiveK] = useState('');
  const [goal, setGoal] = useState<Goal>('10k');
  const [goalDate, setGoalDate] = useState(toDmy(addDays(today, 10 * 7)));
  const [days, setDays] = useState<number[]>([1, 3, 5, 6]);
  const [longDay, setLongDay] = useState<number | undefined>(undefined);
  const [place, setPlace] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [locBusy, setLocBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(!isEdit);

  // cargar valores actuales al editar
  useEffect(() => {
    (async () => {
      const p = await repo.getProfile(db);
      if (p) {
        setName(p.name);
        setAge(p.age ? String(p.age) : '');
        setMaxHr(p.max_hr ? String(p.max_hr) : '');
        setWeight(p.weight_kg ? String(p.weight_kg) : '');
        setLevel(p.level);
        setFiveK(p.five_k_s ? formatPace(p.five_k_s).replace(/^(\d+):/, '$1:') : '');
        setPlace({ lat: p.home_lat, lon: p.home_lon, label: p.home_label ?? 'Mi zona' });
      }
      const plan = await repo.getActivePlan(db);
      if (plan) {
        setGoal(plan.goal);
        setGoalDate(toDmy(plan.goal_date));
        setDays(plan.days);
        setLongDay(plan.long_day ?? undefined);
      }
    })();
  }, [db]);

  const ageN = parseInt(age, 10);
  const estHr = ageN > 10 && ageN < 100 ? estimateMaxHr(ageN) : null;
  const fiveKS = parseTime(fiveK);
  const goalIso = parseDmy(goalDate);
  const paces = derivePaces(level, fiveKS, goal);

  let preview: string | null = null;
  try {
    if (goalIso) {
      const g = generatePlan({ goal, level, startDate: today, goalDate: goalIso, days, longDay });
      preview = `${g.weeks} semanas · ${g.sessions.filter((s) => s.type !== 'descanso').length} sesiones${g.warnings.length ? ` · ${g.warnings[0]}` : ''}`;
    }
  } catch (e: any) {
    preview = String(e.message);
  }

  const useGps = async () => {
    setLocBusy(true);
    try {
      setPlace(await currentPlace());
      setResults([]);
    } catch (e: any) {
      Alert.alert('Ubicación', `${e?.message ?? e}. Busca tu ciudad a mano.`);
    } finally {
      setLocBusy(false);
    }
  };
  const search = async () => {
    setLocBusy(true);
    try {
      const r = await searchPlaces(query);
      setResults(r);
      if (r.length === 0) Alert.alert('Sin resultados', 'Prueba con otro nombre.');
    } catch {
      Alert.alert('Sin conexión', 'No se pudo buscar en Open-Meteo.');
    } finally {
      setLocBusy(false);
    }
  };

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    if (!name.trim()) return Alert.alert('Falta tu nombre');
    if (!place) return Alert.alert('Falta la ubicación', 'Usa el GPS o busca tu ciudad: se usa para el clima.');
    if (!goalIso) return Alert.alert('Fecha no válida', 'Usa el formato dd/mm/aaaa.');
    if (days.length < 2) return Alert.alert('Días', 'Elige al menos 2 días por semana.');
    setSaving(true);
    try {
      await repo.saveProfile(db, {
        name: name.trim(),
        age: ageN > 0 ? ageN : null,
        max_hr: parseInt(maxHr, 10) || estHr,
        weight_kg: parseFloat(weight.replace(',', '.')) || null,
        level,
        five_k_s: fiveKS,
        home_lat: place.lat,
        home_lon: place.lon,
        home_label: place.label,
      });
      if (regen) await createPlanFromConfig(db, { goal, level, startDate: today, goalDate: goalIso, days, longDay });
      await t.refresh(true);
      if (isEdit && router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e: any) {
      Alert.alert('No se pudo guardar', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen bottomPad={40}>
      <Header eyebrow={isEdit ? 'Perfil' : 'Bienvenido a Pace'} title={isEdit ? 'Editar perfil y meta' : 'Configura tu plan'} back={isEdit} />
      {!isEdit ? <T color={colors.muted}>Todo se guarda solo en este teléfono. Puedes cambiarlo después en Perfil.</T> : null}

      <Card>
        <Label>Tú</Label>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Edwin" />
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Field label="Edad" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="35" style={{ flex: 1 }} />
          <Field label="FC máx (lpm)" value={maxHr} onChangeText={setMaxHr} keyboardType="number-pad" placeholder={estHr ? String(estHr) : '—'} hint={estHr ? `Estimada: ${estHr} (208 − 0,7·edad)` : 'Opcional'} style={{ flex: 1 }} />
        </Row>
        <Field label="Peso (kg, opcional)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Para estimar calorías" />
        <Label>Nivel</Label>
        <Segmented options={(Object.keys(LEVEL_LABEL) as Level[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))} value={level} onChange={setLevel} />
        <Field label="Tiempo reciente en 5K (opcional)" value={fiveK} onChangeText={setFiveK} placeholder="mm:ss, p. ej. 28:40" hint={`Ritmos: suave ${formatPace(paces.suave.from)}–${formatPace(paces.suave.to)} · tempo ${formatPace(paces.tempo.from)} · series ${formatPace(paces.series.from)} /km`} />
      </Card>

      <Card>
        <Label>Meta</Label>
        <Segmented options={(Object.keys(GOAL_INFO) as Goal[]).map((g) => ({ value: g, label: GOAL_INFO[g].label }))} value={goal} onChange={setGoal} />
        <Field label="Fecha de la carrera" value={goalDate} onChangeText={setGoalDate} placeholder="dd/mm/aaaa" hint={goalIso ? undefined : 'Formato dd/mm/aaaa'} />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {[6, 8, 10, 12, 16].map((w) => (
            <Pressable key={w} onPress={() => setGoalDate(toDmy(addDays(today, w * 7)))}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
                <T size={12} color={colors.muted}>+{w} sem</T>
              </View>
            </Pressable>
          ))}
        </Row>
        <Label>Días disponibles</Label>
        <Row gap={6}>
          {DAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <Pressable key={i} onPress={() => toggleDay(i)} style={{ flex: 1 }}>
                <View style={{ height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? colors.lime : colors.border, backgroundColor: on ? colors.lime + '1A' : 'transparent' }}>
                  <T weight="bold" color={on ? colors.lime : colors.muted}>{d}</T>
                </View>
              </Pressable>
            );
          })}
        </Row>
        {days.length >= 2 ? (
          <>
            <Label>Día de la tirada larga</Label>
            <Segmented small options={days.map((d) => ({ value: d, label: DAYS[d] }))} value={longDay ?? (days.includes(6) ? 6 : days.includes(5) ? 5 : days[days.length - 1])} onChange={setLongDay} />
          </>
        ) : null}
        {preview ? <T size={12} color={colors.cyan}>{preview}</T> : null}
        {isEdit ? (
          <Pressable onPress={() => setRegen((v) => !v)}>
            <Row gap={8}>
              <Feather name={regen ? 'check-square' : 'square'} size={18} color={regen ? colors.lime : colors.muted} />
              <T size={13} color={colors.muted} style={{ flex: 1 }}>Regenerar el plan desde hoy (el anterior se archiva; las carreras se conservan)</T>
            </Row>
          </Pressable>
        ) : null}
      </Card>

      <Card>
        <Label>Ubicación para el clima</Label>
        {place ? (
          <Row gap={8}>
            <Feather name="map-pin" size={14} color={colors.lime} />
            <T weight="semibold">{place.label}</T>
            <T size={11} color={colors.dim}>{place.lat.toFixed(3)}, {place.lon.toFixed(3)}</T>
          </Row>
        ) : (
          <T size={13} color={colors.muted}>Aún sin ubicación.</T>
        )}
        <Button label="Usar mi ubicación" icon="navigation" variant="secondary" onPress={useGps} loading={locBusy} />
        <Row gap={8} style={{ alignItems: 'flex-end' }}>
          <Field label="O busca tu ciudad" value={query} onChangeText={setQuery} placeholder="Santo Domingo" onSubmitEditing={search} returnKeyType="search" style={{ flex: 1 }} />
          <Pressable onPress={search} style={{ height: 48, width: 48, borderRadius: 12, backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center' }}>
            {locBusy ? <ActivityIndicator color={colors.lime} /> : <Feather name="search" size={18} color={colors.lime} />}
          </Pressable>
        </Row>
        {results.map((r, i) => (
          <Pressable key={i} onPress={() => { setPlace({ lat: r.lat, lon: r.lon, label: [r.name, r.admin1, r.country].filter(Boolean).join(', ') }); setResults([]); }}>
            <Row style={{ paddingVertical: 8 }} gap={8}>
              <Feather name="map-pin" size={13} color={colors.muted} />
              <T>{r.name}</T>
              <T size={12} color={colors.muted}>{[r.admin1, r.country].filter(Boolean).join(', ')}</T>
            </Row>
          </Pressable>
        ))}
        <T size={11} color={colors.dim}>Búsqueda: Open-Meteo Geocoding.</T>
      </Card>

      <Button label={isEdit ? 'Guardar' : 'Crear mi plan'} icon="check" onPress={save} loading={saving} />
    </Screen>
  );
}

/** "28:40" o "1:02:30" → segundos */
function parseTime(s: string): number | null {
  const parts = s.trim().split(':').map((x) => parseInt(x, 10));
  if (parts.some((x) => Number.isNaN(x)) || parts.length < 2) return null;
  const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  return sec > 600 && sec < 7200 ? sec : null;
}
