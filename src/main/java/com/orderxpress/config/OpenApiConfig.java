package com.orderxpress.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger UI: http://localhost:8080/swagger-ui.html
 * Ueber den "Authorize"-Button (Basic Auth) mit inhaber/kueche anmelden,
 * um die Admin- und Kuechen-Endpunkte zu testen.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI orderXpressOpenApi() {
        SecurityScheme basicAuth = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("basic");

        return new OpenAPI()
                .info(new Info()
                        .title("OrderXpress API")
                        .description("QR-Bestellsystem: Gast scannt den Tisch-QR-Code -> Inhaber gibt frei "
                                + "(\"Tisch Nr. X freigeben?\") -> Gast bestellt -> Kueche erhaelt die "
                                + "Bestellung live und druckt den Bon.")
                        .version("0.1.0"))
                .components(new Components().addSecuritySchemes("basicAuth", basicAuth))
                .addSecurityItem(new SecurityRequirement().addList("basicAuth"));
    }
}
