package com.orderxpress.repository;

import com.orderxpress.domain.MenuItemImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MenuItemImageRepository extends JpaRepository<MenuItemImage, Long> {

    /** Ids aller Gerichte, die ein Bild haben (ohne die Bilddaten zu laden). */
    @Query("select i.menuItemId from MenuItemImage i")
    List<Long> findAllMenuItemIds();
}
