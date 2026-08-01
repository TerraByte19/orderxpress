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

/**
 * Ein "Kellner rufen"-Ruf von einem Tisch. Gehoert zu einer Sitzung (damit
 * Tisch + Laden feststehen) und der Person, die gerufen hat. Bleibt OPEN, bis
 * das Personal ihn als erledigt markiert.
 */
@Entity
@Table(name = "waiter_calls")
public class WaiterCall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private TableSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guest_id", nullable = false)
    private Guest guest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CallStatus status = CallStatus.OPEN;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected WaiterCall() {
        // fuer JPA
    }

    public WaiterCall(TableSession session, Guest guest) {
        this.session = session;
        this.guest = guest;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void markDone() {
        this.status = CallStatus.DONE;
    }

    public Long getId() {
        return id;
    }

    public TableSession getSession() {
        return session;
    }

    public Guest getGuest() {
        return guest;
    }

    public CallStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
