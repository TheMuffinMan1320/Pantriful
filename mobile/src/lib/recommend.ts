import type { InventoryItem, Recipe } from '@/lib/api';

// Common staples the backend may use without tracking them as pantry items (see
// RecipeGenerationService's system prompt) - never penalize a recipe for "missing" these.
const STAPLES = new Set(['salt', 'pepper', 'oil', 'water', 'sugar', 'butter']);

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function isOnHand(ingredientName: string, pantryNames: string[]): boolean {
  const normalized = normalize(ingredientName);
  if (STAPLES.has(normalized)) return true;
  return pantryNames.some((pantryName) => pantryName.includes(normalized) || normalized.includes(pantryName));
}

export type RankedRecipe = {
  recipe: Recipe;
  pantryMatchCount: number;
  pantryMatchTotal: number;
  score: number;
};

// Ranks not-yet-made recipes by two signals: how many of their ingredients are already in the
// pantry (what you can cook right now), and how much their ingredients overlap with recipes
// already marked "made" (a proxy for what this user tends to like cooking).
export function rankRecommendedRecipes(recipes: Recipe[], pantry: InventoryItem[]): RankedRecipe[] {
  const pantryNames = pantry.filter((item) => item.quantity > 0).map((item) => normalize(item.name));

  const madeIngredientCounts = new Map<string, number>();
  for (const recipe of recipes) {
    if (recipe.status !== 'made') continue;
    for (const ingredient of recipe.ingredients) {
      const key = normalize(ingredient.name);
      madeIngredientCounts.set(key, (madeIngredientCounts.get(key) ?? 0) + 1);
    }
  }
  const hasHistory = madeIngredientCounts.size > 0;

  const candidates = recipes.filter((recipe) => recipe.status !== 'made');

  const ranked = candidates.map((recipe) => {
    const total = recipe.ingredients.length || 1;
    const matched = recipe.ingredients.filter((ingredient) => isOnHand(ingredient.name, pantryNames)).length;
    const pantryScore = matched / total;

    const preferenceScore = hasHistory
      ? recipe.ingredients.filter((ingredient) => madeIngredientCounts.has(normalize(ingredient.name))).length /
        total
      : 0;

    return {
      recipe,
      pantryMatchCount: matched,
      pantryMatchTotal: recipe.ingredients.length,
      score: pantryScore + preferenceScore * 0.5,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
