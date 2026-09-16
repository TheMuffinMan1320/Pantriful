package com.pantriful.backend.inventory;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record UpsertInventoryItemRequest(
        @NotBlank String name,
        @NotNull @DecimalMin(value = "0", inclusive = true) BigDecimal quantity,
        @NotBlank String unit,
        String category,
        LocalDate expirationDate,
        @DecimalMin(value = "0", inclusive = true) BigDecimal lowStockThreshold) {}
