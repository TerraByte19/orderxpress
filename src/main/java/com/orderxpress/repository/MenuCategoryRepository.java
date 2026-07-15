package com.orderxpress.repository;

import com.orderxpress.domain.MenuCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MenuCategoryRepository extends JpaRepository<MenuCategory, Long> {

    List<MenuCategory> findByRestaurantIdOrderBySortOrderAscNameAsc(Long restaurantId);

    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);

    Optional<MenuCategory> findByIdAndRestaurantId(Long id, Long restaurantId);
}
