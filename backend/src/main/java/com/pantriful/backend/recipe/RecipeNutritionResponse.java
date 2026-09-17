package com.pantriful.backend.recipe;

import java.math.BigDecimal;

public record RecipeNutritionResponse(
        BigDecimal caloriesPerServing, BigDecimal proteinGrams, BigDecimal carbsGrams, BigDecimal fatGrams) {

    static RecipeNutritionResponse from(RecipeNutrition nutrition) {
        return new RecipeNutritionResponse(
                nutrition.getCaloriesPerServing(),
                nutrition.getProteinGrams(),
                nutrition.getCarbsGrams(),
                nutrition.getFatGrams());
    }
}
