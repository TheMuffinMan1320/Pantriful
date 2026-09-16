package com.pantriful.backend.inventory;

import com.pantriful.backend.user.User;
import com.pantriful.backend.user.UserRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventoryService {

    private final InventoryItemRepository inventoryItemRepository;
    private final UserRepository userRepository;

    public InventoryService(InventoryItemRepository inventoryItemRepository, UserRepository userRepository) {
        this.inventoryItemRepository = inventoryItemRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<InventoryItemResponse> list(UUID userId) {
        return inventoryItemRepository.findByUserId(userId).stream()
                .map(InventoryItemResponse::from)
                .toList();
    }

    @Transactional
    public InventoryItemResponse create(UUID userId, UpsertInventoryItemRequest request) {
        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        InventoryItem item = new InventoryItem(user, request.name(), request.quantity(), request.unit());
        item.setCategory(request.category());
        item.setExpirationDate(request.expirationDate());
        item.setLowStockThreshold(request.lowStockThreshold());

        return InventoryItemResponse.from(inventoryItemRepository.save(item));
    }

    @Transactional
    public InventoryItemResponse update(UUID userId, UUID itemId, UpsertInventoryItemRequest request) {
        InventoryItem item = findOwnedItem(userId, itemId);

        item.setName(request.name());
        item.setQuantity(request.quantity());
        item.setUnit(request.unit());
        item.setCategory(request.category());
        item.setExpirationDate(request.expirationDate());
        item.setLowStockThreshold(request.lowStockThreshold());

        return InventoryItemResponse.from(item);
    }

    @Transactional
    public void delete(UUID userId, UUID itemId) {
        InventoryItem item = findOwnedItem(userId, itemId);
        inventoryItemRepository.delete(item);
    }

    private InventoryItem findOwnedItem(UUID userId, UUID itemId) {
        return inventoryItemRepository
                .findByIdAndUserId(itemId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inventory item not found"));
    }
}
