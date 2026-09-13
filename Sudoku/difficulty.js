(function (root) {
    "use strict";

    function classify(grid) {
        const analysis = root.SudokuSolver.analyze(grid);
        const clues = analysis.clues;
        if (analysis.xWings > 0) return "Experte";
        if (analysis.nakedPairs > 0 || analysis.lockedCandidates > 0) return "Schwer";
        if (clues >= 40 && !analysis.requiresSearch) return "Leicht";
        if (clues >= 34 && !analysis.requiresSearch) return "Mittel";
        if (clues >= 29 && analysis.unresolved < 30) return "Schwer";
        return "Experte";
    }

    root.SudokuDifficulty = Object.freeze({ classify });
})(window);
