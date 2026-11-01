(function (root) {
    "use strict";
    const KEY = "andis-game-foundry-deutsche-dame-current-v1";
    const LEGACY_KEYS = ["andis-deutsche-dame-prototype"];

    function read(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (_) { return null; }
    }

    function save(value) {
        try {
            localStorage.setItem(KEY, JSON.stringify(value));
            return true;
        } catch (_) {
            // Die lokale Speicherung darf das laufende Spiel nicht blockieren.
            return false;
        }
    }

    function load() {
        const current = read(KEY);
        if (current) return current;
        for (const legacyKey of LEGACY_KEYS) {
            const legacy = read(legacyKey);
            if (legacy) return legacy;
        }
        return null;
    }

    function clear() {
        try {
            localStorage.removeItem(KEY);
            LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
        } catch (_) { /* Kein weiterer Schritt nötig. */ }
    }

    root.DeutscheDameStorage = Object.freeze({
        load() {
            return load();
        },
        save(value) {
            return save(value);
        },
        clear() {
            clear();
        }
    });
})(window);
