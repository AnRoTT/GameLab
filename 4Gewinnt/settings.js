(function (root) {
    "use strict";
    root.ConnectFourSettings = Object.freeze({
        manualStrengths: Object.freeze({
            anfanger: 0.24,
            hobby: 0.59,
            verein: 0.78,
            meister: 0.90,
            referenz: 1.00
        }),
        difficulty: Object.freeze({
            minSearchChance: 0.06,
            maxSearchChance: 1.00,
            minRandomness: 0.00,
            maxRandomness: 0.42,
            minErrorRate: 0.00,
            maxErrorRate: 0.34,
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
