const OthelloAdaptiveCore = window.OthelloAICore;

let adaptiveStrength = 35;
const ADAPTIVE_STORAGE_KEY = "andis-game-foundry-othello-adaptive";

function saveAdaptivePersistentState() {
    try { localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify({ adaptiveStrength })); } catch (_) {}
}

function loadAdaptivePersistentState() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADAPTIVE_STORAGE_KEY) || "null");
        if (stored && Number.isFinite(stored.adaptiveStrength)) adaptiveStrength = Math.max(1, Math.min(100, stored.adaptiveStrength));
    } catch (_) {}
}
loadAdaptivePersistentState();

function calculatePlayerPerformance(profile) {
    if (!profile) return 50;
    const baseline = profile.adaptiveBaseline || {
        movesPlayed: 0, missedWins: 0, missedBlocks: 0,
        restrictedOpponentMoves: 0, openedOpponentMoves: 0, riskyMoves: 0
    };
    const moves = Math.max(1, profile.movesPlayed - baseline.movesPlayed);
    const observedMoves = profile.movesPlayed - baseline.movesPlayed;
    if (observedMoves < 12) return null;
    const missedWins = profile.mistakes.missedWins - baseline.missedWins;
    const missedBlocks = profile.mistakes.missedBlocks - baseline.missedBlocks;
    const restricted = profile.mobility.restrictedOpponentMoves - baseline.restrictedOpponentMoves;
    const opened = profile.mobility.openedOpponentMoves - baseline.openedOpponentMoves;
    const risky = profile.risk.riskyMoves - baseline.riskyMoves;

    profile.adaptiveBaseline = {
        movesPlayed: profile.movesPlayed,
        missedWins: profile.mistakes.missedWins,
        missedBlocks: profile.mistakes.missedBlocks,
        restrictedOpponentMoves: profile.mobility.restrictedOpponentMoves,
        openedOpponentMoves: profile.mobility.openedOpponentMoves,
        riskyMoves: profile.risk.riskyMoves
    };

    let score = 50;
    score += (restricted / moves) * 25;
    score -= (opened / moves) * 25;
    score -= (missedWins / moves) * 35;
    score -= (missedBlocks / moves) * 25;
    score -= (risky / moves) * 10;
    return Math.max(0, Math.min(100, score));
}

function startAdaptiveRound(profile, speed = "normal") {
    // Der Bot passt sich an das Spielniveau des Spielers an:
    // Ein Spielersieg verlangt mehr Herausforderung, ein Bot-Sieg weniger.
    const performance = calculatePlayerPerformance(profile);
    // Erst ab zwölf beobachteten Spielerzügen ist das Profil aussagekräftig.
    if (performance === null) return adaptiveStrength;
    let adjustment;

    if (profile?.lastResult === "playerWin") {
        // Gewinnt der Spieler trotz schwacher Züge, war der Bot zu schwach.
        // Gewinnt er stark, wird die Herausforderung nur leicht erhöht.
        adjustment = 4 + (50 - performance) * 0.08;
    } else if (profile?.lastResult === "botWin") {
        // Spielt der Spieler gut und verliert trotzdem, war der Bot zu stark.
        // Bei schwacher Spielweise wird er deutlicher zurückgenommen.
        adjustment = -4 - (performance - 50) * 0.08;
    } else {
        // Bei einem Remis zählt nur die beobachtete Spielqualität.
        adjustment = (performance - 50) * 0.04;
    }

    const speedFactor = speed === "slow" ? 0.5 : speed === "fast" ? 1.5 : 1;
    const lowerSkillBoost = 1.25 - getAdaptiveCurve(adaptiveStrength).challenge * 0.25;
    const scaledAdjustment = Math.max(-6, Math.min(6, adjustment * speedFactor * lowerSkillBoost));
    adaptiveStrength = Math.max(1, Math.min(100, adaptiveStrength + scaledAdjustment));
    saveAdaptivePersistentState();
    return adaptiveStrength;
}

function getAdaptiveStrength() {
    return adaptiveStrength;
}

function getAdaptiveCurve(skill) {
    const difficulty = window.SharedDifficulty.createProfile({
        mode: "adaptive",
        skill,
        searchConfig: {
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 4,
            fixedDepth: null
        },
        habitInfluence: 1
    });

    // Kompatibilitätsfeld für die adaptive Lernanpassung.
    return { ...difficulty, challenge: difficulty.curve };
}

function getAdaptiveSearchPlan(skill) {
    const difficulty = getAdaptiveCurve(skill);
    return {
        depth: difficulty.depth,
        nextDepth: Math.min(difficulty.maxDepth, difficulty.depth + 1),
        upgradeChance: 0,
        difficulty
    };
}

function getAdaptiveSearchDepth(skill) {
    const plan = getAdaptiveSearchPlan(skill);
    return Math.random() < plan.upgradeChance ? plan.nextDepth : plan.depth;
}

function getAdaptiveBotMove(state, player = "white", profile = null) {
    const core = OthelloAdaptiveCore;
    const moves = core.getAllValidMovesForState(player, state);
    if (!moves.length) return null;
    const difficulty = getAdaptiveCurve(adaptiveStrength);
    const curve = difficulty.curve;
    const weights = {
        position: 0.8 + curve * 1.0,
        mobility: 5 + curve * 14,
        pieces: 0.5 + curve * 1.5
    };
    const depth = difficulty.depth;

    if (depth === 0 && difficulty.randomChance > 0.70) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    if (depth === 0) {
        const scored = moves.map(move => ({
            move,
            score: core.othelloScoreMove(state, move, player, null, weights)
        })).sort((a, b) => b.score - a.score);
        const count = Math.max(1, Math.ceil(scored.length * (0.16 + difficulty.randomChance)));
        return scored[Math.floor(Math.random() * count)].move;
    }

    const randomness = Math.max(0, difficulty.randomChance * 35);
    return core.othelloChooseMinimaxMove(state, player, depth, randomness, weights) || moves[0];
}

function getAdaptiveBotThinkTime() {
    const challenge = getAdaptiveCurve(adaptiveStrength).challenge;
    const minimum = 300 + challenge * 900;
    const variation = 180 + (1 - challenge) * 220;
    return Math.round(minimum + Math.random() * variation);
}

function resetAdaptiveForLab(initialSkill = 35) {
    adaptiveStrength = Math.max(1, Math.min(100, Number(initialSkill) || 35));
    saveAdaptivePersistentState();
}

function clearAdaptivePersistentState(initialSkill = 35) {
    try { localStorage.removeItem(ADAPTIVE_STORAGE_KEY); } catch (_) {}
    resetAdaptiveForLab(initialSkill);
}

function recordAdaptiveLabResult(result, opponentPerformance = 50) {
    const performance = Math.max(0, Math.min(100, Number(opponentPerformance) || 50));
    let adjustment = 0;
    if (result === "playerWin") adjustment = 4 + (performance - 50) * 0.04;
    if (result === "botWin") adjustment = -4 + (performance - 50) * 0.04;
    if (result === "draw") adjustment = (performance - 50) * 0.02;
    const lowerSkillBoost = 1.25 - getAdaptiveCurve(adaptiveStrength).challenge * 0.25;
    adaptiveStrength = Math.max(1, Math.min(100, adaptiveStrength + adjustment * lowerSkillBoost));
    saveAdaptivePersistentState();
    return Math.round(adaptiveStrength);
}

window.OthelloAdaptiveBot = {
    getBotMove: getAdaptiveBotMove,
    getSkill: getAdaptiveStrength,
    resetForLab: resetAdaptiveForLab,
    clearPersistentState: clearAdaptivePersistentState,
    recordLabResult: recordAdaptiveLabResult
};
