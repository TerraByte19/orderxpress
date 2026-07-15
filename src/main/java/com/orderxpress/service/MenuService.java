package com.orderxpress.service;

import com.orderxpress.domain.MenuCategory;
import com.orderxpress.domain.MenuItem;
import com.orderxpress.repository.MenuItemImageRepository;
import com.orderxpress.repository.MenuItemRepository;
import com.orderxpress.web.dto.MenuCategoryDto;
import com.orderxpress.web.dto.MenuItemDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Stellt die Speisekarte fuer Gaeste zusammen.
 */
@Service
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final MenuItemImageRepository imageRepository;

    public MenuService(MenuItemRepository menuItemRepository,
                       MenuItemImageRepository imageRepository) {
        this.menuItemRepository = menuItemRepository;
        this.imageRepository = imageRepository;
    }

    /** Karte fuer Gaeste EINES Ladens: nur aktive Kategorien und verfuegbare Gerichte. */
    @Transactional(readOnly = true)
    public List<MenuCategoryDto> getGuestMenu(Long restaurantId) {
        List<MenuItem> items = menuItemRepository.findGuestMenu(restaurantId);
        Set<Long> idsWithImage = Set.copyOf(imageRepository.findAllMenuItemIds());

        // Die Abfrage liefert die Gerichte bereits richtig sortiert;
        // hier werden sie nur noch nach Kategorie gruppiert.
        Map<MenuCategory, List<MenuItem>> grouped = items.stream()
                .collect(Collectors.groupingBy(
                        MenuItem::getCategory,
                        LinkedHashMap::new,
                        Collectors.toList()));

        return grouped.entrySet().stream()
                .map(entry -> new MenuCategoryDto(
                        entry.getKey().getId(),
                        entry.getKey().getName(),
                        entry.getValue().stream()
                                .map(item -> MenuItemDto.from(item, idsWithImage.contains(item.getId())))
                                .toList()))
                .toList();
    }
}
