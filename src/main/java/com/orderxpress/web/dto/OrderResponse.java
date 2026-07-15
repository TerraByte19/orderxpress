package com.orderxpress.web.dto;

import com.orderxpress.domain.CustomerOrder;
import com.orderxpress.domain.OrderItem;
import com.orderxpress.domain.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Bestellung, wie sie Gast, Kueche und Inhaber sehen. */
public record OrderResponse(Long id,
                            int tableNumber,
                            OrderStatus status,
                            Instant createdAt,
                            BigDecimal totalAmount,
                            boolean printed,
                            List<OrderLineDto> items) {

    public record OrderLineDto(String name,
                               int quantity,
                               BigDecimal unitPrice,
                               BigDecimal lineTotal,
                               String note) {

        public static OrderLineDto from(OrderItem item) {
            return new OrderLineDto(
                    item.getItemName(),
                    item.getQuantity(),
                    item.getUnitPrice(),
                    item.getLineTotal(),
                    item.getNote());
        }
    }

    public static OrderResponse from(CustomerOrder order) {
        return new OrderResponse(
                order.getId(),
                order.getSession().getRestaurantTable().getNumber(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getTotalAmount(),
                order.isPrinted(),
                order.getItems().stream().map(OrderLineDto::from).toList());
    }
}
