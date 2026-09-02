package com.pantriful.backend.inventory;

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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "inventory_items")
@Getter
@Setter
@NoArgsConstructor
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(nullable = false)
    private String unit = "count";

    private String category;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Column(name = "low_stock_threshold", precision = 12, scale = 3)
    private BigDecimal lowStockThreshold;

    @Column(name = "low_stock_notified_at")
    private Instant lowStockNotifiedAt;

    @Column(name = "image_url")
    private String imageUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public InventoryItem(User user, String name, BigDecimal quantity, String unit) {
        this.user = user;
        this.name = name;
        this.quantity = quantity;
        this.unit = unit;
    }
}
