package com.pantriful.backend.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record InventoryItemResponse(
        UUID id,
        String name,
        BigDecimal quantity,
        String unit,
        String category,
        LocalDate expirationDate,
        BigDecimal lowStockThreshold,
        String imageUrl) {

    static InventoryItemResponse from(InventoryItem item) {
        return new InventoryItemResponse(
                item.getId(),
                item.getName(),
                item.getQuantity(),
                item.getUnit(),
                item.getCategory(),
                item.getExpirationDate(),
                item.getLowStockThreshold(),
                item.getImageUrl());
    }
}
