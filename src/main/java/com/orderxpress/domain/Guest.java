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
 * Eine einzelne Person an einem Tisch (Teil einer TableSession). Jede Person
 * hat ihren eigenen geheimen guestToken, mit dem sie bestellt. Die erste Person
 * ist der Gastgeber (host) - sie wird vom Laden freigegeben und gibt danach
 * weitere Personen frei, die denselben QR-Code scannen.
 */
@Entity
@Table(name = "guests")
public class Guest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private TableSession session;

    /** Geheimer, individueller Schluessel dieser Person (nicht die Tischnummer). */
    @Column(name = "guest_token", nullable = false, unique = true, length = 36)
    private String guestToken;

    /** Anzeigename, z.B. "Gast 1" - von der Person aenderbar. */
    @Column(nullable = false, length = 60)
    private String name;

    /** true = Gastgeber (erste Person, gibt weitere Personen frei). */
    @Column(nullable = false)
    private boolean host;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuestStatus status = GuestStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Guest() {
        // fuer JPA
    }

    public Guest(TableSession session, String name, boolean host) {
        this.session = session;
        this.name = name;
        this.host = host;
        this.guestToken = UUID.randomUUID().toString();
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void approve() {
        this.status = GuestStatus.APPROVED;
    }

    public void reject() {
        this.status = GuestStatus.REJECTED;
    }

    public Long getId() {
        return id;
    }

    public TableSession getSession() {
        return session;
    }

    public String getGuestToken() {
        return guestToken;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isHost() {
        return host;
    }

    public GuestStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
