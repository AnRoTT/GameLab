(function (root) {
    "use strict";
    root.SudokuSettings = Object.freeze({
        levels: Object.freeze(["Leicht", "Mittel", "Schwer", "Experte"]),
        clues: Object.freeze({
            "Leicht": Object.freeze({ min: 40, max: 45 }),
            "Mittel": Object.freeze({ min: 34, max: 39 }),
            "Schwer": Object.freeze({ min: 29, max: 33 }),
            "Experte": Object.freeze({ min: 25, max: 28 })
        }),
        difficultyProfiles: Object.freeze({
            "Leicht": Object.freeze({ minTechniqueRank: 0, maxTechniqueRank: 0, preferredTechniqueRank: 0, attempts: 14 }),
            "Mittel": Object.freeze({ minTechniqueRank: 0, maxTechniqueRank: 1, preferredTechniqueRank: 1, attempts: 18 }),
            "Schwer": Object.freeze({ minTechniqueRank: 0, maxTechniqueRank: 2, preferredTechniqueRank: 2, attempts: 22 }),
            "Experte": Object.freeze({ minTechniqueRank: 2, maxTechniqueRank: 4, preferredTechniqueRank: 3, attempts: 26 })
        }),
        storageKey: "andis-game-foundry-sudoku-current-v1"
    });
})(window);
