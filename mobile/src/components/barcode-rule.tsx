import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// A deterministic bar pattern derived from a seed string, so the same item always draws
// the same "barcode" - a real recurring motif, not a random decoration.
function widthsFromSeed(seed: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const widths: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    widths.push(1 + (hash % 3));
  }
  return widths;
}

export function BarcodeRule({ seed, height = 14 }: { seed: string; height?: number }) {
  const theme = useTheme();
  const widths = useMemo(() => widthsFromSeed(seed || 'pantriful', 28), [seed]);

  return (
    <View style={[styles.row, { height }]}>
      {widths.map((width, index) => (
        <View
          key={index}
          style={{
            width,
            height: '100%',
            backgroundColor: theme.text,
            marginRight: index % 4 === 3 ? 2 : 1,
            opacity: index % 4 === 3 ? 1 : 0.65,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
});
