package com.pantriful.backend.recipe;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeNutritionRepository extends JpaRepository<RecipeNutrition, UUID> {}
