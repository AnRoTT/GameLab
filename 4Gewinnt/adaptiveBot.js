var adaptiveSkill = 48;
var adaptiveMomentum = 0;
var adaptiveMoveCounter = 0;
var adaptiveRoundDelta = 0;
var adaptiveRoundsSinceAdjust = 0;
var adaptiveLearn = {
    skill: 48,
    roundForm: 0,
    resultBias: 0,
    matchTrend: 0,
    winStreak: 0,
    lossStreak: 0,
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

// Das Spielerprofil wird zentral in aiCore.js angelegt. Die alten deutschen
// Feldnamen sind dort nur noch kompatible Verweise auf dieselben Werte.
const playerProfile = window.connectFourPlayerProfile;

function adaptiveRandomMove() {
    const columns = window.ConnectFourAICore.getAvailableColumns(board);
    return columns.length ? columns[Math.floor(Math.random() * columns.length)] : -1;
}

function adaptiveFreeRow(col) {
    return window.ConnectFourAICore.getFreeRow(board, col);
}

function adaptiveHasWinner(player) {
    return window.ConnectFourAICore.hasWinner(board, player);
}

function adaptiveMinimaxMove(depth) {
    const result = window.ConnectFourAICore.minimax(
        board,
        depth,
        true,
        PLAYER_YELLOW,
        PLAYER_RED
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
    const s = adaptiveClamp((typeof skill === "number" ? skill : 48) / 100);
    const late = Math.pow(s, 2.35);
    const smooth = late * late * (3 - 2 * late);
    return {
        smooth,
        learningWeight: adaptiveLerp(0.03, 0.58, smooth),
        minimaxWeight: adaptiveLerp(0.06, 0.85, smooth),
        tacticWeight: adaptiveLerp(0.06, 0.80, smooth),
        randomness: adaptiveLerp(0.42, 0.03, smooth),
        errorRate: adaptiveLerp(0.40, 0.02, smooth),
        thinkTimeWeight: smooth
    };
}

function getAdaptiveStrengthGate(skillValue) {
    return adaptiveClamp((skillValue - 60) / 25);
}

function getAdaptivePlayerSkillEstimate() {
    const coreProfile = window.connectFourPlayerProfile;
    const totalMoves = Math.max(1, coreProfile?.totalMoves ?? playerProfile.gesamtZuege);
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
    adaptiveSkill = 48;
    adaptiveMomentum = 0;
    adaptiveMoveCounter = 0;
    adaptiveRoundDelta = 0;
    adaptiveRoundsSinceAdjust = 0;
    adaptiveLearn = {
        skill: 48,
        roundForm: 0,
        resultBias: 0,
        matchTrend: 0,
        winStreak: 0,
        lossStreak: 0,
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
    const skillBand = getAdaptiveBotSkillBand();
    const skillValue = getAdaptiveBotSkillValue();
    const curve = adaptiveCurve(skillValue);

    let baseTime;
    if (skillBand === "low") baseTime = 260;
    else if (skillBand === "mid") baseTime = 400;
    else if (skillBand === "adapted") baseTime = 450 + curve.thinkTimeWeight * 120;
    else if (skillBand === "strong") baseTime = 820 + curve.thinkTimeWeight * 120;
    else baseTime = 1150 + curve.thinkTimeWeight * 100;

    if (stage === "observe") baseTime *= 0.78;
    else if (stage === "learn") baseTime *= 0.95;
    else baseTime *= 1.08;

    if (adaptiveLearn.roundForm > 0.6) baseTime += 120;
    if (adaptiveLearn.resultBias > 0.6) baseTime += 90;
    if (adaptiveLearn.memory.mistakes > 0.5) baseTime -= 70;

    return Math.max(120, Math.round(baseTime));
}

function getAdaptiveSearchDepth() {
    const skillBand = getAdaptiveBotSkillBand();
    const stage = getAdaptiveLearningStage();
    const skillValue = getAdaptiveBotSkillValue();
    const curve = adaptiveCurve(skillValue);
    let depth;

    if (skillBand === "low") depth = 1;
    else if (skillBand === "mid") depth = 1;
    else if (skillBand === "adapted") depth = 1;
    else if (skillBand === "strong") depth = 3;
    else depth = 5;

    if (stage === "observe") depth = Math.max(1, depth - 1);
    else if (stage === "learn") depth = Math.max(1, depth);
    else depth = Math.min(6, depth + 1);

    return depth;
}

function getAdaptiveStochasticity(skillBand, stage) {
    const skillValue = getAdaptiveBotSkillValue();
    const curve = adaptiveCurve(skillValue);
    if (skillBand === "low") return stage === "observe" ? 0.55 : 0.45;
    if (skillBand === "mid") return stage === "observe" ? 0.45 : 0.35;
    if (skillBand === "adapted") return adaptiveLerp(
        stage === "observe" ? 0.22 : 0.16,
        stage === "observe" ? 0.12 : 0.08,
        curve.smooth
    );
    if (skillBand === "strong") return stage === "observe" ? 0.05 : 0.03;
    return stage === "observe" ? 0.02 : 0.005;
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
    const stage = getAdaptiveLearningStage();
    const skillBand = getAdaptiveBotSkillBand();
    const skillValue = getAdaptiveBotSkillValue();
    const curve = adaptiveCurve(skillValue);
    const learnedStrength = getAdaptiveSkillFromProfile();
    const favoriteCol = getFavoritePlayerColumn();
    const depth = getAdaptiveSearchDepth();
    const applyFactor = stage === "observe" ? 0.10 : stage === "learn" ? 0.26 : 0.58;
    const stochasticity = getAdaptiveStochasticity(skillBand, stage);
    const weakPhase = skillValue < 60;
    const learningGate = getAdaptiveStrengthGate(skillValue);
    const earlyMistakeChance = skillValue <= 20
        ? 0.72
        : skillValue < 40
            ? 0.48
            : weakPhase
                ? adaptiveLerp(0.34, 0.18, skillValue / 60)
                : 0.04;

    const dumbMode = skillValue <= 18 || adaptiveLearn.lossStreak >= 8 || adaptiveSkill <= 12;
    if (dumbMode) {
        const randomCol = adaptiveRandomMove();
        if (randomCol !== -1) {
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= 2;
            adaptiveLearn.lastBotCol = randomCol;
        }
        return randomCol;
    }

    if (Math.random() < earlyMistakeChance) {
        const randomCol = adaptiveRandomMove();
        if (randomCol !== -1) {
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= weakPhase ? 1 : 0;
            adaptiveLearn.lastBotCol = randomCol;
        }
        return randomCol;
    }

    if (skillValue < 25) {
        const randomCol = adaptiveRandomMove();
        if (randomCol !== -1) {
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= 1;
            adaptiveLearn.lastBotCol = randomCol;
        }
        return randomCol;
    }

    if (skillValue < 40 && Math.random() < 0.55) {
        const randomCol = adaptiveRandomMove();
        if (randomCol !== -1) {
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= 1;
            adaptiveLearn.lastBotCol = randomCol;
        }
        return randomCol;
    }

    if (skillValue < 60 && Math.random() < 0.30) {
        const randomCol = adaptiveRandomMove();
        if (randomCol !== -1) {
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= 0;
            adaptiveLearn.lastBotCol = randomCol;
        }
        return randomCol;
    }

    for (let c = 0; c < COLS; c++) {
        const r = adaptiveFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_YELLOW;
        if (adaptiveHasWinner(PLAYER_YELLOW)) {
            board[r][c] = 0;
            adaptiveMoveCounter++;
            adaptiveRoundDelta += stage === "observe" ? 2 : 4;
            adaptiveLearn.lastBotCol = c;
            return c;
        }
        board[r][c] = 0;
    }

    for (let c = 0; c < COLS; c++) {
        const r = adaptiveFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_RED;
        if (adaptiveHasWinner(PLAYER_RED)) {
            board[r][c] = 0;
            adaptiveMoveCounter++;
            adaptiveRoundDelta -= skillBand === "low" ? 1 : 3;
            adaptiveLearn.lastBotCol = c;
            return c;
        }
        board[r][c] = 0;
    }

    let tacticalBest = -1;
    if (learningGate > 0) {
        tacticalBest = adaptiveMinimaxMove(depth);
    }
    if (tacticalBest === -1 && learningGate > 0.45) tacticalBest = adaptiveRandomMove();
    if (tacticalBest === -1) return -1;

    const candidates = [];
    for (let c = 0; c < COLS; c++) {
        const r = adaptiveFreeRow(c);
        if (r === -1) continue;

        board[r][c] = PLAYER_YELLOW;
        let score = 0;
        const redWins = window.ConnectFourAICore.countWinningMoves(board, PLAYER_RED);

        if (stage === "apply") {
            if (c === 3) score += weakPhase ? 0.12 : 0.8;
            if (c === 2 || c === 4) score += weakPhase ? 0.06 : 0.55;
            if (c === 1 || c === 5) score += weakPhase ? 0.03 : 0.22;
        } else if (stage === "learn") {
            if (c === 3) score += weakPhase ? 0.08 : 0.35;
            if (c === 2 || c === 4) score += weakPhase ? 0.04 : 0.22;
        } else {
            if (c === 3) score += weakPhase ? 0.02 : 0.12;
        }

        if (skillBand === "low") {
            score += c === 3 ? 0.02 : 0;
        } else if (skillBand === "mid") {
            score += (c === 3 ? 0.05 : 0);
        } else if (skillBand === "adapted") {
            const adaptedCenter = weakPhase ? adaptiveLerp(0.05, 0.18, curve.smooth) : adaptiveLerp(0.18, 0.55, curve.smooth);
            const adaptedSide = weakPhase ? adaptiveLerp(0.05, 0.08, curve.smooth) : adaptiveLerp(0.12, 0.08, curve.smooth);
            score += (c === 3 || c === 2 || c === 4 ? adaptedCenter : adaptedSide);
        } else if (skillBand === "strong") {
            score += (c === 3 || c === 2 || c === 4 ? 0.9 : 0.5);
        } else {
            score += (c === 3 || c === 2 || c === 4 ? 1.5 : 0.7);
        }

        if (favoriteCol !== null) {
            const favoriteFactor = adaptiveLerp(2.0, 4.0, curve.smooth) * learningGate;
            const nearFactor = adaptiveLerp(1.0, 2.0, curve.smooth) * learningGate;
            if (c === favoriteCol) score += adaptiveAI.habitUsage * favoriteFactor * applyFactor;
            if (Math.abs(c - favoriteCol) === 1) score += adaptiveAI.habitUsage * nearFactor * applyFactor;
        }

        const learningFactor = weakPhase ? adaptiveLerp(0.01, 0.05, curve.smooth) : adaptiveLerp(0.08, 0.20, curve.smooth);
        const accuracyFactor = weakPhase ? adaptiveLerp(0.6, 1.4, curve.smooth) : adaptiveLerp(3.8, 5.5, curve.smooth);
        const tacticsFactor = weakPhase ? adaptiveLerp(0.8, 1.8, curve.smooth) : adaptiveLerp(4.2, 6.2, curve.smooth);
        const creativityFactor = weakPhase
            ? adaptiveLerp(0.15, 0.35, curve.smooth) * (Math.random() < 0.5 ? 1 : 0.35)
            : adaptiveLerp(0.7, 1.1, curve.smooth) * (Math.random() < 0.5 ? 1 : 0.45);
        const mistakeFactor = weakPhase
            ? adaptiveLerp(2.6, 4.0, curve.smooth) * (Math.random() + 0.9)
            : adaptiveLerp(2.4, 3.4, curve.smooth) * (Math.random() + 0.65);

        score += learnedStrength * learningFactor * applyFactor * learningGate;
        score += adaptiveAI.accuracy * accuracyFactor * applyFactor * learningGate;
        score += adaptiveAI.tactics * tacticsFactor * applyFactor * learningGate;
        score += adaptiveAI.creativity * creativityFactor * applyFactor * learningGate;
        score -= adaptiveAI.mistakeChance * mistakeFactor * applyFactor;

        if (!weakPhase && learningGate > 0.2) {
            if (redWins >= 2) score += skillBand === "ruthless" ? 55 : adaptiveLerp(12, 24, curve.smooth);
            else if (redWins >= 1) score += skillBand === "ruthless" ? 22 : adaptiveLerp(6, 12, curve.smooth);
        }

        if (adaptiveLearn.lastBotCol === c) score -= weakPhase ? 6 : 4;
        if (adaptiveLearn.lastBotCol !== -1 && Math.abs(adaptiveLearn.lastBotCol - c) === 1) score += 0.5;
        if (learningGate > 0.35 && c === tacticalBest) score += skillBand === "ruthless" ? 7 : skillBand === "strong" ? 3 : adaptiveLerp(0.8, 1.8, curve.smooth);

        board[r][c] = 0;
        candidates.push({ col: c, score });
    }

    if (candidates.length === 0) return tacticalBest;

    candidates.sort((a, b) => b.score - a.score);
    const topScore = candidates[0].score;
    const threshold = adaptiveLerp(
        stage === "observe" ? 5 : stage === "learn" ? 3.5 : 2.0,
        stage === "observe" ? 4 : stage === "learn" ? 3.0 : 1.5,
        curve.smooth
    );
    const pool = candidates.filter(k => topScore - k.score <= threshold);
    let choice = pool[Math.floor(Math.random() * pool.length)] || candidates[0];

    if (learningGate > 0.65 || skillBand === "ruthless") {
        choice = candidates[0];
    } else if (learningGate > 0.25 && stage === "apply" && choice.col !== tacticalBest && Math.random() > stochasticity) {
        choice = candidates.find(k => k.col === tacticalBest) || choice;
    } else if (learningGate > 0.25 && choice.col !== tacticalBest && Math.random() > 0.65) {
        choice = candidates.find(k => k.col === tacticalBest) || choice;
    }

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
    const targetSkill = getAdaptiveTargetSkill();
    const responseGate = adaptiveClamp((adaptiveSkill - 45) / 25);
    const resultDelta = resultSign > 0
        ? adaptiveLerp(5, 10, responseGate)
        : resultSign < 0
            ? -adaptiveLerp(5, 10, responseGate)
            : -2;
    const styleDelta = adaptiveRoundDelta > 0
        ? Math.min(4, adaptiveRoundDelta)
        : Math.max(-3, adaptiveRoundDelta);
    const streakDelta = resultSign > 0
        ? Math.min(6, adaptiveLearn.winStreak * adaptiveLerp(1.2, 2.0, responseGate))
        : resultSign < 0
            ? -Math.min(10, adaptiveLearn.lossStreak * adaptiveLerp(1.8, 2.6, responseGate))
            : 0;
    adaptiveRoundsSinceAdjust += 1;
    const floorSkill = adaptiveSkill >= 60 ? 24 : adaptiveSkill >= 35 ? 16 : 10;
    const adjustedTarget = Math.max(floorSkill, Math.min(100, targetSkill + resultDelta + styleDelta + streakDelta));

    const roundPull = adaptiveLerp(0.34, 0.52, responseGate) + (adaptiveRoundsSinceAdjust >= 2 ? 0.10 : 0);
    adaptiveSkill = Math.max(floorSkill, Math.min(100, adaptiveLerp(adaptiveSkill, adjustedTarget, roundPull)));
    if (adaptiveRoundsSinceAdjust >= 2) adaptiveRoundsSinceAdjust = 0;
    adaptiveLearn.skill = adaptiveSkill;
    if (typeof updateAdaptiveStrengthUI === "function") updateAdaptiveStrengthUI();
    adaptiveMoveCounter = 0;
    adaptiveRoundDelta = 0;
}

