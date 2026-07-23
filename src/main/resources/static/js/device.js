/* Geraet per QR-Code anmelden: /d/<activationToken>
   Der Einmal-Token wird gegen den dauerhaften Geraetetoken getauscht,
   der danach im Browser bleibt - kein Passwort noetig. */
const Device = {

    async init() {
        const path = location.pathname;
        let token = "";
        if (path.startsWith("/d/")) {
            token = decodeURIComponent(path.split("/")[2] || "");
        } else {
            token = new URLSearchParams(location.search).get("token") || "";
        }
        if (!token) {
            this.fail("Kein Anmelde-Code gefunden. Bitte den QR-Code scannen.");
            return;
        }

        try {
            const res = await OX.api("/api/device/activate/" + encodeURIComponent(token), { method: "POST" });

            // Eventuelle alte Anmeldung ersetzen
            OX.clearAuth();
            OX.setDeviceToken(res.deviceToken);

            const target = res.role === "KITCHEN" ? "/kitchen.html"
                : res.role === "WAITER" ? "/waiter.html"
                : "/service.html";
            document.getElementById("ok-text").textContent =
                res.label + " · " + OX.roleText(res.role) + " · " + res.restaurantName;
            document.getElementById("btn-go").onclick = () => { location.href = target; };
            this.show("view-ok");
            setTimeout(() => { location.href = target; }, 2000);
        } catch (e) {
            this.fail(e.message);
        }
    },

    fail(text) {
        document.getElementById("error-text").textContent = text;
        this.show("view-error");
    },

    show(id) {
        for (const v of ["view-wait", "view-ok", "view-error"]) {
            document.getElementById(v).style.display = (v === id) ? "" : "none";
        }
    }
};

Device.init();
