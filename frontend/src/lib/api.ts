/* Alle Aufrufe ans Backend laufen hier durch: Auth-Kopfzeile dran,
   Fehler als ApiFehler mit Status, 204 als null. */

import { authKopfzeilen } from "./auth";
import type { ProblemDetail } from "./types";

export class ApiFehler extends Error {
    readonly status: number;

    constructor(nachricht: string, status: number) {
        super(nachricht);
        this.name = "ApiFehler";
        this.status = status;
    }
}

export async function api<T>(pfad: string, optionen: RequestInit = {}): Promise<T> {
    const antwort = await fetch(pfad, {
        ...optionen,
        headers: {
            "Content-Type": "application/json",
            ...authKopfzeilen(),
            ...(optionen.headers as Record<string, string> | undefined)
        }
    });

    if (antwort.status === 204) return null as T;

    const text = await antwort.text();
    let koerper: unknown = null;
    try { koerper = text ? JSON.parse(text) : null; } catch { /* keine JSON-Antwort */ }

    if (!antwort.ok) {
        const detail = (koerper as ProblemDetail | null)?.detail;
        throw new ApiFehler(detail ?? `Fehler ${antwort.status}`, antwort.status);
    }

    return koerper as T;
}
