/* Geraet per QR-Code anmelden: /d/<activationToken>
   Der Einmal-Token wird gegen den dauerhaften Geraetetoken getauscht,
   der danach im Browser bleibt - kein Passwort noetig. */

import "../styles/app.css";
import "../styles/fonts";
import { api } from "../lib/api";
import { loescheAnmeldung, setzeGeraeteToken, rollenText } from "../lib/auth";
import { registriereServiceWorker } from "../lib/pwa";
import { zeigeNur } from "../lib/ui";
import type { GeraetAktivierung, Rolle } from "../lib/types";

const ANSICHTEN = ["view-wait", "view-ok", "view-error"] as const;

/** Zielseite je nach Rolle des Geraets. */
function zielFuerRolle(rolle: Rolle): string {
    if (rolle === "KITCHEN") return "/kitchen.html";
    if (rolle === "WAITER") return "/waiter.html";
    return "/service.html";
}

/** Token aus /d/<token> oder aus ?token=<token> (Entwicklungsbetrieb). */
function leseToken(): string {
    if (location.pathname.startsWith("/d/")) {
        return decodeURIComponent(location.pathname.split("/")[2] ?? "");
    }
    return new URLSearchParams(location.search).get("token") ?? "";
}

function zeigeFehler(text: string): void {
    const feld = document.getElementById("error-text");
    if (feld) feld.textContent = text;
    zeigeNur("view-error", ANSICHTEN);
}

async function start(): Promise<void> {
    const token = leseToken();
    if (!token) {
        zeigeFehler("Kein Anmelde-Code gefunden. Bitte den QR-Code scannen.");
        return;
    }

    try {
        const ergebnis = await api<GeraetAktivierung>(
            "/api/device/activate/" + encodeURIComponent(token),
            { method: "POST" }
        );

        // Eventuelle alte Anmeldung ersetzen
        loescheAnmeldung();
        setzeGeraeteToken(ergebnis.deviceToken);

        const ziel = zielFuerRolle(ergebnis.role);

        const text = document.getElementById("ok-text");
        if (text) {
            text.textContent = `${ergebnis.label} · ${rollenText(ergebnis.role)} · ${ergebnis.restaurantName}`;
        }
        document.getElementById("btn-go")?.addEventListener("click", () => {
            location.href = ziel;
        });

        zeigeNur("view-ok", ANSICHTEN);
        window.setTimeout(() => { location.href = ziel; }, 2000);
    } catch (fehler) {
        zeigeFehler((fehler as Error).message);
    }
}

registriereServiceWorker();
void start();
