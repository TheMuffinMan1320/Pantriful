import { StyleSheet, Text, type TextProps } from 'react-native';

import { DataFont, DisplayFont, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'label'
    | 'data'
    | 'dataBold';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.accent }],
        type === 'code' && styles.code,
        type === 'label' && styles.label,
        type === 'data' && styles.data,
        type === 'dataBold' && styles.dataBold,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: DisplayFont.semibold,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Item names, card headers: the display voice.
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: DisplayFont.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: DisplayFont.semibold,
  },
  link: {
    lineHeight: 22,
    fontSize: 15,
  },
  linkPrimary: {
    lineHeight: 22,
    fontSize: 15,
    fontFamily: DisplayFont.semibold,
  },
  code: {
    fontFamily: DataFont.regular,
    fontSize: 12,
  },
  // Small caps-style field label above a data value (e.g. "QTY", "EXP").
  label: {
    fontFamily: DisplayFont.medium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  // Quantities, dates, prices, thresholds - every number the user reads as data.
  data: {
    fontFamily: DataFont.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  dataBold: {
    fontFamily: DataFont.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
