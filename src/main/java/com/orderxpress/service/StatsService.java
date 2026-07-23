package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.OrderItem;
import com.orderxpress.domain.OrderStatus;
import com.orderxpress.repository.CustomerOrderRepository;
import com.orderxpress.web.dto.StatsDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tages-Statistik fuer den Inhaber: Umsatz heute, Anzahl Bestellungen und die
 * meistverkauften Produkte. Stornierte Bestellungen bleiben aussen vor.
 */
@Service
public class StatsService {

    private final CustomerOrderRepository orderRepository;

    public StatsService(CustomerOrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public StatsDto today() {
        Instant startOfToday = LocalDate.now(ZoneId.systemDefault())
                .atStartOfDay(ZoneId.systemDefault()).toInstant();

        List<CustomerOrder> orders = orderRepository
                .findBySession_RestaurantTable_Restaurant_IdAndCreatedAtGreaterThanEqual(
                        CurrentUser.restaurantId(), startOfToday);

        BigDecimal revenue = BigDecimal.ZERO;
        int orderCount = 0;
        int itemCount = 0;
        // Produkt -> [Menge, Umsatz]; Reihenfolge egal, wird spaeter sortiert.
        Map<String, int[]> quantityByName = new LinkedHashMap<>();
        Map<String, BigDecimal> revenueByName = new LinkedHashMap<>();

        for (CustomerOrder order : orders) {
            if (order.getStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            orderCount++;
            revenue = revenue.add(order.getTotalAmount());
            for (OrderItem item : order.getItems()) {
                itemCount += item.getQuantity();
                quantityByName.computeIfAbsent(item.getItemName(), k -> new int[1])[0] += item.getQuantity();
                revenueByName.merge(item.getItemName(), item.getLineTotal(), BigDecimal::add);
            }
        }

        List<StatsDto.ProductStat> topProducts = quantityByName.entrySet().stream()
                .map(e -> new StatsDto.ProductStat(
                        e.getKey(),
                        e.getValue()[0],
                        revenueByName.getOrDefault(e.getKey(), BigDecimal.ZERO)))
                .sorted(Comparator.comparingInt(StatsDto.ProductStat::quantity).reversed())
                .toList();

        return new StatsDto(revenue, orderCount, itemCount, topProducts);
    }
}
