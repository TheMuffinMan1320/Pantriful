package com.pantriful.backend.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

// Shared, not per-user - a cache of barcode-identified products, written only by
// BarcodeLookupService, never exposed as a directly-writeable endpoint.
@Entity
@Table(name = "ingredient_catalog")
@Getter
@Setter
@NoArgsConstructor
public class IngredientCatalogEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String barcode;

    @Column(name = "canonical_name", nullable = false)
    private String canonicalName;

    private String brand;

    @Column(name = "default_unit", nullable = false)
    private String defaultUnit = "count";

    private String category;

    @Column(name = "calories_per_100g", precision = 10, scale = 2)
    private BigDecimal caloriesPer100g;

    @Column(name = "carbs_per_100g", precision = 10, scale = 2)
    private BigDecimal carbsPer100g;

    @Column(name = "fat_per_100g", precision = 10, scale = 2)
    private BigDecimal fatPer100g;

    @Column(name = "protein_per_100g", precision = 10, scale = 2)
    private BigDecimal proteinPer100g;

    @Column(nullable = false)
    private String source;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public IngredientCatalogEntry(
            String barcode,
            String canonicalName,
            String brand,
            String defaultUnit,
            String category,
            BigDecimal caloriesPer100g,
            BigDecimal carbsPer100g,
            BigDecimal fatPer100g,
            BigDecimal proteinPer100g,
            String source) {
        this.barcode = barcode;
        this.canonicalName = canonicalName;
        this.brand = brand;
        this.defaultUnit = defaultUnit;
        this.category = category;
        this.caloriesPer100g = caloriesPer100g;
        this.carbsPer100g = carbsPer100g;
        this.fatPer100g = fatPer100g;
        this.proteinPer100g = proteinPer100g;
        this.source = source;
    }
}
