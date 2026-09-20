import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, markRecipeMade, type Recipe } from '@/lib/api';

type Props = {
  recipe: Recipe;
  // Called after the pantry has been decremented, so the parent can reload its data.
  onMade: () => void | Promise<void>;
  onError: (message: string) => void;
};

// Marks a recipe as cooked. The backend decrements every ingredient that's linked to a pantry item
// (never below zero) and skips untracked ones, so the confirmation lists exactly what will be used.
export function MarkMadeButton({ recipe, onMade, onError }: Props) {
  const theme = useTheme();
  const [marking, setMarking] = useState(false);
  const alreadyMade = recipe.status === 'made';

  const confirmAndMark = useCallback(() => {
    const tracked = recipe.ingredients.filter((ingredient) => ingredient.inventoryItemId);
    const usage =
      tracked.length > 0
        ? `This will use up from your pantry:\n${tracked
            .map((ingredient) => `• ${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`)
            .join('\n')}`
        : 'None of its ingredients are tracked in your pantry, so nothing will change.';

    Alert.alert(alreadyMade ? 'Make it again?' : 'Mark as made?', usage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark as made',
        onPress: async () => {
          setMarking(true);
          try {
            await markRecipeMade(recipe.id);
            await onMade();
          } catch (err) {
            onError(err instanceof ApiError ? err.message : 'Failed to mark recipe as made');
          } finally {
            setMarking(false);
          }
        },
      },
    ]);
  }, [recipe, alreadyMade, onMade, onError]);

  return (
    <Pressable
      onPress={confirmAndMark}
      disabled={marking}
      style={({ pressed }) => [styles.button, { borderColor: theme.fresh }, pressed && styles.pressed]}>
      <Icon name="checkmark.seal" size={16} color={theme.fresh} />
      <ThemedText type="linkPrimary" style={{ color: theme.fresh }}>
        {marking ? 'Marking…' : alreadyMade ? 'Made it again' : 'Mark as made'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: Radius.label,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
