package com.orderxpress.repository;

import com.orderxpress.domain.MenuItem;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {

    /**
     * Alle bestellbaren Gerichte inkl. Kategorie in EINER Abfrage
     * (join fetch verhindert das N+1-Problem).
     */
    @Query("""
            select mi from MenuItem mi
            join fetch mi.category c
            where c.restaurant.id = :restaurantId and mi.available = true and c.active = true
            order by c.sortOrder, c.name, mi.sortOrder, mi.name
            """)
    List<MenuItem> findGuestMenu(@Param("restaurantId") Long restaurantId);

    /** Komplette Karte eines Ladens fuer die Verwaltung (auch inaktive Eintraege). */
    @EntityGraph(attributePaths = "category")
    @Query("""
            select mi from MenuItem mi
            where mi.category.restaurant.id = :restaurantId
            order by mi.sortOrder, mi.name
            """)
    List<MenuItem> findAdminMenu(@Param("restaurantId") Long restaurantId);

    /** Gericht nur laden, wenn es zum angegebenen Laden gehoert (Mandanten-Schutz). */
    @EntityGraph(attributePaths = "category")
    @Query("select mi from MenuItem mi where mi.id = :id and mi.category.restaurant.id = :restaurantId")
    Optional<MenuItem> findByIdAndRestaurantId(@Param("id") Long id, @Param("restaurantId") Long restaurantId);

    boolean existsByCategoryId(Long categoryId);
}
