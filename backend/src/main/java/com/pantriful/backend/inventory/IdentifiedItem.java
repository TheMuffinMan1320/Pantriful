package com.pantriful.backend.inventory;

// Shape Claude's structured output is constrained to (see PhotoIdentificationService).
// All fields are null when the photo doesn't clearly show a single edible item.
public record IdentifiedItem(String name, String category, Double estimatedQuantity, String unit) {}
