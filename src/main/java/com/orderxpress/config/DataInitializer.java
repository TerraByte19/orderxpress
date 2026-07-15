package com.orderxpress.config;

import com.orderxpress.domain.AppUser;
import com.orderxpress.domain.MenuCategory;
import com.orderxpress.domain.MenuItem;
import com.orderxpress.domain.Restaurant;
import com.orderxpress.domain.RestaurantTable;
import com.orderxpress.domain.UserRole;
import com.orderxpress.repository.AppUserRepository;
import com.orderxpress.repository.MenuCategoryRepository;
import com.orderxpress.repository.MenuItemRepository;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.repository.RestaurantTableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Legt beim allerersten Start einen Demo-Laden mit Logins, 8 Tischen und einer
 * kleinen Speisekarte an, damit man sofort ausprobieren kann. Laeuft nur bei
 * leerer Datenbank.
 *
 * Demo-Zugaenge:
 *   Plattform-Admin: siehe application.yml (Standard admin / admin123)
 *   Inhaber:  inhaber / inhaber123
 *   Kueche:   kueche  / kueche123
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final RestaurantRepository restaurantRepository;
    private final AppUserRepository userRepository;
    private final RestaurantTableRepository tableRepository;
    private final MenuCategoryRepository categoryRepository;
    private final MenuItemRepository menuItemRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(RestaurantRepository restaurantRepository,
                           AppUserRepository userRepository,
                           RestaurantTableRepository tableRepository,
                           MenuCategoryRepository categoryRepository,
                           MenuItemRepository menuItemRepository,
                           PasswordEncoder passwordEncoder) {
        this.restaurantRepository = restaurantRepository;
        this.userRepository = userRepository;
        this.tableRepository = tableRepository;
        this.categoryRepository = categoryRepository;
        this.menuItemRepository = menuItemRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (restaurantRepository.count() > 0) {
            return; // Datenbank enthaelt bereits Daten -> nichts tun
        }

        Restaurant demo = restaurantRepository.save(new Restaurant("Demo-Restaurant", "demo"));
        demo.setAccentColor("#2563eb");
        demo.setBackgroundColor("#f4f5f7");

        userRepository.save(new AppUser("inhaber",
                passwordEncoder.encode("inhaber123"), UserRole.OWNER, demo));
        userRepository.save(new AppUser("service",
                passwordEncoder.encode("service123"), UserRole.SERVICE, demo));
        userRepository.save(new AppUser("kueche",
                passwordEncoder.encode("kueche123"), UserRole.KITCHEN, demo));

        for (int number = 1; number <= 8; number++) {
            tableRepository.save(new RestaurantTable(demo, number, null));
        }

        seedMenu(demo);
        log.info("Beispieldaten: Demo-Laden '{}' mit 8 Tischen und {} Gerichten angelegt "
                        + "(Inhaber: inhaber/inhaber123, Kueche: kueche/kueche123)",
                demo.getName(), menuItemRepository.count());
    }

    private void seedMenu(Restaurant restaurant) {
        MenuCategory starters = categoryRepository.save(new MenuCategory(restaurant, "Vorspeisen", 1));
        MenuCategory mains = categoryRepository.save(new MenuCategory(restaurant, "Hauptgerichte", 2));
        MenuCategory pizza = categoryRepository.save(new MenuCategory(restaurant, "Pizza", 3));
        MenuCategory drinks = categoryRepository.save(new MenuCategory(restaurant, "Getraenke", 4));
        MenuCategory desserts = categoryRepository.save(new MenuCategory(restaurant, "Desserts", 5));

        menuItemRepository.saveAll(List.of(
                item(starters, "Bruschetta", "Geroestetes Brot mit Tomaten und Basilikum", "6.50", 1,
                        "Zutaten: Weizenbrot, Tomaten, Knoblauch, Basilikum, Olivenoel, Salz.\n"
                                + "Enthaelt: Gluten. Vegan."),
                item(starters, "Tomatensuppe", "Hausgemacht, mit Sahnehaube", "5.90", 2,
                        "Zutaten: Tomaten, Zwiebeln, Gemuesebruehe, Sahne, Basilikum.\n"
                                + "Enthaelt: Milch. Vegetarisch."),

                item(mains, "Wiener Schnitzel", "Mit Pommes und Preiselbeeren", "16.90", 1,
                        "Kalbsschnitzel in Butterschmalz gebacken, dazu Pommes frites und Preiselbeeren.\n"
                                + "Enthaelt: Gluten, Ei, Milch."),
                item(mains, "Rinderburger", "Mit Cheddar, Salat und Steakhouse-Pommes", "14.50", 2,
                        "180g Rindfleisch-Patty, Brioche-Bun, Cheddar, Salat, Tomate, Burgersauce.\n"
                                + "Enthaelt: Gluten, Ei, Milch, Senf."),
                item(mains, "Lachsfilet", "Auf Blattspinat mit Zitronenbutter", "18.90", 3,
                        "Gebratenes Lachsfilet auf Blattspinat, dazu Zitronenbutter und Salzkartoffeln.\n"
                                + "Enthaelt: Fisch, Milch."),

                item(pizza, "Pizza Margherita", "Tomaten, Mozzarella, Basilikum", "9.50", 1,
                        "Zutaten: Weizenmehl, Tomaten, Mozzarella, Basilikum, Olivenoel.\n"
                                + "Enthaelt: Gluten, Milch. Vegetarisch."),
                item(pizza, "Pizza Salami", "Tomaten, Mozzarella, Salami", "11.00", 2,
                        "Zutaten: Weizenmehl, Tomaten, Mozzarella, Rindersalami.\n"
                                + "Enthaelt: Gluten, Milch."),
                item(pizza, "Pizza Quattro Formaggi", "Vier-Kaese-Pizza", "12.50", 3,
                        "Mozzarella, Gorgonzola, Parmesan und Ziegenkaese.\n"
                                + "Enthaelt: Gluten, Milch. Vegetarisch."),

                item(drinks, "Cola 0,4l", null, "3.80", 1, "Enthaelt Koffein und Zucker."),
                item(drinks, "Apfelschorle 0,4l", null, "3.50", 2, null),
                item(drinks, "Mineralwasser 0,75l", null, "4.20", 3, null),
                item(drinks, "Weisswein 0,2l", "Trocken, aus der Pfalz", "5.50", 4,
                        "Enthaelt: Sulfite. Alkoholgehalt ca. 12% vol."),

                item(desserts, "Tiramisu", "Hausgemacht", "6.90", 1,
                        "Loeffelbiskuit, Mascarpone, Espresso, Kakao.\n"
                                + "Enthaelt: Gluten, Ei, Milch. Kann Spuren von Alkohol enthalten."),
                item(desserts, "Panna Cotta", "Mit Himbeersosse", "6.50", 2,
                        "Sahne, Vanille, Gelatine, Himbeeren.\nEnthaelt: Milch.")));
    }

    private static MenuItem item(MenuCategory category, String name, String description,
                                 String price, int sortOrder, String details) {
        MenuItem item = new MenuItem(category, name, description, new BigDecimal(price), sortOrder);
        item.setDetails(details);
        return item;
    }
}
