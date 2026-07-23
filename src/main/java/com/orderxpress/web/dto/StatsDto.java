package com.orderxpress.web.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Statistik eines Ladens fuer einen Zeitraum. Neben den Kennzahlen (Umsatz,
 * Bestellungen, Artikel, Durchschnittsbon) liefert sie die meistverkauften
 * Produkte und zwei Verteilungen fuer Diagramme: Umsatz pro Tag (byDay) und
 * Umsatz pro Tagesstunde (byHour, 0-23 - "Stosszeiten").
 *
 * from/to/day sind ISO-Datumsstrings (yyyy-MM-dd), damit die Darstellung im
 * Frontend eindeutig ist.
 */
public record StatsDto(String range,
                       String from,
                       String to,
                       BigDecimal revenue,
                       int orderCount,
                       int itemCount,
                       BigDecimal avgOrder,
                       List<ProductStat> topProducts,
                       List<DayStat> byDay,
                       List<HourStat> byHour) {

    /** Ein Produkt mit verkaufter Menge und Umsatz. */
    public record ProductStat(String name, int quantity, BigDecimal revenue) {}

    /** Umsatz + Anzahl Bestellungen an einem Tag. */
    public record DayStat(String day, BigDecimal revenue, int orderCount) {}

    /** Umsatz + Anzahl Bestellungen in einer Tagesstunde (0-23). */
    public record HourStat(int hour, BigDecimal revenue, int orderCount) {}
}
