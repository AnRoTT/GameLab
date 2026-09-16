(function (root) {
    "use strict";

    function rate(grid) {
        const analysis = root.SudokuSolver.analyze(grid);
        let techniqueRank = 0;
        let technique = "Singles";
        if (analysis.lockedCandidates > 0) {
            techniqueRank = 1;
            technique = "gesperrte Kandidaten";
        }
        if (analysis.nakedPairs > 0) {
            techniqueRank = 2;
            technique = "nackte Paare";
        }
        if (analysis.xWings > 0) {
            techniqueRank = 3;
            technique = "X-Wing";
        }
        if (analysis.requiresSearch) {
            techniqueRank = 4;
            technique = "Suchschritte";
        }
        return { ...analysis, techniqueRank, technique };
    }

    function classify(grid) {
        const rating = rate(grid);
        if (rating.techniqueRank >= 3) return "Experte";
        if (rating.techniqueRank === 2) return "Schwer";
        if (rating.techniqueRank === 1) return rating.clues >= 34 ? "Mittel" : "Schwer";
        if (rating.clues >= 40) return "Leicht";
        if (rating.clues >= 34) return "Mittel";
        if (rating.clues >= 29) return "Schwer";
        return "Experte";
    }

    function matches(grid, level) {
        const profile = root.SudokuSettings.difficultyProfiles[level];
        if (!profile) return true;
        const rank = rate(grid).techniqueRank;
        return rank >= profile.minTechniqueRank && rank <= profile.maxTechniqueRank;
    }

    root.SudokuDifficulty = Object.freeze({ classify, rate, matches });
})(window);
