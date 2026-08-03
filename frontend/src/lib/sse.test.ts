/* Absicherung von verbindeSse(): der Ereignis-Strom wird selbst per fetch
 * gelesen (siehe Kommentar in sse.ts - der eingebaute EventSource kann
 * keinen Authorization-Header senden). Das ist die verwickeltste Logik der
 * Bibliothek: das Ereignis-Trennzeichen "\n\n" kann mitten durch ein
 * Netzwerkpaket laufen, mehrere Ereignisse koennen in einem Paket stecken,
 * und die Schleife muss sich sauber wieder anhalten lassen. Diese Tests
 * spielen genau diese Faelle durch.
 *
 * fetch wird durch eine Attrappe ersetzt, deren body.getReader() vorbereitete
 * Text-Stuecke der Reihe nach als Uint8Array ausliefert - exakt die Form,
 * die sse.ts konsumiert (nur getReader().read() wird aufgerufen, sonst
 * nichts von Response/ReadableStream). Fake-Timer verhindern, dass die
 * eingebaute 5-Sekunden-Wartezeit vor dem Wiederverbinden echte Testzeit
 * kostet oder Tests haengen laesst. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verbindeSse, type SseVerbindung } from "./sse";

const codierer = new TextEncoder();

/** Attrappe fuer das, was antwort.body.getReader() liefert: read() liefert
 *  die uebergebenen Stuecke der Reihe nach aus, danach done:true - wie ein
 *  echter Netzwerk-Stream, nur ohne echtes Netzwerk und ohne die Feinheiten
 *  der globalen ReadableStream-Klasse. */
function attrappenLeser(stuecke: string[]) {
    let index = 0;
    return {
        async read(): Promise<{ done: boolean; value?: Uint8Array }> {
            if (index >= stuecke.length) return { done: true, value: undefined };
            const wert = codierer.encode(stuecke[index]);
            index += 1;
            return { done: false, value: wert };
        }
    };
}

function attrappenAntwort(stuecke: string[]): Response {
    return {
        ok: true,
        body: { getReader: () => attrappenLeser(stuecke) }
    } as unknown as Response;
}

function attrappenFehlAntwort(): Response {
    return { ok: false, body: null } as unknown as Response;
}

let verbindungen: SseVerbindung[] = [];

/** Startet verbindeSse() und merkt sich das Handle, damit afterEach jede
 *  Verbindung sauber stoppt - sonst laeuft "while (!gestoppt)" in sse.ts
 *  ueber den Test hinaus weiter. */
function starte(
    pfad: string,
    beiEreignis: (name: string, daten: unknown) => void,
    beiStatus?: (verbunden: boolean) => void
): SseVerbindung {
    const verbindung = verbindeSse(pfad, beiEreignis, beiStatus);
    verbindungen.push(verbindung);
    return verbindung;
}

/** Laesst die Mikrotask-Kette der Leseschleife ablaufen (fetch-Aufloesung,
 *  read()-Aufrufe, JSON.parse, Rueckrufe), ohne echte Zeit verstreichen zu
 *  lassen. Noetig, weil verbindeSse() intern nur "void lauf()" macht - der
 *  Test bekommt lediglich das SseVerbindung-Handle zurueck, nicht die
 *  laufende Promise selbst. */
async function fliessenLassen(schritte = 10): Promise<void> {
    for (let i = 0; i < schritte; i += 1) {
        await vi.advanceTimersByTimeAsync(0);
    }
}

beforeEach(() => {
    vi.useFakeTimers();
    verbindungen = [];
});

afterEach(async () => {
    verbindungen.forEach((verbindung) => verbindung.stop());
    // Eine evtl. bereits laufende 5s-Wartezeit vor dem Wiederverbinden noch
    // ausloesen, damit keine unaufgeloeste Promise zurueckbleibt.
    await vi.advanceTimersByTimeAsync(20000);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("verbindeSse", () => {
    describe("Paketgrenzen", () => {
        it("erkennt ein Ereignis, das über zwei Datenpakete verteilt ankommt", async () => {
            // Die "\n\n"-Grenze faellt genau zwischen die beiden Stuecke, und
            // sogar der JSON-Wert ist mitten durchtrennt - das ist der
            // Normalfall bei echtem TCP/HTTP, keine Ausnahme.
            vi.stubGlobal("fetch", vi.fn(async () => attrappenAntwort([
                'event: bestellung\ndata: {"tisch":7,"status"',
                ':"NEW"}\n\n'
            ])));

            const ereignisse: Array<{ name: string; daten: unknown }> = [];
            starte("/api/kitchen/stream", (name, daten) => ereignisse.push({ name, daten }));
            await fliessenLassen();

            expect(ereignisse).toEqual([
                { name: "bestellung", daten: { tisch: 7, status: "NEW" } }
            ]);
        });

        it("meldet mehrere Ereignisse aus einem einzigen Paket einzeln, nicht nur das erste", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => attrappenAntwort([
                'event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\nevent: c\ndata: {"n":3}\n\n'
            ])));

            const ereignisse: Array<{ name: string; daten: unknown }> = [];
            starte("/api/x", (name, daten) => ereignisse.push({ name, daten }));
            await fliessenLassen();

            expect(ereignisse).toEqual([
                { name: "a", daten: { n: 1 } },
                { name: "b", daten: { n: 2 } },
                { name: "c", daten: { n: 3 } }
            ]);
        });
    });

    describe("Ereignis-Filter", () => {
        it("verschluckt ping und connected, ohne den Rückruf aufzurufen", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => attrappenAntwort([
                "event: connected\n\nevent: ping\n\n",
                'event: bestellung\ndata: {"n":1}\n\n'
            ])));

            const ereignisse: Array<{ name: string; daten: unknown }> = [];
            starte("/api/x", (name, daten) => ereignisse.push({ name, daten }));
            await fliessenLassen();

            expect(ereignisse).toEqual([{ name: "bestellung", daten: { n: 1 } }]);
        });
    });

    describe("Fehlertoleranz", () => {
        it("meldet bei kaputtem JSON den Rohtext, statt zu werfen", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => attrappenAntwort([
                "event: bestellung\ndata: {kaputt\n\n"
            ])));

            const ereignisse: Array<{ name: string; daten: unknown }> = [];
            starte("/api/x", (name, daten) => ereignisse.push({ name, daten }));
            await fliessenLassen();

            // Kein Wurf, sondern der Rohtext - genau das, was verlangt ist.
            // Wuerde stattdessen geworfen, landete der Fehler im aeusseren
            // try/catch von lauf() und ereignisse bliebe komplett leer.
            expect(ereignisse).toEqual([{ name: "bestellung", daten: "{kaputt" }]);
        });
    });

    describe("Ereignisname", () => {
        it("liest event: als Ereignisnamen und fällt ohne diese Zeile auf message zurück", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => attrappenAntwort([
                'event: status\ndata: {"v":1}\n\ndata: {"v":2}\n\n'
            ])));

            const ereignisse: Array<{ name: string; daten: unknown }> = [];
            starte("/api/x", (name, daten) => ereignisse.push({ name, daten }));
            await fliessenLassen();

            expect(ereignisse).toEqual([
                { name: "status", daten: { v: 1 } },
                { name: "message", daten: { v: 2 } }
            ]);
        });
    });

    describe("stop()", () => {
        it("beendet die Schleife - danach kommen keine Rückrufe und kein neuer Verbindungsversuch mehr", async () => {
            const fetchAttrappe = vi.fn()
                .mockResolvedValueOnce(attrappenAntwort(['event: erstes\ndata: {"n":1}\n\n']))
                .mockResolvedValueOnce(attrappenAntwort(['event: zweites\ndata: {"n":2}\n\n']));
            vi.stubGlobal("fetch", fetchAttrappe);

            const ereignisse: Array<{ name: string; daten: unknown }> = [];
            const verbindung = starte("/api/x", (name, daten) => ereignisse.push({ name, daten }));
            await fliessenLassen();

            expect(ereignisse).toEqual([{ name: "erstes", daten: { n: 1 } }]);
            expect(fetchAttrappe).toHaveBeenCalledTimes(1);

            // Der Strom ist jetzt zu Ende, die Schleife wartet 5s auf den
            // naechsten Verbindungsversuch. Genau in diesem Moment stoppen -
            // das ist der Fall, der im Betrieb zaehlt.
            verbindung.stop();
            await vi.advanceTimersByTimeAsync(20000);
            await fliessenLassen();

            expect(fetchAttrappe).toHaveBeenCalledTimes(1); // kein zweiter Versuch
            expect(ereignisse).toEqual([{ name: "erstes", daten: { n: 1 } }]); // nichts Neues
        });
    });

    describe("Status-Rückruf", () => {
        it("meldet verbunden nach dem Aufbau und getrennt, sobald der Strom endet", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => attrappenAntwort(['event: x\ndata: {}\n\n'])));

            const status: boolean[] = [];
            starte("/api/x", () => {}, (verbunden) => status.push(verbunden));
            await fliessenLassen();

            expect(status).toEqual([true, false]);
        });

        it("meldet nur getrennt, wenn die Antwort nicht ok ist - nie erst verbunden", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => attrappenFehlAntwort()));

            const status: boolean[] = [];
            starte("/api/x", () => {}, (verbunden) => status.push(verbunden));
            await fliessenLassen();

            expect(status).toEqual([false]);
        });

        it("meldet getrennt, wenn fetch selbst verwirft, statt sich aufzuhängen", async () => {
            vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Netzwerk weg"); }));

            const status: boolean[] = [];
            starte("/api/x", () => {}, (verbunden) => status.push(verbunden));
            await fliessenLassen();

            expect(status).toEqual([false]);
        });
    });
});
