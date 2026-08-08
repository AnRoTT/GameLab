const TicTacToeManualCore = window.TicTacToeAICore;

// Die manuellen Bots lernen nicht. Ihre Staerke bleibt pro Level fest.
const TICTACTOE_MANUAL_LEVELS = {
    1: { randomChance: 0.92, tacticalChance: 0.10, minimaxChance: 0.08 },
    2: { randomChance: 0.48, tacticalChance: 0.65, minimaxChance: 0.35 },
    3: { randomChance: 0.20, tacticalChance: 0.90, minimaxChance: 0.70 },
    4: { randomChance: 0.05, tacticalChance: 1.00, minimaxChance: 0.90 }
};

const TICTACTOE_MANUAL_THINK_TIMES = {
    1: [180, 320],
    2: [300, 500],
    3: [450, 700],
    4: [650, 950]
};

function pickTicTacToeRandomMove(board) {
    const free = TicTacToeManualCore.getFreeCells(board);
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
}

function pickTicTacToeTacticalMove(board, player, opponent) {
    const win = TicTacToeManualCore.findCritical(player, board);
    if (win !== null) return win;
    const block = TicTacToeManualCore.findCritical(opponent, board);
    return block !== null ? block : -1;
}

function getTicTacToeManualMove({ board, level = 1, player = "O", opponent = "X" }) {
    const config = TICTACTOE_MANUAL_LEVELS[level] || TICTACTOE_MANUAL_LEVELS[1];

    if (Math.random() < config.tacticalChance) {
        const tacticalMove = pickTicTacToeTacticalMove(board, player, opponent);
        if (tacticalMove !== -1) return tacticalMove;
    }

    if (Math.random() < config.randomChance) {
        return pickTicTacToeRandomMove(board);
    }

    if (Math.random() < config.minimaxChance) {
        const bestMoves = TicTacToeManualCore.getBestMoves(board, player);
        if (bestMoves.length) return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    return pickTicTacToeRandomMove(board);
}

function getTicTacToeManualThinkTime(level) {
    const [min, max] = TICTACTOE_MANUAL_THINK_TIMES[level]
        || TICTACTOE_MANUAL_THINK_TIMES[1];
    return Math.round(min + Math.random() * (max - min));
}
