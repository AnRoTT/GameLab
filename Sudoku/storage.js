(function (root) {
    "use strict";
    const key = () => root.SudokuSettings.storageKey;

    function save(state) {
        try { localStorage.setItem(key(), JSON.stringify(state)); } catch (_) { /* private mode */ }
    }
    function load() {
        try {
            const value = localStorage.getItem(key());
            return value ? JSON.parse(value) : null;
        } catch (_) { return null; }
    }
    function clear() {
        try { localStorage.removeItem(key()); } catch (_) { /* private mode */ }
    }
    root.SudokuStorage = Object.freeze({ save, load, clear });
})(window);
