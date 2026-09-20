import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeRule } from '@/components/barcode-rule';
import { Icon } from '@/components/icon';
import { LabelCard } from '@/components/label-card';
import { MarkMadeButton } from '@/components/mark-made-button';
import { StampBadge } from '@/components/stamp-badge';
import { ApiError, deleteRecipe, generateRecipe, listRecipes, setRecipeFavorite, type Recipe } from '@/lib/api';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

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

  const onToggleFavorite = useCallback(async (recipe: Recipe) => {
    setError(null);
    try {
      const updated = await setRecipeFavorite(recipe.id, !recipe.favorite);
      setRecipes((current) => current?.map((r) => (r.id === updated.id ? updated : r)) ?? current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update favorite');
    }
  }, []);

  const onDelete = useCallback(
    (recipe: Recipe) => {
      Alert.alert('Delete recipe?', `"${recipe.title}" will be permanently removed.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError(null);
            try {
              await deleteRecipe(recipe.id);
              await load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Failed to delete recipe');
            }
          },
        },
      ]);
    },
    [load],
  );

  // Search matches the title or any ingredient name, and combines with the Favorites filter.
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const visibleRecipes = (recipes ?? []).filter(
    (recipe) =>
      (!favoritesOnly || recipe.favorite) &&
      (!trimmedQuery ||
        recipe.title.toLowerCase().includes(trimmedQuery) ||
        recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(trimmedQuery))),
  );
  const favoriteCount = (recipes ?? []).filter((recipe) => recipe.favorite).length;

  if (authState.status !== 'signedIn') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <Icon name="person.crop.circle.badge.questionmark" size={40} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            Sign in on the Settings tab to generate recipes.
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

        {recipes !== null && recipes.length > 0 && (
          <>
            <View
              style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Icon name="magnifyingglass" size={16} color={theme.textSecondary} />
              <TextInput
                placeholder="Search recipes"
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={[styles.searchInput, { color: theme.text }]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Icon name="xmark.circle.fill" size={16} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            <View style={styles.filterRow}>
              <FilterChip label="All" active={!favoritesOnly} onPress={() => setFavoritesOnly(false)} />
              <FilterChip
                label={`Favorites (${favoriteCount})`}
                icon="heart.fill"
                active={favoritesOnly}
                onPress={() => setFavoritesOnly(true)}
              />
            </View>
          </>
        )}

        {recipes === null ? (
          <ActivityIndicator style={styles.loading} color={theme.accent} />
        ) : (
          <FlatList
            data={visibleRecipes}
            keyExtractor={(recipe) => recipe.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon
                  name={trimmedQuery ? 'magnifyingglass' : favoritesOnly ? 'heart' : 'fork.knife'}
                  size={40}
                  color={theme.textSecondary}
                />
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {trimmedQuery
                    ? `No ${favoritesOnly ? 'favorite ' : ''}recipes match "${searchQuery.trim()}".`
                    : favoritesOnly
                      ? 'No favorites yet. Tap the heart on a recipe to save it here.'
                      : 'No recipes yet. Generate one from your current pantry.'}
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
                  <Pressable
                    onPress={() => onToggleFavorite(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={item.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                    <Icon
                      name={item.favorite ? 'heart.fill' : 'heart'}
                      size={22}
                      color={item.favorite ? theme.danger : theme.textSecondary}
                    />
                  </Pressable>
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
                  <InstructionSteps instructions={item.instructions} />
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

                <View style={styles.cardActions}>
                  <MarkMadeButton recipe={item} onMade={load} onError={setError} />
                  <Pressable onPress={() => onDelete(item)} hitSlop={8} style={styles.deleteButton}>
                    <Icon name="trash" size={16} color={theme.danger} />
                    <ThemedText type="small" themeColor="danger">
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </LabelCard>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

// Recipes come back as one instructions string (usually newline-separated numbered steps);
// this splits it into individual steps regardless of whether newlines survived and strips any
// existing "1." / "-" markers, since each step gets its own tappable bullet instead.
function parseInstructionSteps(instructions: string): string[] {
  const byLine = instructions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const lines =
    byLine.length > 1
      ? byLine
      : instructions
          .split(/(?=\d+[.)]\s)/)
          .map((line) => line.trim())
          .filter(Boolean);

  return lines.map((line) => line.replace(/^(?:\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean);
}

function InstructionSteps({ instructions }: { instructions: string }) {
  const theme = useTheme();
  const steps = useMemo(() => parseInstructionSteps(instructions), [instructions]);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const toggleStep = useCallback((index: number) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <View style={styles.stepsList}>
      {steps.map((step, index) => {
        const done = completed.has(index);
        return (
          <Pressable
            key={index}
            onPress={() => toggleStep(index)}
            hitSlop={4}
            style={({ pressed }) => [styles.stepRow, pressed && styles.stepRowPressed]}>
            <Icon
              name={done ? 'checkmark.circle.fill' : 'circle'}
              size={18}
              color={done ? theme.fresh : theme.textSecondary}
            />
            <ThemedText
              type="default"
              themeColor={done ? 'textSecondary' : 'text'}
              style={[styles.stepText, done && styles.stepTextDone]}>
              {step}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: 'heart.fill';
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = active ? theme.accentText : theme.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {icon && <Icon name={icon} size={14} color={tint} />}
      <ThemedText type="small" style={{ color: tint }}>
        {label}
      </ThemedText>
    </Pressable>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.label,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.label,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
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
  stepsList: {
    gap: Spacing.two,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  stepRowPressed: {
    opacity: 0.6,
  },
  stepText: {
    flex: 1,
  },
  stepTextDone: {
    textDecorationLine: 'line-through',
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: 'auto',
  },
});
