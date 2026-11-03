(function (root) {
    "use strict";
    const core = root.DeutscheDameAICore;
    const clamp = root.SharedDifficulty.clamp;
    const SPEED = { slow: 0.5, normal: 1, fast: 1.5 };
    const KEY = "andis-game-foundry-deutsche-dame-adaptive";
    let skill = 35;
    let speed = "normal";
    let drawStreak = 0;
    let roundStarted = false;
    let roundSnapshot = null;
    let observedProfile = null;
    let labState = null;
    const playerProfile = root.deutscheDamePlayerProfile;

    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved) {
            skill = clamp(Number(saved.skill) || 35, 10, 100);
            speed = SPEED[saved.speed] ? saved.speed : "normal";
            drawStreak = Number.isInteger(saved.drawStreak) && saved.drawStreak >= 0 ? saved.drawStreak : 0;
        }
    } catch (_) {}

    function save() {
        if (labState) return;
        try { localStorage.setItem(KEY, JSON.stringify({ skill, speed, drawStreak })); } catch (_) {}
    }

    function profile() {
        return root.SharedDifficulty.createProfile({
            mode: "adaptive",
            skill,
            ...root.DeutscheDameSettings.difficulty,
            playerProfile,
            habitInfluence: root.DeutscheDameSettings.adaptiveHabitInfluence,
            searchConfig: root.DeutscheDameSettings.searchConfig
        });
    }

    function profileBias(state, action, player, difficulty, next, observedProfile = playerProfile) {
        if (!observedProfile?.observationReady) return 0;
        const total = Math.max(1, observedProfile.totalMoves);
        const actionSamples = Math.max(1, Number(observedProfile.actionSamples) || (observedProfile.sources || []).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0) || total);
        const tactics = observedProfile.tactics || {};
        const weakness = ((tactics.weakChoices || 0) * 5 + (tactics.allowedCaptures || 0) * 4 + (tactics.missedPromotions || 0) * 4) / total;
        const aggression = (observedProfile.style?.aggressive || 0) / total;
        const carefulness = (observedProfile.style?.careful || 0) / total;
        const defensiveness = (observedProfile.style?.defensive || 0) / total;
        const maturity = Math.min(1, total / 48);
        let bonus = 0;
        if (action.type === "capture") bonus += weakness * 18 * difficulty.habitInfluence;
        if (next && next.currentPlayer !== state.currentPlayer) {
            const humanActions = root.DeutscheDameAICore.getActionsForPlayer(next, 1);
            // Bewerte die möglichen Antworten des Menschen anhand seiner
            // bisherigen Felder, nicht die eigenen Start- und Zielfelder.
            const frequency = value => Math.max(0, Math.min(1, (Number(value) || 0) / actionSamples));
            const familiarReply = humanActions.reduce((best, candidate) => Math.max(best,
                frequency(observedProfile.destinations?.[candidate.to]) * 4
                + frequency(observedProfile.sources?.[candidate.from]) * 2), 0);
            bonus -= familiarReply * maturity * difficulty.habitInfluence;
            if (humanActions.some(candidate => candidate.type === "capture")) bonus -= 35 * (1 + carefulness) * difficulty.habitInfluence;
            const humanPromotions = humanActions.filter(candidate => {
                const piece = next.board[candidate.from];
                const targetRow = Math.floor(candidate.to / 8);
                return piece && !piece.king && targetRow === 0;
            }).length;
            bonus -= humanPromotions * 42 * (1 + defensiveness) * difficulty.habitInfluence;
        }
        if (aggression > carefulness && action.type === "move") bonus += 4 * difficulty.habitInfluence;
        return bonus;
    }

    function snapshotProfile(profile) {
        if (!profile) return null;
        return {
            totalMoves: profile.totalMoves || 0,
            promotions: profile.promotions || 0,
            tactics: { ...(profile.tactics || {}) },
            style: { ...(profile.style || {}) },
            mobility: { ...(profile.mobility || {}) }
        };
    }

    function playerPerformance() {
        if (labState) return null;
        const playerProfile = observedProfile || root.deutscheDamePlayerProfile;
        if (!playerProfile?.observationReady) return null;
        const baseline = roundSnapshot || { totalMoves: 0, promotions: 0, tactics: {}, style: {}, mobility: {} };
        const total = Math.max(1, (playerProfile.totalMoves || 0) - baseline.totalMoves);
        const tactics = playerProfile.tactics || {};
        const tacticalDelta = key => Math.max(0, (tactics[key] || 0) - (baseline.tactics?.[key] || 0));
        const styleDelta = key => Math.max(0, (playerProfile.style?.[key] || 0) - (baseline.style?.[key] || 0));
        const mobilityDelta = key => Math.max(0, (playerProfile.mobility?.[key] || 0) - (baseline.mobility?.[key] || 0));
        const good = tacticalDelta("strongCaptures") * 4 + tacticalDelta("winsChosen") * 5 + tacticalDelta("blocksChosen") * 4 + tacticalDelta("rescuedPieces") * 2
            + Math.max(0, (playerProfile.promotions || 0) - baseline.promotions) * 3
            + styleDelta("careful") + styleDelta("defensive")
            + Math.max(0, mobilityDelta("improved") - mobilityDelta("reduced"));
        const bad = tacticalDelta("weakChoices") * 5 + tacticalDelta("allowedCaptures") * 4 + tacticalDelta("missedPromotions") * 4 + tacticalDelta("missedWins") * 5 + tacticalDelta("missedBlocks") * 4 + tacticalDelta("avoidableExposures") * 2 + tacticalDelta("missedCapturePaths") * 3;
        return Math.max(0, Math.min(100, 50 + ((good - bad) / total) * 12));
    }

    function chooseAction(state, player = 2, suppliedProfile = null) {
        const difficulty = profile();
        const observedProfile = labState ? null : (suppliedProfile || playerProfile);
        return core.chooseDifficultyAction(state, player, difficulty, {
            scoreBonus: (currentState, action, currentPlayer, currentDifficulty, next) =>
                profileBias(currentState, action, currentPlayer, currentDifficulty, next, observedProfile)
        }) || core.legalActions(state)[0] || null;
    }

    function beginRound(options = {}) {
        if (options.adaptSpeed && SPEED[options.adaptSpeed]) speed = options.adaptSpeed;
        roundStarted = true;
        observedProfile = labState ? null : (options.playerProfile || playerProfile);
        roundSnapshot = options.roundSnapshot && typeof options.roundSnapshot === "object"
            ? snapshotProfile(options.roundSnapshot) : snapshotProfile(observedProfile);
        save();
        return Math.round(skill);
    }

    function recordRoundResult(result, performanceOverride = null) {
        if (!roundStarted || !["playerWin", "botWin", "draw"].includes(result)) return Math.round(skill);
        const update = root.SharedDifficulty.applyAdaptiveResult(skill, result, {
            performance: performanceOverride === null ? (playerPerformance() ?? 50) : clamp(Number(performanceOverride) || 50, 0, 100),
            drawStreak,
            speedFactor: SPEED[speed]
        });
        skill = update.skill;
        drawStreak = update.drawStreak;
        roundStarted = false;
        roundSnapshot = null;
        observedProfile = null;
        save();
        return Math.round(skill);
    }

    function cancelRound() { roundStarted = false; roundSnapshot = null; observedProfile = null; }
    function resetForLab(initial = 35) { if (!labState) labState = { skill, speed, drawStreak, roundStarted, roundSnapshot, observedProfile }; skill = clamp(Number(initial) || 35, 10, 100); speed = "normal"; drawStreak = 0; roundStarted = false; roundSnapshot = null; observedProfile = null; }
    function finishLab() { if (!labState) return; ({ skill, speed, drawStreak, roundStarted, roundSnapshot, observedProfile } = labState); labState = null; }
    function clearPersistentState(initial = 35) { labState = null; try { localStorage.removeItem(KEY); } catch (_) {} skill = clamp(Number(initial) || 35, 10, 100); speed = "normal"; drawStreak = 0; cancelRound(); save(); }

    root.DeutscheDameAdaptiveBot = {
        enabled: true,
        chooseAction,
        beginRound,
        isRoundActive() { return roundStarted; },
        getRoundSnapshot() { return roundStarted ? snapshotProfile(roundSnapshot) : null; },
        recordRoundResult,
        recordLabResult(result) { return recordRoundResult(result); },
        cancelRound,
        resetForLab,
        finishLab,
        clearPersistentState,
        setAdaptSpeed(value) { if (SPEED[value]) { speed = value; save(); } },
        getAdaptSpeed() { return speed; },
        getAdaptiveSkill() { return Math.round(skill); },
        getSkill() { return Math.round(skill); },
        getAdaptiveCurve: profile,
        getThinkTime() { return Math.round(350 + profile().curve * 650); },
        getUiState() { return { skill: Math.round(skill), speed, speedLabel: speed === "slow" ? "Langsam" : speed === "fast" ? "Schnell" : "Normal" }; }
    };
})(window);
