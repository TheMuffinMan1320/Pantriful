import { SymbolView, type SymbolViewProps } from 'expo-symbols';

export type IconProps = {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  weight?: SymbolViewProps['weight'];
};

// Thin wrapper so every icon in the app goes through one call site - real SF Symbols
// throughout, never emoji standing in for an icon system.
export function Icon({ name, size = 20, color, weight = 'medium' }: IconProps) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} />;
}
