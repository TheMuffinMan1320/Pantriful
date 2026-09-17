package com.pantriful.backend.inventory;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.TextBlockParam;
import java.util.List;
import org.springframework.stereotype.Service;

// Isolated behind its own class so IdentifyPhotoControllerTest-style tests can mock it out
// instead of hitting the real Claude API, same pattern as RecipeGenerationService.
@Service
public class PhotoIdentificationService {

    private static final String MODEL = "claude-sonnet-5";

    private final AnthropicClient anthropicClient;

    public PhotoIdentificationService(AnthropicClient anthropicClient) {
        this.anthropicClient = anthropicClient;
    }

    public IdentifiedItem identify(String imageBase64, String mediaType) {
        String system =
                """
                You identify a single grocery or kitchen ingredient from a photo for a home inventory \
                app. Give your best guess at its name (e.g. "Banana", "Whole Milk"), a simple category \
                (produce, dairy, meat, pantry, frozen, beverage, or other), a reasonable estimated \
                quantity, and a unit (e.g. count, lbs, gallon). If the photo does not clearly show a \
                single edible grocery or kitchen item, set name to null and leave the rest null too.
                """;

        ImageBlockParam image = ImageBlockParam.builder()
                .source(Base64ImageSource.builder()
                        .mediaType(Base64ImageSource.MediaType.of(mediaType))
                        .data(imageBase64)
                        .build())
                .build();

        StructuredMessageCreateParams<IdentifiedItem> params = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(1024L)
                .system(system)
                .outputConfig(IdentifiedItem.class)
                .addUserMessageOfBlockParams(List.of(
                        ContentBlockParam.ofImage(image),
                        ContentBlockParam.ofText(
                                TextBlockParam.builder().text("What is this item?").build())))
                .build();

        return anthropicClient.messages().create(params).content().stream()
                .flatMap(block -> block.text().stream())
                .findFirst()
                .map(textBlock -> textBlock.text())
                .orElseThrow(() -> new IllegalStateException("Claude did not return a structured identification"));
    }
}
