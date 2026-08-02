/* Live-Ereignisse.
 *
 * Der eingebaute EventSource kann KEINEN Authorization-Header senden,
 * deshalb lesen wir den Ereignis-Strom selbst per fetch. Bei Abbruch wird
 * nach 5 Sekunden neu verbunden. */

import { authKopfzeilen } from "./auth";

export interface SseVerbindung {
    stop(): void;
}

export function verbindeSse(
    pfad: string,
    beiEreignis: (name: string, daten: unknown) => void,
    beiStatus?: (verbunden: boolean) => void
): SseVerbindung {
    let gestoppt = false;

    const lauf = async (): Promise<void> => {
        while (!gestoppt) {
            try {
                const antwort = await fetch(pfad, {
                    headers: { Accept: "text/event-stream", ...authKopfzeilen() }
                });
                if (!antwort.ok || !antwort.body) throw new Error("SSE-Verbindung fehlgeschlagen");
                beiStatus?.(true);

                const leser = antwort.body.getReader();
                const dekodierer = new TextDecoder();
                let puffer = "";

                for (;;) {
                    const { done, value } = await leser.read();
                    if (done) break;
                    puffer += dekodierer.decode(value, { stream: true });

                    let grenze: number;
                    while ((grenze = puffer.indexOf("\n\n")) >= 0) {
                        const block = puffer.slice(0, grenze);
                        puffer = puffer.slice(grenze + 2);

                        let name = "message";
                        let daten = "";
                        for (const zeile of block.split("\n")) {
                            if (zeile.startsWith("event:")) name = zeile.slice(6).trim();
                            else if (zeile.startsWith("data:")) daten += zeile.slice(5).trim();
                        }

                        if (name === "ping" || name === "connected") continue;
                        try {
                            beiEreignis(name, daten ? JSON.parse(daten) : null);
                        } catch {
                            beiEreignis(name, daten);
                        }
                    }
                }
            } catch {
                /* Verbindung weg - unten neu versuchen */
            }
            beiStatus?.(false);
            if (!gestoppt) await new Promise((weiter) => setTimeout(weiter, 5000));
        }
    };

    void lauf();
    return { stop() { gestoppt = true; } };
}
