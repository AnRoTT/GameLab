const CONNECT_FOUR_ROWS = 6;
const CONNECT_FOUR_COLS = 7;
const CONNECT_FOUR_EMPTY = 0;

function cloneConnectFourBoard(board) {
    return board.map(row => row.slice());
}

function getConnectFourAvailableColumns(board) {
    const columns = [];
    for (let col = 0; col < CONNECT_FOUR_COLS; col++) {
        if (board[0][col] === CONNECT_FOUR_EMPTY) columns.push(col);
    }
    return columns;
}

function getConnectFourFreeRow(board, col) {
    for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row--) {
        if (board[row][col] === CONNECT_FOUR_EMPTY) return row;
    }
    return -1;
}

function applyConnectFourMove(board, col, player) {
    const next = cloneConnectFourBoard(board);
    const row = getConnectFourFreeRow(next, col);
    if (row === -1) return null;
    next[row][col] = player;
    return { board: next, row, col };
}

function connectFourCountDirection(board, row, col, rowStep, colStep, player) {
    let count = 0;
    let r = row + rowStep;
    let c = col + colStep;
    while (
        r >= 0 && r < CONNECT_FOUR_ROWS &&
        c >= 0 && c < CONNECT_FOUR_COLS &&
        board[r][c] === player
    ) {
        count++;
        r += rowStep;
        c += colStep;
    }
    return count;
}

function findConnectFourWinner(board) {
    for (let row = 0; row < CONNECT_FOUR_ROWS; row++) {
        for (let col = 0; col < CONNECT_FOUR_COLS; col++) {
            const player = board[row][col];
            if (player === CONNECT_FOUR_EMPTY) continue;
            const lines = [
                [0, 1], [1, 0], [1, 1], [1, -1]
            ];
            for (const [dr, dc] of lines) {
                const forward = connectFourCountDirection(board, row, col, dr, dc, player);
                const backward = connectFourCountDirection(board, row, col, -dr, -dc, player);
                const count = 1 + forward + backward;
                if (count >= 4) {
                    const coordinates = [];
                    for (let step = -backward; step <= forward; step += 1) {
                        const nextRow = row + dr * step;
                        const nextCol = col + dc * step;
                        if (nextRow >= 0 && nextRow < CONNECT_FOUR_ROWS && nextCol >= 0 && nextCol < CONNECT_FOUR_COLS && board[nextRow][nextCol] === player) {
                            coordinates.push([nextRow, nextCol]);
                        }
                    }
                    return { player, coordinates };
                }
            }
        }
    }
    return null;
}

function connectFourHasWinner(board, player) {
    const winner = findConnectFourWinner(board);
    return Boolean(winner && winner.player === player);
}

function isConnectFourBoardFull(board) {
    return getConnectFourAvailableColumns(board).length === 0;
}

function scoreConnectFourWindow(window, player, opponent) {
    const own = window.filter(cell => cell === player).length;
    const enemy = window.filter(cell => cell === opponent).length;
    const empty = window.filter(cell => cell === CONNECT_FOUR_EMPTY).length;
    if (own === 4) return 100000;
    if (enemy === 4) return -100000;
    if (own === 3 && empty === 1) return 80;
    if (own === 2 && empty === 2) return 12;
    if (enemy === 3 && empty === 1) return -95;
    if (enemy === 2 && empty === 2) return -15;
    return 0;
}

function evaluateConnectFourBoard(board, player, opponent) {
    let score = 0;
    const center = board.map(row => row[3]).filter(cell => cell === player).length;
    score += center * 6;

    for (let row = 0; row < CONNECT_FOUR_ROWS; row++) {
        for (let col = 0; col <= CONNECT_FOUR_COLS - 4; col++) {
            score += scoreConnectFourWindow(board[row].slice(col, col + 4), player, opponent);
        }
    }
    for (let col = 0; col < CONNECT_FOUR_COLS; col++) {
        for (let row = 0; row <= CONNECT_FOUR_ROWS - 4; row++) {
            score += scoreConnectFourWindow(
                [board[row][col], board[row + 1][col], board[row + 2][col], board[row + 3][col]],
                player,
                opponent
            );
        }
    }
    for (let row = 0; row <= CONNECT_FOUR_ROWS - 4; row++) {
        for (let col = 0; col <= CONNECT_FOUR_COLS - 4; col++) {
            score += scoreConnectFourWindow(
                [board[row][col], board[row + 1][col + 1], board[row + 2][col + 2], board[row + 3][col + 3]],
                player,
                opponent
            );
        }
    }
    for (let row = 0; row <= CONNECT_FOUR_ROWS - 4; row++) {
        for (let col = 3; col < CONNECT_FOUR_COLS; col++) {
            score += scoreConnectFourWindow(
                [board[row][col], board[row + 1][col - 1], board[row + 2][col - 2], board[row + 3][col - 3]],
                player,
                opponent
            );
        }
    }
    return score;
}

function connectFourMinimax(board, depth, maximizing, player, opponent, alpha = -Infinity, beta = Infinity) {
    const columns = getConnectFourAvailableColumns(board);
    if (depth <= 0 || !columns.length || connectFourHasWinner(board, player) || connectFourHasWinner(board, opponent)) {
        return { score: evaluateConnectFourBoard(board, player, opponent), col: null };
    }

    if (maximizing) {
        let best = { score: -Infinity, col: columns[0] };
        for (const col of columns) {
            const result = applyConnectFourMove(board, col, player);
            const candidate = connectFourMinimax(result.board, depth - 1, false, player, opponent, alpha, beta);
            if (candidate.score > best.score) best = { score: candidate.score, col };
            alpha = Math.max(alpha, best.score);
            if (beta <= alpha) break;
        }
        return best;
    }

    let best = { score: Infinity, col: columns[0] };
    for (const col of columns) {
        const result = applyConnectFourMove(board, col, opponent);
        const candidate = connectFourMinimax(result.board, depth - 1, true, player, opponent, alpha, beta);
        if (candidate.score < best.score) best = { score: candidate.score, col };
        beta = Math.min(beta, best.score);
        if (beta <= alpha) break;
    }
    return best;
}

function getConnectFourRankedMoves(board, depth, player, opponent) {
    const columns = getConnectFourAvailableColumns(board);
    return columns.map(col => {
        const result = applyConnectFourMove(board, col, player);
        const evaluated = connectFourMinimax(
            result.board,
            Math.max(0, depth - 1),
            false,
            player,
            opponent
        );
        return { col, score: evaluated.score };
    }).sort((a, b) => b.score - a.score);
}

function createConnectFourPlayerProfile() {
    const profile = {
        totalMoves: 0,
        gamesAgainstBot: 0,
        favoriteColumns: Array(CONNECT_FOUR_COLS).fill(0),
        opening: { center: 0, edge: 0, side: 0 },
        phases: { opening: 0, midgame: 0, endgame: 0 },
        style: { offensive: 0, defensive: 0, risky: 0, careful: 0 },
        tactics: { missedWins: 0, forks: 0, pressureMoves: 0, pressureMistakes: 0 },
        mobility: { restrictedOpponent: 0, openedOpponent: 0 },
        mistakes: { missedWins: 0, missedBlocks: 0 }
    };

    // Legacy-Namen bleiben als Verweise erhalten, damit adaptiveBot.js und
    // bestehende Spielanzeigen schrittweise migriert werden koennen. Die
    // Werte liegen trotzdem nur einmal im zentralen Profil.
    Object.defineProperties(profile, {
        gesamtZuege: { get: () => profile.totalMoves, set: value => { profile.totalMoves = value; }, configurable: true },
        spieleGegenBot: { get: () => profile.gamesAgainstBot, set: value => { profile.gamesAgainstBot = value; }, configurable: true },
        spalten: { get: () => profile.favoriteColumns, set: value => { profile.favoriteColumns = value; }, configurable: true },
        ersterZugMitte: { get: () => profile.opening.center, set: value => { profile.opening.center = value; }, configurable: true },
        ersterZugEcke: { get: () => profile.opening.edge, set: value => { profile.opening.edge = value; }, configurable: true },
        ersterZugRand: { get: () => profile.opening.side, set: value => { profile.opening.side = value; }, configurable: true },
        eroeffnungZuege: { get: () => profile.phases.opening, set: value => { profile.phases.opening = value; }, configurable: true },
        mittelspielZuege: { get: () => profile.phases.midgame, set: value => { profile.phases.midgame = value; }, configurable: true },
        endspielZuege: { get: () => profile.phases.endgame, set: value => { profile.phases.endgame = value; }, configurable: true },
        gingInGabel: { get: () => profile.tactics.forks, set: value => { profile.tactics.forks = value; }, configurable: true },
        hatGewinnzugVerpasst: { get: () => profile.tactics.missedWins, set: value => { profile.tactics.missedWins = value; }, configurable: true },
        druckZuege: { get: () => profile.tactics.pressureMoves, set: value => { profile.tactics.pressureMoves = value; }, configurable: true },
        druckVerlaesst: { get: () => profile.tactics.pressureMistakes, set: value => { profile.tactics.pressureMistakes = value; }, configurable: true },
        defensivZuege: { get: () => profile.style.defensive, set: value => { profile.style.defensive = value; }, configurable: true },
        offensivZuege: { get: () => profile.style.offensive, set: value => { profile.style.offensive = value; }, configurable: true },
        angriffsZuege: { get: () => profile.style.risky, set: value => { profile.style.risky = value; }, configurable: true }
    });

    return profile;
}

function resetConnectFourPlayerProfile(profile) {
    if (!profile) return createConnectFourPlayerProfile();
    const freshProfile = createConnectFourPlayerProfile();
    Object.keys(freshProfile).forEach(key => {
        profile[key] = freshProfile[key];
    });
    return profile;
}

function trackConnectFourPlayerMove(profile, col, row, quality = 0) {
    if (!profile || col < 0 || col >= CONNECT_FOUR_COLS) return;
    profile.totalMoves++;
    profile.favoriteColumns[col]++;
    if (profile.totalMoves <= 6) {
        if (col === 3) profile.opening.center++;
        else if (col === 0 || col === 6) profile.opening.edge++;
        else profile.opening.side++;
        profile.phases.opening++;
    } else if (profile.totalMoves <= 18) {
        profile.phases.midgame++;
    } else {
        profile.phases.endgame++;
    }
    if (quality >= 15) profile.tactics.pressureMoves++;
    if (quality >= 17) profile.style.offensive++;
    if (quality <= 0) profile.style.defensive++;
}

function recordConnectFourPlayerEvent(profile, event) {
    if (!profile) return;
    if (event === "missedWin") {
        profile.tactics.missedWins++;
        profile.mistakes.missedWins++;
    }
    if (event === "missedBlock") profile.mistakes.missedBlocks++;
    if (event === "fork") profile.tactics.forks++;
    if (event === "pressure") profile.tactics.pressureMistakes++;
}

function evaluateConnectFourPlayerMove(board, col, row, player) {
    if (row === undefined || row === null || row < 0 || row >= CONNECT_FOUR_ROWS) return -3;
    const previous = board[row][col];
    board[row][col] = player;
    let quality = 1;
    if (connectFourHasWinner(board, player)) quality += 15;
    if (col === 3) quality += 2;
    if (col === 2 || col === 4) quality += 1;
    board[row][col] = previous;
    return quality;
}

function countConnectFourWinningMoves(board, player) {
    let count = 0;
    for (const col of getConnectFourAvailableColumns(board)) {
        const result = applyConnectFourMove(board, col, player);
        if (result && connectFourHasWinner(result.board, player)) count++;
    }
    return count;
}

function hasMissedConnectFourWin(board, chosenCol, player) {
    for (const col of getConnectFourAvailableColumns(board)) {
        if (col === chosenCol) continue;
        const result = applyConnectFourMove(board, col, player);
        if (result && connectFourHasWinner(result.board, player)) return true;
    }
    return false;
}

function getConnectFourDifficultyProfile(skill) {
    const difficulty = window.SharedDifficulty.createProfile({
        mode: "adaptive",
        skill,
        minSearchChance: 0.06,
        maxSearchChance: 1.0,
        minRandomness: 0.03,
        maxRandomness: 0.42,
        minErrorRate: 0.02,
        maxErrorRate: 0.34,
        habitInfluence: 0.60,
        searchConfig: {
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 3,
            fixedDepth: 3
        }
    });

    return {
        ...difficulty,
        challenge: difficulty.curve,
        smooth: difficulty.curve,
        learningWeight: 0.03 + difficulty.curve * 0.55,
        minimaxWeight: difficulty.searchChance,
        tacticWeight: difficulty.tacticalAccuracy,
        randomness: difficulty.randomChance,
        thinkTimeWeight: difficulty.curve,
        searchIntensity: difficulty.curve,
        maxDepth: difficulty.maxDepth,
        thinkTime: 260 + difficulty.curve * 1050
    };
}
//Anpassung der manuellen Bots//
const CONNECT_FOUR_MANUAL_STRENGTHS = Object.freeze({ 
      anfanger: 0.26, 
	  hobby: 0.48, 
	  verein: 0.63, 
	  meister: 0.67, 
	  referenz: 1.0 
});
const connectFourManualOverrides = Object.create(null);
try {
    const stored = JSON.parse(localStorage.getItem("gamelab-4gewinnt-manual-profiles") || "{}");
    ["1", "2", "3", "4"].forEach((key) => delete stored[key]);
    Object.assign(connectFourManualOverrides, stored);
    localStorage.setItem("gamelab-4gewinnt-manual-profiles", JSON.stringify(connectFourManualOverrides));
} catch {}

function clearConnectFourManualProfileOverrides() {
    Object.keys(connectFourManualOverrides).forEach((key) => delete connectFourManualOverrides[key]);
    try { localStorage.removeItem("gamelab-4gewinnt-manual-profiles"); } catch {}
}
//Anpassung der manuellen Bots//

function normalizeConnectFourProfileKey(level) {
    const value = String(level).toLowerCase();
    return ({
        "1": "anfanger",
        "2": "hobby",
        "3": "verein",
        "4": "meister",
        referenz: "referenz",
        reference: "referenz"
    })[value] || value;
}

function getConnectFourManualProfile(level = "anfanger") {
    const key = normalizeConnectFourProfileKey(level);
    const strength = connectFourManualOverrides[key] ?? CONNECT_FOUR_MANUAL_STRENGTHS[key] ?? Math.max(0, Math.min(1, Number(level) || 0.31));
    const difficulty = window.SharedDifficulty.createProfile({
        mode: "manual",
        strength,
        minSearchChance: 0.06,
        maxSearchChance: 1.0,
        minRandomness: 0.03,
        maxRandomness: 0.42,
        minErrorRate: 0.02,
        maxErrorRate: 0.34,
        habitInfluence: 0.60,
        searchConfig: {
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 3,
            fixedDepth: 3
        }
    });
    return {
        level: key,
        strength,
        curve: difficulty.curve,
        randomChance: difficulty.randomChance,
        tacticalChance: difficulty.tacticalAccuracy,
        minimaxChance: difficulty.searchChance,
        candidatePoolSize: Math.max(1, Math.ceil(7 * (1 - difficulty.searchChance))),
        depth: difficulty.depth,
        thinkTime: 260 + difficulty.curve * 1020
    };
}

function setConnectFourManualProfileStrength(level, value) {
    const key = normalizeConnectFourProfileKey(level);
    if (key === "referenz") return 1;
    connectFourManualOverrides[key] = Math.max(0, Math.min(0.999, Number(value) || 0));
    try { localStorage.setItem("gamelab-4gewinnt-manual-profiles", JSON.stringify(connectFourManualOverrides)); } catch {}
    return connectFourManualOverrides[key];
}

window.ConnectFourAICore = {
    ROWS: CONNECT_FOUR_ROWS,
    COLS: CONNECT_FOUR_COLS,
    EMPTY: CONNECT_FOUR_EMPTY,
    cloneBoard: cloneConnectFourBoard,
    getAvailableColumns: getConnectFourAvailableColumns,
    getFreeRow: getConnectFourFreeRow,
    applyMove: applyConnectFourMove,
    hasWinner: connectFourHasWinner,
    findWinner: findConnectFourWinner,
    isBoardFull: isConnectFourBoardFull,
    evaluateBoard: evaluateConnectFourBoard,
    minimax: connectFourMinimax,
    getRankedMoves: getConnectFourRankedMoves,
    createPlayerProfile: createConnectFourPlayerProfile,
    resetPlayerProfile: resetConnectFourPlayerProfile,
    trackPlayerMove: trackConnectFourPlayerMove,
    recordPlayerEvent: recordConnectFourPlayerEvent,
    evaluatePlayerMove: evaluateConnectFourPlayerMove,
    countWinningMoves: countConnectFourWinningMoves,
    hasMissedWin: hasMissedConnectFourWin,
    getDifficultyProfile: getConnectFourDifficultyProfile,
    getManualProfile: getConnectFourManualProfile,
    getManualReferenceProfile: () => getConnectFourManualProfile("referenz"),
    setManualProfileStrength: setConnectFourManualProfileStrength,
    clearManualProfileOverrides: clearConnectFourManualProfileOverrides
};

// Das Profil muss vor adaptiveBot.js und game.js existieren, weil beide
// Dateien auf dasselbe Objekt zugreifen.
window.connectFourPlayerProfile = createConnectFourPlayerProfile();
