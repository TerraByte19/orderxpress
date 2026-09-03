package com.orderxpress.repository;

import com.orderxpress.domain.RestaurantGalleryImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RestaurantGalleryImageRepository extends JpaRepository<RestaurantGalleryImage, Long> {

    /** Nur die Ids, in Anlegereihenfolge - ohne die Bilddaten mitzuladen (fuer Listen). */
    @Query("select g.id from RestaurantGalleryImage g where g.restaurantId = :restaurantId order by g.id asc")
    List<Long> findIdsByRestaurantId(@Param("restaurantId") Long restaurantId);

    int countByRestaurantId(Long restaurantId);

    Optional<RestaurantGalleryImage> findByIdAndRestaurantId(Long id, Long restaurantId);
}
