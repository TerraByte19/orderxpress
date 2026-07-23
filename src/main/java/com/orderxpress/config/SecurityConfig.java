package com.orderxpress.config;

import com.orderxpress.config.security.DeviceTokenFilter;
import com.orderxpress.service.StaffDeviceService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Zugriffsregeln:
 * - /api/guest/**    oeffentlich (Gaeste brauchen kein Login; Schutz erfolgt
 *                     ueber geheime QR-/Sitzungs-Tokens und die Tisch-Freigabe)
 * - /api/platform/** nur Plattform-Admin (legt Laeden an)
 * - /api/admin/**    nur Inhaber (auf seinen eigenen Laden beschraenkt)
 * - /api/kitchen/**  Inhaber und Kueche (auf ihren eigenen Laden beschraenkt)
 *
 * Login-Daten: Plattform-Admin aus application.yml, Inhaber/Kueche aus der
 * Datenbank (BCrypt) - siehe {@link StoreUserDetailsService}.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Entwicklungswerkzeuge (H2-Konsole, Swagger) nur lokal offen. Auf einem
     * oeffentlichen Server (z.B. Render) per ENV ORDERXPRESS_DEV_TOOLS=false
     * abschalten - sonst waere die Datenbank-Konsole fuer jeden erreichbar.
     */
    @Value("${orderxpress.dev-tools:true}")
    private boolean devTools;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   StaffDeviceService staffDeviceService) throws Exception {
        http
                // Geraete-Anmeldung per "X-Device-Token" VOR der Basic-Auth pruefen
                .addFilterBefore(new DeviceTokenFilter(staffDeviceService),
                        org.springframework.security.web.authentication.www.BasicAuthenticationFilter.class)
                // Reine Token-/Basic-Auth-API ohne Session-Cookies -> kein CSRF-Risiko
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // noetig fuer die H2-Console (laeuft in einem Frame)
                .headers(headers -> headers.frameOptions(fo -> fo.sameOrigin()))
                .authorizeHttpRequests(auth -> {
                    auth
                        .requestMatchers("/api/guest/**", "/error").permitAll()
                        // Geraet aktiviert sich einmalig ueber den QR-Code (Einmal-Token)
                        .requestMatchers("/api/device/activate/**").permitAll()
                        // Frontend-Seiten und statische Dateien (Schutz erfolgt in der API, nicht im HTML)
                        .requestMatchers("/", "/index.html", "/guest.html", "/admin.html", "/kitchen.html",
                                "/platform.html", "/service.html", "/device.html", "/waiter.html", "/stats.html",
                                "/t/**", "/d/**", "/css/**", "/js/**", "/favicon.ico").permitAll()
                        // "Wer bin ich?" - fuer jeden angemeldeten Laden-Benutzer bzw. jedes Geraet
                        .requestMatchers("/api/me").hasAnyRole("OWNER", "SERVICE", "KITCHEN", "WAITER")
                        .requestMatchers("/api/platform/**").hasRole("PLATFORM_ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("OWNER")
                        .requestMatchers("/api/service/**").hasAnyRole("OWNER", "SERVICE")
                        .requestMatchers("/api/waiter/**").hasAnyRole("OWNER", "SERVICE", "WAITER")
                        .requestMatchers("/api/kitchen/**").hasAnyRole("OWNER", "KITCHEN");
                    // Entwicklungswerkzeuge (H2-Konsole, Swagger) NUR lokal offen.
                    // Auf Render: ORDERXPRESS_DEV_TOOLS=false -> bleiben gesperrt.
                    if (devTools) {
                        auth.requestMatchers("/h2-console/**").permitAll()
                                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll();
                    }
                    auth.anyRequest().denyAll();
                })
                .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    /**
     * Prueft Passwoerter. Der DelegatingPasswordEncoder versteht "{bcrypt}..."
     * (DB-Benutzer aus StoreUserDetailsService) und "{noop}..." (Klartext-
     * Plattform-Admin aus der Konfiguration). Zusammen mit der einzigen
     * UserDetailsService-Bean (StoreUserDetailsService) verdrahtet Spring Boot
     * daraus automatisch die Authentifizierung (DaoAuthenticationProvider).
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
