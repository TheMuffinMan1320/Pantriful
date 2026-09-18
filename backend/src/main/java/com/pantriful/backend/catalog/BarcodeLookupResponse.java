package com.pantriful.backend.catalog;

public record BarcodeLookupResponse(
        boolean found,
        String name,
        String brand,
        String category,
        String defaultUnit,
        Double caloriesPer100g,
        Double carbsPer100g,
        Double fatPer100g,
        Double proteinPer100g) {

    static BarcodeLookupResponse notFound() {
        return new BarcodeLookupResponse(false, null, null, null, null, null, null, null, null);
    }

    static BarcodeLookupResponse from(IngredientCatalogEntry entry) {
        return new BarcodeLookupResponse(
                true,
                entry.getCanonicalName(),
                entry.getBrand(),
                entry.getCategory(),
                entry.getDefaultUnit(),
                toDouble(entry.getCaloriesPer100g()),
                toDouble(entry.getCarbsPer100g()),
                toDouble(entry.getFatPer100g()),
                toDouble(entry.getProteinPer100g()));
    }

    private static Double toDouble(java.math.BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }
}
