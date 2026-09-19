import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeRule } from '@/components/barcode-rule';
import { Icon } from '@/components/icon';
import { LabelCard } from '@/components/label-card';
import { StampBadge } from '@/components/stamp-badge';
import { ApiError, generateRecipe, listRecipes, markRecipeMade, type Recipe } from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function RecipesScreen() {
  const { state: authState } = useAuth();
  const theme = useTheme();
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await listRecipes();
      setRecipes(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load recipes');
    }
  }, []);

  useEffect(() => {
    if (authState.status === 'signedIn') {
      load();
    }
  }, [authState.status, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateRecipe();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate a recipe');
    } finally {
      setGenerating(false);
    }
  }, [load]);

  const onMarkMade = useCallback(
    async (recipe: Recipe) => {
      setMarkingId(recipe.id);
      setError(null);
      try {
        await markRecipeMade(recipe.id);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to mark recipe as made');
      } finally {
        setMarkingId(null);
      }
    },
    [load],
  );

  if (authState.status !== 'signedIn') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <Icon name="person.crop.circle.badge.questionmark" size={40} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            Sign in on the Home tab to generate recipes.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Recipes
          </ThemedText>
          <Pressable
            onPress={onGenerate}
            disabled={generating}
            style={({ pressed }) => [
              styles.generateButton,
              { backgroundColor: theme.accent },
              pressed && styles.generateButtonPressed,
            ]}>
            {generating ? (
              <ActivityIndicator size="small" color={theme.accentText} />
            ) : (
              <Icon name="sparkles" size={16} color={theme.accentText} />
            )}
            <ThemedText type="linkPrimary" style={{ color: theme.accentText }}>
              {generating ? 'Generating' : 'Generate'}
            </ThemedText>
          </Pressable>
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {recipes === null ? (
          <ActivityIndicator style={styles.loading} color={theme.accent} />
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(recipe) => recipe.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon name="fork.knife" size={40} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  No recipes yet. Generate one from your current pantry.
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => (
              <LabelCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <ThemedText type="subtitle" numberOfLines={2}>
                      {item.title}
                    </ThemedText>
                    {item.servings && (
                      <ThemedText type="data" themeColor="textSecondary">
                        Serves {item.servings}
                      </ThemedText>
                    )}
                  </View>
                  {item.status === 'made' && <StampBadge label="MADE" color={theme.fresh} />}
                </View>

                <BarcodeRule seed={item.id} />

                <View style={styles.section}>
                  <ThemedText type="label" themeColor="textSecondary">
                    Ingredients
                  </ThemedText>
                  {item.ingredients.map((ingredient) => (
                    <View key={ingredient.id} style={styles.ingredientRow}>
                      <ThemedText type="dataBold">
                        {ingredient.quantity} {ingredient.unit}
                      </ThemedText>
                      <ThemedText type="default" style={styles.ingredientName}>
                        {ingredient.name}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View style={styles.section}>
                  <ThemedText type="label" themeColor="textSecondary">
                    Instructions
                  </ThemedText>
                  <ThemedText type="default">{item.instructions}</ThemedText>
                </View>

                {item.nutrition && (
                  <View style={styles.section}>
                    <ThemedText type="label" themeColor="textSecondary">
                      Nutrition, per serving
                    </ThemedText>
                    <View style={styles.nutritionRow}>
                      {item.nutrition.caloriesPerServing != null && (
                        <NutritionStat value={item.nutrition.caloriesPerServing} unit="cal" />
                      )}
                      {item.nutrition.proteinGrams != null && (
                        <NutritionStat value={item.nutrition.proteinGrams} unit="g protein" />
                      )}
                      {item.nutrition.carbsGrams != null && (
                        <NutritionStat value={item.nutrition.carbsGrams} unit="g carbs" />
                      )}
                      {item.nutrition.fatGrams != null && (
                        <NutritionStat value={item.nutrition.fatGrams} unit="g fat" />
                      )}
                    </View>
                  </View>
                )}

                {item.status !== 'made' && (
                  <Pressable
                    onPress={() => onMarkMade(item)}
                    disabled={markingId === item.id}
                    style={({ pressed }) => [
                      styles.markMadeButton,
                      { borderColor: theme.fresh },
                      pressed && styles.markMadeButtonPressed,
                    ]}>
                    <Icon name="checkmark.seal" size={16} color={theme.fresh} />
                    <ThemedText type="linkPrimary" style={{ color: theme.fresh }}>
                      {markingId === item.id ? 'Marking…' : 'Mark as made'}
                    </ThemedText>
                  </Pressable>
                )}
              </LabelCard>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function NutritionStat({ value, unit }: { value: number; unit: string }) {
  return (
    <View style={styles.nutritionStat}>
      <ThemedText type="dataBold">{value}</ThemedText>
      <ThemedText type="label" themeColor="textSecondary">
        {unit}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 30,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.label,
  },
  generateButtonPressed: {
    opacity: 0.85,
  },
  error: {
    marginBottom: Spacing.two,
  },
  loading: {
    marginTop: Spacing.six,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.one,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  ingredientName: {
    flex: 1,
  },
  nutritionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  nutritionStat: {
    gap: Spacing.half,
  },
  markMadeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: Radius.label,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  markMadeButtonPressed: {
    opacity: 0.7,
  },
});
