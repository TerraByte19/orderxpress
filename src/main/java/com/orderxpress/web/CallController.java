package com.orderxpress.web;

import com.orderxpress.service.WaiterCallService;
import com.orderxpress.web.dto.WaiterCallDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Offene "Kellner rufen"-Rufe fuer das Personal (Inhaber, Kasse/Service, Kellner).
 * Nur lesen + abhaken - ausgeloest werden Rufe vom Gast ueber /api/guest/.../call.
 */
@RestController
@RequestMapping("/api/calls")
public class CallController {

    private final WaiterCallService callService;

    public CallController(WaiterCallService callService) {
        this.callService = callService;
    }

    /** Offene Rufe des eigenen Ladens. */
    @GetMapping
    public List<WaiterCallDto> open() {
        return callService.listOpen();
    }

    /** Einen Ruf als erledigt markieren. */
    @PostMapping("/{id}/done")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void done(@PathVariable Long id) {
        callService.markDone(id);
    }
}
