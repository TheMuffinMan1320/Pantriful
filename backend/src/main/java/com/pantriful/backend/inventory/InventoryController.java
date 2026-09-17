package com.pantriful.backend.inventory;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final PhotoIdentificationService photoIdentificationService;
    private final ReceiptParsingService receiptParsingService;

    public InventoryController(
            InventoryService inventoryService,
            PhotoIdentificationService photoIdentificationService,
            ReceiptParsingService receiptParsingService) {
        this.inventoryService = inventoryService;
        this.photoIdentificationService = photoIdentificationService;
        this.receiptParsingService = receiptParsingService;
    }

    @GetMapping
    public List<InventoryItemResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return inventoryService.list(userId(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryItemResponse create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpsertInventoryItemRequest request) {
        return inventoryService.create(userId(jwt), request);
    }

    @PutMapping("/{id}")
    public InventoryItemResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpsertInventoryItemRequest request) {
        return inventoryService.update(userId(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        inventoryService.delete(userId(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/identify-photo")
    public IdentifiedItem identifyPhoto(@Valid @RequestBody IdentifyPhotoRequest request) {
        return photoIdentificationService.identify(request.imageBase64(), request.mediaType());
    }

    @PostMapping("/parse-receipt")
    public ParsedReceipt parseReceipt(@Valid @RequestBody IdentifyPhotoRequest request) {
        return receiptParsingService.parse(request.imageBase64(), request.mediaType());
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
