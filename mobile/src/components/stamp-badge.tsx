import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The recurring "stamped" mark - a rotated, circular, ink-colored ring used for low-stock
// alerts and a completed recipe's mark, echoing a real date/inspection stamp.
export function StampBadge({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();
  const tint = color ?? theme.accent;

  return (
    <View style={[styles.stamp, { borderColor: tint }]}>
      <ThemedText type="label" style={[styles.text, { color: tint }]} numberOfLines={2}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    width: 56,
    height: 56,
    borderRadius: Radius.stamp,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
    transform: [{ rotate: '-8deg' }],
  },
  text: {
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 11,
  },
});
