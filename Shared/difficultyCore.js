/* Gemeinsame Difficulty-Berechnung fuer manuelle und adaptive Bots. */
(function (root) {
    "use strict";


    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function smoothstep(value) {
        const normalized = clamp(Number(value) || 0, 0, 1);
        return normalized * normalized * (3 - 2 * normalized);
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

    function getDepth({ curve, searchConfig }) {
        const { supportsMinimax, minDepth, maxDepth, fixedDepth } = searchConfig;
        if (!supportsMinimax) return 0;
        if (fixedDepth !== null) return fixedDepth;
        if (maxDepth === minDepth) return minDepth;
        if (curve >= 1) return maxDepth;
        return clamp(
            minDepth + Math.round(curve * (maxDepth - minDepth)),
            minDepth,
            maxDepth
        );
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

    root.SharedDifficulty = Object.freeze({ clamp, smoothstep, getCurve, getDepth, createProfile });
})(window);
