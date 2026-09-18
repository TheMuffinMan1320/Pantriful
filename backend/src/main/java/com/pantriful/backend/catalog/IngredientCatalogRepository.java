package com.pantriful.backend.catalog;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngredientCatalogRepository extends JpaRepository<IngredientCatalogEntry, UUID> {

    Optional<IngredientCatalogEntry> findByBarcode(String barcode);
}
