/* Absicherung von session.ts - dem "Herz" der Gaeste-Seite.
 *
 * Zwei Dinge verdienen besondere Sorgfalt:
 *
 * 1. starteStatusAbfrage() darf niemals auf ein einzelnes "freigegeben
 *    ja/nein"-Flag verkuerzen. sessionStatus (Tisch, vom Personal freigegeben)
 *    und guestStatus (Person, vom Gastgeber freigegeben) aendern sich
 *    UNABHAENGIG voneinander - siehe TableSessionService.expireStalePendingSessions()
 *    und .close() im Backend, die beide NUR session.status aendern, nie die
 *    einzelnen Guest-Zeilen. Ein Test weiter unten bildet genau diesen
 *    Backend-Fall nach (nur sessionStatus wechselt, guestStatus bleibt gleich)
 *    und verlangt trotzdem eine Meldung.
 *
 * 2. Der neue Ruhe-Takt: die Abfrage muss pausieren, wenn die Seite in den
 *    Hintergrund geht (visibilitychange), und danach weiterlaufen. document.hidden
 *    ist in jsdom ein Getter ohne Setter, darum wird er hier einmalig durch
 *    einen eigenen (konfigurierbaren) Getter ersetzt, den geheInHintergrund()/
 *    kommeZurueck() umschalten. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeitrittsAnfrage, GastStatusAntwort, ScanAntwort } from "../../lib/types";

vi.mock("../../lib/api", () => ({
    api: vi.fn()
}));

import { api } from "../../lib/api";
import {
    entscheideBeitritt,
    geleseneToken,
    holeBeitrittsAnfragen,
    holeStatus,
    leseQrToken,
    merkeToken,
    rufeKellner,
    scanne,
    setzeName,
    starteStatusAbfrage
} from "./session";

const apiMock = vi.mocked(api);

/** Vollstaendiger GastStatusAntwort-Beispielwert, per Feld ueberschreibbar. */
function status(ueberschreibungen: Partial<GastStatusAntwort> = {}): GastStatusAntwort {
    return {
        guestStatus: "PENDING",
        sessionStatus: "PENDING",
        isHost: true,
        name: "Gast 1",
        tableNumber: 5,
        restaurantId: 1,
        restaurantName: "Bistro",
        ...ueberschreibungen
    };
}

// ---------- Sichtbarkeits-Attrappe (document.hidden hat in jsdom keinen Setter) ----------
let seiteSichtbar = true;
Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => !seiteSichtbar
});
function geheInHintergrund(): void {
    seiteSichtbar = false;
    document.dispatchEvent(new Event("visibilitychange"));
}
function kommeZurueck(): void {
    seiteSichtbar = true;
    document.dispatchEvent(new Event("visibilitychange"));
}

// ---------- Aufraeumen: keine Abfrage darf einen Test ueberleben ----------
let laufendeAbfragen: Array<{ stop(): void }> = [];
function starte(
    guestToken: string,
    beiAenderung: (s: GastStatusAntwort) => void,
    intervallMs?: number
): { stop(): void } {
    const abfrage = starteStatusAbfrage(guestToken, beiAenderung, intervallMs);
    laufendeAbfragen.push(abfrage);
    return abfrage;
}

beforeEach(() => {
    vi.useFakeTimers();
    apiMock.mockReset();
    localStorage.clear();
    history.pushState({}, "", "/");
    seiteSichtbar = true;
    laufendeAbfragen = [];
});

afterEach(() => {
    laufendeAbfragen.forEach((a) => a.stop());
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe("leseQrToken", () => {
    it("liest den Token aus dem Pfad /t/<token>", () => {
        history.pushState({}, "", "/t/abc123");
        expect(leseQrToken()).toBe("abc123");
    });

    it("liest den Token aus dem Query-Parameter ?t=, wenn der Pfad nicht mit /t/ beginnt", () => {
        history.pushState({}, "", "/guest.html?t=xyz789");
        expect(leseQrToken()).toBe("xyz789");
    });

    it("dekodiert URL-kodierte Zeichen im Pfad-Token", () => {
        // Leerzeichen und Schraegstrich - waere die Dekodierung vergessen,
        // kaeme "tisch%207%2Fecke" statt "tisch 7/ecke" zurueck.
        const roh = "tisch 7/ecke";
        history.pushState({}, "", "/t/" + encodeURIComponent(roh));
        expect(leseQrToken()).toBe(roh);
    });

    it("liefert einen leeren String, wenn weder Pfad noch Query einen Token enthalten", () => {
        history.pushState({}, "", "/guest.html");
        expect(leseQrToken()).toBe("");
    });
});

describe("scanne", () => {
    it("ruft POST /api/guest/scan/<qrToken> auf und liefert die Antwort unveraendert zurueck", async () => {
        const antwort: ScanAntwort = {
            guestToken: "g1", isHost: true, sessionStatus: "PENDING", guestStatus: "PENDING",
            guestName: "Gast 1", tableNumber: 5, restaurantId: 42, restaurantName: "Bistro"
        };
        apiMock.mockResolvedValueOnce(antwort);

        const ergebnis = await scanne("abc123");

        expect(apiMock).toHaveBeenCalledWith("/api/guest/scan/abc123", { method: "POST" });
        expect(ergebnis).toBe(antwort);
    });

    it("kodiert Sonderzeichen im QR-Token fuer die URL", async () => {
        apiMock.mockResolvedValueOnce({} as ScanAntwort);
        await scanne("tisch 7/ecke");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/scan/tisch%207%2Fecke", { method: "POST" });
    });
});

describe("holeStatus", () => {
    it("ruft GET /api/guest/guests/<guestToken> auf und liefert die Antwort unveraendert zurueck", async () => {
        const antwort = status();
        apiMock.mockResolvedValueOnce(antwort);

        const ergebnis = await holeStatus("g1");

        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1");
        expect(ergebnis).toBe(antwort);
    });

    it("kodiert Sonderzeichen im Gast-Token fuer die URL", async () => {
        apiMock.mockResolvedValueOnce(status());
        await holeStatus("a b");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/a%20b");
    });
});

describe("setzeName", () => {
    it("ruft PUT .../name mit dem Namen im Rumpf auf", async () => {
        apiMock.mockResolvedValueOnce(status({ name: "Maria" }));

        await setzeName("g1", "Maria");

        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/name", {
            method: "PUT",
            body: JSON.stringify({ name: "Maria" })
        });
    });

    it("liefert nichts zurueck, obwohl das Backend ein GuestStatusResponse-Objekt liefert", async () => {
        apiMock.mockResolvedValueOnce(status({ name: "Maria" }));
        const ergebnis = await setzeName("g1", "Maria");
        expect(ergebnis).toBeUndefined();
    });
});

describe("holeBeitrittsAnfragen", () => {
    it("ruft GET .../join-requests auf und liefert die Liste unveraendert zurueck", async () => {
        const liste: BeitrittsAnfrage[] = [{ id: 1, name: "Tom", createdAt: "2026-08-01T10:00:00Z" }];
        apiMock.mockResolvedValueOnce(liste);

        const ergebnis = await holeBeitrittsAnfragen("g1");

        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/join-requests");
        expect(ergebnis).toBe(liste);
    });
});

describe("entscheideBeitritt", () => {
    it("ruft POST .../join-requests/<id>/approve auf, wenn aktion 'approve' ist", async () => {
        apiMock.mockResolvedValueOnce(null);
        await entscheideBeitritt("g1", 7, "approve");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/join-requests/7/approve", { method: "POST" });
    });

    it("ruft POST .../join-requests/<id>/reject auf, wenn aktion 'reject' ist - nicht denselben Pfad wie approve", async () => {
        apiMock.mockResolvedValueOnce(null);
        await entscheideBeitritt("g1", 7, "reject");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/join-requests/7/reject", { method: "POST" });
    });
});

describe("rufeKellner", () => {
    it("ruft POST .../call auf", async () => {
        apiMock.mockResolvedValueOnce(null);
        await rufeKellner("g1");
        expect(apiMock).toHaveBeenCalledWith("/api/guest/guests/g1/call", { method: "POST" });
    });
});

describe("merkeToken / geleseneToken", () => {
    it("liefert null, wenn fuer diesen QR-Code noch kein Token gemerkt wurde", () => {
        expect(geleseneToken("qr-1")).toBeNull();
    });

    it("liefert den gemerkten Token fuer denselben QR-Code zurueck", () => {
        merkeToken("qr-1", "guest-token-abc");
        expect(geleseneToken("qr-1")).toBe("guest-token-abc");
    });

    it("teilt den Token NICHT zwischen zwei verschiedenen QR-Codes", () => {
        merkeToken("qr-1", "guest-token-abc");
        merkeToken("qr-2", "guest-token-xyz");

        expect(geleseneToken("qr-1")).toBe("guest-token-abc");
        expect(geleseneToken("qr-2")).toBe("guest-token-xyz");
        expect(geleseneToken("qr-3")).toBeNull(); // dritter, nie gescannter Code
    });

    it("wirft nicht, wenn localStorage beim Schreiben verwirft (z.B. privater Modus)", () => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new DOMException("privater Modus"); };
        try {
            expect(() => merkeToken("qr-1", "g1")).not.toThrow();
        } finally {
            Storage.prototype.setItem = original;
        }
    });

    it("liefert null statt zu werfen, wenn localStorage beim Lesen verwirft", () => {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = () => { throw new DOMException("privater Modus"); };
        try {
            expect(geleseneToken("qr-1")).toBeNull();
        } finally {
            Storage.prototype.getItem = original;
        }
    });
});

describe("starteStatusAbfrage", () => {
    describe("Takt", () => {
        it("fragt nicht vor Ablauf des Standardtaktes (3000 ms) ab", async () => {
            apiMock.mockResolvedValue(status());
            starte("g1", () => {});

            await vi.advanceTimersByTimeAsync(2999);
            expect(apiMock).not.toHaveBeenCalled();
        });

        it("fragt nach 3000 ms zum ersten Mal ab, danach im selben Takt erneut", async () => {
            apiMock.mockResolvedValue(status());
            starte("g1", () => {});

            await vi.advanceTimersByTimeAsync(3000);
            expect(apiMock).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(3000);
            expect(apiMock).toHaveBeenCalledTimes(2);
        });

        it("nutzt einen abweichenden Takt, wenn intervallMs uebergeben wird", async () => {
            apiMock.mockResolvedValue(status());
            starte("g1", () => {}, 1000);

            await vi.advanceTimersByTimeAsync(999);
            expect(apiMock).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(apiMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("meldet nur bei Aenderung", () => {
        it("meldet den ersten abgefragten Stand, aber nicht denselben Stand ein zweites Mal", async () => {
            // mockImplementation liefert bei jedem Aufruf ein NEUES Objekt mit
            // gleichem Inhalt - ein Vergleich per Referenz wuerde hier faelschlich
            // "veraendert" melden bzw. ein fehlender Vergleich wuerde IMMER melden.
            const momentan = status();
            apiMock.mockImplementation(async () => ({ ...momentan }));

            const aenderungen: GastStatusAntwort[] = [];
            starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000);
            expect(aenderungen).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(3000);
            expect(aenderungen).toHaveLength(1); // unveraendert -> keine zweite Meldung
        });

        it("meldet erneut, sobald sich guestStatus aendert", async () => {
            let momentan = status({ guestStatus: "PENDING" });
            apiMock.mockImplementation(async () => ({ ...momentan }));

            const aenderungen: GastStatusAntwort[] = [];
            starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000);
            expect(aenderungen).toHaveLength(1);

            momentan = status({ guestStatus: "APPROVED" });
            await vi.advanceTimersByTimeAsync(3000);

            expect(aenderungen).toHaveLength(2);
            expect(aenderungen[1].guestStatus).toBe("APPROVED");
        });

        it("meldet erneut, wenn sich NUR sessionStatus aendert - guestStatus bleibt PENDING " +
           "(so wie beim Verfallen einer Anfrage im Backend: expireStalePendingSessions() " +
           "aendert nur die Sitzung, nie die einzelnen Gaeste)", async () => {
            let momentan = status({ guestStatus: "PENDING", sessionStatus: "PENDING" });
            apiMock.mockImplementation(async () => ({ ...momentan }));

            const aenderungen: GastStatusAntwort[] = [];
            starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000);
            expect(aenderungen).toHaveLength(1);

            momentan = status({ guestStatus: "PENDING", sessionStatus: "EXPIRED" });
            await vi.advanceTimersByTimeAsync(3000);

            // Eine Implementierung, die nur guestStatus vergleicht, wuerde hier
            // still schweigen - genau das darf nicht passieren.
            expect(aenderungen).toHaveLength(2);
            expect(aenderungen[1]).toMatchObject({ guestStatus: "PENDING", sessionStatus: "EXPIRED" });
        });

        it("meldet erneut, wenn sich NUR sessionStatus aendert - guestStatus bleibt APPROVED " +
           "(so wie beim regulaeren Sitzungsende: close() aendert nur die Sitzung)", async () => {
            let momentan = status({ guestStatus: "APPROVED", sessionStatus: "APPROVED" });
            apiMock.mockImplementation(async () => ({ ...momentan }));

            const aenderungen: GastStatusAntwort[] = [];
            starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000);
            expect(aenderungen).toHaveLength(1);

            momentan = status({ guestStatus: "APPROVED", sessionStatus: "CLOSED" });
            await vi.advanceTimersByTimeAsync(3000);

            expect(aenderungen).toHaveLength(2);
            expect(aenderungen[1]).toMatchObject({ guestStatus: "APPROVED", sessionStatus: "CLOSED" });
        });
    });

    describe("Sichtbarkeit (Hintergrund/Vordergrund)", () => {
        it("fragt nicht mehr ab, waehrend die Seite im Hintergrund liegt, und laeuft danach weiter", async () => {
            let momentan = status();
            apiMock.mockImplementation(async () => ({ ...momentan }));

            const aenderungen: GastStatusAntwort[] = [];
            starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000);
            expect(apiMock).toHaveBeenCalledTimes(1);

            geheInHintergrund();
            momentan = status({ sessionStatus: "EXPIRED" }); // aendert sich waehrend der Pause

            await vi.advanceTimersByTimeAsync(30000); // lange im Hintergrund
            expect(apiMock).toHaveBeenCalledTimes(1); // kein weiterer Abruf
            expect(aenderungen).toHaveLength(1);       // also auch keine Meldung

            kommeZurueck();
            await vi.advanceTimersByTimeAsync(3000); // laeuft im selben Takt weiter

            expect(apiMock).toHaveBeenCalledTimes(2);
            expect(aenderungen).toHaveLength(2);
            expect(aenderungen[1].sessionStatus).toBe("EXPIRED");
        });

        it("haengt keinen zweiten Zeitgeber an, wenn visibilitychange mehrfach im Vordergrund feuert", async () => {
            apiMock.mockResolvedValue(status());
            starte("g1", () => {});

            await vi.advanceTimersByTimeAsync(3000);
            expect(apiMock).toHaveBeenCalledTimes(1);

            // Sichtbar, obwohl schon sichtbar - darf keinen zusaetzlichen Takt anstossen
            kommeZurueck();
            kommeZurueck();

            await vi.advanceTimersByTimeAsync(3000);
            expect(apiMock).toHaveBeenCalledTimes(2); // nicht 3 oder 4
        });
    });

    describe("stop()", () => {
        it("beendet die Abfrage wirklich - kein weiterer Abruf, auch nicht nach Sichtbarkeitswechseln", async () => {
            let momentan = status();
            apiMock.mockImplementation(async () => ({ ...momentan }));

            const aenderungen: GastStatusAntwort[] = [];
            const abfrage = starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000);
            expect(apiMock).toHaveBeenCalledTimes(1);

            abfrage.stop();
            momentan = status({ guestStatus: "APPROVED" });

            geheInHintergrund();
            kommeZurueck();
            await vi.advanceTimersByTimeAsync(30000);

            expect(apiMock).toHaveBeenCalledTimes(1); // kein zweiter Abruf
            expect(aenderungen).toHaveLength(1);        // keine weitere Meldung
        });

        it("ruft den Rueckruf nicht mehr auf, wenn stop() waehrend einer noch offenen Anfrage kommt", async () => {
            let freigeben!: (s: GastStatusAntwort) => void;
            apiMock.mockImplementation(
                () => new Promise<GastStatusAntwort>((resolve) => { freigeben = resolve; })
            );

            const aenderungen: GastStatusAntwort[] = [];
            const abfrage = starte("g1", (s) => aenderungen.push(s));

            await vi.advanceTimersByTimeAsync(3000); // Anfrage laeuft jetzt, Promise noch offen
            abfrage.stop();
            freigeben(status()); // Antwort trifft ERST NACH stop() ein

            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(0);

            expect(aenderungen).toHaveLength(0);
        });
    });
});
