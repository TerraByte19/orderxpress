package com.orderxpress.repository;

import com.orderxpress.domain.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    Optional<Restaurant> findBySlug(String slug);

    boolean existsBySlugIgnoreCase(String slug);

    boolean existsByNameIgnoreCase(String name);

    List<Restaurant> findAllByOrderByNameAsc();
}
