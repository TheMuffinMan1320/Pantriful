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

// Same one-shot pattern as PhotoIdentificationService, extended to a list of line items.
// The receipt photo is never stored - it's only used for this single parsing call.
@Service
public class ReceiptParsingService {

    private static final String MODEL = "claude-sonnet-5";

    private final AnthropicClient anthropicClient;

    public ReceiptParsingService(AnthropicClient anthropicClient) {
        this.anthropicClient = anthropicClient;
    }

    public ParsedReceipt parse(String imageBase64, String mediaType) {
        String system =
                """
                You read grocery store receipts for a home kitchen inventory app. Extract every \
                purchased grocery/kitchen item as a line item with your best guess at its plain name \
                (e.g. "Whole Milk", not a store SKU abbreviation), a simple category (produce, dairy, \
                meat, pantry, frozen, beverage, or other), the purchased quantity, and a unit (e.g. \
                count, lbs, gallon) - default to quantity 1, unit "count" when the receipt doesn't make \
                the quantity or unit clear. Skip non-food line items (bags, tax, discounts, totals). If \
                the photo isn't a legible receipt, return an empty items list.
                """;

        ImageBlockParam image = ImageBlockParam.builder()
                .source(Base64ImageSource.builder()
                        .mediaType(Base64ImageSource.MediaType.of(mediaType))
                        .data(imageBase64)
                        .build())
                .build();

        StructuredMessageCreateParams<ParsedReceipt> params = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(4096L)
                .system(system)
                .outputConfig(ParsedReceipt.class)
                .addUserMessageOfBlockParams(List.of(
                        ContentBlockParam.ofImage(image),
                        ContentBlockParam.ofText(
                                TextBlockParam.builder().text("Parse this receipt.").build())))
                .build();

        return anthropicClient.messages().create(params).content().stream()
                .flatMap(block -> block.text().stream())
                .findFirst()
                .map(textBlock -> textBlock.text())
                .orElseThrow(() -> new IllegalStateException("Claude did not return a structured receipt"));
    }
}
