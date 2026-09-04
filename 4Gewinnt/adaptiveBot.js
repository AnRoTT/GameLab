(function () {
"use strict";

var adaptiveSkill = 35;
var adaptiveMomentum = 0;
var adaptiveMoveCounter = 0;
var adaptiveRoundDelta = 0;
var adaptiveLearn = {
    skill: 35,
    roundForm: 0,
    resultBias: 0,
    matchTrend: 0,
    winStreak: 0,
    lossStreak: 0,
    drawStreak: 0,
    resultHistory: [],
    lastBotCol: -1,
    lastUiMove: 0,
    uiText: "Bot beobachtet erst einmal ruhig",
    memory: {
        favoriteColumns: Array(7).fill(0),
        openingStyle: 0,
        midgameStyle: 0,
        endgameStyle: 0,
        pressureResponse: 0,
        missedWins: 0,
        forks: 0,
        mistakes: 0,
        tempo: 0
    }
};
var adaptiveAI = {
    accuracy: 0.60,
    tactics: 0.52,
    habitUsage: 0.38,
    mistakeChance: 0.12,
    creativity: 0.42
};
const ADAPTIVE_STORAGE_KEY = "andis-game-foundry-4gewinnt-adaptive";

function saveAdaptivePersistentState() {
    try {
        localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify({
            adaptiveSkill, adaptiveMomentum, adaptiveMoveCounter, adaptiveRoundDelta,
            adaptiveLearn, adaptiveAI
        }));
    } catch (_) {}
}

function loadAdaptivePersistentState() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADAPTIVE_STORAGE_KEY) || "null");
        if (!stored) return;
        if (Number.isFinite(stored.adaptiveSkill)) adaptiveSkill = Math.max(10, Math.min(100, stored.adaptiveSkill));
        if (Number.isFinite(stored.adaptiveMomentum)) adaptiveMomentum = stored.adaptiveMomentum;
        if (Number.isFinite(stored.adaptiveMoveCounter)) adaptiveMoveCounter = stored.adaptiveMoveCounter;
        if (Number.isFinite(stored.adaptiveRoundDelta)) adaptiveRoundDelta = stored.adaptiveRoundDelta;
        if (stored.adaptiveLearn && typeof stored.adaptiveLearn === "object") {
            adaptiveLearn = {
                ...adaptiveLearn,
                ...stored.adaptiveLearn,
                memory: { ...adaptiveLearn.memory, ...(stored.adaptiveLearn.memory || {}) },
                resultHistory: Array.isArray(stored.adaptiveLearn.resultHistory)
                    ? stored.adaptiveLearn.resultHistory
                    : adaptiveLearn.resultHistory
            };
        }
        if (stored.adaptiveAI && typeof stored.adaptiveAI === "object") {
            adaptiveAI = { ...adaptiveAI, ...stored.adaptiveAI };
        }
    } catch (_) {}
}
loadAdaptivePersistentState();

// Fallbacks for the isolated BotLab context. The normal game still provides
// these constants through game.js.
const ADAPTIVE_PLAYER_RED = typeof PLAYER_RED !== "undefined" ? PLAYER_RED : 1;
const ADAPTIVE_PLAYER_YELLOW = typeof PLAYER_YELLOW !== "undefined" ? PLAYER_YELLOW : 2;
const ADAPTIVE_COLS = typeof COLS !== "undefined" ? COLS : 7;

// Das Spielerprofil wird zentral in aiCore.js angelegt. Die alten deutschen
// Feldnamen sind dort nur noch kompatible Verweise auf dieselben Werte.
const playerProfile = window.connectFourPlayerProfile;
let adaptiveLabBoard = null;

function getAdaptiveBoard() {
    return adaptiveLabBoard || (typeof board !== "undefined" ? board : null);
}

function adaptiveRandomMove() {
    const columns = window.ConnectFourAICore.getAvailableColumns(getAdaptiveBoard());
    return columns.length ? columns[Math.floor(Math.random() * columns.length)] : -1;
}

function adaptiveFreeRow(col) {
    return window.ConnectFourAICore.getFreeRow(getAdaptiveBoard(), col);
}

function adaptiveHasWinner(player) {
    return window.ConnectFourAICore.hasWinner(getAdaptiveBoard(), player);
}

function adaptiveMinimaxMove(depth) {
    const result = window.ConnectFourAICore.minimax(
        getAdaptiveBoard(),
        depth,
        true,
        ADAPTIVE_PLAYER_YELLOW,
        ADAPTIVE_PLAYER_RED
    );
    return result.col ?? -1;
}

function adaptiveClamp(v) {
    return Math.max(0, Math.min(1, v));
}

function adaptiveSignedClamp(v, limit = 1) {
    return Math.max(-limit, Math.min(limit, v));
}

function adaptiveLerp(current, target, factor) {
    return current + (target - current) * factor;
}

function adaptiveCurve(skill) {
    return window.ConnectFourAICore.getDifficultyProfile(typeof skill === "number" ? skill : 48);
}

function getAdaptiveStrengthGate(skillValue) {
    return adaptiveClamp((skillValue - 60) / 25);
}

function getAdaptivePlayerSkillEstimate() {
    const coreProfile = window.connectFourPlayerProfile;
    const totalMoves = Math.max(1, coreProfile?.totalMoves ?? playerProfile.gesamtZuege);
    if (totalMoves < 12) return 50;
    const patternScore = coreProfile
        ? (coreProfile.tactics.missedWins + coreProfile.tactics.forks * 1.15 + coreProfile.style.offensive * 0.16) / totalMoves
        : (playerProfile.hatGewinnzugVerpasst + playerProfile.gingInGabel * 1.15 + playerProfile.angriffsZuege * 0.16) / totalMoves;
    const pressureScore = coreProfile
        ? (coreProfile.tactics.pressureMoves * 0.4 + coreProfile.style.offensive * 0.2) / totalMoves
        : (playerProfile.druckVerlaesst + playerProfile.druckZuege * 0.4) / totalMoves;
    const phaseScore = coreProfile
        ? (coreProfile.phases.opening * 0.15 + coreProfile.phases.midgame * 0.33 + coreProfile.phases.endgame * 0.52) / totalMoves
        : (playerProfile.eroeffnungZuege * 0.15 + playerProfile.mittelspielZuege * 0.33 + playerProfile.endspielZuege * 0.52) / totalMoves;
    const resultTrend = adaptiveLearn.resultBias;
    const roundTrend = adaptiveLearn.roundForm;

    const rawSkill = 0.24
        + patternScore * 0.20
        + pressureScore * 0.14
        + phaseScore * 0.08
        + resultTrend * 0.12
        + roundTrend * 0.10;

    return Math.max(0, Math.min(100, rawSkill * 100));
}

function getAdaptiveBotSkillValue() {
    return Math.max(0, Math.min(100, adaptiveSkill));
}

function getAdaptiveBotSkillBand() {
    const skill = getAdaptiveBotSkillValue();
    if (skill <= 20) return "low";
    if (skill <= 40) return "mid";
    if (skill <= 60) return "adapted";
    if (skill <= 85) return "strong";
    return "ruthless";
}

function resetAdaptiveState() {
    adaptiveMomentum = 0;
    adaptiveMoveCounter = 0;
    adaptiveRoundDelta = 0;
    adaptiveLearn = {
        skill: 35,
        roundForm: 0,
        resultBias: 0,
        matchTrend: 0,
        winStreak: 0,
        lossStreak: 0,
        drawStreak: 0,
        resultHistory: [],
        lastBotCol: -1,
        lastUiMove: 0,
        uiText: "Bot beobachtet erst einmal ruhig",
        memory: {
            favoriteColumns: Array(7).fill(0),
            openingStyle: 0,
            midgameStyle: 0,
            endgameStyle: 0,
            pressureResponse: 0,
            missedWins: 0,
            forks: 0,
            mistakes: 0,
            tempo: 0
        }
    };
    adaptiveLearn.skill = adaptiveSkill;
    adaptiveAI = {
        accuracy: 0.60,
        tactics: 0.52,
        habitUsage: 0.38,
        mistakeChance: 0.12,
        creativity: 0.42
    };
    window.ConnectFourAICore.resetPlayerProfile(playerProfile);
}

function getAdaptivePhase() {
    const moves = playerProfile.gesamtZuege;
    if (moves <= 6) return "eröffnung";
    if (moves <= 18) return "mittelspiel";
    return "endspiel";
}

function getAdaptiveLearningStage() {
    const moves = playerProfile.gesamtZuege;
    if (moves < 12) return "observe";
    if (moves < 20) return "learn";
    return "apply";
}

function getAdaptiveThinkTime() {
    const stage = getAdaptiveLearningStage();
    const skillValue = adaptiveSkill;
    const curve = adaptiveCurve(skillValue);

    const baseTime = 260 + curve.smooth * 990;

    if (stage === "observe") baseTime *= 0.78;
    else if (stage === "learn") baseTime *= 0.95;
    else baseTime *= 1.08;

    if (adaptiveLearn.roundForm > 0.6) baseTime += 120;
    if (adaptiveLearn.resultBias > 0.6) baseTime += 90;
    if (adaptiveLearn.memory.mistakes > 0.5) baseTime -= 70;

    return Math.max(120, Math.round(baseTime));
}

function getAdaptiveSearchDepth() {
    const skillValue = adaptiveSkill;
    const curve = adaptiveCurve(skillValue);
    return curve.depth;
}

// Liefert fuer jede Skillzahl einen stetigen Faktor zwischen 0 und 1.
// Die vorhandene nichtlineare Kurve wird nur unterschiedlich stark gewichtet;
// feste Umschaltpunkte gibt es fuer adaptive Entscheidungsanteile nicht.
function getContinuousStrengthFactor(skillValue, exponent = 1) {
    const smooth = adaptiveClamp(adaptiveCurve(skillValue).smooth);
    return Math.pow(smooth, exponent);
}

function getAdaptiveStochasticity(skillBand, stage) {
    const skillValue = adaptiveSkill;
    const curve = adaptiveCurve(skillValue);
    return curve.randomChance;
}

function pickAdaptiveSentence(options) {
    return options[Math.floor(Math.random() * options.length)];
}

function getPlayerSkillBand() {
    const skill = getAdaptivePlayerSkillEstimate();
    if (skill <= 15) return "low";
    if (skill <= 35) return "mid";
    if (skill <= 60) return "adapted";
    if (skill <= 82) return "strong";
    return "ruthless";
}

function buildAdaptiveLeadText(stage, skillBand) {
    const skillValue = getAdaptivePlayerSkillEstimate();
    if (stage === "observe") {
        if (skillBand === "ruthless") return "Bot prüft dein Spiel kompromisslos";
        if (skillBand === "strong") return "Bot prüft dein Spiel sehr genau";
        if (skillBand === "adapted") return skillValue <= 48 ? "Bot beobachtet dein Spiel vorsichtig" : "Bot beobachtet dein Spiel aufmerksam";
        return "Bot beobachtet erst einmal ruhig";
    }

    if (stage === "learn") {
        if (skillBand === "ruthless") return "Bot liest dein Spiel kompromisslos";
        if (skillBand === "strong") return "Bot liest dein Spiel deutlich genauer";
        if (skillBand === "adapted") return skillValue <= 48 ? "Bot lernt dein Spiel erst langsam" : "Bot lernt dein Spiel schrittweise";
        return "Bot erkennt erste Gewohnheiten";
    }

    if (skillBand === "ruthless") return "Bot nutzt dein Muster kompromisslos";
    if (skillBand === "strong") return "Bot nutzt dein Muster sehr gezielt";
    if (skillBand === "adapted") return skillValue <= 48 ? "Bot setzt dein Muster vorsichtig ein" : "Bot setzt dein Muster jetzt gezielt ein";
    return "Bot setzt dein Muster jetzt vorsichtig ein";
}

function buildAdaptiveTailText(phase, skillBand) {
    const skillValue = getAdaptivePlayerSkillEstimate();
    const opening = [
        "bleibt in der Eröffnung ruhig",
        "beobachtet die Eröffnung eher ruhig",
        "hält sich in der Eröffnung zurück"
    ];
    const middle = [
        "liest dein Mittelspiel",
        "reagiert im Aufbau gezielter",
        "passt sich im Mittelspiel weiter an"
    ];
    const end = [
        "bleibt im Endspiel wach",
        "nutzt bekannte Muster im Endspiel",
        "spielt im Endspiel direkter"
    ];

    if (skillBand === "low") {
        return pickAdaptiveSentence([
            phase === "eröffnung" ? "bleibt in der Eröffnung ruhig" : "spielt noch eher zurückhaltend",
            phase === "mittelspiel" ? "reagiert im Aufbau vorsichtig" : "hält sich bewusst zurück",
            "testet dein Verhalten noch"
        ]);
    }

    if (skillBand === "mid") {
        return pickAdaptiveSentence(phase === "eröffnung" ? opening : phase === "mittelspiel" ? middle : end);
    }

    if (skillBand === "adapted") {
        if (skillValue <= 48) {
            return pickAdaptiveSentence([
                phase === "eröffnung" ? "tastet sich an deine Eröffnung heran" : "reagiert noch vorsichtig auf deine Züge",
                phase === "mittelspiel" ? "liest dein Mittelspiel nur teilweise" : "passt sein Spiel langsam an",
                "spielt noch mit etwas Zurückhaltung"
            ]);
        }
        return pickAdaptiveSentence([
            phase === "eröffnung" ? "tastet sich an deine Eröffnung heran" : "reagiert flexibel auf deine Züge",
            phase === "mittelspiel" ? "liest dein Mittelspiel recht gut" : "nutzt dein Verhalten gezielt",
            "spielt angepasst und stabil"
        ]);
    }

    if (skillBand === "strong") {
        return pickAdaptiveSentence([
            phase === "eröffnung" ? "beobachtet deine Eröffnung sehr genau" : "zieht im Spiel klar an",
            phase === "mittelspiel" ? "setzt dein Verhalten direkt ein" : "blockt Muster frühzeitig",
            "spielt taktisch stark"
        ]);
    }

    return pickAdaptiveSentence([
        phase === "eröffnung" ? "nimmt deine Eröffnung kompromisslos auseinander" : "spielt sehr konsequent",
        phase === "mittelspiel" ? "setzt Muster kompromisslos ein" : "blockt früh und direkt",
        "spielt kompromisslos"
    ]);
}

function getAdaptiveLevelText(skillBand) {
    const skillValue = getAdaptivePlayerSkillEstimate();
    if (skillBand === "low") return "spielt vorsichtig";
    if (skillBand === "mid") return "spielt solide";
    if (skillBand === "adapted") return skillValue <= 48 ? "spielt vorsichtig angepasst" : "spielt angepasst";
    if (skillBand === "strong") return "spielt taktisch stark";
    return "spielt kompromisslos";
}

function getAdaptiveUiState() {
    const stage = getAdaptiveLearningStage();
    const phase = getAdaptivePhase();
    const observeTexts = [
        "Bot beobachtet erst einmal ruhig",
        "Bot sammelt gerade nur Muster",
        "Bot tastet dich noch ab"
    ];
    const learnTexts = [
        "Bot erkennt erste Gewohnheiten",
        "Bot lernt dein Spiel schrittweise",
        "Bot prüft deine typischen Züge"
    ];
    const applyTexts = [
        "Bot setzt dein Muster jetzt gezielt ein",
        "Bot reagiert nun konkreter auf dich",
        "Bot spielt mit deutlich mehr Bezug zu dir"
    ];
    const openingTexts = [
        "Bot tastet sich in die Eröffnung",
        "Bot bleibt in der Eröffnung noch ruhig",
        "Bot beobachtet die ersten Züge genau"
    ];
    const midgameTexts = [
        "Bot liest dein Mittelspiel",
        "Bot reagiert im Aufbau gezielter",
        "Bot zieht im Mittelspiel leicht an"
    ];
    const endgameTexts = [
        "Bot bleibt im Endspiel wach",
        "Bot nutzt bekannte Muster im Endspiel",
        "Bot spielt im Endspiel direkter"
    ];

    let text = adaptiveLearn.uiText;
    if (!text) {
        const skillBand = getPlayerSkillBand();
        text = `${buildAdaptiveLeadText(stage, skillBand)}, ${getAdaptiveLevelText(skillBand)} und ${buildAdaptiveTailText(phase, skillBand)}`;
        adaptiveLearn.uiText = text;
        adaptiveLearn.lastUiMove = playerProfile.gesamtZuege;
    }

    return { phase, text };
}

function decayAdaptiveMemory() {
    const keep = 0.985;
    playerProfile.spalten = playerProfile.spalten.map(v => v * keep);
    playerProfile.ersterZugMitte *= keep;
    playerProfile.ersterZugEcke *= keep;
    playerProfile.ersterZugRand *= keep;
    playerProfile.eroeffnungZuege *= keep;
    playerProfile.mittelspielZuege *= keep;
    playerProfile.endspielZuege *= keep;
    playerProfile.gingInGabel *= keep;
    playerProfile.hatGewinnzugVerpasst *= keep;
    playerProfile.druckZuege *= keep;
    playerProfile.druckVerlaesst *= keep;
    playerProfile.defensivZuege *= keep;
    playerProfile.offensivZuege *= keep;
    playerProfile.angriffsZuege *= keep;

    adaptiveLearn.memory.favoriteColumns = adaptiveLearn.memory.favoriteColumns.map(v => v * 0.99);
    adaptiveLearn.memory.openingStyle *= 0.985;
    adaptiveLearn.memory.midgameStyle *= 0.987;
    adaptiveLearn.memory.endgameStyle *= 0.988;
    adaptiveLearn.memory.pressureResponse *= 0.99;
    adaptiveLearn.memory.missedWins *= 0.98;
    adaptiveLearn.memory.forks *= 0.98;
    adaptiveLearn.memory.mistakes *= 0.985;
    adaptiveLearn.memory.tempo *= 0.99;
    adaptiveLearn.roundForm *= 0.96;
    adaptiveLearn.resultBias *= 0.97;
}

function getFavoritePlayerColumn() {
    if (playerProfile.totalMoves <= 0) return null;
    const bestValue = Math.max(...playerProfile.favoriteColumns);
    return bestValue > 0
        ? playerProfile.favoriteColumns.indexOf(bestValue)
        : null;
}

function updateAdaptiveAfterMatch(resultSign) {
    const stage = getAdaptiveLearningStage();
    const totalMoves = Math.max(1, playerProfile.gesamtZuege);
    const patternScore = (playerProfile.hatGewinnzugVerpasst + playerProfile.gingInGabel * 1.2 + playerProfile.angriffsZuege * 0.2) / totalMoves;
    const openingBias = (playerProfile.ersterZugMitte + playerProfile.ersterZugEcke + playerProfile.ersterZugRand) > 0
        ? (playerProfile.ersterZugMitte * 0.4 + playerProfile.ersterZugEcke * 0.35 + playerProfile.ersterZugRand * 0.25) / totalMoves
        : 0;
    const pressureScore = (playerProfile.druckVerlaesst + playerProfile.druckZuege * 0.4) / totalMoves;
    const stanceScore = (playerProfile.defensivZuege * 0.45 + playerProfile.offensivZuege * 0.55) / totalMoves;
    const phaseScore = (playerProfile.eroeffnungZuege * 0.2 + playerProfile.mittelspielZuege * 0.35 + playerProfile.endspielZuege * 0.45) / totalMoves;
    const favoriteCol = getFavoritePlayerColumn();

    const targetAccuracy = adaptiveClamp(0.56 + resultSign * 0.03 + patternScore * 0.01 + pressureScore * 0.004);
    const targetTactics = adaptiveClamp(0.48 + resultSign * 0.03 + patternScore * 0.014 + phaseScore * 0.01 + (playerProfile.gingInGabel / Math.max(1, playerProfile.spieleGegenBot)) * 0.008);
    const targetHabitUsage = adaptiveClamp(0.34 + openingBias * 0.01 + (favoriteCol !== null ? 0.006 : 0));
    const targetMistakeChance = adaptiveClamp(0.16 - resultSign * 0.03 - pressureScore * 0.002);
    const targetCreativity = adaptiveClamp(0.38 + (resultSign === 0 ? 0.003 : resultSign > 0 ? 0.008 : -0.01) + phaseScore * 0.003 + stanceScore * 0.001);

    const stageFactor = stage === "observe" ? 0.12 : stage === "learn" ? 0.28 : 0.5;

    if (resultSign > 0) {
        adaptiveLearn.winStreak += 1;
        adaptiveLearn.lossStreak = 0;
        adaptiveLearn.matchTrend = adaptiveSignedClamp(adaptiveLearn.matchTrend + 0.26);
    } else if (resultSign < 0) {
        adaptiveLearn.lossStreak += 1;
        adaptiveLearn.winStreak = 0;
        adaptiveLearn.matchTrend = adaptiveSignedClamp(adaptiveLearn.matchTrend - 0.30);
    } else {
        adaptiveLearn.winStreak = Math.max(0, adaptiveLearn.winStreak - 1);
        adaptiveLearn.lossStreak = Math.max(0, adaptiveLearn.lossStreak - 1);
        adaptiveLearn.matchTrend *= 0.92;
    }

    adaptiveAI.accuracy = adaptiveClamp(adaptiveLerp(adaptiveAI.accuracy, targetAccuracy, 0.18 * stageFactor));
    adaptiveAI.tactics = adaptiveClamp(adaptiveLerp(adaptiveAI.tactics, targetTactics, 0.16 * stageFactor));
    adaptiveAI.habitUsage = adaptiveClamp(adaptiveLerp(adaptiveAI.habitUsage, targetHabitUsage, 0.14 * stageFactor));
    adaptiveAI.mistakeChance = adaptiveClamp(adaptiveLerp(adaptiveAI.mistakeChance, targetMistakeChance, 0.16 * stageFactor));
    adaptiveAI.creativity = adaptiveClamp(adaptiveLerp(adaptiveAI.creativity, targetCreativity, 0.10 * stageFactor));
    adaptiveLearn.roundForm = adaptiveSignedClamp(adaptiveLearn.roundForm + (patternScore * 0.06 + pressureScore * 0.04 + phaseScore * 0.02) * stageFactor + (resultSign > 0 ? 0.015 : resultSign < 0 ? -0.04 : -0.01));
    adaptiveLearn.resultBias = adaptiveSignedClamp(adaptiveLearn.resultBias + (resultSign > 0 ? 0.09 : resultSign < 0 ? -0.14 : -0.025) * stageFactor);

    decayAdaptiveMemory();
}

function getAdaptiveSkillFromProfile() {
    const stage = getAdaptiveLearningStage();
    const totalMoves = Math.max(1, playerProfile.gesamtZuege);
    if (totalMoves < 12) return 50;
    const curve = adaptiveCurve(getAdaptivePlayerSkillEstimate());
    const patternScore = (playerProfile.hatGewinnzugVerpasst + playerProfile.gingInGabel * 1.1 + playerProfile.angriffsZuege * 0.15) / totalMoves;
    const pressureScore = (playerProfile.druckVerlaesst + playerProfile.druckZuege * 0.35) / totalMoves;
    const phaseScore = (playerProfile.eroeffnungZuege * 0.15 + playerProfile.mittelspielZuege * 0.3 + playerProfile.endspielZuege * 0.55) / totalMoves;
    const favoriteCol = getFavoritePlayerColumn();

    const learnedStrength = 0.32
        + patternScore * adaptiveLerp(0.05, 0.12, curve.smooth)
        + pressureScore * adaptiveLerp(0.03, 0.08, curve.smooth)
        + phaseScore * adaptiveLerp(0.02, 0.06, curve.smooth)
        + (favoriteCol !== null ? adaptiveLerp(0.01, 0.03, curve.smooth) : 0)
        + adaptiveAI.tactics * adaptiveLerp(0.02, 0.045, curve.smooth)
        + adaptiveAI.accuracy * adaptiveLerp(0.02, 0.04, curve.smooth)
        + adaptiveLearn.roundForm * adaptiveLerp(0.03, 0.05, curve.smooth)
        + adaptiveLearn.resultBias * adaptiveLerp(0.04, 0.06, curve.smooth)
        + adaptiveLearn.matchTrend * adaptiveLerp(0.10, 0.18, curve.smooth)
        + (adaptiveLearn.winStreak > 0 ? Math.min(0.08, adaptiveLearn.winStreak * 0.015) : 0)
        - (adaptiveLearn.lossStreak > 0 ? Math.min(0.14, adaptiveLearn.lossStreak * 0.03) : 0)
        + (stage === "observe" ? -0.12 : stage === "learn" ? -0.06 : 0.02);

    return Math.max(0, Math.min(100, learnedStrength * 100));
}

function getAdaptiveTargetSkill() {
    const curve = adaptiveCurve(getAdaptivePlayerSkillEstimate());
    const totalMoves = Math.max(1, playerProfile.gesamtZuege);
    if (totalMoves < 12) return adaptiveSkill;
    const profilePressure = (playerProfile.druckZuege + playerProfile.offensivZuege * 1.2 + playerProfile.gingInGabel * 1.5) / totalMoves;
    const profileWeakness = (playerProfile.defensivZuege + playerProfile.hatGewinnzugVerpasst * 1.2) / totalMoves;
    const profileBalance = (playerProfile.eroeffnungZuege * 0.15 + playerProfile.mittelspielZuege * 0.35 + playerProfile.endspielZuege * 0.50) / totalMoves;
    const playerSkillValue = getAdaptivePlayerSkillEstimate();
    const learnedSkill = getAdaptiveSkillFromProfile() / 100;
    const responseGate = adaptiveClamp((adaptiveSkill - 45) / 25);
    const learnedWeight = adaptiveLerp(0.10, 0.18, responseGate);
    const trendWeight = adaptiveLerp(0.16, 0.26, responseGate);
    const winWeight = adaptiveLerp(0.06, 0.12, responseGate);
    const lossWeight = adaptiveLerp(0.18, 0.28, responseGate);

    const rawTarget = 0.10
        + curve.smooth * 0.24
        + (playerSkillValue / 100) * 0.07
        + profilePressure * 0.04
        - profileWeakness * 0.08
        + profileBalance * 0.02
        + learnedSkill * learnedWeight
        + adaptiveLearn.matchTrend * trendWeight
        + (adaptiveLearn.winStreak > 0 ? Math.min(0.10, adaptiveLearn.winStreak * winWeight) : 0)
        - (adaptiveLearn.lossStreak > 0 ? Math.min(0.20, adaptiveLearn.lossStreak * lossWeight) : 0);

    return Math.max(0, Math.min(100, rawTarget * 100));
}

function getAdaptiveBotMove() {
    const board = getAdaptiveBoard();
    const stage = getAdaptiveLearningStage();
    const skillBand = getAdaptiveBotSkillBand();
    const skillValue = adaptiveSkill;
    const curve = adaptiveCurve(skillValue);
    const learnedStrength = getAdaptiveSkillFromProfile();
    const favoriteCol = getFavoritePlayerColumn();
    const depth = getAdaptiveSearchDepth();
    const applyFactor = stage === "observe" ? 0.10 : stage === "learn" ? 0.26 : 0.58;
    const stochasticity = getAdaptiveStochasticity(skillBand, stage);
    const strengthBlend = curve.smooth;
    const learningGate = getContinuousStrengthFactor(skillValue, 1.0);
    const earlyMistakeChance = Math.max(0.02, Math.min(0.58,
        curve.errorRate * (stage === "observe" ? 1.25 : stage === "learn" ? 1.05 : 0.9)
    ));

    if (Math.random() < earlyMistakeChance) {
        const randomCol = adaptiveRandomMove();
        if (randomCol !== -1) {
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= adaptiveLerp(1, 0, strengthBlend);
            adaptiveLearn.lastBotCol = randomCol;
        }
        return randomCol;
    }

    const directWin = window.ConnectFourAICore.findImmediateWinningMove(board, ADAPTIVE_PLAYER_YELLOW);
    if (directWin !== -1) {
        adaptiveMoveCounter++;
        adaptiveRoundDelta += stage === "observe" ? 2 : 4;
        adaptiveLearn.lastBotCol = directWin;
        return directWin;
    }
    const directBlock = window.ConnectFourAICore.findImmediateWinningMove(board, ADAPTIVE_PLAYER_RED);
    if (directBlock !== -1) {
        adaptiveMoveCounter++;
        adaptiveRoundDelta -= adaptiveLerp(3, 1, strengthBlend);
        adaptiveLearn.lastBotCol = directBlock;
        return directBlock;
    }

    let tacticalBest = adaptiveMinimaxMove(depth);
    if (tacticalBest === -1) tacticalBest = adaptiveRandomMove();
    if (tacticalBest === -1) return -1;

    // Im oberen Bereich muss die Staerke auch spielerisch sichtbar werden:
    // Der Suchzug wird zunehmend verbindlich, damit die Heuristik nicht bei
    // Skill 100 trotzdem einen schwachen Alternativzug auswaehlt.
    const candidates = [];
    for (let c = 0; c < ADAPTIVE_COLS; c++) {
        const r = adaptiveFreeRow(c);
        if (r === -1) continue;

        board[r][c] = ADAPTIVE_PLAYER_YELLOW;
        let score = 0;
        const redWins = window.ConnectFourAICore.countWinningMoves(board, ADAPTIVE_PLAYER_RED);

        if (stage === "apply") {
            if (c === 3) score += adaptiveLerp(0.12, 0.8, strengthBlend);
            if (c === 2 || c === 4) score += adaptiveLerp(0.06, 0.55, strengthBlend);
            if (c === 1 || c === 5) score += adaptiveLerp(0.03, 0.22, strengthBlend);
        } else if (stage === "learn") {
            if (c === 3) score += adaptiveLerp(0.08, 0.35, strengthBlend);
            if (c === 2 || c === 4) score += adaptiveLerp(0.04, 0.22, strengthBlend);
        } else {
            if (c === 3) score += adaptiveLerp(0.02, 0.12, strengthBlend);
        }

        const centerBias = adaptiveLerp(0.02, 1.5, strengthBlend);
        const sideBias = adaptiveLerp(0, 0.7, strengthBlend);
        score += (c === 3 || c === 2 || c === 4) ? centerBias : sideBias;

        if (favoriteCol !== null) {
            const favoriteFactor = adaptiveLerp(2.0, 4.0, curve.smooth) * learningGate;
            const nearFactor = adaptiveLerp(1.0, 2.0, curve.smooth) * learningGate;
            if (c === favoriteCol) score += adaptiveAI.habitUsage * favoriteFactor * applyFactor;
            if (Math.abs(c - favoriteCol) === 1) score += adaptiveAI.habitUsage * nearFactor * applyFactor;
        }

        const learningFactor = adaptiveLerp(0.01, 0.20, strengthBlend);
        const accuracyFactor = adaptiveLerp(0.6, 5.5, strengthBlend);
        const tacticsFactor = adaptiveLerp(0.8, 6.2, strengthBlend);
        const creativityFactor = adaptiveLerp(0.15, 1.1, strengthBlend) * (Math.random() < 0.5 ? 1 : 0.4);
        const mistakeFactor = adaptiveLerp(2.6, 3.4, strengthBlend) * (Math.random() + adaptiveLerp(0.9, 0.65, strengthBlend));

        score += learnedStrength * learningFactor * applyFactor * learningGate;
        score += adaptiveAI.accuracy * accuracyFactor * applyFactor * learningGate;
        score += adaptiveAI.tactics * tacticsFactor * applyFactor * learningGate;
        score += adaptiveAI.creativity * creativityFactor * applyFactor * learningGate;
        score -= adaptiveAI.mistakeChance * mistakeFactor * applyFactor;

        if (strengthBlend > 0) {
            if (redWins >= 2) score += adaptiveLerp(12, 55, strengthBlend);
            else if (redWins >= 1) score += adaptiveLerp(6, 22, strengthBlend);
        }

        if (adaptiveLearn.lastBotCol === c) score -= adaptiveLerp(6, 4, strengthBlend);
        if (adaptiveLearn.lastBotCol !== -1 && Math.abs(adaptiveLearn.lastBotCol - c) === 1) score += 0.5;
        if (c === tacticalBest) score += adaptiveLerp(0.8, 7, learningGate) * learningGate;

        board[r][c] = 0;
        candidates.push({ col: c, score });
    }

    if (candidates.length === 0) return tacticalBest;

    let choice = window.SharedDifficulty.selectSoftCandidate(
        candidates,
        curve.curve ?? curve.smooth,
        true
    ) || candidates[0];

    adaptiveMoveCounter++;
    adaptiveRoundDelta += stage === "observe"
        ? -2
        : Math.max(-2, Math.min(2, Math.round(choice.score / 240) - 1));
    adaptiveMomentum = adaptiveLerp(adaptiveMomentum, choice.score / 100, 0.08);
    adaptiveLearn.lastBotCol = choice.col;

    return choice.col;
}

function finalizeAdaptiveRound(resultSign) {
    updateAdaptiveAfterMatch(resultSign);
    adaptiveLearn.resultHistory.push(resultSign);
    if (adaptiveLearn.resultHistory.length > 5) adaptiveLearn.resultHistory.shift();
    const playerSkill = getAdaptivePlayerSkillEstimate();
    const learningStage = getAdaptiveLearningStage();
    // Gegen starke Gegner soll der Bot die hohe Suchlogik frueher erreichen.
    // Die Anpassung bleibt ergebnisbasiert und wird nicht ueber die Grenzen
    // hinaus verstaerkt.
    const stageRate = learningStage === "observe" ? 0.65 : learningStage === "learn" ? 0.9 : 1;
    const speedRate = Number(window.currentAdaptSpeedFactor) || 1;
    const skillUpdate = window.SharedDifficulty.applyAdaptiveResult(
        adaptiveSkill,
        resultSign > 0 ? "playerWin" : resultSign < 0 ? "botWin" : "draw",
        {
            performance: playerSkill,
            drawStreak: adaptiveLearn.drawStreak,
            speedFactor: stageRate * speedRate
        }
    );
    adaptiveLearn.drawStreak = skillUpdate.drawStreak;
    adaptiveSkill = skillUpdate.skill;
    adaptiveLearn.skill = adaptiveSkill;
    if (typeof updateAdaptiveStrengthUI === "function") updateAdaptiveStrengthUI();
    adaptiveMoveCounter = 0;
    adaptiveRoundDelta = 0;
    saveAdaptivePersistentState();
}

function resetAdaptiveForLab(initialSkill = 35) {
    resetAdaptiveState();
    adaptiveSkill = Math.max(10, Math.min(100, Number(initialSkill) || 35));
    adaptiveLearn.skill = adaptiveSkill;
    saveAdaptivePersistentState();
}

function clearAdaptivePersistentState(initialSkill = 35) {
    try { localStorage.removeItem(ADAPTIVE_STORAGE_KEY); } catch (_) {}
    resetAdaptiveForLab(initialSkill);
}

function getAdaptiveMoveForLab(testBoard) {
    adaptiveLabBoard = testBoard;
    try {
        return getAdaptiveBotMove();
    } finally {
        adaptiveLabBoard = null;
    }
}

function recordAdaptiveLabResult(result) {
    finalizeAdaptiveRound(result === "playerWin" ? 1 : result === "botWin" ? -1 : 0);
    saveAdaptivePersistentState();
    return Math.round(adaptiveSkill);
}

window.ConnectFourAdaptiveBot = {
    getMove: getAdaptiveMoveForLab,
    getSkill: () => Math.round(adaptiveSkill),
    resetForLab: resetAdaptiveForLab,
    clearPersistentState: clearAdaptivePersistentState,
    recordLabResult: recordAdaptiveLabResult
};

// Keep the normal 4-Gewinnt game API explicit while isolating internal names
// from the adaptive bots of the other games in BotLab.
window.getAdaptiveThinkTime = getAdaptiveThinkTime;
window.getAdaptiveBotMove = getAdaptiveBotMove;
window.resetAdaptiveState = resetAdaptiveState;
window.finalizeAdaptiveRound = finalizeAdaptiveRound;
})();
