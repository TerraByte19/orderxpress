/* OrderXpress - gemeinsame Helfer fuer alle Seiten */
const OX = {

    euro: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),

    preis(v) { return this.euro.format(v); },

    zeit(iso) {
        return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    },

    /* ---------- Anmeldung ----------
       Zwei Wege:
       1. Personen (Inhaber/Service/Kueche): Benutzername + Passwort (Basic Auth).
          Liegt im localStorage, gilt also tab-uebergreifend -> EINMAL anmelden
          reicht fuer Inhaber-, Service- und Kuechen-Ansicht.
       2. Geraete (Kuechen-Tablet, Kasse): Geraetetoken aus dem QR-Code,
          wird als Header "X-Device-Token" geschickt - kein Passwort noetig. */

    setAuth(user, pass) {
        try { localStorage.setItem("ox-auth", "Basic " + btoa(user + ":" + pass)); } catch (e) { /* ignore */ }
        this._me = null;
    },
    setDeviceToken(token) {
        try { localStorage.setItem("ox-device", token); } catch (e) { /* ignore */ }
        this._me = null;
    },
    deviceToken() {
        try { return localStorage.getItem("ox-device"); } catch (e) { return null; }
    },
    basicAuth() {
        try { return localStorage.getItem("ox-auth"); } catch (e) { return null; }
    },
    clearAuth() {
        try { localStorage.removeItem("ox-auth"); localStorage.removeItem("ox-device"); } catch (e) { /* ignore */ }
        this._me = null;
    },
    hasAuth() { return !!(this.basicAuth() || this.deviceToken()); },
    authHeader() {
        const device = this.deviceToken();
        if (device) return { "X-Device-Token": device };
        const basic = this.basicAuth();
        return basic ? { Authorization: basic } : {};
    },

    /* ---------- Wer bin ich? (Rolle + Laden) ---------- */

    async me() {
        if (!this._me) { this._me = await this.api("/api/me"); }
        return this._me;
    },

    roleText(role) {
        return { OWNER: "Inhaber", SERVICE: "Service/Kasse", KITCHEN: "Küche", WAITER: "Kellner" }[role] || role;
    },

    /* Baut oben eine Leiste zum Umschalten zwischen den Ansichten.
       Der Inhaber sieht alle drei, Service und Kueche nur ihre eigene. */
    async buildNav(active) {
        let me;
        try { me = await this.me(); } catch (e) { return; }

        const all = [
            { key: "admin", href: "/admin.html", label: "Inhaber", roles: ["OWNER"] },
            { key: "service", href: "/service.html", label: "Service/Kasse", roles: ["OWNER", "SERVICE"] },
            { key: "kitchen", href: "/kitchen.html", label: "Küche", roles: ["OWNER", "KITCHEN"] }
        ].filter(l => l.roles.includes(me.role));

        let bar = document.getElementById("ox-nav");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "ox-nav";
            const main = document.querySelector("main");
            if (!main) return;
            main.insertBefore(bar, main.firstChild);
        }
        bar.className = "ox-nav";
        bar.innerHTML = "";

        for (const link of all) {
            const a = document.createElement("a");
            a.href = link.href;
            a.textContent = link.label;
            if (link.key === active) a.className = "current";
            bar.appendChild(a);
        }
        const info = document.createElement("span");
        info.className = "muted";
        info.style.marginLeft = "auto";
        info.textContent = me.restaurantName + " · " + this.roleText(me.role);
        bar.appendChild(info);
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
