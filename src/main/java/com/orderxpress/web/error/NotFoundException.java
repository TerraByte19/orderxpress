package com.orderxpress.web.error;

/** Wird zu HTTP 404 (nicht gefunden). */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
