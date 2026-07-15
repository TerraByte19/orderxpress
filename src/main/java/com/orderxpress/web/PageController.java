package com.orderxpress.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Liefert fuer die QR-Code-URL /t/{qrToken} die Gaeste-Seite aus.
 * Das JavaScript der Seite liest den Token aus der Adresszeile.
 */
@Controller
public class PageController {

    @GetMapping("/t/{qrToken}")
    public String guestPage() {
        return "forward:/guest.html";
    }
}
