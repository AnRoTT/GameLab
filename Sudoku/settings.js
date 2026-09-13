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
        storageKey: "andis-game-foundry-sudoku-current-v1"
    });
})(window);
