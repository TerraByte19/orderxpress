package com.orderxpress;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import com.orderxpress.repository.RestaurantRepository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Laesst die Integrationstests ZUSAETZLICH gegen einen echten PostgreSQL-Server
 * laufen (eingebettet, kein Docker noetig). Produktiv (Render) laeuft OrderXpress
 * auf PostgreSQL, die normalen Tests nur auf H2 - Unterschiede bei Typen
 * (Bilder/BLOB, Enums, Zeitstempel) oder Abfragen fielen sonst erst im Betrieb auf.
 *
 * Jede verschachtelte Klasse erbt alle Tests der H2-Variante; nur die
 * Datenbank-Verbindung wird hier umgebogen.
 */
class PostgresCompatibilityTest {

    private static final EmbeddedPostgres PG;

    static {
        try {
            PG = EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            throw new IllegalStateException("Eingebettetes PostgreSQL startet nicht", e);
        }
    }

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> PG.getJdbcUrl("postgres", "postgres"));
        r.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        r.add("spring.datasource.username", () -> "postgres");
        r.add("spring.datasource.password", () -> "postgres");
    }

    @Nested
    class DarkModeAndFontsAufPostgres extends DarkModeAndFontsIntegrationTest {}

    @Nested
    class DesignThemeAufPostgres extends DesignThemeIntegrationTest {}

    @Nested
    class GuestJoinBillingAufPostgres extends GuestJoinBillingIntegrationTest {}

    @Nested
    class GuestPageDesignAufPostgres extends GuestPageDesignIntegrationTest {}

    @Nested
    class KitchenDisplayAufPostgres extends KitchenDisplayIntegrationTest {}

    @Nested
    class KitchenOrderStatusAufPostgres extends KitchenOrderStatusIntegrationTest {}

    @Nested
    class MenuCatalogAufPostgres extends MenuCatalogIntegrationTest {}

    @Nested
    class MenuImageAufPostgres extends MenuImageIntegrationTest {}

    @Nested
    class MultiTenantIsolationAufPostgres extends MultiTenantIsolationTest {}

    @Nested
    class OrderFlowAufPostgres extends OrderFlowIntegrationTest {}

    @Nested
    class PlatformAufPostgres extends PlatformIntegrationTest {}

    @Nested
    class StaffDeviceAufPostgres extends StaffDeviceIntegrationTest {}

    @Nested
    class StaffUserAufPostgres extends StaffUserIntegrationTest {}

    @Nested
    class StatsAufPostgres extends StatsIntegrationTest {}

    @Nested
    class TeilzahlungUndStornoAufPostgres extends TeilzahlungUndStornoIntegrationTest {}

    @Nested
    class StructureAxesAufPostgres extends StructureAxesIntegrationTest {}

    @Nested
    class TableManagementAufPostgres extends TableManagementIntegrationTest {}

    @Nested
    class WaiterCallAufPostgres extends WaiterCallIntegrationTest {}

    @Nested
    class WaiterViewAufPostgres extends WaiterViewIntegrationTest {}

    /** Das echte Produktivprofil (application-prod.yml), wie auf Render. */
    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    @ActiveProfiles("prod")
    @TestPropertySource(properties = "ORDERXPRESS_SECURITY_PLATFORMADMIN_PASSWORD=prod-test-passwort")
    class ProduktivProfil {

        @Autowired
        MockMvc mvc;

        @Autowired
        RestaurantRepository restaurants;

        @Test
        void keinDemoLadenMitBekanntenPasswoertern() throws Exception {
            assertThat(restaurants.findAll()).noneMatch(r -> "demo".equals(r.getSlug()));
            mvc.perform(get("/api/me").with(httpBasic("inhaber", "inhaber123")))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void entwicklungswerkzeugeGesperrt() throws Exception {
            mvc.perform(get("/h2-console/")).andExpect(status().isUnauthorized());
            mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
        }

        @Test
        void plattformAdminNurMitGesetztemPasswort() throws Exception {
            mvc.perform(get("/api/platform/restaurants").with(httpBasic("admin", "admin123")))
                    .andExpect(status().isUnauthorized());
            mvc.perform(get("/api/platform/restaurants").with(httpBasic("admin", "prod-test-passwort")))
                    .andExpect(status().isOk());
        }
    }
}
