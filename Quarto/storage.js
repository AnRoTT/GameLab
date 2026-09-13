(function (root) {
    "use strict";

    const KEY = "andis-game-foundry-quarto-current-v1";

    function save(state) {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (_) {
            // Lokale Speicherung darf das laufende Spiel nicht blockieren.
        }
    }

    function load() {
        try {
            const value = localStorage.getItem(KEY);
            return value ? JSON.parse(value) : null;
        } catch (_) {
            return null;
        }
    }

    function clear() {
        try {
            localStorage.removeItem(KEY);
        } catch (_) {
            // Keine Aktion erforderlich, wenn Storage nicht verfügbar ist.
        }
    }

    root.QuartoStorage = Object.freeze({ save, load, clear });
})(window);
