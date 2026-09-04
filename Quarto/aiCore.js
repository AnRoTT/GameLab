/* Quarto-Regeln und phasenbasierte Suche fuer spaetere Bots. */
(function () {
    "use strict";

    const SIZE = 4;
    const PIECE_COUNT = 16;
    const WIN_SCORE = 100000;
    const MIN_OBSERVATION_MOVES = 12;
    const lines = [];

    for (let i = 0; i < SIZE; i += 1) {
        lines.push([0, 1, 2, 3].map((offset) => i * SIZE + offset));
        lines.push([0, 1, 2, 3].map((offset) => offset * SIZE + i));
    }
    lines.push([0, 5, 10, 15], [3, 6, 9, 12]);

    function cloneBoard(board) {
        return board.slice();
    }

    function cloneState(state) {
        return {
            board: cloneBoard(state.board),
            remainingPieces: state.remainingPieces.slice(),
            chooser: state.chooser,
            selectedPiece: state.selectedPiece,
            winner: state.winner ?? null,
            lastCell: state.lastCell ?? null,
            lastPlacer: state.lastPlacer ?? null
        };
    }

    function getOpenCells(board) {
        return board.map((piece, index) => piece === null ? index : -1)
            .filter((index) => index >= 0);
    }

    function hasCommonAttribute(pieces) {
        return [0, 1, 2, 3].some((bit) => pieces.every((piece) =>
            ((piece >> bit) & 1) === ((pieces[0] >> bit) & 1)
        ));
    }

    function getCommonAttributes(pieces) {
        const attributes = [
            { bit: 0, values: ["dunkle", "helle"] },
            { bit: 1, values: ["eckige", "runde"] },
            { bit: 2, values: ["kleine", "hohe"] },
            { bit: 3, values: ["hohle", "gefüllte"] }
        ];

        return attributes
            .filter(({ bit }) => pieces.every((piece) =>
                ((piece >> bit) & 1) === ((pieces[0] >> bit) & 1)
            ))
            .map(({ bit, values }) => values[(pieces[0] >> bit) & 1]);
    }

    function findWinningLine(board) {
        return lines.find((line) => line.every((index) => board[index] !== null) &&
            hasCommonAttribute(line.map((index) => board[index]))) || null;
    }

    function selectPiece(state, piece) {
        if (state.selectedPiece !== null || !state.remainingPieces.includes(piece)) return null;
        const next = cloneState(state);
        next.selectedPiece = piece;
        next.remainingPieces = next.remainingPieces.filter((candidate) => candidate !== piece);
        return next;
    }

    function placePiece(state, cell) {
        if (state.selectedPiece === null || state.board[cell] !== null) return null;
        const next = cloneState(state);
        const placer = 1 - state.chooser;
        next.board[cell] = state.selectedPiece;
        next.selectedPiece = null;
        next.chooser = 1 - state.chooser;
        next.lastCell = cell;
        next.lastPlacer = placer;
        next.winner = findWinningLine(next.board) ? placer : null;
        return next;
    }

    function getLegalActions(state) {
        return state.selectedPiece === null
            ? state.remainingPieces.slice()
            : getOpenCells(state.board);
    }

    function isTerminal(state) {
        return state.winner !== null ||
            (state.selectedPiece === null && state.remainingPieces.length === 0);
    }

    function countWinningPlacements(state, piece) {
        if (piece === null || piece === undefined) return 0;
        return getOpenCells(state.board).filter((cell) => {
            const next = cloneBoard(state.board);
            next[cell] = piece;
            return Boolean(findWinningLine(next));
        }).length;
    }

    const PLAYER_PROFILE_KEY = "andis-game-foundry-quarto-player-profile";
    function createPlayerProfile() {
        const profile = {
            totalMoves: 0,
            selectionCount: 0,
            selectedPieces: Array(PIECE_COUNT).fill(0),
            placedCells: Array(PIECE_COUNT).fill(0),
            attributes: {
                light: 0, dark: 0, round: 0, square: 0,
                tall: 0, short: 0, solid: 0, hollow: 0
            },
            zones: { corner: 0, edge: 0, center: 0 },
            tactics: {
                winningMoves: 0,
                missedWins: 0,
                dangerousGifts: 0,
                safeGifts: 0
            },
            observationReady: false
        };
        try {
            const stored = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || "null");
            if (stored && typeof stored === "object") Object.keys(profile).forEach((key) => { if (key in stored) profile[key] = stored[key]; });
        } catch (_) {}
        return profile;
    }
    function savePlayerProfile(profile) { try { localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile)); } catch (_) {} }
    function clearPlayerProfile(profile) { try { localStorage.removeItem(PLAYER_PROFILE_KEY); } catch (_) {} const fresh = createPlayerProfile(); Object.keys(profile).forEach((key) => { profile[key] = fresh[key]; }); }

    function recordPieceAttributes(profile, piece) {
        if ((piece & 1) !== 0) profile.attributes.light += 1;
        else profile.attributes.dark += 1;
        if ((piece & 2) !== 0) profile.attributes.round += 1;
        else profile.attributes.square += 1;
        if ((piece & 4) !== 0) profile.attributes.tall += 1;
        else profile.attributes.short += 1;
        if ((piece & 8) !== 0) profile.attributes.solid += 1;
        else profile.attributes.hollow += 1;
    }

    function getCellZone(cell) {
        const row = Math.floor(cell / SIZE);
        const column = cell % SIZE;
        const isCorner = (row === 0 || row === SIZE - 1) && (column === 0 || column === SIZE - 1);
        if (isCorner) return "corner";
        if (row === 1 || row === 2) return column === 1 || column === 2 ? "center" : "edge";
        return "edge";
    }

    function trackPlayerSelection(profile, piece, state, recipient = 1) {
        if (!profile || state.selectedPiece !== null || !state.remainingPieces.includes(piece)) return;
        profile.selectionCount += 1;
        profile.selectedPieces[piece] += 1;
        recordPieceAttributes(profile, piece);
        const winningPlacements = countWinningPlacements(state, piece);
        if (recipient !== 0 && winningPlacements > 0) profile.tactics.dangerousGifts += 1;
        else if (recipient !== 0) profile.tactics.safeGifts += 1;
        savePlayerProfile(profile);
    }

    function trackPlayerPlacement(profile, piece, cell, state) {
        if (!profile || state.selectedPiece !== piece || !getOpenCells(state.board).includes(cell)) return;
        profile.totalMoves += 1;
        profile.placedCells[cell] += 1;
        profile.zones[getCellZone(cell)] += 1;
        const winningCells = getOpenCells(state.board).filter((candidate) =>
            countWinningPlacements(state, piece) > 0 && (() => {
                const next = cloneBoard(state.board);
                next[candidate] = piece;
                return Boolean(findWinningLine(next));
            })()
        );
        if (winningCells.includes(cell)) profile.tactics.winningMoves += 1;
        else if (winningCells.length) profile.tactics.missedWins += 1;
        profile.observationReady = profile.totalMoves >= MIN_OBSERVATION_MOVES;
        savePlayerProfile(profile);
    }

    function countOpenLinePotential(board) {
        let score = 0;
        for (const line of lines) {
            const pieces = line.map((index) => board[index]).filter((piece) => piece !== null);
            if (!pieces.length || hasConflictingAttribute(pieces)) continue;
            score += pieces.length === 1 ? 2 : pieces.length === 2 ? 8 : 24;
        }
        return score;
    }

    function getPlacementValue(cell) {
        const row = Math.floor(cell / SIZE);
        const column = cell % SIZE;
        const isCorner = (row === 0 || row === SIZE - 1) && (column === 0 || column === SIZE - 1);
        if (isCorner) return 3;
        if (row >= 1 && row <= 2 && column >= 1 && column <= 2) return 4;
        return 1;
    }

    function countWinningPlacementsCached(state, piece, cache) {
        if (!cache) return countWinningPlacements(state, piece);
        const key = `${stateKey(state)}|${piece}`;
        if (!cache.winningPlacements.has(key)) cache.winningPlacements.set(key, countWinningPlacements(state, piece));
        return cache.winningPlacements.get(key);
    }

    function countWinningPieces(state, cache = null) {
        const cacheKey = cache ? stateKey(state) : null;
        if (cache && cache.winningPieces.has(cacheKey)) return cache.winningPieces.get(cacheKey);
        const result = state.remainingPieces.reduce((count, piece) =>
            count + (countWinningPlacementsCached(state, piece, cache) > 0 ? 1 : 0), 0
        );
        if (cache) cache.winningPieces.set(cacheKey, result);
        return result;
    }

    function hasConflictingAttribute(pieces) {
        return [0, 1, 2, 3].every((bit) => {
            const values = new Set(pieces.map((piece) => (piece >> bit) & 1));
            return values.size === 2;
        });
    }

    function evaluateState(state, botPlayer, cache = null) {
        if (state.winner !== null) return state.winner === botPlayer ? WIN_SCORE : -WIN_SCORE;
        if (state.selectedPiece === null && state.remainingPieces.length === 0) return 0;

        const nextPlayer = 1 - state.chooser;
        const perspective = nextPlayer === botPlayer ? 1 : -1;
        const immediateWins = state.selectedPiece === null
            ? countWinningPieces(state, cache)
            : countWinningPlacementsCached(state, state.selectedPiece, cache);
        const multipleThreatBonus = immediateWins >= 2 ? 900 : 0;
        const tacticalScore = perspective * (immediateWins * 2600 + multipleThreatBonus);
        const lineScore = perspective * countOpenLinePotential(state.board) * 8;

        const lastMoveScore = state.lastCell === null ? 0
            : (state.lastPlacer === botPlayer ? 1 : -1) * getPlacementValue(state.lastCell) * 12;
        const safePieceCount = state.remainingPieces.length - countWinningPieces(state);
        const safetyScore = perspective * safePieceCount * 18;
        return tacticalScore + lineScore + safetyScore + lastMoveScore;
    }

    function stateKey(state) {
        return `${state.board.map(piece => piece === null ? "." : piece.toString(16)).join("")}|${state.remainingPieces.map(piece => piece.toString(16)).join("")}|${state.chooser}|${state.selectedPiece ?? "."}|${state.winner ?? "."}|${state.lastCell ?? "."}|${state.lastPlacer ?? "."}`;
    }

    function canonicalBoardKey(board) {
        const transforms = [
            (r, c) => [r, c], (r, c) => [c, 3 - r],
            (r, c) => [3 - r, 3 - c], (r, c) => [3 - c, r],
            (r, c) => [r, 3 - c], (r, c) => [3 - r, c],
            (r, c) => [c, r], (r, c) => [3 - c, 3 - r]
        ];
        const keys = transforms.map(transform => {
            const cells = Array(16).fill(".");
            board.forEach((piece, index) => {
                const row = Math.floor(index / 4);
                const col = index % 4;
                const [nextRow, nextCol] = transform(row, col);
                cells[nextRow * 4 + nextCol] = piece === null ? "." : piece.toString(16);
            });
            return cells.join("");
        });
        return keys.sort()[0];
    }

    function evaluationStateKey(state, botPlayer) {
        return `${canonicalBoardKey(state.board)}|${state.remainingPieces.map(piece => piece.toString(16)).join("")}|${state.chooser}|${state.selectedPiece ?? "."}|${state.winner ?? "."}|${state.lastPlacer ?? "."}|${botPlayer}`;
    }

    function createSearchCache() {
        return { search: new Map(), evaluation: new Map(), next: new Map(), winningPieces: new Map(), winningPlacements: new Map(), history: new Map() };
    }

    // Quarto besteht aus zwei technischen Aktionen, aber die Platzierung und
    // die anschließende Steinwahl gehören zum selben vollständigen Zug des
    // Spielers. Tiefe wird deshalb nur beim tatsächlichen Spielerwechsel
    // reduziert.
    function actingPlayer(state) {
        return state.selectedPiece === null ? state.chooser : 1 - state.chooser;
    }

    function nextSearchDepth(state, next, depth) {
        return actingPlayer(state) === actingPlayer(next) ? depth : depth - 1;
    }

    function search(state, botPlayer, depth, alpha, beta, cache = createSearchCache()) {
        const baseKey = stateKey(state);
        const evaluationKey = evaluationStateKey(state, botPlayer);
        const evaluate = () => {
            if (!cache.evaluation.has(evaluationKey)) cache.evaluation.set(evaluationKey, evaluateState(state, botPlayer, cache));
            return cache.evaluation.get(evaluationKey);
        };
        // Suchergebnisse behalten die konkrete Brettausrichtung und dürfen
        // deshalb nicht den symmetrie-reduzierten Bewertungsschlüssel nutzen.
        const searchKey = `${baseKey}|${botPlayer}|${depth}`;
        const alphaOriginal = alpha;
        const betaOriginal = beta;
        const cached = cache.search.get(searchKey);
        if (cached) {
            if (cached.flag === "exact") return cached.value;
            if (cached.flag === "lower") alpha = Math.max(alpha, cached.value.score);
            if (cached.flag === "upper") beta = Math.min(beta, cached.value.score);
            if (alpha >= beta) return cached.value;
        }
        if (isTerminal(state) || depth <= 0) {
            const value = { score: evaluate(), action: null };
            cache.search.set(searchKey, { value, flag: "exact" });
            return value;
        }

        const actions = getLegalActions(state);
        if (!actions.length) return { score: evaluate(), action: null };

        const currentActor = actingPlayer(state);
        const maximizing = currentActor === botPlayer;
        const prepared = actions.map(action => {
            const nextKey = `${baseKey}|${action}`;
            if (!cache.next.has(nextKey)) {
                cache.next.set(nextKey, state.selectedPiece === null ? selectPiece(state, action) : placePiece(state, action));
            }
            const next = cache.next.get(nextKey);
            const historyKey = `${baseKey}|${action}|${depth}`;
            const historyBonus = cache.history.get(historyKey) || 0;
            return { action, next, order: (next ? evaluateState(next, botPlayer, cache) : (maximizing ? -Infinity : Infinity)) + historyBonus };
        }).filter(item => item.next).sort((a, b) => maximizing ? b.order - a.order : a.order - b.order);

        const fractionalScore = window.SharedDifficulty.resolveFractionalDepth(
            depth,
            evaluate,
            () => prepared.reduce((best, item) => maximizing ? Math.max(best, item.order) : Math.min(best, item.order), maximizing ? -Infinity : Infinity)
        );
        if (fractionalScore !== null) {
            const value = { score: fractionalScore, action: null };
            cache.search.set(searchKey, { value, flag: "exact" });
            return value;
        }

        let best = { score: maximizing ? -Infinity : Infinity, action: prepared[0].action };

        for (const { action, next } of prepared) {
            const candidate = search(next, botPlayer, nextSearchDepth(state, next, depth), alpha, beta, cache);
            if (maximizing && candidate.score > best.score) {
                best = { score: candidate.score, action };
            } else if (!maximizing && candidate.score < best.score) {
                best = { score: candidate.score, action };
            }

            if (maximizing) alpha = Math.max(alpha, best.score);
            else beta = Math.min(beta, best.score);
            if (beta <= alpha) {
                const historyKey = `${baseKey}|${action}|${depth}`;
                cache.history.set(historyKey, Math.min(100000, (cache.history.get(historyKey) || 0) + Math.max(1, depth * depth)));
                break;
            }
        }
        const flag = best.score <= alphaOriginal ? "upper" : best.score >= betaOriginal ? "lower" : "exact";
        cache.search.set(searchKey, { value: best, flag });
        return best;
    }

    function createInitialState(board, remainingPieces, chooser, selectedPiece = null) {
        return {
            board: cloneBoard(board),
            remainingPieces: remainingPieces.slice(),
            chooser,
            selectedPiece,
            winner: null,
            lastCell: null,
            lastPlacer: null
        };
    }

    function choosePiece(state, botPlayer, depth = 4, cache = null) {
        if (state.selectedPiece !== null) return null;
        const result = search(state, botPlayer, Math.max(0, depth), -Infinity, Infinity, cache || createSearchCache());
        return result.action;
    }

    function getScoredActions(state, botPlayer, depth = 4, cache = null) {
        const searchCache = cache || createSearchCache();
        return getLegalActions(state).map(action => {
            const next = state.selectedPiece === null ? selectPiece(state, action) : placePiece(state, action);
            const result = next ? search(next, botPlayer, Math.max(0, nextSearchDepth(state, next, depth)), -Infinity, Infinity, searchCache) : { score: -Infinity };
            return { action, score: result.score };
        });
    }

    function chooseCell(state, botPlayer, depth = 4, cache = null) {
        if (state.selectedPiece === null) return null;
        const result = search(state, botPlayer, Math.max(0, depth), -Infinity, Infinity, cache || createSearchCache());
        return result.action;
    }

    const MANUAL_PROFILES = window.QuartoSettings.manualStrengths;
    const manualOverrides = Object.create(null);
    try {
        const storedProfiles = JSON.parse(localStorage.getItem("gamelab-quarto-manual-profiles") || "{}");
        if (storedProfiles && typeof storedProfiles === "object") Object.entries(storedProfiles).forEach(([level, value]) => {
            if (["1", "2", "3", "4"].includes(level) && Number.isFinite(Number(value))) manualOverrides[level] = Math.max(0, Math.min(0.999, Number(value)));
        });
    } catch {}

    function getManualProfile(level = 1) {
        const base = MANUAL_PROFILES[level] || MANUAL_PROFILES[1];
        const isReference = String(level) === "reference";
        const baseStrength = typeof base === "number" ? base : base?.strength;
        const strength = isReference ? 1 : (manualOverrides[level] ?? baseStrength);
        const difficulty = window.SharedDifficulty.createProfile({
            mode: "manual",
            strength,
            ...window.QuartoSettings.difficulty,
            habitInfluence: window.QuartoSettings.manualHabitInfluence,
            minRandomness: isReference ? 0 : window.QuartoSettings.difficulty.minRandomness,
            minErrorRate: isReference ? 0 : window.QuartoSettings.difficulty.minErrorRate,
            searchConfig: window.QuartoSettings.searchConfig
        });
        return {
            ...(typeof base === "object" && base ? base : {}),
            level: isReference ? "reference" : Number(level),
            strength: difficulty.strength,
            curve: difficulty.curve,
            depth: difficulty.depth,
            immediateWinChance: difficulty.tacticalAccuracy,
            safeGiftChance: difficulty.tacticalAccuracy,
            lineChance: difficulty.tacticalAccuracy,
            positionChance: difficulty.habitInfluence,
            randomChance: difficulty.randomChance,
            minimaxChance: difficulty.searchChance,
            errorChance: difficulty.errorRate
        };
    }

    function setManualProfileStrength(level, value) {
        const key = String(level);
        if (key === "reference") return 1;
        manualOverrides[key] = Math.max(0, Math.min(0.999, Number(value) || 0));
        try { localStorage.setItem("gamelab-quarto-manual-profiles", JSON.stringify(manualOverrides)); } catch {}
        return manualOverrides[key];
    }

    window.QuartoAICore = {
        SIZE,
        PIECE_COUNT,
        lines,
        cloneBoard,
        cloneState,
        createInitialState,
        getOpenCells,
        MIN_OBSERVATION_MOVES,
        getLegalActions,
        selectPiece,
        placePiece,
        isTerminal,
        findWinningLine,
        countWinningPlacements,
        createPlayerProfile,
        trackPlayerSelection,
        trackPlayerPlacement,
        getCommonAttributes,
        evaluateState,
        createSearchCache,
        search,
        choosePiece,
        chooseCell,
        getScoredActions,
        getManualProfile,
        getManualReferenceProfile: () => getManualProfile("reference"),
        setManualProfileStrength
        ,clearPlayerProfile: () => clearPlayerProfile(window.quartoPlayerProfile)
    };
})();
