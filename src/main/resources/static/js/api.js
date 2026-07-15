/* OrderXpress - gemeinsame Helfer fuer alle Seiten */
const OX = {

    euro: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),

    preis(v) { return this.euro.format(v); },

    zeit(iso) {
        return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    },

    /* ---------- Login (Basic Auth im sessionStorage) ---------- */

    setAuth(user, pass) { sessionStorage.setItem("ox-auth", "Basic " + btoa(user + ":" + pass)); },
    clearAuth() { sessionStorage.removeItem("ox-auth"); },
    hasAuth() { return !!sessionStorage.getItem("ox-auth"); },
    authHeader() {
        const a = sessionStorage.getItem("ox-auth");
        return a ? { Authorization: a } : {};
    },

    /* ---------- API-Aufrufe ---------- */

    async api(path, options = {}) {
        const res = await fetch(path, {
            ...options,
            headers: { "Content-Type": "application/json", ...this.authHeader(), ...(options.headers || {}) }
        });
        if (res.status === 204) return null;
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { /* keine JSON-Antwort */ }
        if (!res.ok) {
            const msg = body && body.detail ? body.detail : "Fehler " + res.status;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }
        return body;
    },

    /* ---------- Kleine Einblend-Meldung ---------- */

    toast(msg, isError = false) {
        let el = document.getElementById("toast");
        if (!el) {
            el = document.createElement("div");
            el.id = "toast";
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.className = "show" + (isError ? " error" : "");
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { el.className = ""; }, 3500);
    },

    /* ---------- Live-Ereignisse (SSE) ----------
       Der eingebaute EventSource kann keinen Basic-Auth-Header senden,
       deshalb lesen wir den Ereignis-Strom selbst per fetch.
       Verbindet sich bei Abbruch automatisch neu.                     */

    connectSse(path, onEvent, onStatus) {
        let stopped = false;

        const run = async () => {
            while (!stopped) {
                try {
                    const res = await fetch(path, {
                        headers: { Accept: "text/event-stream", ...this.authHeader() }
                    });
                    if (!res.ok || !res.body) throw new Error("SSE-Verbindung fehlgeschlagen");
                    if (onStatus) onStatus(true);

                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });

                        let idx;
                        while ((idx = buffer.indexOf("\n\n")) >= 0) {
                            const chunk = buffer.slice(0, idx);
                            buffer = buffer.slice(idx + 2);
                            let event = "message", data = "";
                            for (const line of chunk.split("\n")) {
                                if (line.startsWith("event:")) event = line.slice(6).trim();
                                else if (line.startsWith("data:")) data += line.slice(5).trim();
                            }
                            if (event !== "ping" && event !== "connected") {
                                try { onEvent(event, data ? JSON.parse(data) : null); }
                                catch (e) { onEvent(event, data); }
                            }
                        }
                    }
                } catch (e) {
                    /* Verbindung weg -> unten neu versuchen */
                }
                if (onStatus) onStatus(false);
                if (!stopped) await new Promise(r => setTimeout(r, 5000));
            }
        };
        run();
        return { stop() { stopped = true; } };
    }
};
