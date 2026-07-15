package com.orderxpress.repository;

import com.orderxpress.domain.AssetKind;
import com.orderxpress.domain.RestaurantAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RestaurantAssetRepository extends JpaRepository<RestaurantAsset, Long> {

    Optional<RestaurantAsset> findByRestaurantIdAndKind(Long restaurantId, AssetKind kind);

    boolean existsByRestaurantIdAndKind(Long restaurantId, AssetKind kind);

    void deleteByRestaurantIdAndKind(Long restaurantId, AssetKind kind);

    /** Welche Arten (LOGO/BACKGROUND) hat dieser Laden? Ohne die Bilddaten zu laden. */
    @Query("select a.kind from RestaurantAsset a where a.restaurantId = :restaurantId")
    List<AssetKind> findKinds(@Param("restaurantId") Long restaurantId);
}
