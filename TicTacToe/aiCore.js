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

function getTicTacToeDifficultyProfile(skill) {
    const normalized = Math.max(0, Math.min(100, Number(skill) || 0)) / 100;
    const challenge = normalized <= 0.75
        ? 0.75 * ((normalized / 0.75) ** 2 * (3 - 2 * (normalized / 0.75)))
        : 0.75 + ((normalized - 0.75) / 0.25) ** 1.8 * 0.25;

    return {
        challenge,
        randomness: Math.max(0.02, 0.42 - challenge * 0.38),
        errorRate: Math.max(0.02, 0.34 - challenge * 0.30),
        tacticalAccuracy: Math.min(0.98, 0.35 + challenge * 0.60),
        thinkTime: 160 + challenge * 1500
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
    getDifficultyProfile: getTicTacToeDifficultyProfile,
    createPlayerProfile: createTicTacToePlayerProfile,
    getPositionType: getTicTacToePositionType,
    trackPlayerMove: trackTicTacToePlayerMove,
    recordPlayerEvent: recordTicTacToePlayerEvent
};

window.ticTacToePlayerProfile = createTicTacToePlayerProfile();
