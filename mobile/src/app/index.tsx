import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeRule } from '@/components/barcode-rule';
import { Icon } from '@/components/icon';
import { LabelCard } from '@/components/label-card';
import { StampBadge } from '@/components/stamp-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import {
  ApiError,
  generateRecipe,
  listInventory,
  listRecipes,
  type InventoryItem,
  type Recipe,
} from '@/lib/api';
import { rankRecommendedRecipes, type RankedRecipe } from '@/lib/recommend';

function isLowStock(item: InventoryItem): boolean {
  return item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
}

export default function HomeScreen() {
  const { state: authState } = useAuth();
  const theme = useTheme();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [inventory, recipeList] = await Promise.all([listInventory(), listRecipes()]);
      setItems(inventory);
      setRecipes(recipeList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your pantry');
    }
  }, []);

  useEffect(() => {
    if (authState.status === 'signedIn') {
      load();
    }
  }, [authState.status, load]);

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

  if (authState.status !== 'signedIn') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.wordmarkBlock}>
            <ThemedText type="title" style={styles.wordmark}>
              PANTRIFUL
            </ThemedText>
            <BarcodeRule seed="pantriful-home" height={16} />
            <ThemedText type="label" themeColor="textSecondary" style={styles.tagline}>
              Kitchen inventory, tracked and dated
            </ThemedText>
          </View>

          {authState.status === 'loading' ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <LabelCard style={styles.card}>
              <ThemedText type="label" themeColor="textSecondary">
                Status
              </ThemedText>
              <ThemedText type="subtitle">Signed out</ThemedText>
              <ThemedText themeColor="textSecondary">Sign in from the Settings tab to see your pantry.</ThemedText>
            </LabelCard>
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const lowStockCount = (items ?? []).filter(isLowStock).length;
  const ranked = recipes ? rankRecommendedRecipes(recipes, items ?? []) : [];
  const topPicks = ranked.slice(0, 3);
  const loading = items === null || recipes === null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.landingSafeArea} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.wordmarkBlock}>
            <ThemedText type="title" style={styles.wordmark}>
              PANTRIFUL
            </ThemedText>
            <BarcodeRule seed="pantriful-home" height={16} />
          </View>

          {error && (
            <ThemedText type="small" themeColor="danger" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {loading ? (
            <ActivityIndicator style={styles.loading} color={theme.accent} />
          ) : (
            <>
              <Link href="/explore" asChild>
                <Pressable>
                  <LabelCard style={styles.snapshotCard}>
                    <View style={styles.snapshotRow}>
                      <View>
                        <ThemedText type="label" themeColor="textSecondary">
                          Pantry
                        </ThemedText>
                        <ThemedText type="subtitle">{(items ?? []).length} items on the shelf</ThemedText>
                      </View>
                      {lowStockCount > 0 && <StampBadge label={`${lowStockCount} LOW`} />}
                    </View>
                  </LabelCard>
                </Pressable>
              </Link>

              <View style={styles.section}>
                <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
                  Recommended for you
                </ThemedText>

                {topPicks.length === 0 ? (
                  <LabelCard style={styles.card}>
                    <ThemedText type="subtitle">No recommendations yet</ThemedText>
                    <ThemedText themeColor="textSecondary">
                      Generate a recipe from what&apos;s in your pantry to get started.
                    </ThemedText>
                    <Pressable onPress={onGenerate} disabled={generating} hitSlop={8}>
                      <View style={styles.generateRow}>
                        {generating ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <Icon name="sparkles" size={16} color={theme.accent} />
                        )}
                        <ThemedText type="linkPrimary">
                          {generating ? 'Generating…' : 'Generate a recipe'}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </LabelCard>
                ) : (
                  topPicks.map((pick) => <RecommendationCard key={pick.recipe.id} pick={pick} />)
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function RecommendationCard({ pick }: { pick: RankedRecipe }) {
  const theme = useTheme();
  const { recipe, pantryMatchCount, pantryMatchTotal } = pick;

  return (
    <Link href="/recipes" asChild>
      <Pressable>
        <LabelCard style={styles.card}>
          <View style={styles.snapshotRow}>
            <View style={styles.recommendationInfo}>
              <ThemedText type="subtitle" numberOfLines={2}>
                {recipe.title}
              </ThemedText>
              {recipe.servings && (
                <ThemedText type="data" themeColor="textSecondary">
                  Serves {recipe.servings}
                </ThemedText>
              )}
            </View>
            <Icon name="fork.knife" size={22} color={theme.accent} />
          </View>
          <BarcodeRule seed={recipe.id} height={10} />
          <ThemedText type="data" themeColor="textSecondary">
            {pantryMatchTotal > 0
              ? `${pantryMatchCount}/${pantryMatchTotal} ingredients on hand`
              : 'No ingredients listed'}
          </ThemedText>
        </LabelCard>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  landingSafeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  wordmarkBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  wordmark: {
    letterSpacing: 2,
  },
  tagline: {
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  card: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  error: {
    textAlign: 'center',
  },
  loading: {
    marginTop: Spacing.six,
  },
  snapshotCard: {
    gap: Spacing.two,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    marginLeft: Spacing.one,
  },
  recommendationInfo: {
    gap: Spacing.half,
    flex: 1,
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
