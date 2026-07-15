package com.orderxpress.web.dto;

import com.orderxpress.domain.AppUser;

import java.time.Instant;

/** Mitarbeiter-Login (Kueche oder Service) in der Inhaber-Verwaltung. */
public record StaffUserDto(Long id, String username, String role, boolean active, Instant createdAt) {

    public static StaffUserDto from(AppUser user) {
        return new StaffUserDto(user.getId(), user.getUsername(), user.getRole().name(),
                user.isActive(), user.getCreatedAt());
    }
}
