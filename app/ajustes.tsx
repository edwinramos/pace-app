import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Header, Label, Screen, Segmented, T } from '@/components/ui';
import { resetDatabase } from '@/db';
import * as repo from '@/db/repo';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

export default function Ajustes() {
  const db = useSQLiteContext();
  const router = useRouter();
  const s = useSettings();
  const t = useToday();
  const [busy, setBusy] = useState(false);

  const wipe = () =>
    Alert.alert('Borrar todos los datos', 'Se borran perfil, plan, carreras, rutas, zapatillas y registros de recuperación de este teléfono. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await resetDatabase(db);
          await s.reload();
          await t.refresh();
          setBusy(false);
          router.replace('/onboarding');
        },
      },
    ]);

  const examples = async () => {
    const n = await repo.addExampleRoutes(db);
    await t.refresh();
    Alert.alert('Rutas de ejemplo', n ? `Añadidas ${n} rutas de ejemplo (Santo Domingo).` : 'Ya estaban añadidas.');
  };

  return (
    <Screen bottomPad={40}>
      <Header eyebrow="Perfil" title="Ajustes" back />
      <Card>
        <Label>Unidades</Label>
        <Segmented options={[{ value: 'km', label: 'Kilómetros' }, { value: 'mi', label: 'Millas' }]} value={s.units} onChange={(v) => s.set('units', v)} />
        <T size={11} color={colors.dim}>Los parciales siguen siendo por km.</T>
      </Card>
      <Card>
        <Label>Voz del coach</Label>
        <Segmented options={[{ value: 'on', label: 'Activada' }, { value: 'off', label: 'Desactivada' }]} value={s.voice ? 'on' : 'off'} onChange={(v) => s.set('voice', v === 'on')} />
        <T size={11} color={colors.dim}>Anuncia cada km el ritmo y si vas dentro del objetivo.</T>
      </Card>
      <Card>
        <Label>Modo de carrera por defecto</Label>
        <Segmented options={[{ value: 'gps', label: 'GPS real' }, { value: 'treadmill', label: 'Caminadora' }, { value: 'sim', label: 'Simulado' }]} value={s.gpsMode} onChange={(v) => s.set('gpsMode', v)} />
      </Card>
      <Card>
        <Label>Sueño y FC en reposo</Label>
        <Segmented options={[{ value: 'manual', label: 'Manual' }, { value: 'mock', label: 'Simulado' }]} value={s.healthSource} onChange={async (v) => { await s.set('healthSource', v); await t.refresh(); }} />
      </Card>
      <Card>
        <Label>Rutas de ejemplo</Label>
        <T size={12} color={colors.muted}>Añade 4 rutas de Santo Domingo para probar el modo simulado. Puedes borrarlas cuando quieras.</T>
        <Button label="Añadir rutas de ejemplo" variant="secondary" onPress={examples} />
      </Card>
      <Card accent={colors.coral}>
        <Label color={colors.coral}>Zona peligrosa</Label>
        <Button label="Borrar todos los datos" variant="ghost" onPress={wipe} loading={busy} />
      </Card>
      <T size={11} color={colors.dim} style={{ textAlign: 'center' }}>Pace · datos solo en este teléfono (SQLite local)</T>
    </Screen>
  );
}
