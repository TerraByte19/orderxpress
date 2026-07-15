package com.orderxpress.repository;

import com.orderxpress.domain.AppUser;
import com.orderxpress.domain.UserRole;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    /** Login: Benutzer inkl. Restaurant laden (fuer den restaurantId im Principal). */
    @EntityGraph(attributePaths = "restaurant")
    Optional<AppUser> findByUsername(String username);

    boolean existsByUsernameIgnoreCase(String username);

    /** Benutzer eines Ladens mit einer bestimmten Rolle. */
    List<AppUser> findByRestaurantIdAndRoleOrderByUsernameAsc(Long restaurantId, UserRole role);

    /** Mitarbeiter eines Ladens (mehrere Rollen, z.B. KITCHEN + SERVICE). */
    List<AppUser> findByRestaurantIdAndRoleInOrderByRoleAscUsernameAsc(Long restaurantId,
                                                                       Collection<UserRole> roles);

    Optional<AppUser> findByIdAndRestaurantId(Long id, Long restaurantId);
}
