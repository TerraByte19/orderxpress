package com.orderxpress.domain;

/**
 * Status einer einzelnen Person (Guest) an einem Tisch.
 * - PENDING: hat gescannt, wartet auf Freigabe (erste Person durch den Laden,
 *            weitere Personen durch den Gastgeber = erste Person).
 * - APPROVED: darf bestellen und die geteilte Rechnung sehen.
 * - REJECTED: wurde abgelehnt.
 */
public enum GuestStatus {
    PENDING,
    APPROVED,
    REJECTED
}
