/* Reine Funktion, kein Netzwerk/DOM: ermittelt, welche zwei Nachbarn in
 * einer nach sortOrder aufsteigend sortierten Liste getauscht werden
 * muessen. Der Aufrufer (index.ts) verschickt die beiden PUT-Aufrufe mit
 * vertauschtem sortOrder. */

export interface SortierbaresElement {
    id: number;
    sortOrder: number;
}

export function ermittleTausch<T extends SortierbaresElement>(
    liste: T[],
    id: number,
    richtung: -1 | 1
): { a: T; b: T } | null {
    const index = liste.findIndex((element) => element.id === id);
    if (index === -1) return null;
    const nachbarIndex = index + richtung;
    if (nachbarIndex < 0 || nachbarIndex >= liste.length) return null;
    return { a: liste[index], b: liste[nachbarIndex] };
}
