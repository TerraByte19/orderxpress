/* Sichert den Cache-Mechanismus aus session.ts ab: /api/me wird nur einmal
   gerufen, solange sich die Anmeldung nicht aendert. Nach setzeAnmeldung()
   oder loescheAnmeldung() muss die naechste me()-Anfrage wieder ans Backend
   gehen, sonst wuerde ein Personal-Tablet nach dem Umschalten der Anmeldung
   die Rolle des Vorgaengers weiterbenutzen.

   Genau dafuer registriert session.ts sich mit beiAnmeldungsWechsel(vergissMe)
   bei auth.ts (session.ts:25) - dieser Test haelt diese Verdrahtung fest. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Me } from "./types";

const beispielMe: Me = {
    name: "Test",
    role: "OWNER",
    restaurantId: 1,
    restaurantName: "Bistro",
    kitchenDisplayEnabled: true
};

vi.mock("./api", () => ({
    api: vi.fn(async () => beispielMe)
}));

import { api } from "./api";
import { me, vergissMe } from "./session";
import { setzeAnmeldung, loescheAnmeldung } from "./auth";

beforeEach(() => {
    vergissMe();
    vi.mocked(api).mockClear();
});

afterEach(() => { localStorage.clear(); });

describe("session", () => {
    it("ruft /api/me nur einmal auf, wenn sich die Anmeldung nicht aendert", async () => {
        await me();
        await me();
        expect(api).toHaveBeenCalledTimes(1);
    });

    it("vergisst die gemerkte Antwort bei setzeAnmeldung", async () => {
        await me();
        setzeAnmeldung("a", "b");
        await me();
        expect(api).toHaveBeenCalledTimes(2);
    });

    it("vergisst die gemerkte Antwort bei loescheAnmeldung", async () => {
        await me();
        loescheAnmeldung();
        await me();
        expect(api).toHaveBeenCalledTimes(2);
    });
});
