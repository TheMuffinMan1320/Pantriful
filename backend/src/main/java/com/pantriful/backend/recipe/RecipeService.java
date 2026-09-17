package com.pantriful.backend.recipe;

import com.pantriful.backend.inventory.InventoryItem;
import com.pantriful.backend.inventory.InventoryItemRepository;
import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecipeService {

    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final RecipeNutritionRepository recipeNutritionRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final UserRepository userRepository;
    private final RecipeGenerationService recipeGenerationService;

    public RecipeService(
            RecipeRepository recipeRepository,
            RecipeIngredientRepository recipeIngredientRepository,
            RecipeNutritionRepository recipeNutritionRepository,
            InventoryItemRepository inventoryItemRepository,
            UserRepository userRepository,
            RecipeGenerationService recipeGenerationService) {
        this.recipeRepository = recipeRepository;
        this.recipeIngredientRepository = recipeIngredientRepository;
        this.recipeNutritionRepository = recipeNutritionRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.userRepository = userRepository;
        this.recipeGenerationService = recipeGenerationService;
    }

    @Transactional(readOnly = true)
    public List<RecipeResponse> list(UUID userId) {
        return recipeRepository.findByUserId(userId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RecipeResponse get(UUID userId, UUID recipeId) {
        return toResponse(findOwnedRecipe(userId, recipeId));
    }

    @Transactional
    public RecipeResponse generate(UUID userId) {
        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        List<InventoryItem> pantry = inventoryItemRepository.findByUserId(userId);
        Map<UUID, InventoryItem> pantryById =
                pantry.stream().collect(Collectors.toMap(InventoryItem::getId, item -> item));

        GeneratedRecipe generated = recipeGenerationService.generate(pantry);

        Recipe recipe = new Recipe(user, generated.title(), generated.instructions(), generated.servings());
        recipeRepository.save(recipe);

        for (GeneratedRecipe.GeneratedIngredient ingredient : generated.ingredients()) {
            InventoryItem matched = matchInventoryItem(pantryById, ingredient.inventoryItemId());
            recipeIngredientRepository.save(new RecipeIngredient(
                    recipe, matched, ingredient.name(), BigDecimal.valueOf(ingredient.quantity()), ingredient.unit()));
        }

        if (generated.nutrition() != null) {
            GeneratedRecipe.GeneratedNutrition nutrition = generated.nutrition();
            recipeNutritionRepository.save(new RecipeNutrition(
                    recipe,
                    toBigDecimal(nutrition.caloriesPerServing()),
                    toBigDecimal(nutrition.proteinGrams()),
                    toBigDecimal(nutrition.carbsGrams()),
                    toBigDecimal(nutrition.fatGrams())));
        }

        return toResponse(recipe);
    }

    @Transactional
    public RecipeResponse markMade(UUID userId, UUID recipeId) {
        Recipe recipe = findOwnedRecipe(userId, recipeId);

        for (RecipeIngredient ingredient : recipeIngredientRepository.findByRecipeId(recipeId)) {
            InventoryItem item = ingredient.getInventoryItem();
            if (item == null) {
                continue; // untracked staple - nothing to decrement
            }
            item.setQuantity(item.getQuantity().subtract(ingredient.getQuantity()).max(BigDecimal.ZERO));
        }

        recipe.setStatus("made");
        return toResponse(recipe);
    }

    private InventoryItem matchInventoryItem(Map<UUID, InventoryItem> pantryById, String inventoryItemId) {
        if (inventoryItemId == null) {
            return null;
        }
        try {
            return pantryById.get(UUID.fromString(inventoryItemId));
        } catch (IllegalArgumentException notAUuid) {
            // Claude returned a malformed id - treat the ingredient as untracked rather than failing the request.
            return null;
        }
    }

    private Recipe findOwnedRecipe(UUID userId, UUID recipeId) {
        return recipeRepository
                .findByIdAndUserId(recipeId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));
    }

    private RecipeResponse toResponse(Recipe recipe) {
        List<RecipeIngredient> ingredients = recipeIngredientRepository.findByRecipeId(recipe.getId());
        RecipeNutrition nutrition =
                recipeNutritionRepository.findById(recipe.getId()).orElse(null);
        return RecipeResponse.from(recipe, ingredients, nutrition);
    }

    private static BigDecimal toBigDecimal(Double value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }
}
