(function (root) {
    "use strict";

    const KEY = "andis-game-foundry-connect-four-current-v1";

    function save(state) {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* private mode */ }
    }

    function load() {
        try {
            const value = localStorage.getItem(KEY);
            return value ? JSON.parse(value) : null;
        } catch (_) { return null; }
    }

    function clear() {
        try { localStorage.removeItem(KEY); } catch (_) { /* private mode */ }
    }

    root.ConnectFourStorage = Object.freeze({ save, load, clear });
})(window);
