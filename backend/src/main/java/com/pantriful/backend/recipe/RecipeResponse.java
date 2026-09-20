package com.pantriful.backend.recipe;

import java.util.List;
import java.util.UUID;

public record RecipeResponse(
        UUID id,
        String title,
        String instructions,
        Integer servings,
        String status,
        boolean favorite,
        List<RecipeIngredientResponse> ingredients,
        RecipeNutritionResponse nutrition) {

    static RecipeResponse from(Recipe recipe, List<RecipeIngredient> ingredients, RecipeNutrition nutrition) {
        return new RecipeResponse(
                recipe.getId(),
                recipe.getTitle(),
                recipe.getInstructions(),
                recipe.getServings(),
                recipe.getStatus(),
                recipe.isFavorite(),
                ingredients.stream().map(RecipeIngredientResponse::from).toList(),
                nutrition != null ? RecipeNutritionResponse.from(nutrition) : null);
    }
}
