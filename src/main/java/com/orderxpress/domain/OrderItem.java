package com.orderxpress.domain;

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

/**
 * Eine Position innerhalb einer Bestellung. Name und Preis werden als
 * "Schnappschuss" kopiert, damit alte Bestellungen korrekt bleiben,
 * auch wenn sich die Karte spaeter aendert.
 */
@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id")
    private MenuItem menuItem;

    /** Name des Gerichts zum Bestellzeitpunkt. */
    @Column(name = "item_name", nullable = false, length = 150)
    private String itemName;

    /** Einzelpreis zum Bestellzeitpunkt. */
    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private int quantity;

    /** Wunsch des Gastes, z.B. "ohne Zwiebeln". */
    @Column(length = 200)
    private String note;

    /** true = diese Position wurde an der Kasse bereits KOMPLETT bezahlt. */
    @Column(nullable = false)
    private boolean paid = false;

    /**
     * Wie viele Stueck schon bezahlt sind (z.B. 2 von 5 Cola). Nullable, damit
     * die Spalte per ddl-auto auf bestehende Daten passt: null = 0 bzw. bei
     * paid=true die ganze Menge (alte, komplett bezahlte Positionen).
     */
    @Column(name = "paid_quantity")
    private Integer paidQuantity;

    @Column(name = "paid_at")
    private Instant paidAt;

    protected OrderItem() {
        // fuer JPA
    }

    public OrderItem(MenuItem menuItem, int quantity, String note) {
        this.menuItem = menuItem;
        this.itemName = menuItem.getName();
        this.unitPrice = menuItem.getPrice();
        this.quantity = quantity;
        this.note = note;
    }

    public BigDecimal getLineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    public boolean isPaid() {
        return paid;
    }

    /** Bereits bezahlte Stueckzahl (0 bis quantity). */
    public int getPaidQuantity() {
        if (paid) {
            return quantity;
        }
        return paidQuantity == null ? 0 : paidQuantity;
    }

    /** Noch offene Stueckzahl. */
    public int getOpenQuantity() {
        return quantity - getPaidQuantity();
    }

    /** Betrag der bereits bezahlten Stueck. */
    public BigDecimal getPaidTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(getPaidQuantity()));
    }

    /**
     * Teilmenge bezahlen, z.B. 1 von 5 Cola. Ist danach alles bezahlt, gilt die
     * ganze Position als bezahlt.
     */
    public void pay(int count) {
        if (count < 1 || count > getOpenQuantity()) {
            throw new IllegalArgumentException("Ungueltige Stueckzahl: " + count);
        }
        this.paidQuantity = getPaidQuantity() + count;
        if (paidQuantity == quantity) {
            this.paid = true;
        }
        this.paidAt = Instant.now();
    }

    public Instant getPaidAt() {
        return paidAt;
    }

    public Long getId() {
        return id;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    void setOrder(CustomerOrder order) {
        this.order = order;
    }

    public MenuItem getMenuItem() {
        return menuItem;
    }

    public String getItemName() {
        return itemName;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public int getQuantity() {
        return quantity;
    }

    public String getNote() {
        return note;
    }
}
