/** Kinetic Obsidian — tokens de diseño de Pace. */
export const colors = {
  bg: '#0E1012',
  card: '#16191D',
  cardHi: '#1D2126',
  border: '#262B31',
  text: '#F4F4F0',
  muted: '#B7B3A6',
  dim: '#7C7A72',
  lime: '#C6F432',
  cyan: '#38BDF8',
  coral: '#F43F5E',
  amber: '#F5A524',
  limeInk: '#0E1012',
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const space = (n: number) => n * 4;

/** Color por tipo de sesión (igual que el prototipo). */
export const sessionColor: Record<string, string> = {
  suave: colors.lime,
  tempo: colors.cyan,
  series: colors.amber,
  larga: colors.coral,
  carrera: '#E879F9',
  descanso: colors.dim,
};
