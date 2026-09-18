package com.pantriful.backend.catalog;

import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BarcodeLookupService {

    private final IngredientCatalogRepository catalogRepository;
    private final OpenFoodFactsClient openFoodFactsClient;

    public BarcodeLookupService(
            IngredientCatalogRepository catalogRepository, OpenFoodFactsClient openFoodFactsClient) {
        this.catalogRepository = catalogRepository;
        this.openFoodFactsClient = openFoodFactsClient;
    }

    @Transactional
    public BarcodeLookupResponse lookup(String barcode) {
        Optional<IngredientCatalogEntry> cached = catalogRepository.findByBarcode(barcode);
        if (cached.isPresent()) {
            return BarcodeLookupResponse.from(cached.get());
        }

        Optional<OpenFoodFactsClient.Product> product = openFoodFactsClient.lookup(barcode);
        if (product.isEmpty() || product.get().productName() == null) {
            return BarcodeLookupResponse.notFound();
        }

        OpenFoodFactsClient.Product p = product.get();
        OpenFoodFactsClient.Nutriments n = p.nutriments();
        IngredientCatalogEntry entry = new IngredientCatalogEntry(
                barcode,
                p.productName(),
                p.brands(),
                "count",
                null,
                toBigDecimal(n != null ? n.energyKcal100g() : null),
                toBigDecimal(n != null ? n.carbohydrates100g() : null),
                toBigDecimal(n != null ? n.fat100g() : null),
                toBigDecimal(n != null ? n.proteins100g() : null),
                "openfoodfacts");
        catalogRepository.save(entry);

        return BarcodeLookupResponse.from(entry);
    }

    private static BigDecimal toBigDecimal(Double value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }
}
