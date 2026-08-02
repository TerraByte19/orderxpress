import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiFehler } from "./api";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

function antwort(status: number, koerper: string, ok = status < 400): Response {
    return {
        ok,
        status,
        text: async () => koerper
    } as unknown as Response;
}

describe("api", () => {
    it("liefert den geparsten Koerper zurueck", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(200, '{"name":"Test"}')));
        const ergebnis = await api<{ name: string }>("/api/me");
        expect(ergebnis.name).toBe("Test");
    });

    it("liefert null bei 204 ohne Inhalt", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(204, "")));
        expect(await api("/api/guest/guests/x/call", { method: "POST" })).toBeNull();
    });

    it("wirft ApiFehler mit Status und Meldung aus dem ProblemDetail", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(400, '{"detail":"Tisch nicht frei"}')));
        await expect(api("/api/guest/orders")).rejects.toMatchObject({
            message: "Tisch nicht frei",
            status: 400
        });
    });

    it("wirft ApiFehler auch ohne JSON-Koerper", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => antwort(500, "<html>kaputt</html>")));
        await expect(api("/api/me")).rejects.toBeInstanceOf(ApiFehler);
    });

    it("schickt den Geraetetoken als X-Device-Token", async () => {
        const gefaelscht = vi.fn(async () => antwort(200, "{}"));
        vi.stubGlobal("fetch", gefaelscht);
        localStorage.setItem("ox-device", "abc123");

        await api("/api/me");

        const kopfzeilen = (gefaelscht.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
        expect(kopfzeilen["X-Device-Token"]).toBe("abc123");
        expect(kopfzeilen.Authorization).toBeUndefined();
    });

    it("bevorzugt den Geraetetoken vor Basic Auth", async () => {
        const gefaelscht = vi.fn(async () => antwort(200, "{}"));
        vi.stubGlobal("fetch", gefaelscht);
        localStorage.setItem("ox-auth", "Basic xyz");
        localStorage.setItem("ox-device", "abc123");

        await api("/api/me");

        const kopfzeilen = (gefaelscht.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
        expect(kopfzeilen["X-Device-Token"]).toBe("abc123");
    });
});
