package com.pantriful.backend.recipe;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.pantriful.backend.inventory.InventoryItem;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

// Isolated behind its own interface-free class so RecipeService's tests can mock it out
// instead of hitting the real Claude API.
@Service
public class RecipeGenerationService {

    private static final String MODEL = "claude-sonnet-5";

    private final AnthropicClient anthropicClient;

    public RecipeGenerationService(AnthropicClient anthropicClient) {
        this.anthropicClient = anthropicClient;
    }

    public GeneratedRecipe generate(List<InventoryItem> pantry) {
        String pantryList = pantry.isEmpty()
                ? "(empty)"
                : pantry.stream()
                        .map(item -> "- id=%s, name=%s, quantity=%s, unit=%s"
                                .formatted(item.getId(), item.getName(), item.getQuantity(), item.getUnit()))
                        .collect(Collectors.joining("\n"));

        String system =
                """
                You are a home cooking assistant. Generate exactly one recipe built around the \
                ingredients in the user's current pantry, listed below with their exact ids. The user \
                may not have everything the dish needs - it is fine, and often better, to suggest a \
                good recipe that requires buying a few extra ingredients.

                Rules:
                - Use at least two pantry items as core ingredients of the dish.
                - For every ingredient you use that matches a pantry item, set its inventoryItemId to \
                that item's exact id from the list below.
                - You may include up to 4 ingredients that are NOT in the pantry when they make the \
                dish meaningfully better; for those, set inventoryItemId to null. The app will show the \
                user which ones they need to buy.
                - You may also use common staples (salt, pepper, cooking oil, water) even if they are \
                not listed; for those, set inventoryItemId to null.
                - Never invent an inventoryItemId that is not one of the ids listed below.
                - Give realistic quantities and clear, numbered step-by-step instructions.
                - Nutrition values are a rough per-serving estimate.
                """;

        String user = "Current pantry:\n" + pantryList + "\n\nGenerate a recipe based on these ingredients.";

        StructuredMessageCreateParams<GeneratedRecipe> params = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(4096L)
                .system(system)
                .outputConfig(GeneratedRecipe.class)
                .addUserMessage(user)
                .build();

        return anthropicClient.messages().create(params).content().stream()
                .flatMap(block -> block.text().stream())
                .findFirst()
                .map(textBlock -> textBlock.text())
                .orElseThrow(() -> new IllegalStateException("Claude did not return a structured recipe"));
    }
}
