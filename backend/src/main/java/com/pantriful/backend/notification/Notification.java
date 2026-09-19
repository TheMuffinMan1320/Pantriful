package com.pantriful.backend.notification;

import com.pantriful.backend.inventory.InventoryItem;
import com.pantriful.backend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

// Audit log of pushes actually sent, so a scheduled sweep can tell what's already been
// notified about without re-deriving it from InventoryItem.lowStockNotifiedAt alone.
@Entity
@Table(name = "notifications")
@Getter
@NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    private InventoryItem inventoryItem;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(nullable = false, columnDefinition = "text")
    private String message;

    @CreationTimestamp
    @Column(name = "sent_at", nullable = false, updatable = false)
    private Instant sentAt;

    public Notification(User user, InventoryItem inventoryItem, String type, String message) {
        this.user = user;
        this.inventoryItem = inventoryItem;
        this.type = type;
        this.message = message;
    }
}
