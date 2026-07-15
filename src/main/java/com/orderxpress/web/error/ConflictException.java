package com.orderxpress.web.error;

/** Wird zu HTTP 409 (Aktion passt nicht zum aktuellen Zustand). */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
