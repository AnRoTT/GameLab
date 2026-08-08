const OTHELLO_DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

const OTHELLO_POSITION_MATRIX = [
    [120, -35, 20, 8, 8, 20, -35, 120],
    [-35, -50, -10, -5, -5, -10, -50, -35],
    [20, -10, 15, 5, 5, 15, -10, 20],
    [8, -5, 5, 3, 3, 5, -5, 8],
    [8, -5, 5, 3, 3, 5, -5, 8],
    [20, -10, 15, 5, 5, 15, -10, 20],
    [-35, -50, -10, -5, -5, -10, -50, -35],
    [120, -35, 20, 8, 8, 20, -35, 120]
];

function createOthelloPlayerProfile() {
    return {
        gamesPlayed: 0,
        movesPlayed: 0,
        opening: { center: 0, corner: 0, edge: 0 },
        positions: {
            favorites: Array.from({ length: 64 }, () => 0),
            rowBias: Array(8).fill(0),
            colBias: Array(8).fill(0),
            zones: { center: 0, corner: 0, edge: 0 }
        },
        style: {
            aggressive: 0,
            defensive: 0,
            risky: 0,
            careful: 0
        },
        mistakes: {
            missedWins: 0,
            missedBlocks: 0
        },
        pressure: {
            underPressureMoves: 0,
            pressureMistakes: 0
        },
        mobility: {
            movesBefore: 0,
            movesAfter: 0,
            restrictedOpponentMoves: 0,
            openedOpponentMoves: 0
        },
        risk: {
            greedyMoves: 0,
            riskyMoves: 0,
            cornerThreats: 0
        },
        phases: {
            opening: 0,
            midgame: 0,
            endgame: 0
        }
    };
}

function getOthelloZone(r, c) {
    if ((r === 0 || r === 7) && (c === 0 || c === 7)) return "corner";
    if (r === 0 || r === 7 || c === 0 || c === 7) return "edge";
    if (r >= 2 && r <= 5 && c >= 2 && c <= 5) return "center";
    return "edge";
}

function othelloTrackPlayerMove(state, move, player, isPressureMove = false) {
    if (!state || !state.playerProfile) return;
    const profile = state.playerProfile;
    profile.movesPlayed += 1;
    profile.positions.favorites[move.r * 8 + move.c] += 1;
    profile.positions.rowBias[move.r] += 1;
    profile.positions.colBias[move.c] += 1;
    const zone = getOthelloZone(move.r, move.c);
    profile.positions.zones[zone] += 1;

    const turnIndex = state.board.flat().filter(Boolean).length;
    if (turnIndex <= 8) {
        profile.phases.opening += 1;
        if (move.r >= 2 && move.r <= 5 && move.c >= 2 && move.c <= 5) profile.opening.center += 1;
        else if (othelloIsCornerMove(move)) profile.opening.corner += 1;
        else profile.opening.edge += 1;
    } else if (turnIndex <= 40) {
        profile.phases.midgame += 1;
    } else {
        profile.phases.endgame += 1;
    }

    if (isPressureMove) profile.pressure.underPressureMoves += 1;
}

function othelloRecordMistake(state, kind) {
    if (!state || !state.playerProfile) return;
    if (kind === "win") state.playerProfile.mistakes.missedWins += 1;
    if (kind === "block") state.playerProfile.mistakes.missedBlocks += 1;
    if (kind === "pressure") state.playerProfile.pressure.pressureMistakes += 1;
}

function othelloTrackMoveQuality(state, move, player, beforeBoard, beforePlayerMoves, beforeOpponentMoves) {
    if (!state || !state.playerProfile || !beforeBoard) return;
    const profile = state.playerProfile;
    const opponent = player === "black" ? "white" : "black";
    const afterOpponentMoves = getAllValidMovesForState(opponent, state.board);
    const afterPlayerMoves = getAllValidMovesForState(player, state.board);
    const beforeCorners = beforeOpponentMoves.filter(othelloIsCornerMove);
    const afterCorners = afterOpponentMoves.filter(othelloIsCornerMove);
    const playedCorner = othelloIsCornerMove(move);

    profile.mobility.movesBefore += beforeOpponentMoves.length;
    profile.mobility.movesAfter += afterOpponentMoves.length;
    if (afterOpponentMoves.length < beforeOpponentMoves.length) profile.mobility.restrictedOpponentMoves += 1;
    if (afterOpponentMoves.length > beforeOpponentMoves.length) profile.mobility.openedOpponentMoves += 1;

    const flippedCount = state.board.flat().filter(cell => cell === player).length
        - beforeBoard.flat().filter(cell => cell === player).length;
    if (flippedCount >= 5) profile.risk.greedyMoves += 1;
    if (afterCorners.length > 0) profile.risk.cornerThreats += 1;
    if (afterCorners.length > beforeCorners.length || (afterOpponentMoves.length > beforeOpponentMoves.length && !playedCorner)) {
        profile.risk.riskyMoves += 1;
    }

    // In Othello sind Ecken die klarste unmittelbare Gewinnchance.
    const playerCorners = getAllValidMovesForState(player, beforeBoard).filter(othelloIsCornerMove);
    if (playerCorners.length && !playedCorner) othelloRecordMistake(state, "win");
    if (beforeCorners.length && afterCorners.length >= beforeCorners.length) othelloRecordMistake(state, "block");
    if (beforeOpponentMoves.length <= 4 && afterOpponentMoves.length > beforeOpponentMoves.length) {
        othelloRecordMistake(state, "pressure");
    }
}

function othelloCloneBoard(srcBoard) {
    return srcBoard.map(row => row.slice());
}

function othelloCountPieces(state) {
    let black = 0;
    let white = 0;
    for (const row of state) {
        for (const cell of row) {
            if (cell === "black") black++;
            if (cell === "white") white++;
        }
    }
    return { black, white };
}

function othelloIsCornerMove(move) {
    return (
        (move.r === 0 && move.c === 0) ||
        (move.r === 0 && move.c === 7) ||
        (move.r === 7 && move.c === 0) ||
        (move.r === 7 && move.c === 7)
    );
}

function othelloIsEdgeMove(move) {
    return move.r === 0 || move.r === 7 || move.c === 0 || move.c === 7;
}

function othelloApplyMoveToState(state, move, player) {
    const next = othelloCloneBoard(state);
    const opponent = player === "black" ? "white" : "black";
    next[move.r][move.c] = player;

    for (const [dr, dc] of OTHELLO_DIRECTIONS) {
        let nr = move.r + dr;
        let nc = move.c + dc;
        const toFlip = [];
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && next[nr][nc] === opponent) {
            toFlip.push([nr, nc]);
            nr += dr;
            nc += dc;
        }
        if (toFlip.length && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && next[nr][nc] === player) {
            toFlip.forEach(([r, c]) => {
                next[r][c] = player;
            });
        }
    }
    return next;
}

function getAllValidMovesForState(player, state) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMoveState(r, c, player, state)) moves.push({ r, c });
        }
    }
    return moves;
}

function isValidMoveState(r, c, player, state) {
    if (state[r][c]) return false;
    const opponent = player === "black" ? "white" : "black";
    for (const [dr, dc] of OTHELLO_DIRECTIONS) {
        let nr = r + dr;
        let nc = c + dc;
        let foundOpponent = false;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && state[nr][nc] === opponent) {
            foundOpponent = true;
            nr += dr;
            nc += dc;
        }
        if (foundOpponent && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && state[nr][nc] === player) {
            return true;
        }
    }
    return false;
}

function othelloScoreMove(state, move, player, profile = null, weights = {}) {
    const opponent = player === "black" ? "white" : "black";
    const nextState = othelloApplyMoveToState(state, move, player);
    const opponentMoves = getAllValidMovesForState(opponent, nextState);
    const pieces = othelloCountPieces(nextState);
    const positionWeight = weights.position ?? 1;
    const mobilityWeight = weights.mobility ?? 6;
    const piecesWeight = weights.pieces ?? 1;
    let score = OTHELLO_POSITION_MATRIX[move.r][move.c] * positionWeight;
    const nearCorner = (
        (move.r <= 1 && move.c <= 1) ||
        (move.r <= 1 && move.c >= 6) ||
        (move.r >= 6 && move.c <= 1) ||
        (move.r >= 6 && move.c >= 6)
    );
    if (nearCorner && !othelloIsCornerMove(move)) score -= 90;
    score -= opponentMoves.length * mobilityWeight;
    score += (player === "black" ? pieces.black - pieces.white : pieces.white - pieces.black) * piecesWeight;
    if (profile) {
        const index = move.r * 8 + move.c;
        score += profile.positions.favorites[index] * 0.15;
        score += profile.positions.rowBias[move.r] * 0.05;
        score += profile.positions.colBias[move.c] * 0.05;
    }
    return score;
}

function othelloEvaluateState(state, player, weights = {}) {
    const opponent = player === "black" ? "white" : "black";
    const pieces = othelloCountPieces(state);
    const own = player === "black" ? pieces.black : pieces.white;
    const enemy = player === "black" ? pieces.white : pieces.black;
    const ownMoves = getAllValidMovesForState(player, state).length;
    const enemyMoves = getAllValidMovesForState(opponent, state).length;
    const mobilityWeight = weights.mobility ?? 12;
    const piecesWeight = weights.pieces ?? 2;
    const positionWeight = weights.position ?? 1;
    let score = (own - enemy) * piecesWeight + (ownMoves - enemyMoves) * mobilityWeight;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (state[r][c] === player) score += OTHELLO_POSITION_MATRIX[r][c] * positionWeight;
            if (state[r][c] === opponent) score -= OTHELLO_POSITION_MATRIX[r][c] * positionWeight;
        }
    }

    for (const move of [{ r: 0, c: 0 }, { r: 0, c: 7 }, { r: 7, c: 0 }, { r: 7, c: 7 }]) {
        if (state[move.r][move.c] === player) score += 120;
        if (state[move.r][move.c] === opponent) score -= 120;
    }
    return score;
}

function othelloChooseMinimaxMove(state, player, depth = 3, randomness = 0, weights = {}) {
    const opponent = player === "black" ? "white" : "black";
    const rootMoves = getAllValidMovesForState(player, state);
    if (!rootMoves.length) return null;

    function search(currentState, turn, remainingDepth, alpha, beta, passed) {
        const moves = getAllValidMovesForState(turn, currentState);
        const other = turn === "black" ? "white" : "black";
        if (remainingDepth <= 0 || (passed && !moves.length)) {
            return othelloEvaluateState(currentState, player, weights);
        }
        if (!moves.length) return search(currentState, other, remainingDepth - 1, alpha, beta, true);

        const maximizing = turn === player;
        let best = maximizing ? -Infinity : Infinity;
        for (const move of moves) {
            const next = othelloApplyMoveToState(currentState, move, turn);
            const value = search(next, other, remainingDepth - 1, alpha, beta, false);
            best = maximizing ? Math.max(best, value) : Math.min(best, value);
            if (maximizing) alpha = Math.max(alpha, best);
            else beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }

    const scored = rootMoves.map(move => ({
        move,
        score: search(othelloApplyMoveToState(state, move, player), opponent, depth - 1, -Infinity, Infinity, false)
    })).sort((a, b) => b.score - a.score);

    const bestScore = scored[0].score;
    const candidates = scored.filter(item => item.score >= bestScore - randomness);
    return candidates[Math.floor(Math.random() * candidates.length)].move;
}

function getOthelloDifficultyProfile(skill) {
    const normalized = Math.max(0, Math.min(100, Number(skill) || 0)) / 100;
    const challenge = normalized <= 0.75
        ? 0.75 * ((normalized / 0.75) ** 2 * (3 - 2 * (normalized / 0.75)))
        : 0.75 + ((normalized - 0.75) / 0.25) ** 1.8 * 0.25;

    return {
        challenge,
        randomness: Math.max(0.03, 0.38 - challenge * 0.34),
        tacticalAccuracy: Math.min(0.98, 0.32 + challenge * 0.64),
        position: 0.8 + challenge * 1.0,
        mobility: 5 + challenge * 14,
        pieces: 0.5 + challenge * 1.5,
        maxDepth: 4,
        thinkTime: 300 + challenge * 900
    };
}

window.OthelloAICore = {
    createOthelloPlayerProfile,
    getOthelloZone,
    othelloTrackPlayerMove,
    othelloRecordMistake,
    othelloTrackMoveQuality,
    othelloCloneBoard,
    othelloCountPieces,
    othelloIsCornerMove,
    othelloIsEdgeMove,
    othelloApplyMoveToState,
    othelloScoreMove,
    OTHELLO_POSITION_MATRIX,
    othelloEvaluateState,
    othelloChooseMinimaxMove,
    getDifficultyProfile: getOthelloDifficultyProfile,
    getAllValidMovesForState,
    isValidMoveState
};
