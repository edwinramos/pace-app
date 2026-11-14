import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip, Empty, Header, Label, ProgressBar, Row, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

function shoeColor(s: { totalKm: number; retireKm: number }) {
  return s.totalKm >= s.retireKm ? colors.coral : s.totalKm >= s.retireKm - 50 ? colors.amber : colors.lime;
}

export default function Equipo() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useToday();
  const active = t.shoes.filter((s) => !s.retiredAt);
  const retired = t.shoes.filter((s) => s.retiredAt);
  const act = async (f: () => Promise<unknown>) => {
    await f();
    await t.refresh();
  };
  const open = (id: string) => router.push({ pathname: '/zapatilla/[id]', params: { id } });

  return (
    <Screen>
      <Header eyebrow="Equipo" title="Zapatillas" back right={<Button label="Añadir" icon="plus" small onPress={() => open('nueva')} />} />
      {t.shoes.length === 0 ? (
        <Empty icon="box" title="Sin zapatillas" text="Añade tus zapatillas para contar sus km y recibir un aviso al acercarte a su vida útil (600 km por defecto)." action={<Button label="Añadir zapatillas" onPress={() => open('nueva')} />} />
      ) : null}
      {active.map((s) => {
        const c = shoeColor(s);
        return (
          <Pressable key={s.id} onPress={() => open(s.id)}>
            <Card accent={s.isDefault ? colors.lime : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T weight="bold" size={16}>{s.name}</T>
                  {s.useNote ? <T size={12} color={colors.muted}>{s.useNote}</T> : null}
                </View>
                {s.isDefault ? <Chip label="Por defecto" /> : null}
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <T mono size={22} weight="extrabold" color={c}>{Math.round(s.totalKm)} km</T>
                <T size={12} color={colors.muted}>de {s.retireKm} · {s.runs} carreras</T>
              </Row>
              <ProgressBar value={s.totalKm / s.retireKm} color={c} />
              {s.totalKm >= s.retireKm ? <T size={12} color={colors.coral}>Superó su vida útil: considera retirarlas.</T> : s.totalKm >= s.retireKm - 50 ? <T size={12} color={colors.amber}>Quedan {Math.round(s.retireKm - s.totalKm)} km de vida útil.</T> : null}
              <Row gap={8}>
                {!s.isDefault ? <Button label="Usar por defecto" small variant="secondary" onPress={() => act(() => repo.setDefaultShoe(db, s.id))} /> : null}
                <Button label="Retirar" small variant="ghost" onPress={() => act(() => repo.retireShoe(db, s.id, true))} />
              </Row>
            </Card>
          </Pressable>
        );
      })}
      {retired.length ? <Label>Retiradas</Label> : null}
      {retired.map((s) => (
        <Pressable key={s.id} onPress={() => open(s.id)}>
          <Card style={{ opacity: 0.7 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T weight="bold">{s.name}</T>
              <T mono size={12} color={colors.muted}>{Math.round(s.totalKm)} km</T>
            </Row>
            <Row gap={8}>
              <Feather name="archive" size={14} color={colors.dim} />
              <T size={12} color={colors.dim} style={{ flex: 1 }}>Retirada el {new Date(s.retiredAt!).toLocaleDateString('es')}</T>
              <Button label="Reactivar" small variant="ghost" onPress={() => act(() => repo.retireShoe(db, s.id, false))} />
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
