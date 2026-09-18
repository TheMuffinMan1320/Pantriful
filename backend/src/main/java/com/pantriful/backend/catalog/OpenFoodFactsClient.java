package com.pantriful.backend.catalog;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

// Free, no API key - see https://openfoodfacts.github.io/openfoodfacts-server/api/
@Component
public class OpenFoodFactsClient {

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper;

    public OpenFoodFactsClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Optional<Product> lookup(String barcode) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://world.openfoodfacts.org/api/v2/product/" + barcode + ".json"))
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            ApiResponse parsed = objectMapper.readValue(response.body(), ApiResponse.class);
            if (parsed.status() != 1 || parsed.product() == null) {
                return Optional.empty();
            }
            return Optional.of(parsed.product());
        } catch (Exception e) {
            // Network hiccup, malformed response, etc. - treat exactly like "not found" so a
            // flaky third party never turns into a 500 for the caller.
            return Optional.empty();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ApiResponse(int status, Product product) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Product(
            @JsonProperty("product_name") String productName, String brands, Nutriments nutriments) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Nutriments(
            @JsonProperty("energy-kcal_100g") Double energyKcal100g,
            @JsonProperty("carbohydrates_100g") Double carbohydrates100g,
            @JsonProperty("fat_100g") Double fat100g,
            @JsonProperty("proteins_100g") Double proteins100g) {}
}
