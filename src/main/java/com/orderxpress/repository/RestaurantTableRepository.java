package com.orderxpress.repository;

import com.orderxpress.domain.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {

    Optional<RestaurantTable> findByQrToken(String qrToken);

    boolean existsByRestaurantIdAndNumber(Long restaurantId, int number);

    List<RestaurantTable> findByRestaurantIdOrderByNumberAsc(Long restaurantId);

    Optional<RestaurantTable> findByIdAndRestaurantId(Long id, Long restaurantId);
}
