(function () {
    const TicTacToeAdaptiveCore = window.TicTacToeAICore;
    const state = {
        adaptiveRoundStatus: "",
        adaptiveRoundSnapshot: null,
        adaptiveSkill: 0.5,
        adaptiveAI: {
            accuracy: 0.60,
            tactics: 0.55,
            habitUsage: 0.40,
            mistakeChance: 0.12,
            creativity: 0.50
        },
        // Das Profil wird zentral in aiCore.js erstellt und hier nur gelesen.
        playerProfile: window.ticTacToePlayerProfile
    };

    function getLearningRate() {
        switch (activeMatch?.adaptSpeed) {
            case "slow": return 0.45;
            case "fast": return 1.4;
            default: return 1.0;
        }
    }

    function adaptiveClamp(v) {
        return Math.max(0, Math.min(1, v));
    }

    function adaptiveCurve() {
        return TicTacToeAdaptiveCore.getDifficultyProfile(getAdaptiveSkillValue()).challenge;
    }

    function getAdaptiveSkillBand() {
        if (state.adaptiveSkill < 0.30) return 0;
        if (state.adaptiveSkill < 0.44) return 1;
        if (state.adaptiveSkill < 0.58) return 2;
        if (state.adaptiveSkill < 0.72) return 3;
        if (state.adaptiveSkill < 0.86) return 4;
        return 5;
    }

    function sumAdaptive(values) {
        return values.reduce((sum, value) => sum + value, 0);
    }

    function captureAdaptiveRoundSnapshot() {
        state.adaptiveRoundSnapshot = {
            totalMoves: state.playerProfile.totalMoves,
            mistakes: state.playerProfile.mistakes,
            missedBlocks: state.playerProfile.missedBlocks,
            missedWins: state.playerProfile.missedWins,
            forksSeen: state.playerProfile.forksSeen,
            forksMissed: state.playerProfile.forksMissed,
            tacticalGood: state.playerProfile.tacticalGood,
            tacticalBad: state.playerProfile.tacticalBad
        };
    }

    function getAdaptiveSkillValue() {
        return Math.round(state.adaptiveSkill * 100);
    }

    function decayAdaptiveMemory() {
        const keep = 0.98 + (getLearningRate() - 1) * 0.01;
        state.playerProfile.favoriteCells = state.playerProfile.favoriteCells.map(v => v * keep);
        state.playerProfile.openingCells = state.playerProfile.openingCells.map(v => v * keep);
        state.playerProfile.rowPreference = state.playerProfile.rowPreference.map(v => v * keep);
        state.playerProfile.colPreference = state.playerProfile.colPreference.map(v => v * keep);
        state.playerProfile.positionPreference.center *= keep;
        state.playerProfile.positionPreference.corner *= keep;
        state.playerProfile.positionPreference.edge *= keep;
        state.playerProfile.style.aggressive *= keep;
        state.playerProfile.style.defensive *= keep;
        state.playerProfile.mistakes *= keep;
        state.playerProfile.missedBlocks *= keep;
        state.playerProfile.missedWins *= keep;
        state.playerProfile.forksSeen *= keep;
        state.playerProfile.forksMissed *= keep;
        state.playerProfile.tacticalGood *= keep;
        state.playerProfile.tacticalBad *= keep;
    }

    function getBotDelay() {
        const profile = TicTacToeAdaptiveCore.getDifficultyProfile(getAdaptiveSkillValue());
        const base = 160;
        const skillDelay = profile.challenge * 1500;
        const tacticsDelay = state.adaptiveAI.tactics * 180;
        const creativityDelay = state.adaptiveAI.creativity * 90;
        return base + skillDelay + tacticsDelay + creativityDelay;
    }

    function adaptiveCellType(index) {
        if (index === 4) return "center";
        if ([0, 2, 6, 8].includes(index)) return "corner";
        return "edge";
    }

    function registerAdaptiveMissedWin(move, stateBeforeMove) {
        const win = TicTacToeAdaptiveCore.findCritical("X", stateBeforeMove);
        if (win !== null && move !== win) {
            return true;
        }
        return false;
    }

    function registerAdaptiveMissedBlock(move, stateBeforeMove) {
        const block = TicTacToeAdaptiveCore.findCritical("O", stateBeforeMove);
        if (block !== null && move !== block) {
            return true;
        }
        return false;
    }

    function registerAdaptiveForkSignals(move, stateBeforeMove) {
        if (TicTacToeAdaptiveCore.wouldFork(stateBeforeMove, "X", move)) {
            state.playerProfile.forksSeen += 1;
        }
    }

    function getAdaptiveHabitScore(move) {
        const favorite = state.playerProfile.favoriteCells[move] || 0;
        const opening = state.playerProfile.openingCells[move] || 0;
        const row = state.playerProfile.rowPreference[Math.floor(move / 3)] || 0;
        const col = state.playerProfile.colPreference[move % 3] || 0;
        const type = state.playerProfile.positionPreference[adaptiveCellType(move)] || 0;
        return favorite + opening + row * 0.35 + col * 0.35 + type * 0.5;
    }

    function adaptiveChooseFromCandidates(candidates) {
        if (!candidates.length) return null;
        const sorted = candidates
            .map(index => ({ index, score: getAdaptiveHabitScore(index) }))
            .sort((a, b) => b.score - a.score);
        const creativity = state.adaptiveAI.creativity;
        const limit = Math.max(1, Math.min(sorted.length, Math.ceil(sorted.length * (0.35 + creativity * 0.35))));
        const pool = sorted.slice(0, limit);
        return pool[Math.floor(Math.random() * pool.length)].index;
    }

    function getAdaptiveBestMove() {
        const free = TicTacToeAdaptiveCore.getFreeCells(cells);
        const curve = adaptiveCurve();
        const win = TicTacToeAdaptiveCore.findCritical("O", cells);
        if (win !== null) return win;
        const block = TicTacToeAdaptiveCore.findCritical("X", cells);
        if (block !== null) return block;

        const tacticsRoll = Math.random();
        const tacticChance = state.adaptiveAI.tactics * (0.12 + curve * 0.88);
        if (tacticsRoll < tacticChance) {
            const fork = free.find(i => TicTacToeAdaptiveCore.wouldFork(cells, "O", i));
            if (fork !== undefined) return fork;
            const antiFork = free.find(i => TicTacToeAdaptiveCore.wouldFork(cells, "X", i));
            if (antiFork !== undefined) return antiFork;
        }

        const habitRoll = Math.random();
        const habitChance = state.adaptiveAI.habitUsage * (0.06 + curve * 0.72);
        if (habitRoll < habitChance) {
            const habitMove = adaptiveChooseFromCandidates(free);
            if (habitMove !== null) return habitMove;
        }

        const opening = cells[4] === null
            ? 4
            : [0, 2, 6, 8].filter(index => cells[index] === null)[0] ?? null;
        const openingChance = (0.12 + curve * 0.48) * (0.55 + curve * 0.45);
        if (cells.filter(v => v !== null).length < 2 && opening !== null && Math.random() < openingChance) {
            return opening;
        }

        const bestMoves = TicTacToeAdaptiveCore.getBestMoves(cells, "O");
        if (!bestMoves.length) return free[0] ?? null;

        const accuracyChance = state.adaptiveAI.accuracy * (0.08 + curve * 0.84);
        if (Math.random() < accuracyChance) {
            const sorted = bestMoves
                .map(index => ({ index, habit: getAdaptiveHabitScore(index) }))
                .sort((a, b) => b.habit - a.habit);
            const windowSize = Math.max(1, Math.ceil(sorted.length * (0.25 + state.adaptiveAI.creativity * 0.35)));
            return sorted[Math.floor(Math.random() * windowSize)].index;
        }

        const imperfectPool = free.filter(i => !bestMoves.includes(i));
        if (imperfectPool.length) return imperfectPool[Math.floor(Math.random() * imperfectPool.length)];
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    function getBotMove() {
        return botAdaptive();
    }

    function botAdaptive() {
        const bestMove = getAdaptiveBestMove();
        const free = TicTacToeAdaptiveCore.getFreeCells(cells);
        if (bestMove === null || !Number.isInteger(bestMove) || !free.includes(bestMove)) {
            return free[0] ?? null;
        }

        if (state.adaptiveSkill >= 0.98) {
            return bestMove;
        }

        const curve = adaptiveCurve();
        const difficultyProfile = TicTacToeAdaptiveCore.getDifficultyProfile(getAdaptiveSkillValue());
        const skillFactor = 1 - curve;
        const styleFactor = (1 - state.adaptiveAI.accuracy) * 0.18 + (1 - state.adaptiveAI.tactics) * 0.08 + (1 - state.adaptiveAI.creativity) * 0.06;
        const errorChance = Math.max(
            0.02,
            Math.min(0.38, difficultyProfile.errorRate + state.adaptiveAI.mistakeChance * 0.12 + styleFactor * 0.35)
        );
        if (Math.random() < errorChance) {
            const imperfectPool = free.filter(i => i !== bestMove);
            if (imperfectPool.length) return imperfectPool[Math.floor(Math.random() * imperfectPool.length)];
        }

        return bestMove;
    }

    function updateAdaptiveAfterMatch(winner) {
        const rate = getLearningRate();
        const snap = state.adaptiveRoundSnapshot ?? {
            totalMoves: 0,
            mistakes: 0,
            missedBlocks: 0,
            missedWins: 0,
            forksSeen: 0,
            forksMissed: 0,
            tacticalGood: 0,
            tacticalBad: 0
        };
        const profileReady = state.playerProfile.totalMoves >= 12;
        const roundGood = profileReady ? Math.max(0, state.playerProfile.tacticalGood - snap.tacticalGood) : 0;
        const roundBad = profileReady ? Math.max(0, state.playerProfile.tacticalBad - snap.tacticalBad) : 0;
        const roundRisk = Math.max(
            0,
            profileReady
                ? (state.playerProfile.missedWins - snap.missedWins) +
                  (state.playerProfile.missedBlocks - snap.missedBlocks) +
                  (state.playerProfile.forksMissed - snap.forksMissed)
                : 0
        );

        let delta = 0;
        if (winner === "X") delta += 0.022;
        else if (winner === "O") delta -= 0.03;
        else delta += 0.003;

        delta += Math.max(-0.012, Math.min(0.012, (roundGood - roundBad) * 0.002));
        delta += Math.max(-0.01, Math.min(0.01, -roundRisk * 0.001));
        delta *= rate;

        state.adaptiveSkill = adaptiveClamp(state.adaptiveSkill + delta);
        state.adaptiveAI.accuracy = adaptiveClamp(state.adaptiveAI.accuracy + delta * 0.25);
        if (profileReady) {
            state.adaptiveAI.tactics = adaptiveClamp(state.adaptiveAI.tactics + (state.playerProfile.forksMissed * -0.001 + state.playerProfile.forksSeen * 0.0005) * rate);
            state.adaptiveAI.habitUsage = adaptiveClamp(state.adaptiveAI.habitUsage + (state.playerProfile.favoriteCells.reduce((a, b) => a + b, 0) > 0 ? 0.0008 * rate : 0));
        }
        state.adaptiveAI.mistakeChance = adaptiveClamp(state.adaptiveAI.mistakeChance + (winner === "X" ? -0.0015 : 0.0008) * rate);
        state.adaptiveAI.creativity = adaptiveClamp(state.adaptiveAI.creativity + (winner === "draw" ? 0.0015 : 0.0005) * rate);

        if (winner === "X") {
            state.playerProfile.style.aggressive += 0.6;
        } else if (winner === "O") {
            state.playerProfile.style.defensive += 0.4;
        } else {
            state.playerProfile.style.aggressive += 0.2;
            state.playerProfile.style.defensive += 0.2;
        }

        decayAdaptiveMemory();
    }

    function observePlayerMove(move, stateBeforeMove, player) {
        if (player !== "X") return;
        registerAdaptiveForkSignals(move, stateBeforeMove);
        const missedWin = registerAdaptiveMissedWin(move, stateBeforeMove);
        const missedBlock = registerAdaptiveMissedBlock(move, stateBeforeMove);
        if (missedWin || missedBlock) {
            state.playerProfile.mistakes += 1;
        } else {
            state.playerProfile.tacticalGood += 1;
        }
        if (missedWin || missedBlock) {
            state.playerProfile.forksMissed += 1;
        }
    }

    function beginRound({ full, roundNumber, totalRounds, current, enabled }) {
        if (!enabled) {
            state.adaptiveRoundStatus = "";
            state.adaptiveRoundSnapshot = null;
            return "";
        }

        state.adaptiveRoundStatus = "";
        captureAdaptiveRoundSnapshot();
        return getAdaptiveSkillValue();
    }

    function getRoundStatus() {
        return state.adaptiveRoundStatus;
    }

    window.AdaptiveBot = {
        beginRound,
        getRoundStatus,
        getSkillValue: getAdaptiveSkillValue,
        getBotMove,
        getBotDelay,
        observePlayerMove,
        updateAfterMatch: updateAdaptiveAfterMatch,
    };
})();
