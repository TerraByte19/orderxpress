package com.orderxpress.repository;

import com.orderxpress.domain.OrderItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    /** Positionen anhand ihrer Ids laden, inkl. Bestellung/Sitzung/Tisch (fuer die Kasse). */
    @EntityGraph(attributePaths = {"order", "order.session", "order.session.restaurantTable"})
    List<OrderItem> findByIdIn(Collection<Long> ids);
}
