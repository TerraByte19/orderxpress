package com.orderxpress.web;

import com.orderxpress.service.StaffDeviceService;
import com.orderxpress.web.dto.DeviceActivationResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Geraet meldet sich per QR-Code an - ohne Login. Der Einmal-Token aus dem
 * QR-Code wird gegen den dauerhaften Geraetetoken getauscht und dabei
 * verbraucht (ein QR-Code funktioniert also genau einmal).
 */
@RestController
@RequestMapping("/api/device")
public class DeviceController {

    private final StaffDeviceService deviceService;

    public DeviceController(StaffDeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @PostMapping("/activate/{activationToken}")
    public DeviceActivationResponse activate(@PathVariable String activationToken) {
        return deviceService.activate(activationToken);
    }
}
