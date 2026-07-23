package com.orderxpress.repository;

import com.orderxpress.domain.StaffDevice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StaffDeviceRepository extends JpaRepository<StaffDevice, Long> {

    /** Anmeldung per Geraetetoken (inkl. Laden, fuer den Mandanten-Kontext). */
    @EntityGraph(attributePaths = "restaurant")
    Optional<StaffDevice> findByDeviceTokenAndRevokedFalse(String deviceToken);

    /** Einmalige Aktivierung ueber den QR-Code. */
    @EntityGraph(attributePaths = "restaurant")
    Optional<StaffDevice> findByActivationTokenAndRevokedFalse(String activationToken);

    List<StaffDevice> findByRestaurantIdOrderByCreatedAtAsc(Long restaurantId);

    Optional<StaffDevice> findByIdAndRestaurantId(Long id, Long restaurantId);
}
