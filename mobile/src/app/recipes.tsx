import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, generateRecipe, listRecipes, markRecipeMade, type Recipe } from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function RecipesScreen() {
  const { state: authState } = useAuth();
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
          <ThemedText>Sign in on the Home tab to generate recipes.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Recipes
          </ThemedText>
          <Pressable onPress={onGenerate} disabled={generating}>
            <ThemedText type="linkPrimary">{generating ? 'Generating…' : '+ Generate'}</ThemedText>
          </Pressable>
        </ThemedView>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {recipes === null ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(recipe) => recipe.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No recipes yet. Generate one from your current pantry.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedView style={styles.cardHeader}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.status === 'made' ? 'Made' : 'Suggested'}
                    {item.servings ? ` · ${item.servings} servings` : ''}
                  </ThemedText>
                </ThemedView>

                <ThemedText type="smallBold" style={styles.sectionLabel}>
                  Ingredients
                </ThemedText>
                {item.ingredients.map((ingredient) => (
                  <ThemedText key={ingredient.id} type="small" themeColor="textSecondary">
                    {ingredient.quantity} {ingredient.unit} {ingredient.name}
                  </ThemedText>
                ))}

                <ThemedText type="smallBold" style={styles.sectionLabel}>
                  Instructions
                </ThemedText>
                <ThemedText type="small">{item.instructions}</ThemedText>

                {item.nutrition && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    {item.nutrition.caloriesPerServing != null
                      ? `${item.nutrition.caloriesPerServing} cal`
                      : ''}
                    {item.nutrition.proteinGrams != null ? ` · ${item.nutrition.proteinGrams}g protein` : ''}
                    {item.nutrition.carbsGrams != null ? ` · ${item.nutrition.carbsGrams}g carbs` : ''}
                    {item.nutrition.fatGrams != null ? ` · ${item.nutrition.fatGrams}g fat` : ''}
                  </ThemedText>
                )}

                {item.status !== 'made' && (
                  <Pressable
                    style={styles.markMadeButton}
                    onPress={() => onMarkMade(item)}
                    disabled={markingId === item.id}>
                    <ThemedText type="linkPrimary">
                      {markingId === item.id ? 'Marking…' : 'Mark as made'}
                    </ThemedText>
                  </Pressable>
                )}
              </ThemedView>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  error: {
    color: '#d33',
    marginBottom: Spacing.two,
  },
  loading: {
    marginTop: Spacing.six,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    marginTop: Spacing.two,
  },
  markMadeButton: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
  },
});
