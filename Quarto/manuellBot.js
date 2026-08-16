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

    function chooseAction(state, botPlayer, level) {
        const actions = core.getLegalActions(state);
        if (!actions.length) return null;

        const config = configFor(level);
        if (Math.random() < config.randomChance) return randomItem(actions);

        const habitChance = (name) => Math.random() < (config[name] || 0);
        const scored = actions.map((action) => {
            let score = 0;
            if (state.selectedPiece === null) {
                const danger = core.countWinningPlacements(state, action);
                if (habitChance("safeGiftChance")) score -= danger * 1200;
            } else {
                const next = core.placePiece(state, action);
                if (next && habitChance("immediateWinChance") && next.winner === botPlayer) score += 100000;
                if (next && habitChance("lineChance")) score += core.evaluateState(next, botPlayer);
                if (habitChance("positionChance")) {
                    const row = Math.floor(action / 4);
                    const col = action % 4;
                    score += (row >= 1 && row <= 2 && col >= 1 && col <= 2) ? 4 :
                        ((row === 0 || row === 3) && (col === 0 || col === 3) ? 3 : 1);
                }
            }
            return { action, score };
        }).sort((a, b) => b.score - a.score);
        if (scored.length && scored[0].score !== 0 && Math.random() < config.minimaxChance) {
            return scored[0].action;
        }

        // Die Suche ist in jedem Level Bestandteil des Profils; die Staerke
        // steuert nur, wie oft sie gegen einen Zufallszug gewinnt.
        if (Math.random() >= config.minimaxChance) return randomItem(actions);

        const action = state.selectedPiece === null
            ? core.choosePiece(state, botPlayer, config.depth)
            : core.chooseCell(state, botPlayer, config.depth);
        return actions.includes(action) ? action : randomItem(actions);
    }

    window.QuartoRandomBot = {
        choosePiece(remainingPieces) { return randomItem(remainingPieces); },
        chooseCell(openCells) { return randomItem(openCells); }
    };

    window.QuartoManualBot = {
        LEVELS,
        choosePiece(state, botPlayer = 1, level = 1) {
            if (state.selectedPiece !== null) return null;
            return chooseAction(state, botPlayer, level);
        },
        chooseCell(state, botPlayer = 1, level = 1) {
            if (state.selectedPiece === null) return null;
            return chooseAction(state, botPlayer, level);
        }
    };
})();
