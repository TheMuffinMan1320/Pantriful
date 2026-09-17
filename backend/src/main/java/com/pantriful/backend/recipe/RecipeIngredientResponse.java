package com.pantriful.backend.recipe;

import java.math.BigDecimal;
import java.util.UUID;

public record RecipeIngredientResponse(UUID id, UUID inventoryItemId, String name, BigDecimal quantity, String unit) {

    static RecipeIngredientResponse from(RecipeIngredient ingredient) {
        return new RecipeIngredientResponse(
                ingredient.getId(),
                ingredient.getInventoryItem() != null ? ingredient.getInventoryItem().getId() : null,
                ingredient.getName(),
                ingredient.getQuantity(),
                ingredient.getUnit());
    }
}
