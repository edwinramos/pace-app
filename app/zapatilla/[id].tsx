import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Header, Row, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

export default function ZapatillaForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nueva';
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const [shoe, setShoe] = useState<repo.Shoe | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [note, setNote] = useState('');
  const [startKm, setStartKm] = useState('0');
  const [retireKm, setRetireKm] = useState('600');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    repo.getShoe(db, id).then((s) => {
      if (!s) return;
      setShoe(s);
      setBrand(s.brand);
      setModel(s.model);
      setNote(s.useNote ?? '');
      setStartKm(String(s.startKm));
      setRetireKm(String(s.retireKm));
    });
  }, [id]);

  const num = (v: string) => Number(v.replace(',', '.'));
  const save = async () => {
    const sk = num(startKm || '0');
    const rk = num(retireKm || '600');
    if (!model.trim()) return Alert.alert('Falta el modelo', 'Escribe al menos el modelo.');
    if (!Number.isFinite(sk) || sk < 0 || !Number.isFinite(rk) || rk < 50) return Alert.alert('Km no válidos', 'Km iniciales ≥ 0 y vida útil ≥ 50.');
    setBusy(true);
    const input = { brand: brand.trim(), model: model.trim(), useNote: note.trim() || null, startKm: sk, retireKm: rk };
    if (isNew) await repo.addShoe(db, input);
    else await repo.updateShoe(db, id, input);
    await t.refresh();
    router.back();
  };
  const remove = () =>
    Alert.alert('Borrar zapatillas', shoe?.runs ? `Tiene ${shoe.runs} carreras asociadas; quedarán sin zapatilla. Si solo ya no las usas, mejor retíralas.` : '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await repo.deleteShoe(db, id); await t.refresh(); router.back(); } },
    ]);

  return (
    <Screen bottomPad={40}>
      <Header eyebrow="Equipo" title={isNew ? 'Nuevas zapatillas' : shoe?.name ?? 'Zapatillas'} back />
      <Field label="Marca" value={brand} onChangeText={setBrand} placeholder="Nike, ASICS…" />
      <Field label="Modelo" value={model} onChangeText={setModel} placeholder="Pegasus 41" />
      <Field label="Uso" value={note} onChangeText={setNote} placeholder="Rodajes, series, carrera…" />
      <Row gap={10}>
        <Field label="Km iniciales" value={startKm} onChangeText={setStartKm} keyboardType="decimal-pad" hint="Si ya estaban usadas" style={{ flex: 1 }} />
        <Field label="Vida útil (km)" value={retireKm} onChangeText={setRetireKm} keyboardType="number-pad" hint="Aviso 50 km antes" style={{ flex: 1 }} />
      </Row>
      {shoe ? <T size={12} color={colors.muted}>Llevan {Math.round(shoe.runKm)} km en {shoe.runs} carreras registradas en Pace.</T> : null}
      <Button label="Guardar" onPress={save} loading={busy} />
      {!isNew ? <Button label="Borrar" variant="ghost" onPress={remove} /> : null}
    </Screen>
  );
}
