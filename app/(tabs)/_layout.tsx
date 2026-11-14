import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToday } from '@/state/today';
import { colors, fonts } from '@/theme';

const TABS: { name: string; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { name: 'index', label: 'Hoy', icon: 'home' },
  { name: 'planes', label: 'Planes', icon: 'calendar' },
  { name: 'carrera', label: 'Carrera', icon: 'play' },
  { name: 'metricas', label: 'Métricas', icon: 'bar-chart-2' },
  { name: 'perfil', label: 'Perfil', icon: 'user' },
];

/** Pantallas que viven bajo una pestaña sin tener botón propio. */
const PARENT: Record<string, string> = { dispositivos: 'perfil', equipo: 'perfil' };

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;
  const active = PARENT[current] ?? current;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {TABS.map((t) => {
          const focused = active === t.name;
          const onPress = () => {
            const r = state.routes.find((x) => x.name === t.name);
            if (r) navigateToTab(r.key);
          };
          if (t.name === 'carrera') {
            return (
              <Pressable key={t.name} onPress={onPress} style={styles.item} accessibilityRole="button" accessibilityLabel="Carrera">
                <View style={styles.fab}>
                  <MaterialCommunityIcons name="run-fast" size={30} color={colors.limeInk} />
                </View>
                <Text style={[styles.label, { color: focused ? colors.lime : colors.muted, marginTop: 2 }]}>{t.label}</Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={t.name} onPress={onPress} style={styles.item} accessibilityRole="button" accessibilityLabel={t.label}>
              <Feather name={t.icon} size={20} color={focused ? colors.lime : colors.muted} />
              <Text style={[styles.label, { color: focused ? colors.lime : colors.muted }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const t = useToday();
  if (t.needsOnboarding) return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="planes" />
      <Tabs.Screen name="carrera" />
      <Tabs.Screen name="metricas" />
      <Tabs.Screen name="perfil" />
      <Tabs.Screen name="dispositivos" options={{ href: null }} />
      <Tabs.Screen name="equipo" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, backgroundColor: 'transparent' },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#14171Bee',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    height: 68,
    alignItems: 'flex-end',
    paddingBottom: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 11 },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
    borderWidth: 5,
    borderColor: colors.bg,
    shadowColor: colors.lime,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
});
