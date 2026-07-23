package com.orderxpress.web.dto;

import com.orderxpress.domain.Guest;
import com.orderxpress.domain.GuestStatus;
import com.orderxpress.domain.SessionStatus;

/** Aktueller Zustand einer Person am Tisch (Gast-Ansicht, Polling). */
public record GuestStatusResponse(GuestStatus guestStatus,
                                  SessionStatus sessionStatus,
                                  boolean isHost,
                                  String name,
                                  int tableNumber,
                                  Long restaurantId,
                                  String restaurantName) {

    public static GuestStatusResponse from(Guest guest) {
        var table = guest.getSession().getRestaurantTable();
        var restaurant = table.getRestaurant();
        return new GuestStatusResponse(
                guest.getStatus(),
                guest.getSession().getStatus(),
                guest.isHost(),
                guest.getName(),
                table.getNumber(),
                restaurant.getId(),
                restaurant.getName());
    }
}
