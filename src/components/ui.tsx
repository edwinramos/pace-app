import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../theme';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  bottomPad = 120,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  bottomPad?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + bottomPad, gap: 14 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lime} colors={[colors.lime]} progressBackgroundColor={colors.card} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function T({
  children,
  style,
  mono,
  weight = 'regular',
  size = 14,
  color = colors.text,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  mono?: boolean;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  size?: number;
  color?: string;
  numberOfLines?: number;
}) {
  const fontFamily = mono ? (weight === 'bold' || weight === 'extrabold' ? fonts.monoBold : fonts.mono) : fonts[weight];
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily, fontSize: size, color }, style]}>
      {children}
    </Text>
  );
}

/** Etiqueta pequeña en mayúsculas, JetBrains Mono (como el prototipo). */
export function Label({ children, color = colors.muted, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return (
    <View style={[styles.card, accent ? { borderColor: accent + '55' } : null, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = 10 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Chip({ label, color = colors.lime, filled = false }: { label: string; color?: string; filled?: boolean }) {
  return (
    <View style={[styles.chip, { borderColor: color + '66', backgroundColor: filled ? color : color + '14' }]}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8, color: filled ? colors.limeInk : color, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  label: string;
  small?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary' ? colors.lime : variant === 'danger' ? colors.coral : variant === 'secondary' ? colors.cardHi : 'transparent';
  const fg = variant === 'primary' ? colors.limeInk : variant === 'danger' ? '#fff' : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'secondary' || variant === 'ghost' ? { borderWidth: 1, borderColor: colors.border } : null,
        small ? { height: 36, paddingHorizontal: 12, borderRadius: 10 } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Feather name={icon} size={small ? 14 : 18} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 13 : 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.lime, height = 6 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function Stat({
  label,
  value,
  unit,
  sub,
  color = colors.text,
  subColor = colors.muted,
  big = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  color?: string;
  subColor?: string;
  big?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Label>{label}</Label>
      <Text>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: big ? 30 : 22, color }}>{value}</Text>
        {unit ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: subColor }}>{sub}</Text> : null}
    </View>
  );
}

export function Header({ title, eyebrow, back, right }: { title: string; eyebrow?: string; back?: boolean; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={8}>
          {back ? (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={styles.round}>
              <Feather name="chevron-left" size={20} color={colors.text} />
            </Pressable>
          ) : null}
          {eyebrow ? (
            <Row gap={6}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime }} />
              <Label>{eyebrow}</Label>
            </Row>
          ) : null}
        </Row>
        {right}
      </Row>
      <T size={28} weight="extrabold" style={{ letterSpacing: -0.5 }}>
        {title}
      </T>
    </View>
  );
}

export function Avatar({ initials = 'ER', onPress }: { initials?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.avatar}>
      <Text style={{ fontFamily: fonts.extrabold, color: colors.lime, fontSize: 13 }}>{initials}</Text>
    </Pressable>
  );
}

export function SimBadge({ text = 'Simulado' }: { text?: string }) {
  return <Chip label={text} color={colors.amber} />;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  btn: {
    height: 54,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime + '14',
  },
});

export function Field({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof TextInput> & { label?: string; hint?: string }) {
  return (
    <View style={{ gap: 6, flex: (props.style as any)?.flex }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.dim}
        {...props}
        style={[
          { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, color: colors.text, paddingHorizontal: 12, fontFamily: fonts.medium, fontSize: 15 },
          props.style,
        ]}
      />
      {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.dim }}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={{ flexGrow: small ? 0 : 1 }}>
            <View style={{ paddingVertical: small ? 7 : 11, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: on ? colors.lime : colors.border, backgroundColor: on ? colors.lime + '1A' : 'transparent' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.lime : colors.muted }}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string; action?: React.ReactNode }) {
  return (
    <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
      <Feather name={icon} size={26} color={colors.dim} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 }}>{text}</Text>
      {action}
    </View>
  );
}

export function ListRow({ icon, title, sub, onPress, color = colors.lime, right }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; sub?: string; onPress?: () => void; color?: string; right?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>{title}</Text>
          {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>{sub}</Text> : null}
        </View>
        {right ?? (onPress ? <Feather name="chevron-right" size={18} color={colors.muted} /> : null)}
      </View>
    </Pressable>
  );
}

export function initials(name?: string | null) {
  if (!name) return '·';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
