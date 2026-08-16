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

    function createPlayerProfile() {
        return {
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
    }

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

    function countWinningPieces(state) {
        return state.remainingPieces.reduce((count, piece) =>
            count + (countWinningPlacements(state, piece) > 0 ? 1 : 0), 0
        );
    }

    function hasConflictingAttribute(pieces) {
        return [0, 1, 2, 3].some((bit) => {
            const values = new Set(pieces.map((piece) => (piece >> bit) & 1));
            return values.size === 2;
        });
    }

    function evaluateState(state, botPlayer) {
        if (state.winner !== null) return state.winner === botPlayer ? WIN_SCORE : -WIN_SCORE;
        if (state.selectedPiece === null && state.remainingPieces.length === 0) return 0;

        const nextPlayer = 1 - state.chooser;
        const perspective = nextPlayer === botPlayer ? 1 : -1;
        const immediateWins = state.selectedPiece === null
            ? countWinningPieces(state)
            : countWinningPlacements(state, state.selectedPiece);
        const multipleThreatBonus = immediateWins >= 2 ? 900 : 0;
        const tacticalScore = perspective * (immediateWins * 2600 + multipleThreatBonus);
        const lineScore = perspective * countOpenLinePotential(state.board) * 8;

        const lastMoveScore = state.lastCell === null ? 0
            : (state.lastPlacer === botPlayer ? 1 : -1) * getPlacementValue(state.lastCell) * 12;
        const safePieceCount = state.remainingPieces.length - countWinningPieces(state);
        const safetyScore = perspective * safePieceCount * 18;
        return tacticalScore + lineScore + safetyScore + lastMoveScore;
    }

    function search(state, botPlayer, depth, alpha, beta) {
        if (isTerminal(state) || depth <= 0) return { score: evaluateState(state, botPlayer), action: null };

        const actions = getLegalActions(state);
        if (!actions.length) return { score: evaluateState(state, botPlayer), action: null };

        const actingPlayer = state.selectedPiece === null ? state.chooser : 1 - state.chooser;
        const maximizing = actingPlayer === botPlayer;
        let best = { score: maximizing ? -Infinity : Infinity, action: actions[0] };

        for (const action of actions) {
            const next = state.selectedPiece === null
                ? selectPiece(state, action)
                : placePiece(state, action);
            if (!next) continue;

            const candidate = search(next, botPlayer, depth - 1, alpha, beta);
            if (maximizing && candidate.score > best.score) {
                best = { score: candidate.score, action };
            } else if (!maximizing && candidate.score < best.score) {
                best = { score: candidate.score, action };
            }

            if (maximizing) alpha = Math.max(alpha, best.score);
            else beta = Math.min(beta, best.score);
            if (beta <= alpha) break;
        }
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

    function choosePiece(state, botPlayer, depth = 4) {
        if (state.selectedPiece !== null) return null;
        const result = search(state, botPlayer, Math.max(1, depth), -Infinity, Infinity);
        return result.action;
    }

    function chooseCell(state, botPlayer, depth = 4) {
        if (state.selectedPiece === null) return null;
        const result = search(state, botPlayer, Math.max(1, depth), -Infinity, Infinity);
        return result.action;
    }

    const MANUAL_PROFILES = Object.freeze({
        1: { strength: 0.30 },
        2: { strength: 0.48 },
        3: { strength: 0.68 },
        4: { strength: 0.85 },
        reference: { strength: 1.0 }
    });
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
        const strength = isReference ? 1 : (manualOverrides[level] ?? base.strength);
        const difficulty = window.SharedDifficulty.createProfile({
            mode: "manual",
            strength,
            minSearchChance: 0.08,
            maxSearchChance: 1.0,
            minRandomness: 0.02,
            maxRandomness: 0.88,
            minErrorRate: 0.02,
            maxErrorRate: 0.34,
            habitInfluence: 0.60,
            searchConfig: {
                supportsMinimax: true,
                minDepth: 0,
                maxDepth: 4,
                fixedDepth: null
            }
        });
        return {
            ...base,
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
        search,
        choosePiece,
        chooseCell,
        getManualProfile,
        getManualReferenceProfile: () => getManualProfile("reference"),
        setManualProfileStrength
    };
})();
