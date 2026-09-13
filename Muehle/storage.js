(function (root) {
    "use strict";

    const KEY = "andis-game-foundry-muehle-current-v1";

    function save(value) {
        try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (_) { /* Spiel bleibt spielbar. */ }
    }

    function load() {
        try {
            const value = localStorage.getItem(KEY);
            return value ? JSON.parse(value) : null;
        } catch (_) { return null; }
    }

    function clear() {
        try { localStorage.removeItem(KEY); } catch (_) { /* Kein weiterer Schritt nötig. */ }
    }

    root.MuehleStorage = Object.freeze({ save, load, clear });
})(window);
