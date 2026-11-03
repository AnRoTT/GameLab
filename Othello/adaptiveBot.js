const OthelloAdaptiveCore = window.OthelloAICore;

let adaptiveStrength = 35;
let adaptiveDrawStreak = 0;
let labState = null;
const ADAPTIVE_STORAGE_KEY = "andis-game-foundry-othello-adaptive";

function saveAdaptivePersistentState() {
    if (labState) return;
    try { localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify({ adaptiveStrength, adaptiveDrawStreak })); } catch (_) {}
}

function loadAdaptivePersistentState() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADAPTIVE_STORAGE_KEY) || "null");
        if (stored && Number.isFinite(stored.adaptiveStrength)) adaptiveStrength = Math.max(10, Math.min(100, stored.adaptiveStrength));
        if (stored && Number.isSafeInteger(stored.adaptiveDrawStreak) && stored.adaptiveDrawStreak >= 0) adaptiveDrawStreak = stored.adaptiveDrawStreak;
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
    // Unter zwölf beobachteten Spielerzügen bleibt nur die Profilkorrektur
    // neutral; das Rundenergebnis selbst wird trotzdem verarbeitet.
    const measuredPerformance = performance === null ? 50 : performance;
    const speedFactor = speed === "slow" ? 0.5 : speed === "fast" ? 1.5 : 1;
    const update = window.SharedDifficulty.applyAdaptiveResult(
        adaptiveStrength,
        profile?.lastResult || "draw",
        { performance: measuredPerformance, drawStreak: adaptiveDrawStreak, speedFactor }
    );
    adaptiveStrength = update.skill;
    adaptiveDrawStreak = update.drawStreak;
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
        ...window.OthelloSettings.difficulty,
        habitInfluence: window.OthelloSettings.adaptiveHabitInfluence,
        searchConfig: window.OthelloSettings.searchConfig
    });

    // Kompatibilitätsfeld für die adaptive Lernanpassung.
    return { ...difficulty, challenge: difficulty.curve };
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
        pieces: 0.5 + curve * 1.5,
        stability: 5 + curve * 15,
        potentialMobility: 2 + curve * 5
    };
    const depth = difficulty.depth;
    const habitBonus = move => core.othelloPlayerHabitBonus(move, labState ? null : profile, difficulty.habitInfluence);

    if (depth === 0 || Math.random() >= difficulty.searchChance || Math.random() < difficulty.errorRate) {
        const scored = moves.map(move => ({
            move,
            score: core.othelloScoreMove(state, move, player, null, weights) + habitBonus(move)
        })).sort((a, b) => b.score - a.score);
        return window.SharedDifficulty.selectSoftCandidate(scored, difficulty.curve, true)?.move || scored[0].move;
    }

    const randomness = Math.max(0, difficulty.randomChance * 35);
    return core.othelloChooseMinimaxMove(state, player, depth, randomness, weights, difficulty.curve, "soft", habitBonus) || moves[0];
}

function getAdaptiveBotThinkTime() {
    const challenge = getAdaptiveCurve(adaptiveStrength).challenge;
    const minimum = 300 + challenge * 900;
    const variation = 180 + (1 - challenge) * 220;
    return Math.round(minimum + Math.random() * variation);
}

function resetAdaptiveForLab(initialSkill = 35) {
    if (!labState) labState = { adaptiveStrength, adaptiveDrawStreak };
    adaptiveStrength = window.SharedDifficulty.clamp(Number(initialSkill) || 35, 10, 100);
    adaptiveDrawStreak = 0;
}

function finishAdaptiveLab() {
    if (!labState) return;
    ({ adaptiveStrength, adaptiveDrawStreak } = labState);
    labState = null;
}

function clearAdaptivePersistentState(initialSkill = 35) {
    labState = null;
    try { localStorage.removeItem(ADAPTIVE_STORAGE_KEY); } catch (_) {}
    resetAdaptiveForLab(initialSkill);
    labState = null;
    saveAdaptivePersistentState();
}

function recordAdaptiveLabResult(result, opponentPerformance = 50) {
    const performance = labState ? 50 : Math.max(0, Math.min(100, Number(opponentPerformance) || 50));
    const update = window.SharedDifficulty.applyAdaptiveResult(adaptiveStrength, result, {
        performance,
        drawStreak: adaptiveDrawStreak
    });
    adaptiveStrength = update.skill;
    adaptiveDrawStreak = update.drawStreak;
    saveAdaptivePersistentState();
    return Math.round(adaptiveStrength);
}

window.OthelloAdaptiveBot = {
    getBotMove: getAdaptiveBotMove,
    getSkill: getAdaptiveStrength,
    resetForLab: resetAdaptiveForLab,
    finishLab: finishAdaptiveLab,
    clearPersistentState: clearAdaptivePersistentState,
    recordLabResult: recordAdaptiveLabResult
};
