(function (root) {
    "use strict";
    root.MuehleSettings = Object.freeze({
        manualStrengths: Object.freeze({
            1: 0.72,
            2: 0.82,
            3: 0.86,
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
        adaptiveHabitInfluence: 0.55,
        manualHabitInfluence: 0,
        searchConfig: Object.freeze({
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 3,
            fixedDepth: null
        })
    });
})(window);
