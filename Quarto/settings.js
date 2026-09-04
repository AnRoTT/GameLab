(function (root) {
    "use strict";
    root.QuartoSettings = Object.freeze({
        manualStrengths: Object.freeze({
            1: 0.52,
            2: 0.66,
            3: 0.77,
            4: 0.86,
            reference: 1.00
        }),
        difficulty: Object.freeze({
            minSearchChance: 0.08,
            maxSearchChance: 1.00,
            minRandomness: 0.00,
            maxRandomness: 0.42,
            minErrorRate: 0.00,
            maxErrorRate: 0.30,
            habitInfluence: 0.60
        }),
        adaptiveHabitInfluence: 0.60,
        manualHabitInfluence: 0,
        searchConfig: Object.freeze({
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 3,
            fixedDepth: null
        })
    });
})(window);
