/* Gemeinsame Difficulty-Berechnung fuer manuelle und adaptive Bots. */
(function (root) {
    "use strict";


    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function smoothstep(value) {
        const normalized = clamp(Number(value) || 0, 0, 1);
        return normalized * normalized * (3 - 2 * normalized);
    }

    // Gemeinsame Lernkurve fuer adaptive Bots: unten schneller lernen,
    // in der Mitte normal reagieren und oben sanft abflachen.
    function getAdaptiveSkillFactor(skill, { minSkill = 10, maxSkill = 100, minFactor = 0.4, maxFactor = 1.6 } = {}) {
        const lower = Number(minSkill);
        const upper = Number(maxSkill);
        const lowFactor = Number(minFactor);
        const highFactor = Number(maxFactor);
        if (!(upper > lower) || !Number.isFinite(lowFactor) || !Number.isFinite(highFactor)) {
            throw new RangeError("Ungültige Grenzen für die adaptive Skill-Kurve.");
        }
        const position = clamp((Number(skill) - lower) / (upper - lower), 0, 1);
        return lowFactor + (highFactor - lowFactor) * (1 - smoothstep(position));
    }

    function applyAdaptiveSkillDelta(skill, baseDelta, options = {}) {
        const minSkill = Number(options.minSkill ?? 10);
        const maxSkill = Number(options.maxSkill ?? 100);
        const currentSkill = clamp(Number(skill) || minSkill, minSkill, maxSkill);
        const rawDelta = Number(baseDelta) || 0;
        const speedFactor = Number(options.speedFactor ?? 1);
        const factor = getAdaptiveSkillFactor(currentSkill, { minSkill, maxSkill });
        const nextSkill = clamp(currentSkill + rawDelta * factor * (Number.isFinite(speedFactor) ? speedFactor : 1), minSkill, maxSkill);
        return { skill: nextSkill, delta: nextSkill - currentSkill, factor };
    }

    function applyAdaptiveResult(skill, result, options = {}) {
        if (!["playerWin", "botWin", "draw"].includes(result)) {
            return { skill: clamp(Number(skill) || 10, 10, 100), delta: 0, factor: 1, baseDelta: 0, adjustment: 0, drawStreak: Number(options.drawStreak) || 0, applied: false };
        }
        const performance = clamp(Number(options.performance ?? 50), 0, 100);
        const influence = Number(options.performanceInfluence ?? 0.03);
        const adjustmentLimit = Math.max(0, Number(options.adjustmentLimit ?? 1.5));
        const previousDrawStreak = Math.max(0, Number(options.drawStreak) || 0);
        const drawStreak = result === "draw" ? previousDrawStreak + 1 : 0;
        const adjustment = result === "draw"
            ? 0
            : clamp((performance - 50) * (Number.isFinite(influence) ? influence : 0.03), -adjustmentLimit, adjustmentLimit);
        const baseDelta = result === "playerWin"
            ? 4 + adjustment
            : result === "botWin"
                ? -3 - adjustment
                : drawStreak >= Number(options.drawThreshold ?? 3) ? Number(options.drawDelta ?? 1) : 0;
        const applied = applyAdaptiveSkillDelta(skill, baseDelta, options);
        return { ...applied, baseDelta, adjustment, drawStreak, applied: true };
    }

    function getCurve(strength, curveShape = {}) {
        const normalized = clamp(Number(strength) || 0, 0, 1);
        // Eine gemeinsame monotone, nichtlineare Kurve fuer alle Spiele.
        const exponent = Number(curveShape.exponent) > 0
            ? Number(curveShape.exponent)
            : 1.15;
        return clamp(normalized ** exponent, 0, 1);
    }

    function normalizeSearchConfig(searchConfig) {
        if (!searchConfig || typeof searchConfig !== "object") {
            throw new TypeError("SharedDifficulty.createProfile benötigt searchConfig des Spiels.");
        }
        const { supportsMinimax, minDepth, maxDepth, fixedDepth = null } = searchConfig;
        if (typeof supportsMinimax !== "boolean") throw new TypeError("searchConfig.supportsMinimax muss boolean sein.");
        const min = Number(minDepth);
        const max = Number(maxDepth);
        if (!Number.isInteger(min) || !Number.isInteger(max)) {
            throw new TypeError("searchConfig.minDepth und maxDepth müssen ganzzahlige Werte sein.");
        }
        if (min < 0 || max < min) throw new RangeError("searchConfig verlangt 0 <= minDepth <= maxDepth.");
        let fixed = null;
        if (fixedDepth !== null && fixedDepth !== undefined) {
            fixed = Number(fixedDepth);
            if (!Number.isInteger(fixed) || fixed < min || fixed > max) {
                throw new RangeError("searchConfig.fixedDepth muss innerhalb von minDepth und maxDepth liegen.");
            }
        }
        return { supportsMinimax, minDepth: min, maxDepth: max, fixedDepth: fixed };
    }

    function getDepthRange({ curve, searchConfig }) {
        const { supportsMinimax, minDepth, maxDepth, fixedDepth } = searchConfig;
        if (!supportsMinimax) return { lowDepth: 0, highDepth: 0, highDepthChance: 0 };
        if (fixedDepth !== null) return { lowDepth: fixedDepth, highDepth: fixedDepth, highDepthChance: 0 };
        const rawDepth = minDepth + clamp(curve, 0, 1) * (maxDepth - minDepth);
        const lowDepth = Math.floor(rawDepth);
        const highDepth = Math.ceil(rawDepth);
        return { lowDepth, highDepth, highDepthChance: rawDepth - lowDepth };
    }

    function getDepth({ curve, searchConfig }) {
        const { minDepth, maxDepth, fixedDepth } = searchConfig;
        if (fixedDepth !== null && fixedDepth !== undefined) return fixedDepth;
        return minDepth + clamp(curve, 0, 1) * (maxDepth - minDepth);
    }

    function resolveFractionalDepth(depth, evaluateCurrent, evaluateOnePly) {
        const numericDepth = Number(depth);
        if (!(numericDepth > 0 && numericDepth < 1)) return null;
        const currentScore = Number(evaluateCurrent());
        const onePlyScore = Number(evaluateOnePly());
        if (!Number.isFinite(currentScore) || !Number.isFinite(onePlyScore)) return null;
        return currentScore * (1 - numericDepth) + onePlyScore * numericDepth;
    }

    function selectSoftCandidate(candidates, curve = 0, randomize = true) {
        if (!Array.isArray(candidates) || !candidates.length) return null;
        const ordered = candidates.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        if (!randomize || clamp(curve, 0, 1) >= 0.999) return ordered[0];
        const values = ordered.map(candidate => Number(candidate.score || 0));
        const best = values[0];
        const worst = values[values.length - 1];
        const span = Math.max(1e-9, best - worst);
        const normalized = values.map(value => (value - worst) / span);
        const temperature = 0.08 + (1 - clamp(curve, 0, 1)) * 0.92;
        const weights = normalized.map(value => Math.exp((value - 1) / temperature));
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let cursor = Math.random() * total;
        for (let index = 0; index < ordered.length; index += 1) {
            cursor -= weights[index];
            if (cursor <= 0) return ordered[index];
        }
        return ordered[ordered.length - 1];
    }

    function createProfile({
        mode = "manual", strength = 0, skill = null, searchConfig,
        minSearchChance = 0.08, maxSearchChance = 1.0,
        minRandomness = 0, maxRandomness = 0.88,
        minErrorRate = 0, maxErrorRate = 0.34,
        habitInfluence = 0, tacticalValues = null, playerProfile = null,
        gameContext = null, curveShape = {}
    } = {}) {
        const normalizedSearchConfig = normalizeSearchConfig(searchConfig);
        const isAdaptive = mode === "adaptive";
        const rawStrength = isAdaptive
            ? clamp((Number(skill) || 0) / 100, 0, 1)
            : clamp(Number(strength) || 0, 0, 1);
        const curve = getCurve(rawStrength, curveShape);
        const effectiveCurve = curve;
        const depthRange = getDepthRange({ curve: effectiveCurve, searchConfig: normalizedSearchConfig });
        const depth = getDepth({ curve: effectiveCurve, searchConfig: normalizedSearchConfig });
        // High skill must converge more sharply towards the reference path.
        // A linear residual leaves enough random/error events over a long game
        // to materially weaken otherwise deep-searching bots.
        const highSkillResidual = (1 - effectiveCurve) ** 2;
        const searchChance = !normalizedSearchConfig.supportsMinimax
            ? 0
            : maxSearchChance - highSkillResidual * (maxSearchChance - minSearchChance);

        return {
            mode, strength: rawStrength, curve: effectiveCurve, depth,
            lowDepth: depthRange.lowDepth,
            highDepth: depthRange.highDepth,
            highDepthChance: depthRange.highDepthChance,
            fraction: depthRange.highDepthChance,
            supportsMinimax: normalizedSearchConfig.supportsMinimax,
            minDepth: normalizedSearchConfig.minDepth,
            maxDepth: normalizedSearchConfig.maxDepth,
            fixedDepth: normalizedSearchConfig.fixedDepth,
            searchChance,
            randomChance: minRandomness + highSkillResidual * (maxRandomness - minRandomness),
            errorRate: minErrorRate + highSkillResidual * (maxErrorRate - minErrorRate),
            tacticalAccuracy: 0.30 + effectiveCurve * 0.68,
            habitInfluence: effectiveCurve * clamp(habitInfluence, 0, 1),
            tacticalValues: tacticalValues ?? {}, playerProfile, gameContext: gameContext ?? {},
            isAdaptive
        };
    }

    root.SharedDifficulty = Object.freeze({ clamp, smoothstep, getCurve, getAdaptiveSkillFactor, applyAdaptiveSkillDelta, applyAdaptiveResult, getDepth, getDepthRange, resolveFractionalDepth, selectSoftCandidate, createProfile });
})(window);
