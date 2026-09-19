import type { InventoryItem, Recipe, RecipeIngredient } from '@/lib/api';

// Common staples the backend may use without tracking them as pantry items (see
// RecipeGenerationService's system prompt) - never penalize a recipe for "missing" these.
const STAPLES = new Set(['salt', 'pepper', 'oil', 'water', 'sugar', 'butter']);

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// An ingredient is on hand if it's a staple, is linked to a pantry item that's still in stock, or
// (for ingredients the generator left unlinked) loosely matches a pantry item by name.
function isOnHand(ingredient: RecipeIngredient, inStockIds: Set<string>, pantryNames: string[]): boolean {
  const normalized = normalize(ingredient.name);
  if (STAPLES.has(normalized)) return true;
  if (ingredient.inventoryItemId) return inStockIds.has(ingredient.inventoryItemId);
  return pantryNames.some((pantryName) => pantryName.includes(normalized) || normalized.includes(pantryName));
}

export type RankedRecipe = {
  recipe: Recipe;
  pantryMatchCount: number;
  pantryMatchTotal: number;
  // Ingredients the user doesn't have and would need to buy to make this recipe.
  missingIngredients: RecipeIngredient[];
  score: number;
};

// Ranks not-yet-made recipes by two signals: how many of their ingredients are already in the
// pantry (what you can cook right now), and how much their ingredients overlap with recipes
// already marked "made" (a proxy for what this user tends to like cooking). Recipes the user only
// has some of the ingredients for are still recommended - each one reports what's missing so the
// UI can tell the user what to buy; the ones you're closest to being able to cook rank first.
export function rankRecommendedRecipes(recipes: Recipe[], pantry: InventoryItem[]): RankedRecipe[] {
  const inStock = pantry.filter((item) => item.quantity > 0);
  const inStockIds = new Set(inStock.map((item) => item.id));
  const pantryNames = inStock.map((item) => normalize(item.name));

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
    const missingIngredients = recipe.ingredients.filter(
      (ingredient) => !isOnHand(ingredient, inStockIds, pantryNames),
    );
    const matched = recipe.ingredients.length - missingIngredients.length;
    const pantryScore = matched / total;

    const preferenceScore = hasHistory
      ? recipe.ingredients.filter((ingredient) => madeIngredientCounts.has(normalize(ingredient.name)))
          .length / total
      : 0;

    return {
      recipe,
      pantryMatchCount: matched,
      pantryMatchTotal: recipe.ingredients.length,
      missingIngredients,
      score: pantryScore + preferenceScore * 0.5,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
