const TICTACTOE_WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function cloneTicTacToeBoard(board) {
    return board.slice();
}

function getTicTacToeFreeCells(board) {
    return board.map((value, index) => value === null ? index : null)
        .filter(index => index !== null);
}

function checkTicTacToeWin(player, board) {
    return TICTACTOE_WINNING_LINES.find(line =>
        line.every(index => board[index] === player)
    ) || null;
}

function findTicTacToeCriticalMove(player, board) {
    for (const line of TICTACTOE_WINNING_LINES) {
        const values = line.map(index => board[index]);
        if (values.filter(value => value === player).length === 2 && values.includes(null)) {
            return line[values.indexOf(null)];
        }
    }
    return null;
}

function wouldTicTacToeFork(board, player, move) {
    if (board[move] !== null) return false;
    const testBoard = cloneTicTacToeBoard(board);
    testBoard[move] = player;
    let winningMoves = 0;

    for (const freeCell of getTicTacToeFreeCells(testBoard)) {
        testBoard[freeCell] = player;
        if (checkTicTacToeWin(player, testBoard)) winningMoves++;
        testBoard[freeCell] = null;
    }
    return winningMoves >= 2;
}

function ticTacToeMinimax(board, player, depth = 9) {
    const freeCells = getTicTacToeFreeCells(board);
    if (checkTicTacToeWin("X", board)) return { score: -10 };
    if (checkTicTacToeWin("O", board)) return { score: 10 };
    if (!freeCells.length || depth <= 0) return { score: 0 };

    const fractionalScore = window.SharedDifficulty.resolveFractionalDepth(
        depth,
        () => 0,
        () => {
            const opponent = player === "O" ? "X" : "O";
            const values = freeCells.map(index => {
                const nextBoard = cloneTicTacToeBoard(board);
                nextBoard[index] = player;
                return ticTacToeMinimax(nextBoard, opponent, 0).score;
            });
            return player === "O" ? Math.max(...values) : Math.min(...values);
        }
    );
    if (fractionalScore !== null) return { score: fractionalScore };

    const moves = freeCells.map(index => {
        const nextBoard = cloneTicTacToeBoard(board);
        nextBoard[index] = player;
        const result = ticTacToeMinimax(nextBoard, player === "O" ? "X" : "O", depth - 1);
        return { index, score: result.score };
    });

    return player === "O"
        ? moves.reduce((best, move) => move.score > best.score ? move : best)
        : moves.reduce((best, move) => move.score < best.score ? move : best);
}

function getTicTacToeScoredMoves(board, player, depth = 9) {
    const scored = [];
    for (const index of getTicTacToeFreeCells(board)) {
        const nextBoard = cloneTicTacToeBoard(board);
        nextBoard[index] = player;
        const result = ticTacToeMinimax(nextBoard, player === "O" ? "X" : "O", Math.max(0, depth - 1));
        scored.push({ index, score: player === "O" ? result.score : -result.score });
    }
    return scored;
}

function getTicTacToeBestMoves(board, player, depth = 9) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const { index, score } of getTicTacToeScoredMoves(board, player, depth)) {

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [index];
        } else if (score === bestScore) {
            bestMoves.push(index);
        }
    }
    return bestMoves;
}

// Labor-only deterministic Level-4 reference variant. It uses the same
// search path as Level 4, but without its intentional errors or randomness.
function getTicTacToeReferenceMove(board, player) {
    return getTicTacToeBestMoves(board, player)[0] ?? null;
}

const TICTACTOE_MANUAL_STRENGTHS = window.TicTacToeSettings.manualStrengths;
const ticTacToeManualOverrides = Object.create(null);
try {
    const storedProfiles = JSON.parse(localStorage.getItem("gamelab-tictactoe-manual-profiles") || "{}");
    if (storedProfiles && typeof storedProfiles === "object") Object.entries(storedProfiles).forEach(([level, value]) => {
        if (["1", "2", "3", "4"].includes(level) && Number.isFinite(Number(value))) ticTacToeManualOverrides[level] = Math.max(0, Math.min(0.999, Number(value)));
    });
} catch {}

function getTicTacToeManualProfile(levelOrStrength = 1) {
    const numericValue = Number(levelOrStrength);
    const isReferenceProfile = levelOrStrength === "reference" || levelOrStrength === "referenz";
    const level = Number.isInteger(numericValue) && TICTACTOE_MANUAL_STRENGTHS[numericValue]
        ? numericValue
        : null;
    const strength = isReferenceProfile
        ? 1
        : level
        ? (ticTacToeManualOverrides[level] ?? TICTACTOE_MANUAL_STRENGTHS[level])
        : Math.max(0, Math.min(1, numericValue || 0));
    const difficulty = window.SharedDifficulty.createProfile({
        mode: "manual",
        strength,
        ...window.TicTacToeSettings.difficulty,
        habitInfluence: window.TicTacToeSettings.manualHabitInfluence,
        searchConfig: window.TicTacToeSettings.searchConfig
    });

    return {
        ...difficulty,
        level: isReferenceProfile ? "reference" : level,
        strength,
        tacticalChance: difficulty.tacticalAccuracy,
        minimaxChance: difficulty.searchChance,
        profileUsage: difficulty.habitInfluence,
        thinkTimeMin: Math.round(180 + difficulty.curve * 470),
        thinkTimeMax: Math.round(320 + difficulty.curve * 630)
    };
}

function setTicTacToeManualProfileStrength(level, value) {
    const key = Number(level);
    ticTacToeManualOverrides[key] = Math.max(0, Math.min(0.999, Number(value) || 0));
    try { localStorage.setItem("gamelab-tictactoe-manual-profiles", JSON.stringify(ticTacToeManualOverrides)); } catch {}
    return ticTacToeManualOverrides[key];
}

function getTicTacToeProfilePreferredMove(board, profile) {
    if (!profile || profile.totalMoves < 10) return -1;
    const freeCells = getTicTacToeFreeCells(board);
    if (!freeCells.length) return -1;

    const total = Math.max(1, profile.totalMoves);
    const score = (index) => {
        const favorite = (profile.favoriteCells?.[index] || 0) / total;
        const opening = (profile.openingCells?.[index] || 0) / Math.max(1, Math.min(2, total));
        const row = (profile.rowPreference?.[Math.floor(index / 3)] || 0) / total;
        const col = (profile.colPreference?.[index % 3] || 0) / total;
        return favorite * 0.55 + opening * 0.25 + row * 0.10 + col * 0.10;
    };

    return freeCells.reduce((best, index) => score(index) > score(best) ? index : best, freeCells[0]);
}

function getTicTacToeDifficultyProfile(skill) {
    const difficulty = window.SharedDifficulty.createProfile({
        mode: "adaptive",
        skill,
        ...window.TicTacToeSettings.difficulty,
        habitInfluence: window.TicTacToeSettings.adaptiveHabitInfluence,
        searchConfig: window.TicTacToeSettings.searchConfig
    });

    return {
        ...difficulty,
        challenge: difficulty.curve,
        randomness: difficulty.randomChance,
        tacticalAccuracy: difficulty.tacticalAccuracy,
        thinkTime: 150 + difficulty.curve * 1450
    };
}

const TICTACTOE_PLAYER_PROFILE_KEY = "andis-game-foundry-tictactoe-player-profile";

function createTicTacToePlayerProfile(loadStored = true) {
    const profile = {
        totalMoves: 0,
        gamesAgainstBot: 0,
        favoriteCells: Array(9).fill(0),
        openingCells: Array(9).fill(0),
        rowPreference: Array(3).fill(0),
        colPreference: Array(3).fill(0),
        positionPreference: { center: 0, corner: 0, edge: 0 },
        style: { aggressive: 0, defensive: 0 },
        mistakes: 0,
        missedBlocks: 0,
        missedWins: 0,
        forksSeen: 0,
        forksMissed: 0,
        tacticalGood: 0,
        tacticalBad: 0
    };
    if (!loadStored) return profile;
    try {
        const stored = JSON.parse(localStorage.getItem(TICTACTOE_PLAYER_PROFILE_KEY) || "null");
        if (!stored || typeof stored !== "object") return profile;
        for (const key of ["totalMoves", "gamesAgainstBot", "mistakes", "missedBlocks", "missedWins", "forksSeen", "forksMissed", "tacticalGood", "tacticalBad"]) {
            if (Number.isFinite(Number(stored[key]))) profile[key] = Number(stored[key]);
        }
        for (const key of ["favoriteCells", "openingCells", "rowPreference", "colPreference"]) {
            if (Array.isArray(stored[key]) && stored[key].length === profile[key].length) profile[key] = stored[key].map(value => Number(value) || 0);
        }
        for (const key of ["positionPreference", "style"]) {
            if (stored[key] && typeof stored[key] === "object") {
                Object.keys(profile[key]).forEach(child => {
                    if (Number.isFinite(Number(stored[key][child]))) profile[key][child] = Number(stored[key][child]);
                });
            }
        }
    } catch (_) {}
    return profile;
}

function saveTicTacToePlayerProfile(profile) {
    if (!profile) return;
    try { localStorage.setItem(TICTACTOE_PLAYER_PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
}

function clearTicTacToePlayerProfile(profile) {
    try { localStorage.removeItem(TICTACTOE_PLAYER_PROFILE_KEY); } catch (_) {}
    if (!profile) return;
    const fresh = createTicTacToePlayerProfile(false);
    Object.keys(profile).forEach(key => { delete profile[key]; });
    Object.assign(profile, fresh);
}

function getTicTacToePositionType(move) {
    if (move === 4) return "center";
    if ([0, 2, 6, 8].includes(move)) return "corner";
    return "edge";
}

function trackTicTacToePlayerMove(profile, move, boardBefore, player = "X") {
    if (!profile || move < 0 || move > 8) return;
    profile.totalMoves++;
    profile.favoriteCells[move]++;
    if (profile.totalMoves <= 2) profile.openingCells[move]++;
    profile.rowPreference[Math.floor(move / 3)]++;
    profile.colPreference[move % 3]++;
    profile.positionPreference[getTicTacToePositionType(move)]++;
    if (player === "X") {
        if (move === 4) profile.style.defensive += 0.3;
        if ([0, 2, 6, 8].includes(move)) profile.style.aggressive += 0.2;
    }
    saveTicTacToePlayerProfile(profile);
}

function recordTicTacToePlayerEvent(profile, event) {
    if (!profile) return;
    if (event === "missedWin") { profile.missedWins++; profile.tacticalBad++; }
    if (event === "missedBlock") { profile.missedBlocks++; profile.tacticalBad++; }
    if (event === "fork") profile.forksSeen++;
    if (event === "missedFork") { profile.forksMissed++; profile.tacticalBad++; }
    if (event === "tacticalGood") profile.tacticalGood++;
    saveTicTacToePlayerProfile(profile);
}

window.TicTacToeAICore = {
    WINNING_LINES: TICTACTOE_WINNING_LINES,
    cloneBoard: cloneTicTacToeBoard,
    getFreeCells: getTicTacToeFreeCells,
    checkWin: checkTicTacToeWin,
    findCritical: findTicTacToeCriticalMove,
    wouldFork: wouldTicTacToeFork,
    minimax: ticTacToeMinimax,
    getBestMoves: getTicTacToeBestMoves,
    getScoredMoves: getTicTacToeScoredMoves,
    getReferenceMove: getTicTacToeReferenceMove,
    getManualProfile: getTicTacToeManualProfile,
    getProfilePreferredMove: getTicTacToeProfilePreferredMove,
    getDifficultyProfile: getTicTacToeDifficultyProfile,
    setManualProfileStrength: setTicTacToeManualProfileStrength,
    createPlayerProfile: createTicTacToePlayerProfile,
    savePlayerProfile: saveTicTacToePlayerProfile,
    clearPlayerProfile: clearTicTacToePlayerProfile,
    getPositionType: getTicTacToePositionType,
    trackPlayerMove: trackTicTacToePlayerMove,
    recordPlayerEvent: recordTicTacToePlayerEvent
};

window.ticTacToePlayerProfile = createTicTacToePlayerProfile();
