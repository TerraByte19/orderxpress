package com.orderxpress.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Eine "Sitzung" an einem Tisch: entsteht beim QR-Scan, muss vom Inhaber
 * freigegeben werden und wird beim Verlassen des Tisches geschlossen.
 * Der sessionToken ist der Schluessel, mit dem der Gast bestellen darf.
 */
@Entity
@Table(name = "table_sessions")
public class TableSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "table_id", nullable = false)
    private RestaurantTable restaurantTable;

    @Column(name = "session_token", nullable = false, unique = true, length = 36)
    private String sessionToken;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionStatus status = SessionStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    protected TableSession() {
        // fuer JPA
    }

    public TableSession(RestaurantTable restaurantTable) {
        this.restaurantTable = restaurantTable;
        this.sessionToken = UUID.randomUUID().toString();
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void approve() {
        this.status = SessionStatus.APPROVED;
        this.approvedAt = Instant.now();
    }

    public void reject() {
        this.status = SessionStatus.REJECTED;
    }

    public void expire() {
        this.status = SessionStatus.EXPIRED;
    }

    public void close() {
        this.status = SessionStatus.CLOSED;
        this.closedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public RestaurantTable getRestaurantTable() {
        return restaurantTable;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public SessionStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }
}
