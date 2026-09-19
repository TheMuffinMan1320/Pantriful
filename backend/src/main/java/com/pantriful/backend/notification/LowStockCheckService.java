package com.pantriful.backend.notification;

import com.pantriful.backend.inventory.InventoryItem;
import com.pantriful.backend.user.User;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

// Called synchronously right after any write that changes an item's quantity (manual edit,
// "mark as made") so a notification fires immediately on the change that caused it, per the
// original plan - no polling delay for the common case. A separate @Scheduled sweep
// (LowStockSweepJob) is the backstop for cases this doesn't catch, e.g. a threshold lowered
// on an already-low item.
@Service
public class LowStockCheckService {

    private final ExpoPushClient expoPushClient;
    private final NotificationRepository notificationRepository;

    public LowStockCheckService(ExpoPushClient expoPushClient, NotificationRepository notificationRepository) {
        this.expoPushClient = expoPushClient;
        this.notificationRepository = notificationRepository;
    }

    public void checkItem(InventoryItem item) {
        boolean isLow = item.getLowStockThreshold() != null
                && item.getQuantity().compareTo(item.getLowStockThreshold()) <= 0;

        if (!isLow) {
            // Back above threshold - clear the flag so a future dip notifies again.
            item.setLowStockNotifiedAt(null);
            return;
        }

        if (item.getLowStockNotifiedAt() != null) {
            return; // already notified for this low-stock episode
        }

        notifyLowStock(item);
    }

    // Backstop for items that went low without a write we intercepted (e.g. the threshold
    // itself was just edited downward below the current quantity).
    public void sweep(List<InventoryItem> items) {
        for (InventoryItem item : items) {
            checkItem(item);
        }
    }

    private void notifyLowStock(InventoryItem item) {
        User user = item.getUser();
        item.setLowStockNotifiedAt(Instant.now());

        String message = "%s is running low (%s %s left).".formatted(item.getName(), item.getQuantity(), item.getUnit());
        notificationRepository.save(new Notification(user, item, "low_stock", message));

        if (user.isLowStockNotificationsEnabled() && user.getPushToken() != null) {
            expoPushClient.send(user.getPushToken(), "Running low", message);
        }
    }
}
