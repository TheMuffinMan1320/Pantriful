/**
 * Design direction: Konbini Label System.
 * See PRODUCT.md and DESIGN.md for the full contract. Every surface reads as a printed
 * inventory label — barcode rules, a stamped date/status mark, dense precise data type —
 * on a warm paper ground with one disciplined stamp-ink accent.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Kraft-toned canvas the label cards sit on top of.
    background: '#F1EAD9',
    // Brighter label-stock white for cards, so they read as paper sitting on the canvas.
    backgroundElement: '#FFFCF4',
    backgroundSelected: '#ECE0C3',
    text: '#221D16',
    textSecondary: '#655D4D',
    border: '#DCD1B4',
    // Stamp-ink red: the one accent, used deliberately (primary actions, urgency, marks).
    accent: '#BE3A26',
    accentText: '#FFFCF4',
    // Secondary functional color for "fresh / good" states only - never a second identity color.
    fresh: '#3A6244',
    danger: '#BE3A26',
  },
  dark: {
    background: '#17130E',
    backgroundElement: '#241E17',
    backgroundSelected: '#332A1E',
    text: '#F5EFE2',
    textSecondary: '#AFA48C',
    border: '#3A3226',
    accent: '#DD6448',
    accentText: '#17130E',
    fresh: '#6FA47D',
    danger: '#DD6448',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Space Grotesk carries every display/heading/label moment; Space Mono carries every
// number a user reads as data (quantity, price, date, threshold) - the two together are
// the "printed label" voice. Body copy stays on the system font for dense-paragraph legibility.
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const DisplayFont = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;

export const DataFont = {
  regular: 'SpaceMono_400Regular',
  bold: 'SpaceMono_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Small radius, not a pill - real printed labels and shelf tags have a slight corner, not
// a fully rounded rect.
export const Radius = {
  label: 6,
  stamp: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
