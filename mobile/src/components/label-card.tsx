import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The base "printed label" surface: label-stock white, a small corner radius (not a pill -
// real stickers and shelf tags aren't fully rounded), and a dashed outline that reads as a
// die-cut/tear-off perforation. RN's borderStyle applies to the whole box, not one edge, so
// the perforation runs all the way around rather than just the top.
export function LabelCard({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.label,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: Spacing.three,
    // A label sitting on the kraft canvas casts a real, soft shadow, not a flat outline.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
});
