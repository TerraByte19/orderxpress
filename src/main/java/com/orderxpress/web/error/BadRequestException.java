package com.orderxpress.web.error;

/** Wird zu HTTP 400 (fehlerhafte Eingabe, z.B. ungueltiges Bild). */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
