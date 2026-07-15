package com.orderxpress.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * @EnableAsync      -> Bondruck laeuft im Hintergrund und blockiert keine Bestellung.
 * @EnableScheduling -> SSE-Heartbeat und automatisches Verfallen alter Freigabe-Anfragen.
 */
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {
}
