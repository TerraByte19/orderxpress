package com.orderxpress.domain;

/**
 * Lebenszyklus einer Bestellung:
 * NEW -> IN_PREPARATION -> READY -> SERVED
 * Stornieren (CANCELLED) ist moeglich, solange noch nichts serviert wurde.
 */
public enum OrderStatus {
    NEW, IN_PREPARATION, READY, SERVED, CANCELLED
}
