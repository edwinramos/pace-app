import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Field, Header, Label, Row, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { formatSleep, shortDate } from '@/engine/format';
import { readiness } from '@/engine/rules';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

/** Registro manual de sueño y FC en reposo (mientras Health Connect esté simulado). */
export default function Recuperacion() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [rhr, setRhr] = useState('');
  const [hist, setHist] = useState<repo.HealthRow[]>([]);

  useEffect(() => {
    (async () => {
      const row = await repo.getHealthDay(db, t.date);
      if (row?.source === 'manual') {
        if (row.sleep_min != null) {
          setH(String(Math.floor(row.sleep_min / 60)));
          setM(String(Math.round(row.sleep_min % 60)));
        }
        if (row.resting_hr != null) setRhr(String(Math.round(row.resting_hr)));
      }
      setHist(await repo.getHealthHistory(db, 10, 'manual'));
    })();
  }, [db, t.date]);

  const hh = parseInt(h, 10);
  const mm = parseInt(m || '0', 10);
  const sleepMin = Number.isFinite(hh) ? hh * 60 + (Number.isFinite(mm) ? mm : 0) : null;
  const rhrN = parseInt(rhr, 10);
  const rhrVal = Number.isFinite(rhrN) ? rhrN : null;
  const preview = readiness({
    sleepHours: sleepMin != null ? sleepMin / 60 : undefined,
    restingHr: rhrVal ?? undefined,
    restingHrBaseline: t.healthData?.restingHrBaseline,
  });

  const save = async () => {
    if (sleepMin == null && rhrVal == null) return Alert.alert('Nada que guardar', 'Escribe el sueño, la FC en reposo o ambos.');
    if (sleepMin != null && (sleepMin < 0 || sleepMin > 16 * 60)) return Alert.alert('Sueño fuera de rango');
    if (rhrVal != null && (rhrVal < 30 || rhrVal > 120)) return Alert.alert('FC en reposo fuera de rango (30–120)');
    await repo.saveHealthDay(db, t.date, sleepMin, rhrVal, 'manual');
    await t.refresh();
    router.back();
  };
  const clear = async () => {
    await repo.deleteHealthDay(db, t.date);
    await t.refresh();
    router.back();
  };

  return (
    <Screen bottomPad={40}>
      <Header eyebrow="Recuperación" title="Sueño y FC de hoy" back />
      <T color={colors.muted} style={{ lineHeight: 20 }}>
        Mira los datos en la app de tu reloj y anótalos aquí. Con 3 días o más de FC en reposo, Pace calcula tu línea base de 7 días.
      </T>
      <Card>
        <Label>Sueño anoche</Label>
        <Row gap={10}>
          <Field value={h} onChangeText={setH} keyboardType="number-pad" placeholder="h" style={{ flex: 1 }} />
          <T color={colors.muted}>h</T>
          <Field value={m} onChangeText={setM} keyboardType="number-pad" placeholder="min" style={{ flex: 1 }} />
          <T color={colors.muted}>min</T>
        </Row>
        <Field label="FC en reposo (lpm)" value={rhr} onChangeText={setRhr} keyboardType="number-pad" placeholder="p. ej. 58" />
        <T size={12} color={colors.cyan}>
          Recuperación estimada: {preview.score}/100
          {t.healthData?.restingHrBaseline ? ` · base FC ${Math.round(t.healthData.restingHrBaseline)} lpm` : ' · sin línea base todavía'}
        </T>
      </Card>
      <Button label="Guardar" icon="check" onPress={save} />
      {t.healthOrigin === 'manual' ? <Button label="Borrar el registro de hoy" variant="ghost" icon="trash-2" onPress={clear} /> : null}

      {hist.length ? (
        <Card>
          <Label>Últimos registros manuales</Label>
          {hist.map((r) => (
            <Row key={r.date} style={{ justifyContent: 'space-between' }}>
              <T size={13} color={colors.muted}>{shortDate(r.date)}</T>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <T mono size={12}>{r.sleep_min != null ? formatSleep(r.sleep_min / 60) : '—'}</T>
                <T mono size={12}>{r.resting_hr != null ? `${Math.round(r.resting_hr)} lpm` : '—'}</T>
              </View>
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
