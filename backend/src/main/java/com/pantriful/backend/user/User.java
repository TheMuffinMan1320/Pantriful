package com.pantriful.backend.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "oauth_provider", nullable = false, length = 20)
    private String oauthProvider;

    @Column(name = "oauth_subject", nullable = false)
    private String oauthSubject;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "push_token")
    private String pushToken;

    @Column(name = "low_stock_notifications_enabled", nullable = false)
    private boolean lowStockNotificationsEnabled = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public User(String email, String oauthProvider, String oauthSubject) {
        this.email = email;
        this.oauthProvider = oauthProvider;
        this.oauthSubject = oauthSubject;
    }
}
