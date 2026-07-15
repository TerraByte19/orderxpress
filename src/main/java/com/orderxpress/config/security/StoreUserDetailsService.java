package com.orderxpress.config.security;

import com.orderxpress.config.AppProperties;
import com.orderxpress.domain.AppUser;
import com.orderxpress.repository.AppUserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Laedt Login-Daten:
 * 1. Der Plattform-Admin kommt aus der Konfiguration (application.yml) - er
 *    verwaltet die Laeden und gehoert selbst keinem Laden an.
 * 2. Alle anderen Benutzer (Inhaber, Kueche) kommen aus der Datenbank
 *    (Tabelle app_users) mit BCrypt-Passwort und Laden-Zuordnung.
 */
@Service
public class StoreUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;
    private final AppProperties properties;

    public StoreUserDetailsService(AppUserRepository userRepository, AppProperties properties) {
        this.userRepository = userRepository;
        this.properties = properties;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppProperties.Account admin = properties.security().platformAdmin();
        if (admin.username().equalsIgnoreCase(username)) {
            return new StoreUserDetails(
                    admin.username(),
                    withEncodingPrefix(admin.password()),
                    "PLATFORM_ADMIN",
                    null,
                    true);
        }

        AppUser user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Benutzer nicht gefunden: " + username));
        return new StoreUserDetails(
                user.getUsername(),
                user.getPasswordHash(),
                user.getRole().name(),
                user.getRestaurant().getId(),
                user.isActive());
    }

    /**
     * Erlaubt beim Plattform-Admin in application.yml sowohl Klartext
     * (wird als {noop} behandelt) als auch fertige Hashes wie "{bcrypt}$2a$...".
     */
    private static String withEncodingPrefix(String password) {
        return password.startsWith("{") ? password : "{noop}" + password;
    }
}
