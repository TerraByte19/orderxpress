package com.orderxpress.config.security;

import com.orderxpress.service.StaffDeviceService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Meldet ein Geraet (Kuechen-Tablet, Kassen-Handy) ueber den Header
 * "X-Device-Token" an - ohne Benutzername/Passwort.
 *
 * Wichtig: Der Filter setzt denselben {@link StoreUserDetails}-Principal wie
 * ein normaler Login. Dadurch funktionieren alle bestehenden Services samt
 * Mandanten-Trennung ({@link CurrentUser#restaurantId()}) unveraendert weiter.
 *
 * Bewusst KEIN @Component: der Filter wird ausschliesslich in der
 * SecurityConfig eingehaengt. Sonst wuerde Spring Boot ihn zusaetzlich als
 * normalen Servlet-Filter registrieren (doppelte Ausfuehrung).
 */
public class DeviceTokenFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Device-Token";

    private final StaffDeviceService deviceService;

    public DeviceTokenFilter(StaffDeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = request.getHeader(HEADER);

        // Nur anmelden, wenn ein Token da ist und noch niemand angemeldet wurde.
        if (token != null && !token.isBlank()
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            deviceService.resolveDevice(token.trim()).ifPresent(device -> {
                StoreUserDetails details = new StoreUserDetails(
                        "Geraet: " + device.getLabel(),
                        "",
                        device.getRole().name(),
                        device.getRestaurant().getId(),
                        true);
                var authentication = new UsernamePasswordAuthenticationToken(
                        details, null, details.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }

        chain.doFilter(request, response);
    }
}
