/* Manuelle Quarto-Bots. Die Regeln und Suche bleiben in QuartoAICore. */
(function () {
    "use strict";

    const core = window.QuartoAICore;
    const LEVELS = Object.freeze({
        1: core.getManualProfile(1),
        2: core.getManualProfile(2),
        3: core.getManualProfile(3),
        4: core.getManualProfile(4)
    });

    function randomItem(items) {
        if (!items.length) return null;
        return items[Math.floor(Math.random() * items.length)];
    }

    function configFor(level) {
        if (String(level).toLowerCase() === "reference" || String(level).toLowerCase() === "referenz") {
            return core.getManualReferenceProfile();
        }
        return core.getManualProfile(Math.max(1, Math.min(4, Number(level) || 1)));
    }

    function getThinkTime(level = 1) {
        const config = configFor(level);
        const base = 350 + config.curve * 750;
        const variation = base * 0.18;
        return Math.max(280, Math.round(base - variation + Math.random() * variation * 2));
    }

    function chooseAction(state, botPlayer, level, searchCache = null) {
        const actions = core.getLegalActions(state);
        if (!actions.length) return null;

        const config = configFor(level);
        const searchDepth = config.depth;
        const isReference = String(level).toLowerCase() === "reference" || String(level).toLowerCase() === "referenz";
        if (isReference) {
            const referenceAction = state.selectedPiece === null
                ? core.choosePiece(state, botPlayer, searchDepth, searchCache)
                : core.chooseCell(state, botPlayer, searchDepth, searchCache);
            return actions.includes(referenceAction) ? referenceAction : actions[0];
        }
        const habitChance = (name) => Math.random() < (config[name] || 0);
        const scored = actions.map((action) => {
            let score = 0;
            if (state.selectedPiece === null) {
                const danger = core.countWinningPlacements(state, action);
                score -= danger * 1200 * config.curve;
                if (danger >= 2) score -= (danger - 1) * 1800 * config.curve;
            } else {
                const next = core.placePiece(state, action);
                // Sofortgewinne bleiben stark priorisiert, sind bei niedrigen
                // Levels aber nicht mehr unabhängig von der zentralen
                // taktischen Genauigkeit garantiert.
                if (next && next.winner === botPlayer) {
                    score += 100000 * (config.tacticalAccuracy ?? config.curve);
                }
                if (next) score += core.evaluateState(next, botPlayer) * config.curve;
                if (Math.random() < config.positionChance) {
                    const row = Math.floor(action / 4);
                    const col = action % 4;
                    score += (row >= 1 && row <= 2 && col >= 1 && col <= 2) ? 4 :
                        ((row === 0 || row === 3) && (col === 0 || col === 3) ? 3 : 1);
                }
            }
            return { action, score };
        }).sort((a, b) => b.score - a.score);
        const searched = searchDepth > 0 && Math.random() >= config.errorRate && Math.random() < config.searchChance
            ? core.getScoredActions(state, botPlayer, searchDepth, searchCache)
            : [];
        const combined = actions.map(action => ({
            action,
            score: (searched.find(item => item.action === action)?.score || 0)
                + (scored.find(item => item.action === action)?.score || 0)
                + Math.random() * config.randomChance * 10
        }));
        return window.SharedDifficulty.selectSoftCandidate(combined, config.curve, true)?.action ?? actions[0];
    }

    window.QuartoRandomBot = {
        choosePiece(remainingPieces) { return randomItem(remainingPieces); },
        chooseCell(openCells) { return randomItem(openCells); }
    };

    window.QuartoManualBot = {
        LEVELS,
        getThinkTime,
        choosePiece(state, botPlayer = 1, level = 1, searchCache = null) {
            if (state.selectedPiece !== null) return null;
            return chooseAction(state, botPlayer, level, searchCache);
        },
        chooseCell(state, botPlayer = 1, level = 1, searchCache = null) {
            if (state.selectedPiece === null) return null;
            return chooseAction(state, botPlayer, level, searchCache);
        }
    };
})();
