package com.pantriful.backend.recipe;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "recipe_nutrition")
@Getter
@Setter
@NoArgsConstructor
public class RecipeNutrition {

    @Id
    private UUID recipeId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "recipe_id")
    private Recipe recipe;

    @Column(name = "calories_per_serving", precision = 10, scale = 2)
    private BigDecimal caloriesPerServing;

    @Column(name = "protein_grams", precision = 10, scale = 2)
    private BigDecimal proteinGrams;

    @Column(name = "carbs_grams", precision = 10, scale = 2)
    private BigDecimal carbsGrams;

    @Column(name = "fat_grams", precision = 10, scale = 2)
    private BigDecimal fatGrams;

    public RecipeNutrition(
            Recipe recipe,
            BigDecimal caloriesPerServing,
            BigDecimal proteinGrams,
            BigDecimal carbsGrams,
            BigDecimal fatGrams) {
        this.recipe = recipe;
        this.caloriesPerServing = caloriesPerServing;
        this.proteinGrams = proteinGrams;
        this.carbsGrams = carbsGrams;
        this.fatGrams = fatGrams;
    }
}
