/* Adaptiver Quarto-Bot. Regeln und Suche bleiben in QuartoAICore. */
(function () {
    "use strict";

    const core = window.QuartoAICore;
    const BOT_PLAYER = 1;
    const MIN_OBSERVATION_MOVES = core.MIN_OBSERVATION_MOVES || 12;
    const SPEED_FACTORS = { slow: 0.5, normal: 1, fast: 1.5 };
    const SPEED_LABELS = { slow: "Langsam", normal: "Normal", fast: "Schnell" };
    let skill = 35;
    let speed = "normal";
    let pendingResult = null;
    let roundSnapshot = null;
    const STORAGE_KEY = "andis-game-foundry-quarto-adaptive";

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function savePersistentState() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ skill, speed })); } catch (_) {}
    }

    function loadPersistentState() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (stored && Number.isFinite(stored.skill)) skill = clamp(stored.skill, 1, 100);
            if (stored && SPEED_FACTORS[stored.speed]) speed = stored.speed;
        } catch (_) {}
    }
    loadPersistentState();

    function smoothstep(value) {
        const t = clamp(value, 0, 1);
        return t * t * (3 - 2 * t);
    }

    // Quarto needs a gentler downward response against weak opponents while
    // still reacting quickly when a strong player wins repeatedly.
    function getAdaptiveAdjustmentLimits(value = skill) {
        const current = clamp(Number(value) || 0, 1, 100);
        if (current <= 30) {
            const t = smoothstep(current / 30);
            return { up: 4.5 - t * 0.5, down: 2.0 + t * 0.5 };
        }
        if (current <= 70) {
            const t = smoothstep((current - 30) / 40);
            return { up: 4.0 + t * 0.5, down: 2.5 + t * 1.0 };
        }
        if (current <= 90) {
            const t = smoothstep((current - 70) / 20);
            return { up: 4.5 + t * 0.5, down: 3.5 + t * 0.5 };
        }
        const t = smoothstep((current - 90) / 10);
        return { up: 5.0 + t * 1.0, down: 4.0 - t * 1.0 };
    }

    function limitAdaptiveAdjustment(adjustment, value = skill) {
        const limits = getAdaptiveAdjustmentLimits(value);
        return adjustment >= 0
            ? Math.min(limits.up, adjustment)
            : Math.max(-limits.down, adjustment);
    }

    function getProfile() {
        return window.quartoPlayerProfile || null;
    }

    function getAdaptiveCurve(value = skill) {
        const difficulty = window.SharedDifficulty.createProfile({
            mode: "adaptive",
            skill: clamp(Number(value) || 0, 0, 100),
            minSearchChance: 0.08,
            maxSearchChance: 1.0,
            minRandomness: 0.06,
            maxRandomness: 0.42,
            minErrorRate: 0.06,
            maxErrorRate: 0.30,
            habitInfluence: 0.60,
            searchConfig: {
                supportsMinimax: true,
                minDepth: 0,
                maxDepth: 4,
                fixedDepth: null
            }
        });
        return {
            ...difficulty,
            challenge: difficulty.curve,
            randomness: difficulty.randomChance,
            maxDepth: difficulty.maxDepth,
            immediateWinAccuracy: difficulty.tacticalAccuracy,
            safeGiftAccuracy: difficulty.tacticalAccuracy,
            lineWeight: difficulty.tacticalAccuracy,
            positionWeight: difficulty.habitInfluence,
            selectionHabitInfluence: difficulty.habitInfluence,
            placementHabitInfluence: difficulty.habitInfluence
        };
    }

    function getAdaptiveSkill() {
        return Math.round(skill);
    }

    function setAdaptSpeed(nextSpeed = "normal") {
        speed = SPEED_FACTORS[nextSpeed] ? nextSpeed : "normal";
        savePersistentState();
    }

    function getAdaptSpeed() {
        return speed;
    }

    function snapshotProfile(profile) {
        if (!profile) return null;
        return {
            totalMoves: profile.totalMoves,
            selectionCount: profile.selectionCount,
            winningMoves: profile.tactics.winningMoves,
            missedWins: profile.tactics.missedWins,
            dangerousGifts: profile.tactics.dangerousGifts,
            safeGifts: profile.tactics.safeGifts
        };
    }

    function diff(current, previous, key) {
        return Math.max(0, (current?.[key] || 0) - (previous?.[key] || 0));
    }

    function evaluatePlayerPerformance(profile) {
        if (!profile || !roundSnapshot) return null;
        const observedMoves = diff(profile, roundSnapshot, "totalMoves");
        if (observedMoves < MIN_OBSERVATION_MOVES) return null;

        const selections = Math.max(1, diff(profile, roundSnapshot, "selectionCount"));
        const winningMoves = diff(profile.tactics, roundSnapshot.tactics, "winningMoves");
        const missedWins = diff(profile.tactics, roundSnapshot.tactics, "missedWins");
        const dangerousGifts = diff(profile.tactics, roundSnapshot.tactics, "dangerousGifts");
        const safeGifts = diff(profile.tactics, roundSnapshot.tactics, "safeGifts");

        let performance = 50;
        performance += (winningMoves / observedMoves) * 30;
        performance -= (missedWins / observedMoves) * 35;
        performance -= (dangerousGifts / selections) * 22;
        performance += (safeGifts / selections) * 8;
        return clamp(performance, 0, 100);
    }

    function fadeProfile(profile) {
        if (!profile) return;
        const fade = (values) => values.map((value) => value * 0.985);
        profile.selectedPieces = fade(profile.selectedPieces);
        profile.placedCells = fade(profile.placedCells);
        Object.keys(profile.attributes).forEach((key) => { profile.attributes[key] *= 0.985; });
        Object.keys(profile.zones).forEach((key) => { profile.zones[key] *= 0.985; });
        Object.keys(profile.tactics).forEach((key) => { profile.tactics[key] *= 0.985; });
    }

    function applyPendingResult(profile) {
        if (!pendingResult) return;
        const performance = evaluatePlayerPerformance(profile);
        // Quarto-Partien enden oft vor 12 Zügen. Auch dann soll das Ergebnis
        // die adaptive Stärke begrenzt beeinflussen; die Lernprofildaten
        // werden weiterhin nur bei ausreichender Beobachtungsmenge bewertet.
        const measuredPerformance = performance === null ? 50 : performance;

        let adjustment;
        if (pendingResult === "playerWin") {
            adjustment = 4 + (50 - measuredPerformance) * 0.08;
        } else if (pendingResult === "botWin") {
            // A strong player who still loses means the bot was too strong.
            adjustment = -4 - (measuredPerformance - 50) * 0.08;
        } else {
            adjustment = (measuredPerformance - 50) * 0.04;
        }

        const factor = SPEED_FACTORS[speed];
        const lowerSkillBoost = 1.25 - getAdaptiveCurve(skill).challenge * 0.25;
        const limitedAdjustment = limitAdaptiveAdjustment(adjustment * factor * lowerSkillBoost);
        skill = clamp(skill + limitedAdjustment, 1, 100);
        savePersistentState();
        fadeProfile(profile);
        pendingResult = null;
    }

    function beginRound({ enabled = false, adaptSpeed = "normal" } = {}) {
        setAdaptSpeed(adaptSpeed);
        const profile = getProfile();
        if (!enabled) {
            pendingResult = null;
            roundSnapshot = null;
            return getAdaptiveSkill();
        }
        applyPendingResult(profile);
        roundSnapshot = snapshotProfile(profile);
        return getAdaptiveSkill();
    }

    function recordRoundResult(result) {
        if (result !== "playerWin" && result !== "botWin" && result !== "draw") return;
        pendingResult = result;
        // Die neue Stärke soll direkt nach dem Rundenergebnis sichtbar sein,
        // nicht erst beim Start der nächsten Runde.
        applyPendingResult(getProfile());
    }

    function cancelRound() {
        pendingResult = null;
        roundSnapshot = null;
    }

    function resetForLab(initialSkill = 35) {
        skill = clamp(initialSkill, 1, 100);
        speed = "normal";
        pendingResult = null;
        roundSnapshot = null;
        savePersistentState();
    }

    function clearPersistentState(initialSkill = 35) {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        resetForLab(initialSkill);
    }

    function recordLabResult(result, opponentPerformance = 50) {
        const performance = clamp(Number(opponentPerformance) || 50, 0, 100);
        let adjustment = 0;
        // Ein starker Gegner soll die Anpassung trotz einer Niederlage auslösen.
        if (result === "playerWin") adjustment = 4 + (performance - 50) * 0.04;
        if (result === "botWin") adjustment = -4 + (performance - 50) * 0.04;
        if (result === "draw") adjustment = (performance - 50) * 0.02;
        const factor = SPEED_FACTORS[speed];
        const lowerSkillBoost = 1.25 - getAdaptiveCurve(skill).challenge * 0.25;
        const limitedAdjustment = limitAdaptiveAdjustment(adjustment * factor * lowerSkillBoost);
        skill = clamp(skill + limitedAdjustment, 1, 100);
        savePersistentState();
        return getAdaptiveSkill();
    }

    function chooseFromScored(scored, curve) {
        if (!scored.length) return null;
        scored.sort((a, b) => b.score - a.score);
        const poolSize = Math.max(1, Math.ceil(scored.length * (curve.randomness * 0.9 + (1 - curve.challenge) * 0.35)));
        return scored[Math.floor(Math.random() * poolSize)].action;
    }

    function getProfileBiasForCell(profile, cell, curve) {
        if (!profile || !profile.observationReady) return 0;
        const zone = (() => {
            const row = Math.floor(cell / 4);
            const col = cell % 4;
            if ((row === 0 || row === 3) && (col === 0 || col === 3)) return "corner";
            if (row >= 1 && row <= 2 && col >= 1 && col <= 2) return "center";
            return "edge";
        })();
        const total = Math.max(1, Object.values(profile.zones).reduce((sum, value) => sum + value, 0));
        return (profile.zones[zone] / total) * curve.placementHabitInfluence * 18;
    }

    function choosePiece(state) {
        if (!state || state.selectedPiece !== null || !state.remainingPieces.length) return null;
        const curve = getAdaptiveCurve();
        const profile = getProfile();
        const depth = curve.depth;

        if (Math.random() < curve.searchChance) {
            const searched = core.choosePiece(state, BOT_PLAYER, depth);
            if (state.remainingPieces.includes(searched) && Math.random() > curve.errorRate * 0.35) return searched;
        }

        const scored = state.remainingPieces.map((piece) => {
            const winningPlacements = core.countWinningPlacements(state, piece);
            const commonRisk = winningPlacements * (20 + curve.safeGiftAccuracy * 50);
            const preference = profile?.observationReady
                ? (profile.selectedPieces[piece] || 0) * curve.selectionHabitInfluence
                : 0;
            return { action: piece, score: -commonRisk + preference + Math.random() * curve.randomness * 8 };
        });
        return chooseFromScored(scored, curve);
    }

    function chooseCell(state) {
        if (!state || state.selectedPiece === null) return null;
        const openCells = core.getOpenCells(state.board);
        if (!openCells.length) return null;
        const curve = getAdaptiveCurve();
        const profile = getProfile();
        const depth = curve.depth;

        if (Math.random() < curve.searchChance) {
            const searched = core.chooseCell(state, BOT_PLAYER, depth);
            if (openCells.includes(searched) && Math.random() > curve.errorRate * 0.3) return searched;
        }

        const scored = openCells.map((cell) => {
            const next = core.placePiece(state, cell);
            const score = next ? core.evaluateState(next, BOT_PLAYER) * curve.lineWeight : -Infinity;
            return {
                action: cell,
                score: score
                    + (next?.winner === BOT_PLAYER ? 100000 * curve.immediateWinAccuracy : 0)
                    + getProfileBiasForCell(profile, cell, curve) * curve.positionWeight
                    + Math.random() * curve.randomness * 20
            };
        });
        return chooseFromScored(scored, curve);
    }

    window.QuartoAdaptiveBot = {
        enabled: true,
        choosePiece,
        chooseCell,
        beginRound,
        recordRoundResult,
        cancelRound,
        resetForLab,
        clearPersistentState,
        recordLabResult,
        setAdaptSpeed,
        getAdaptSpeed,
        getAdaptiveSkill,
        getAdaptiveCurve,
        getUiState() {
            return { skill: getAdaptiveSkill(), speed, speedLabel: SPEED_LABELS[speed] };
        }
    };
})();
