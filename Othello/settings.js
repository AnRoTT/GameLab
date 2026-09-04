(function (root) {
    "use strict";
    root.OthelloSettings = Object.freeze({
        manualStrengths: Object.freeze({
            1: 0.47,
            2: 0.58,
            3: 0.72,
            4: 0.85,
            reference: 1.00
        }),
        difficulty: Object.freeze({
            minSearchChance: 0.08,
            maxSearchChance: 1.00,
            minRandomness: 0.00,
            maxRandomness: 0.88,
            minErrorRate: 0.00,
            maxErrorRate: 0.34,
            habitInfluence: 0.75
        }),
        adaptiveHabitInfluence: 0.75,
        manualHabitInfluence: 0,
        searchConfig: Object.freeze({
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 3,
            fixedDepth: null
        })
    });
})(window);
