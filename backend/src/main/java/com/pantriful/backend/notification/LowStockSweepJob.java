package com.pantriful.backend.notification;

import com.pantriful.backend.inventory.InventoryItemRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// Backstop for the synchronous checks in InventoryService/RecipeService: catches cases like a
// low-stock threshold being edited downward below an already-low quantity, where no quantity
// change occurred to trigger the synchronous path.
@Component
public class LowStockSweepJob {

    private final InventoryItemRepository inventoryItemRepository;
    private final LowStockCheckService lowStockCheckService;

    public LowStockSweepJob(
            InventoryItemRepository inventoryItemRepository, LowStockCheckService lowStockCheckService) {
        this.inventoryItemRepository = inventoryItemRepository;
        this.lowStockCheckService = lowStockCheckService;
    }

    @Scheduled(cron = "0 0 8 * * *") // daily at 8am server time
    @Transactional
    public void sweep() {
        lowStockCheckService.sweep(inventoryItemRepository.findAll());
    }
}
