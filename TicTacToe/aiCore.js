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

function ticTacToeMinimax(board, player) {
    const freeCells = getTicTacToeFreeCells(board);
    if (checkTicTacToeWin("X", board)) return { score: -10 };
    if (checkTicTacToeWin("O", board)) return { score: 10 };
    if (!freeCells.length) return { score: 0 };

    const moves = freeCells.map(index => {
        const nextBoard = cloneTicTacToeBoard(board);
        nextBoard[index] = player;
        const result = ticTacToeMinimax(nextBoard, player === "O" ? "X" : "O");
        return { index, score: result.score };
    });

    return player === "O"
        ? moves.reduce((best, move) => move.score > best.score ? move : best)
        : moves.reduce((best, move) => move.score < best.score ? move : best);
}

function getTicTacToeBestMoves(board, player) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const index of getTicTacToeFreeCells(board)) {
        const nextBoard = cloneTicTacToeBoard(board);
        nextBoard[index] = player;
        const result = ticTacToeMinimax(nextBoard, player === "O" ? "X" : "O");
        const score = player === "O" ? result.score : -result.score;

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

const TICTACTOE_MANUAL_STRENGTHS = {
    // Level 1 bis 3 wurden nach der Referenzmessung etwas angehoben,
    // damit sie näher an die Zielkorridore herankommen.
    1: 0.36,
    2: 0.52,
    3: 0.61,
    // Level 4 bleibt am Referenzanker ausgerichtet.
    4: 0.71
};
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
        minSearchChance: 0.08,
        maxSearchChance: 1.0,
        minRandomness: 0,
        maxRandomness: 0.92,
        minErrorRate: 0,
        maxErrorRate: 0.36,
        habitInfluence: 0.60,
        searchConfig: {
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 9,
            fixedDepth: null
        }
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
        minSearchChance: 0.08,
        maxSearchChance: 1.0,
        minRandomness: 0.02,
        maxRandomness: 0.44,
        minErrorRate: 0.02,
        maxErrorRate: 0.36,
        habitInfluence: 0.60,
        searchConfig: {
            supportsMinimax: true,
            minDepth: 0,
            maxDepth: 9,
            fixedDepth: null
        }
    });

    return {
        ...difficulty,
        challenge: difficulty.curve,
        randomness: difficulty.randomChance,
        tacticalAccuracy: difficulty.tacticalAccuracy,
        thinkTime: 150 + difficulty.curve * 1450
    };
}

function createTicTacToePlayerProfile() {
    return {
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
}

function recordTicTacToePlayerEvent(profile, event) {
    if (!profile) return;
    if (event === "missedWin") { profile.missedWins++; profile.tacticalBad++; }
    if (event === "missedBlock") { profile.missedBlocks++; profile.tacticalBad++; }
    if (event === "fork") profile.forksSeen++;
    if (event === "missedFork") { profile.forksMissed++; profile.tacticalBad++; }
    if (event === "tacticalGood") profile.tacticalGood++;
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
    getReferenceMove: getTicTacToeReferenceMove,
    getManualProfile: getTicTacToeManualProfile,
    getProfilePreferredMove: getTicTacToeProfilePreferredMove,
    getDifficultyProfile: getTicTacToeDifficultyProfile,
    setManualProfileStrength: setTicTacToeManualProfileStrength,
    createPlayerProfile: createTicTacToePlayerProfile,
    getPositionType: getTicTacToePositionType,
    trackPlayerMove: trackTicTacToePlayerMove,
    recordPlayerEvent: recordTicTacToePlayerEvent
};

window.ticTacToePlayerProfile = createTicTacToePlayerProfile();
