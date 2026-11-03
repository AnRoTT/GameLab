(function (root) {
    "use strict";
    root.DeutscheDameSettings = Object.freeze({
        manualStrengths: Object.freeze({
            1: 0.68,
            2: 0.77,
            3: 0.83,
            4: 0.93,
            reference: 1.00
        }),
        difficulty: Object.freeze({
            minSearchChance: 0.12,
            maxSearchChance: 1.00,
            minRandomness: 0.00,
            maxRandomness: 0.52,
            minErrorRate: 0.00,
            maxErrorRate: 0.28,
            habitInfluence: 0.55
        }),
        // Nur der adaptive Bot nutzt das beobachtete Spielprofil. Die
        // manuellen Stufen bleiben für alle Spieler reproduzierbar.
        adaptiveHabitInfluence: 0.55,
        manualHabitInfluence: 0,
        searchConfig: Object.freeze({ supportsMinimax: true, minDepth: 0, maxDepth: 3, fixedDepth: null })
    });
})(window);
