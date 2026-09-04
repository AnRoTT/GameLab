(function () {
    "use strict";
    const core = window.MuehleAICore; const clamp = window.SharedDifficulty.clamp; const SPEED = { slow: 0.5, normal: 1, fast: 1.5 }; const KEY = "andis-game-foundry-muehle-adaptive";
    let skill = 35, speed = "normal", drawStreak = 0, roundSnapshot = null;
    try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) { skill = Math.max(10, Math.min(100, Number(saved.skill) || 35)); speed = SPEED[saved.speed] ? saved.speed : "normal"; } } catch (_) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ skill, speed })); } catch (_) {} }
    function curve() { return window.SharedDifficulty.createProfile({ mode: "adaptive", skill, ...window.MuehleSettings.difficulty, habitInfluence: window.MuehleSettings.adaptiveHabitInfluence, searchConfig: window.MuehleSettings.searchConfig }); }
    function actionPoint(action) { return action.type === "move" ? action.to : action.point; }
    function profileBias(state, action, player, playerProfile, difficulty, searchCache = null) {
        if (!playerProfile?.observationReady) return 0;
        const point = actionPoint(action);
        if (!Number.isInteger(point)) return 0;
        const total = Math.max(1, playerProfile.totalMoves);
        let preference = playerProfile.points[point] || 0;
        if (state.phase === core.PHASES.PLACE) preference += (playerProfile.opening?.points?.[point] || 0) * 1.5;
        if (action.type === "select") preference += (playerProfile.sourcePoints?.[point] || 0) * 0.8;
        if (action.type === "move") preference += (playerProfile.targetPoints?.[point] || 0) * 0.8;
        let bias = (preference / total) * 36 * difficulty.habitInfluence;
        if (action.type === "move") {
            const next = core.simulateCached(state, action, searchCache);
            const beforeMobility = state.board.reduce((sum, value, index) => sum + (value === player ? core.legalTargets(state, index, player).length : 0), 0);
            const afterMobility = next ? next.board.reduce((sum, value, index) => sum + (value === player ? core.legalTargets(next, index, player).length : 0), 0) : beforeMobility;
            const cautious = (playerProfile.style?.careful || 0) >= (playerProfile.style?.risky || 0);
            bias += (afterMobility - beforeMobility) * (cautious ? 2.2 : 0.8) * difficulty.habitInfluence;
        }
        const patterns = playerProfile.patterns;
        if (patterns?.threatPoints?.length === 24) {
            const opponent = core.PLAYERS.ONE === player ? core.PLAYERS.TWO : core.PLAYERS.ONE;
            const observed = patterns.threatPoints.reduce((sum, value) => sum + Number(value || 0), 0);
            const maturity = Math.min(1, observed / 80);
            if (maturity > 0) {
                const beforeThreatWeight = core.millThreatPoints(state.board, opponent)
                    .reduce((sum, threatPoint) => sum + (patterns.threatPoints[threatPoint] || 0), 0);
                const next = core.simulateCached(state, action, searchCache);
                const afterThreatWeight = next
                    ? core.millThreatPoints(next.board, opponent)
                        .reduce((sum, threatPoint) => sum + (patterns.threatPoints[threatPoint] || 0), 0)
                    : beforeThreatWeight;
                // Bevorzugt Züge, die die bekannten Drohfelder des Spielers
                // besetzen oder seine wiederkehrenden Mühlenmuster auflösen.
                bias += ((beforeThreatWeight - afterThreatWeight) / Math.max(1, observed))
                    * 220 * maturity * difficulty.habitInfluence;
                if (action.type === "remove") {
                    const support = patterns.supportPoints?.[point] || 0;
                    const lineWeight = (core.MILLS || [])
                        .map((line, index) => line.includes(point) ? (patterns.millLines?.[index] || 0) : 0)
                        .reduce((sum, value) => sum + value, 0);
                    const supportTotal = Math.max(1, (patterns.supportPoints || []).reduce((sum, value) => sum + Number(value || 0), 0));
                    const lineTotal = Math.max(1, (patterns.millLines || []).reduce((sum, value) => sum + Number(value || 0), 0));
                    bias += (support / supportTotal * 150 + lineWeight / lineTotal * 110)
                        * maturity * difficulty.habitInfluence;
                }
            }
        }
        return bias;
    }
    function chooseAction(state, player = core.PLAYERS.TWO, playerProfile = null, sharedCache = null) {
        const difficulty = curve();
        const searchCache = sharedCache || core.createSearchCache();
        return core.chooseDifficultyAction(state, player, difficulty, {
            sharedCache: searchCache,
            scoreBonus: (currentState, action, currentPlayer, currentDifficulty, cache) =>
                profileBias(currentState, action, currentPlayer, playerProfile, currentDifficulty, cache)
        });
    }
    function snapshotProfile(profile) {
        if (!profile) return null;
        return {
            placements: profile.placements || 0,
            moves: profile.moves || 0,
            removals: profile.removals || 0,
            tactics: { ...(profile.tactics || {}) },
            mobility: { ...(profile.mobility || {}) }
        };
    }

    function playerPerformance(playerProfile) {
        if (!playerProfile || playerProfile.totalMoves < 12) return null;
        const baseline = roundSnapshot || { placements: 0, moves: 0, removals: 0, tactics: {}, mobility: {} };
        const tactics = playerProfile.tactics || {};
        const total = Math.max(1, (playerProfile.placements || 0) - baseline.placements + (playerProfile.moves || 0) - baseline.moves + (playerProfile.removals || 0) - baseline.removals);
        const diff = (group, key, base) => Math.max(0, (group?.[key] || 0) - (base?.[key] || 0));
        const mills = diff(tactics, "mills", baseline.tactics) / total;
        const setupMills = diff(tactics, "setupMills", baseline.tactics) / total;
        const movementMills = diff(tactics, "movementMills", baseline.tactics) / total;
        const reopenedMills = diff(tactics, "reopenedMills", baseline.tactics) / total;
        const zwickmuehlen = diff(tactics, "zwickmuehlen", baseline.tactics) / total;
        const blockedZwickmuehlen = diff(tactics, "blockedZwickmuehlen", baseline.tactics) / total;
        const qualityRemovals = diff(tactics, "qualityRemovals", baseline.tactics) / Math.max(1, (playerProfile.removals || 0) - baseline.removals);
        const mobilityDelta = (diff(playerProfile.mobility, "improved", baseline.mobility) - diff(playerProfile.mobility, "reduced", baseline.mobility)) / total;
        const preserved = diff(playerProfile.mobility, "preserved", baseline.mobility) / total;
        return Math.max(0, Math.min(100,
            50 + mills * 20 + setupMills * 8 + movementMills * 14 + reopenedMills * 18
            + zwickmuehlen * 45 + blockedZwickmuehlen * 35
            + qualityRemovals * 18 + mobilityDelta * 24 + preserved * 4
        ));
    }
    function applyResult(result) {
        if (result !== "playerWin" && result !== "botWin" && result !== "draw") return;
        const performance = playerPerformance(window.muehlePlayerProfile);
        const update = window.SharedDifficulty.applyAdaptiveResult(skill, result, {
            performance: performance ?? 50,
            drawStreak,
            speedFactor: SPEED[speed]
        });
        skill = update.skill;
        drawStreak = update.drawStreak;
        roundSnapshot = null;
        save();
    }
    function resetForLab(initial = 35) { skill = Math.max(10, Math.min(100, Number(initial) || 35)); speed = "normal"; drawStreak = 0; roundSnapshot = null; save(); }
    function clearPersistentState(initial = 35) { try { localStorage.removeItem(KEY); } catch (_) {} resetForLab(initial); }
    window.MuehleAdaptiveBot = { enabled: true, chooseAction, choosePlace: chooseAction, chooseSource: chooseAction, chooseTarget: chooseAction, chooseRemove: chooseAction, beginRound(options = {}) { if (options.adaptSpeed) speed = SPEED[options.adaptSpeed] ? options.adaptSpeed : "normal"; roundSnapshot = snapshotProfile(window.muehlePlayerProfile); save(); return Math.round(skill); }, recordRoundResult: applyResult, recordLabResult(result) { applyResult(result); return Math.round(skill); }, cancelRound() { roundSnapshot = null; }, resetForLab, clearPersistentState, setAdaptSpeed(value) { speed = SPEED[value] ? value : "normal"; save(); }, getAdaptSpeed() { return speed; }, getAdaptiveSkill() { return Math.round(skill); }, getSkill() { return Math.round(skill); }, getAdaptiveCurve: curve, getProfile: () => null, getThinkTime() { return Math.round((350 + curve().curve * 650) * ({ slow: 1.25, normal: 1, fast: 0.75 }[speed] || 1)); }, getUiState() { return { skill: Math.round(skill), speed, speedLabel: speed === "slow" ? "Langsam" : speed === "fast" ? "Schnell" : "Normal" }; } };
})();
