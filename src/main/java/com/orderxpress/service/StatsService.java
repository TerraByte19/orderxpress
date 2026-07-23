package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.OrderItem;
import com.orderxpress.domain.OrderStatus;
import com.orderxpress.domain.Restaurant;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.repository.CustomerOrderRepository;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.web.dto.StatsDto;
import com.orderxpress.web.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Statistik fuer den Inhaber: Umsatz, Bestellungen und meistverkaufte Produkte
 * fuer einen Zeitraum (heute/woche/monat/gesamt oder frei gewaehlt), plus
 * Verteilungen fuer Diagramme (pro Tag, pro Tagesstunde).
 *
 * Zwei Loesch-Wege: {@link #reset()} setzt nur einen Startpunkt (Bestellungen
 * bleiben erhalten), {@link #deleteHistory()} entfernt abgeschlossene
 * Bestellungen wirklich. Stornierte Bestellungen zaehlen nie mit.
 */
@Service
public class StatsService {

    /** Nur Bestellungen aus abgeschlossenen Sitzungen duerfen geloescht werden. */
    private static final List<SessionStatus> FINISHED_SESSIONS =
            List.of(SessionStatus.CLOSED, SessionStatus.REJECTED, SessionStatus.EXPIRED);

    private final CustomerOrderRepository orderRepository;
    private final RestaurantRepository restaurantRepository;

    public StatsService(CustomerOrderRepository orderRepository,
                        RestaurantRepository restaurantRepository) {
        this.orderRepository = orderRepository;
        this.restaurantRepository = restaurantRepository;
    }

    @Transactional(readOnly = true)
    public StatsDto compute(String range, LocalDate fromParam, LocalDate toParam) {
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);
        String r = (range == null || range.isBlank()) ? "today" : range.toLowerCase();

        LocalDate from = today;
        LocalDate to = today;
        switch (r) {
            case "week" -> from = today.with(DayOfWeek.MONDAY);
            case "month" -> from = today.withDayOfMonth(1);
            case "total" -> from = null; // von Anbeginn (bzw. ab Reset-Marke)
            case "custom" -> {
                from = (fromParam != null) ? fromParam : today;
                to = (toParam != null) ? toParam : today;
                if (to.isBefore(from)) { // vertauscht -> tauschen
                    LocalDate tmp = from;
                    from = to;
                    to = tmp;
                }
            }
            default -> {
                r = "today";
                from = today;
            }
        }

        Restaurant restaurant = restaurantRepository.findById(CurrentUser.restaurantId())
                .orElseThrow(() -> new NotFoundException("Laden nicht gefunden."));

        Instant since = (from == null) ? Instant.EPOCH : from.atStartOfDay(zone).toInstant();
        Instant until = to.plusDays(1).atStartOfDay(zone).toInstant();
        // Reset-Marke als Untergrenze: davor wird nicht mehr mitgezaehlt.
        Instant resetAt = restaurant.getStatsResetAt();
        if (resetAt != null && resetAt.isAfter(since)) {
            since = resetAt;
        }

        List<CustomerOrder> orders = orderRepository
                .findBySession_RestaurantTable_Restaurant_IdAndCreatedAtBetween(
                        CurrentUser.restaurantId(), since, until);

        BigDecimal revenue = BigDecimal.ZERO;
        int orderCount = 0;
        int itemCount = 0;
        Map<String, int[]> qtyByProduct = new LinkedHashMap<>();
        Map<String, BigDecimal> revByProduct = new LinkedHashMap<>();
        Map<LocalDate, BigDecimal> revByDay = new TreeMap<>();
        Map<LocalDate, Integer> ordByDay = new TreeMap<>();
        BigDecimal[] revByHour = new BigDecimal[24];
        int[] ordByHour = new int[24];
        Arrays.fill(revByHour, BigDecimal.ZERO);

        for (CustomerOrder o : orders) {
            if (o.getStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            orderCount++;
            revenue = revenue.add(o.getTotalAmount());

            LocalDateTime ldt = LocalDateTime.ofInstant(o.getCreatedAt(), zone);
            LocalDate day = ldt.toLocalDate();
            int hour = ldt.getHour();
            revByDay.merge(day, o.getTotalAmount(), BigDecimal::add);
            ordByDay.merge(day, 1, Integer::sum);
            revByHour[hour] = revByHour[hour].add(o.getTotalAmount());
            ordByHour[hour]++;

            for (OrderItem it : o.getItems()) {
                itemCount += it.getQuantity();
                qtyByProduct.computeIfAbsent(it.getItemName(), k -> new int[1])[0] += it.getQuantity();
                revByProduct.merge(it.getItemName(), it.getLineTotal(), BigDecimal::add);
            }
        }

        List<StatsDto.ProductStat> topProducts = qtyByProduct.entrySet().stream()
                .map(e -> new StatsDto.ProductStat(
                        e.getKey(), e.getValue()[0],
                        revByProduct.getOrDefault(e.getKey(), BigDecimal.ZERO)))
                .sorted(Comparator.comparingInt(StatsDto.ProductStat::quantity).reversed())
                .limit(10)
                .toList();

        List<StatsDto.DayStat> byDay = revByDay.entrySet().stream()
                .map(e -> new StatsDto.DayStat(
                        e.getKey().toString(), e.getValue(), ordByDay.getOrDefault(e.getKey(), 0)))
                .toList();

        List<StatsDto.HourStat> byHour = new ArrayList<>(24);
        for (int h = 0; h < 24; h++) {
            byHour.add(new StatsDto.HourStat(h, revByHour[h], ordByHour[h]));
        }

        BigDecimal avgOrder = orderCount == 0 ? BigDecimal.ZERO
                : revenue.divide(BigDecimal.valueOf(orderCount), 2, RoundingMode.HALF_UP);

        // Bei "gesamt" ohne festen Start: den ersten Tag mit Umsatz als Von-Datum zeigen.
        String fromStr = (from != null) ? from.toString()
                : (revByDay.isEmpty() ? to.toString() : revByDay.keySet().iterator().next().toString());

        return new StatsDto(r, fromStr, to.toString(), revenue,
                orderCount, itemCount, avgOrder, topProducts, byDay, byHour);
    }

    /**
     * Statistik zuruecksetzen: ab jetzt wird neu gezaehlt. Die Bestellungen und
     * Rechnungen bleiben in der Datenbank - sie werden nur nicht mehr mitgezaehlt.
     */
    @Transactional
    public void reset() {
        Restaurant restaurant = restaurantRepository.findById(CurrentUser.restaurantId())
                .orElseThrow(() -> new NotFoundException("Laden nicht gefunden."));
        restaurant.setStatsResetAt(Instant.now());
    }

    /**
     * Bestellverlauf endgueltig loeschen - aber NUR aus abgeschlossenen Sitzungen
     * (CLOSED/REJECTED/EXPIRED), damit gerade laufende Tische unangetastet bleiben.
     * Die Positionen haengen per cascade/orphanRemoval mit dran. Liefert die Anzahl.
     */
    @Transactional
    public int deleteHistory() {
        List<CustomerOrder> orders = orderRepository
                .findBySession_RestaurantTable_Restaurant_IdAndSession_StatusIn(
                        CurrentUser.restaurantId(), FINISHED_SESSIONS);
        int count = orders.size();
        orderRepository.deleteAll(orders);
        return count;
    }
}
