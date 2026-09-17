package com.pantriful.backend.recipe;

import java.util.List;

// Shape Claude's structured output is constrained to (see RecipeGenerationService).
public record GeneratedRecipe(
        String title, Integer servings, String instructions, List<GeneratedIngredient> ingredients, GeneratedNutrition nutrition) {

    public record GeneratedIngredient(String inventoryItemId, String name, double quantity, String unit) {}

    public record GeneratedNutrition(
            Double caloriesPerServing, Double proteinGrams, Double carbsGrams, Double fatGrams) {}
}
