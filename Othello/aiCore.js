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

const OTHELLO_PLAYER_PROFILE_KEY = "andis-game-foundry-othello-player-profile";
function saveOthelloPlayerProfile(profile) { try { localStorage.setItem(OTHELLO_PLAYER_PROFILE_KEY, JSON.stringify(profile)); } catch (_) {} }
function clearOthelloPlayerProfile(profile) { try { localStorage.removeItem(OTHELLO_PLAYER_PROFILE_KEY); } catch (_) {} const fresh = createOthelloPlayerProfile(); Object.keys(profile).forEach((key) => { profile[key] = fresh[key]; }); }
function loadOthelloPlayerProfile(profile) {
    try {
        const stored = JSON.parse(localStorage.getItem(OTHELLO_PLAYER_PROFILE_KEY) || "null");
        if (stored && typeof stored === "object") Object.keys(profile).forEach((key) => { if (key in stored) profile[key] = stored[key]; });
    } catch (_) {}
    return profile;
}

function createOthelloPlayerProfile() {
    return loadOthelloPlayerProfile({
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
    });
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
    saveOthelloPlayerProfile(profile);
}

function othelloRecordMistake(state, kind) {
    if (!state || !state.playerProfile) return;
    if (kind === "win") state.playerProfile.mistakes.missedWins += 1;
    if (kind === "block") state.playerProfile.mistakes.missedBlocks += 1;
    if (kind === "pressure") state.playerProfile.pressure.pressureMistakes += 1;
    saveOthelloPlayerProfile(state.playerProfile);
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
    saveOthelloPlayerProfile(profile);

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

function othelloApplyMove(state, move, player) {
    if (!isValidMoveState(move.r, move.c, player, state)) return null;
    const next = othelloCloneBoard(state);
    const opponent = player === "black" ? "white" : "black";
    const flips = [];
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
            flips.push(...toFlip);
        }
    }
    return { board: next, move: { r: move.r, c: move.c }, flips };
}

function othelloApplyMoveToState(state, move, player) {
    const result = othelloApplyMove(state, move, player);
    return result ? result.board : null;
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
    if (othelloIsEdgeMove(move) && !othelloIsCornerMove(move)) {
        let corner = null;
        if (move.r === 0) corner = state[0][move.c < 4 ? 0 : 7];
        else if (move.r === 7) corner = state[7][move.c < 4 ? 0 : 7];
        else if (move.c === 0) corner = state[move.r < 4 ? 0 : 7][0];
        else if (move.c === 7) corner = state[move.r < 4 ? 0 : 7][7];
        const distance = (move.r === 0 || move.r === 7)
            ? Math.min(move.c, 7 - move.c)
            : Math.min(move.r, 7 - move.r);
        if (!corner) score -= distance === 1 ? 82 : distance === 2 ? 28 : 8;
        else if (corner === player) score += 28;
    }
    if ((move.r === 1 || move.r === 6) && (move.c === 1 || move.c === 6)) {
        const corner = state[move.r === 1 ? 0 : 7][move.c === 1 ? 0 : 7];
        if (!corner) score -= 105;
        else if (corner === player) score += 18;
    }
    score -= opponentMoves.length * mobilityWeight;
    score += (player === "black" ? pieces.black - pieces.white : pieces.white - pieces.black) * piecesWeight;
    const frontier = (colour) => {
        let count = 0;
        for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
            if (nextState[r][c] !== colour) continue;
            if (OTHELLO_DIRECTIONS.some(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                return nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !nextState[nr][nc];
            })) count += 1;
        }
        return count;
    };
    const ownColour = player;
    const enemyColour = player === "black" ? "white" : "black";
    score += (frontier(enemyColour) - frontier(ownColour)) * (weights.frontier ?? 3);
    score += (othelloStableCount(nextState, player) - othelloStableCount(nextState, opponent))
        * (weights.stability ?? 10);
    if (profile) {
        const index = move.r * 8 + move.c;
        score += profile.positions.favorites[index] * 0.15;
        score += profile.positions.rowBias[move.r] * 0.05;
        score += profile.positions.colBias[move.c] * 0.05;
    }
    return score;
}

function othelloStableEdgeCount(state, player) {
    const edges = [
        [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7]],
        [[7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7]],
        [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0]],
        [[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]]
    ];
    const stableCells = new Set();
    for (const edge of edges) {
        if (state[edge[0][0]][edge[0][1]] !== player) continue;
        for (const [r, c] of edge) { if (state[r][c] !== player) break; stableCells.add(`${r},${c}`); }
        for (const [r, c] of edge.slice().reverse()) { if (state[r][c] !== player) break; stableCells.add(`${r},${c}`); }
    }
    return stableCells.size;
}

// Konservative Stabilitaetsberechnung: Ein Stein wird nur dann als stabil
// gewertet, wenn er in jeder Achse von einer Brettkante oder bereits
// bestaetigten eigenen stabilen Steinen abgesichert ist. Dadurch werden auch
// vorbereitende Zuege erkannt, ohne unsichere Innensteine zu ueberbewerten.
function othelloStableCount(state, player) {
    const stable = new Set();
    const key = (r, c) => `${r},${c}`;
    const corners = [[0, 0], [0, 7], [7, 0], [7, 7]];
    corners.forEach(([r, c]) => {
        if (state[r][c] === player) stable.add(key(r, c));
    });
    const axes = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const closedTowards = (r, c, dr, dc) => {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (state[nr][nc] !== player) return false;
            if (stable.has(key(nr, nc))) return true;
            nr += dr;
            nc += dc;
        }
        return true;
    };
    let changed = true;
    while (changed) {
        changed = false;
        for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
            const cellKey = key(r, c);
            if (state[r][c] !== player || stable.has(cellKey)) continue;
            const isStable = axes.every(([dr, dc]) =>
                closedTowards(r, c, dr, dc) || closedTowards(r, c, -dr, -dc)
            );
            if (isStable) {
                stable.add(cellKey);
                changed = true;
            }
        }
    }
    return stable.size;
}

function othelloPotentialMobility(state, player) {
    const opponent = player === "black" ? "white" : "black";
    let count = 0;
    for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
        if (state[r][c]) continue;
        if (OTHELLO_DIRECTIONS.some(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            return nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && state[nr][nc] === opponent;
        })) count += 1;
    }
    return count;
}

function othelloEvaluateState(state, player, weights = {}, turn = null) {
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
    score += (othelloStableCount(state, player) - othelloStableCount(state, opponent)) * (weights.stability ?? 10);
    // Eigene potentielle Zugfelder sind gut, gegnerische potentielle Zugfelder
    // erhoehen dagegen den kuenftigen Druck auf die Stellung.
    score += (othelloPotentialMobility(state, player) - othelloPotentialMobility(state, opponent)) * (weights.potentialMobility ?? 3);
    const emptyCount = state.flat().filter(cell => !cell).length;
    if (emptyCount <= 12 && turn) {
        const playerGetsLastMove = emptyCount % 2 === 1 ? turn === player : turn !== player;
        score += (playerGetsLastMove ? 1 : -1) * (weights.parity ?? 8);
    }
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

function othelloChooseMinimaxMove(state, player, depth = 3, randomness = 0, weights = {}, selectionCurve = null, selectionMode = "soft") {
    const opponent = player === "black" ? "white" : "black";
    const rootMoves = getAllValidMovesForState(player, state);
    if (!rootMoves.length) return null;
    const transpositionTable = new Map();
    const legalMovesCache = new Map();
    const evaluationCache = new Map();
    const nextStateCache = new Map();

    const boardKey = (currentState) => currentState.map(row => row.map(cell => cell === "black" ? "b" : cell === "white" ? "w" : ".").join("")).join("");
    const tableKey = (currentState, turn, remainingDepth, passed) =>
        `${boardKey(currentState)}|${turn}|${remainingDepth}|${passed ? 1 : 0}`;
    const getCachedMoves = (currentState, turn) => {
        const key = `${boardKey(currentState)}|${turn}`;
        if (!legalMovesCache.has(key)) legalMovesCache.set(key, getAllValidMovesForState(turn, currentState));
        return legalMovesCache.get(key);
    };
    const getCachedNextState = (currentState, move, turn) => {
        const key = `${boardKey(currentState)}|${turn}|${move.r},${move.c}`;
        if (!nextStateCache.has(key)) nextStateCache.set(key, othelloApplyMoveToState(currentState, move, turn));
        return nextStateCache.get(key);
    };
    const getCachedEvaluation = (currentState, turn) => {
        const key = `${boardKey(currentState)}|${turn}`;
        if (!evaluationCache.has(key)) evaluationCache.set(key, othelloEvaluateState(currentState, player, weights, turn));
        return evaluationCache.get(key);
    };
    const getMoveOrderScore = (move, turn) => {
        const positional = OTHELLO_POSITION_MATRIX[move.r][move.c];
        const edgeBonus = move.r === 0 || move.r === 7 || move.c === 0 || move.c === 7 ? 12 : 0;
        const rootPerspective = turn === player ? 1 : -1;
        return rootPerspective * (positional + edgeBonus);
    };

    const terminalScore = (currentState) => {
        const pieces = othelloCountPieces(currentState);
        const own = player === "black" ? pieces.black : pieces.white;
        const enemy = player === "black" ? pieces.white : pieces.black;
        const difference = own - enemy;
        if (difference === 0) return 0;
        return Math.sign(difference) * 100000 + difference * 100;
    };

    function search(currentState, turn, remainingDepth, alpha, beta, passed) {
        const alphaOriginal = alpha;
        const betaOriginal = beta;
        const key = tableKey(currentState, turn, remainingDepth, passed);
        const cached = transpositionTable.get(key);
        if (cached) {
            if (cached.flag === "exact") return cached.score;
            if (cached.flag === "lower") alpha = Math.max(alpha, cached.score);
            if (cached.flag === "upper") beta = Math.min(beta, cached.score);
            if (alpha >= beta) return cached.score;
        }

        const moves = getCachedMoves(currentState, turn);
        const other = turn === "black" ? "white" : "black";
        if (passed && !moves.length) {
            const score = terminalScore(currentState);
            transpositionTable.set(key, { score, flag: "exact" });
            return score;
        }
        if (remainingDepth <= 0) {
            const score = getCachedEvaluation(currentState, turn);
            transpositionTable.set(key, { score, flag: "exact" });
            return score;
        }
        if (!moves.length) {
            // Ein Pass ist keine gespielte Aktion und darf daher keine
            // zusätzliche Minimax-Tiefe verbrauchen.
            return search(currentState, other, remainingDepth, alpha, beta, true);
        }
        const fractionalScore = window.SharedDifficulty.resolveFractionalDepth(
            remainingDepth,
            () => getCachedEvaluation(currentState, turn),
            () => {
                const maximizing = turn === player;
                return moves.reduce((best, move) => {
                    const value = getCachedEvaluation(getCachedNextState(currentState, move, turn), other);
                    return maximizing ? Math.max(best, value) : Math.min(best, value);
                }, maximizing ? -Infinity : Infinity);
            }
        );
        if (fractionalScore !== null) {
            transpositionTable.set(key, { score: fractionalScore, flag: "exact" });
            return fractionalScore;
        }
        const maximizing = turn === player;
        // Examine strategically promising moves first so alpha-beta can prune
        // more branches without changing the resulting minimax value.
        const orderedMoves = moves
            .map(move => ({ move, score: getMoveOrderScore(move, turn) }))
            .sort((a, b) => maximizing ? b.score - a.score : a.score - b.score)
            .map(entry => entry.move);
        let best = maximizing ? -Infinity : Infinity;
        for (const move of orderedMoves) {
            const next = getCachedNextState(currentState, move, turn);
            const value = search(next, other, remainingDepth - 1, alpha, beta, false);
            best = maximizing ? Math.max(best, value) : Math.min(best, value);
            if (maximizing) alpha = Math.max(alpha, best);
            else beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        const flag = best <= alphaOriginal ? "upper" : best >= betaOriginal ? "lower" : "exact";
        transpositionTable.set(key, { score: best, flag });
        return best;
    }

    const scored = rootMoves.map(move => ({
        move,
        score: search(getCachedNextState(state, move, player), opponent, depth - 1, -Infinity, Infinity, false)
    })).sort((a, b) => b.score - a.score);

    // Der adaptive Bot behält die zentrale Auswahl. Manuelle Othello-Bots
    // nutzen dagegen eine rangbasierte, strikt begrenzte Auswahl, damit ein
    // schwächeres Profil keine beliebig schlechte strategische Variante
    // wählen und dadurch gegen den R-Bot zufällig besser abschneiden kann.
    if (selectionMode !== "ranked" && selectionCurve !== null && selectionCurve !== undefined) {
        return window.SharedDifficulty.selectSoftCandidate(scored, selectionCurve, true)?.move || scored[0].move;
    }
    const bestScore = scored[0].score;
    const curve = Math.max(0, Math.min(1, Number(selectionCurve) || 0));
    const deviationChance = Math.min(0.08, (1 - curve) * 0.35);
    if (Math.random() >= deviationChance) return scored[0].move;

    const nearBest = scored
        .filter(item => bestScore - item.score <= 1.0)
        .slice(0, 3);
    if (nearBest.length < 2) return scored[0].move;
    return nearBest[1 + Math.floor(Math.random() * (nearBest.length - 1))].move;
}

const OTHELLO_MANUAL_PROFILES = window.OthelloSettings.manualStrengths;
const othelloManualOverrides = Object.create(null);
try {
    const storedOthelloProfiles = JSON.parse(localStorage.getItem("gamelab-othello-manual-profiles") || "{}");
    if (storedOthelloProfiles && typeof storedOthelloProfiles === "object") {
        Object.entries(storedOthelloProfiles).forEach(([level, value]) => {
            if (["1", "2", "3", "4"].includes(level) && Number.isFinite(Number(value))) {
                othelloManualOverrides[level] = Math.max(0, Math.min(0.999, Number(value)));
            }
        });
    }
} catch {}

function getOthelloManualProfile(level = 1) {
    const numericLevel = Number(level);
    const profileKey = level === "reference" || level === "referenz"
        ? "reference"
        : (Number.isInteger(numericLevel) && OTHELLO_MANUAL_PROFILES[numericLevel] ? numericLevel : 1);
    const base = OTHELLO_MANUAL_PROFILES[profileKey];
    const baseStrength = typeof base === "number" ? base : base?.strength;
    const strength = profileKey === "reference" ? 1 : othelloManualOverrides[profileKey] ?? baseStrength;
    const scale = Math.max(0, Math.min(1, Number(strength) || 0));
    const difficulty = window.SharedDifficulty.createProfile({
        mode: "manual",
        strength: scale,
        ...window.OthelloSettings.difficulty,
        habitInfluence: window.OthelloSettings.manualHabitInfluence,
        searchConfig: window.OthelloSettings.searchConfig
    });
    const curve = difficulty.curve;
    // Tiefe und weiche Auswahl kommen direkt aus der gemeinsamen Difficulty.
    // Es gibt keine zusätzliche Othello-spezifische Hochstufen-Kurve.
    const depth = difficulty.depth;
    const lowDepth = difficulty.lowDepth;
    const highDepth = difficulty.highDepth;
    const selectionCurve = curve;
    const weights = {
        position: curve,
        mobility: curve * 12,
        pieces: curve * 2,
        stability: curve * 10,
        potentialMobility: curve * 3
    };
    return {
        ...(typeof base === "object" && base ? base : {}),
        level: profileKey,
        ...difficulty,
        strength: scale,
        curve,
        depth,
        lowDepth,
        highDepth,
        highDepthChance: difficulty.highDepthChance,
        fraction: difficulty.fraction,
        selectionCurve,
        learnedUsage: difficulty.habitInfluence,
        cornerChance: difficulty.tacticalAccuracy * curve,
        edgeChance: 0.25 + difficulty.tacticalAccuracy * curve * 0.45,
        weights
    };
}

function setOthelloManualProfileStrength(level, value) {
    const key = String(level);
    if (key === "reference") return 1;
    othelloManualOverrides[key] = Math.max(0, Math.min(0.999, Number(value) || 0));
    try { localStorage.setItem("gamelab-othello-manual-profiles", JSON.stringify(othelloManualOverrides)); } catch {}
    return othelloManualOverrides[key];
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
    applyMove: othelloApplyMove,
    othelloScoreMove,
    othelloStableEdgeCount,
    othelloStableCount,
    othelloPotentialMobility,
    OTHELLO_POSITION_MATRIX,
    othelloEvaluateState,
    othelloChooseMinimaxMove,
    getManualProfile: getOthelloManualProfile,
    setManualProfileStrength: setOthelloManualProfileStrength,
    clearPlayerProfile: () => clearOthelloPlayerProfile(window.othelloPlayerProfile),
    getAllValidMovesForState,
    isValidMoveState,
    getAllValidMoves: getAllValidMovesForState,
    isValidMove: isValidMoveState
};
