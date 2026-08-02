/* Anzeige-Formate. Immer deutsches Format - die App laeuft in Deutschland. */

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Geldbetrag als "7,00 €". Nimmt Zahl oder Zeichenkette (JSON liefert beides). */
export function preis(wert: number | string): string {
    return euro.format(Number(wert));
}

/** Zeitstempel als "14:05". */
export function zeit(iso: string): string {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Volle Minuten seit dem Zeitstempel. Nie negativ. */
export function dauerMinuten(iso: string, jetzt: number = Date.now()): number {
    const vergangen = jetzt - Date.parse(iso);
    return vergangen <= 0 ? 0 : Math.floor(vergangen / 60000);
}
