package com.orderxpress.web.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tages-Statistik fuer den Inhaber: Umsatz und Bestellungen von heute sowie die
 * meistverkauften Produkte. Stornierte Bestellungen zaehlen nicht mit.
 */
public record StatsDto(BigDecimal revenueToday,
                       int orderCount,
                       int itemCount,
                       List<ProductStat> topProducts) {

    /** Ein Produkt in der Bestseller-Liste. */
    public record ProductStat(String name, int quantity, BigDecimal revenue) {
    }
}
