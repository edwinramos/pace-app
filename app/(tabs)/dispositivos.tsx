import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Button, Card, Header, Label, Row, Screen, Segmented, SimBadge, T } from '@/components/ui';
import { health } from '@/services/health';
import { useSettings } from '@/state/settings';
import { useToday } from '@/state/today';
import { colors } from '@/theme';

export default function Dispositivos() {
  const router = useRouter();
  const s = useSettings();
  const t = useToday();
  const setSource = async (v: 'manual' | 'mock') => {
    await s.set('healthSource', v);
    await t.refresh();
  };
  return (
    <Screen>
      <Header eyebrow="Datos" title="Fuentes" back />
      <Card>
        <Label>Sueño y FC en reposo</Label>
        <Segmented options={[{ value: 'manual', label: 'Manual' }, { value: 'mock', label: 'Simulado' }]} value={s.healthSource} onChange={setSource} />
        <T size={12} color={colors.muted} style={{ lineHeight: 18 }}>
          {s.healthSource === 'manual'
            ? 'Registras cada mañana las horas de sueño y la FC en reposo. Sin datos, la recomendación se basa solo en clima y plan.'
            : 'Valores simulados deterministas por fecha, para probar la lógica de recuperación. Lo que registres a mano siempre tiene prioridad.'}
        </T>
        <Button label="Registrar hoy" variant="secondary" icon="edit-3" onPress={() => router.push('/recuperacion')} />
        <T size={12} color={colors.dim}>Hoy: {t.healthOrigin === 'none' ? 'sin datos' : t.healthOrigin === 'manual' ? 'registro manual' : 'simulado'}</T>
      </Card>
      <Card>
        <Row gap={8}>
          <Feather name="heart" size={16} color={colors.coral} />
          <T weight="bold" style={{ flex: 1 }}>Health Connect</T>
          {health.simulated ? <SimBadge text="No disponible en Expo Go" /> : null}
        </Row>
        <T size={12} color={colors.muted} style={{ lineHeight: 18 }}>
          Expo Go no incluye el módulo nativo. En el dev build se leerá sueño y FC en reposo (Samsung Health / Galaxy Watch sincronizan con Health Connect) y se escribirán las carreras. El botón «Guardar en Health Connect» del resumen ahora solo simula la escritura.
        </T>
      </Card>
      <Card>
        <Row gap={8}>
          <Feather name="navigation" size={16} color={colors.lime} />
          <T weight="bold" style={{ flex: 1 }}>GPS</T>
        </Row>
        <T size={12} color={colors.muted} style={{ lineHeight: 18 }}>GPS real del teléfono con la app en primer plano (pantalla encendida). El seguimiento en segundo plano requiere dev build. Modo por defecto en Ajustes.</T>
      </Card>
    </Screen>
  );
}
