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
 * Ein angemeldetes Geraet (Kuechen-Tablet, Kassen-Handy) statt eines
 * Mitarbeiter-Logins mit Passwort. Der Inhaber legt ein Geraet an, zeigt den
 * QR-Code, das Geraet scannt ihn einmal und ist danach dauerhaft angemeldet.
 *
 * - activationToken: steckt im QR-Code, gilt GENAU EINMAL (danach null).
 * - deviceToken: der dauerhafte Schluessel, den das Geraet speichert und bei
 *   jeder Anfrage im Header "X-Device-Token" mitschickt.
 * - revoked: verlorenes Geraet gezielt sperren, ohne andere zu stoeren.
 */
@Entity
@Table(name = "staff_devices")
public class StaffDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    /** Sprechender Name, z.B. "Kuechen-Tablet" oder "Kasse vorne". */
    @Column(nullable = false, length = 80)
    private String label;

    /** Nur SERVICE oder KITCHEN - ein Geraet ist nie Inhaber. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;

    @Column(name = "device_token", nullable = false, unique = true, length = 64)
    private String deviceToken;

    /** Einmal-Token aus dem QR-Code; nach der Aktivierung null. */
    @Column(name = "activation_token", unique = true, length = 64)
    private String activationToken;

    @Column(nullable = false)
    private boolean activated = false;

    @Column(nullable = false)
    private boolean revoked = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    protected StaffDevice() {
        // fuer JPA
    }

    public StaffDevice(Restaurant restaurant, String label, UserRole role) {
        this.restaurant = restaurant;
        this.label = label;
        this.role = role;
        this.deviceToken = newToken();
        this.activationToken = newToken();
    }

    private static String newToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    /** Aktivierung durch den QR-Scan: Einmal-Token verbrauchen. */
    public void activate() {
        this.activated = true;
        this.activationToken = null;
        this.lastUsedAt = Instant.now();
    }

    /** Neuen QR-Code erzeugen (z.B. Geraet neu einrichten). */
    public void regenerateActivationToken() {
        this.activationToken = newToken();
        this.activated = false;
    }

    public void revoke() {
        this.revoked = true;
        this.activationToken = null;
    }

    public void touch() {
        this.lastUsedAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Restaurant getRestaurant() {
        return restaurant;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public UserRole getRole() {
        return role;
    }

    public String getDeviceToken() {
        return deviceToken;
    }

    public String getActivationToken() {
        return activationToken;
    }

    public boolean isActivated() {
        return activated;
    }

    public boolean isRevoked() {
        return revoked;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }
}
