const TicTacToeManualCore = window.TicTacToeAICore;

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

function getTicTacToeManualMove({ board, level = 1, player = "O", opponent = "X", playerProfile = null }) {
    const config = TicTacToeManualCore.getManualProfile(level);

    if (Math.random() < config.tacticalChance) {
        const tacticalMove = pickTicTacToeTacticalMove(board, player, opponent);
        if (tacticalMove !== -1) return tacticalMove;
    }

    if (Math.random() < config.randomChance) {
        return pickTicTacToeRandomMove(board);
    }

    if (Math.random() < config.minimaxChance) {
        const bestMoves = TicTacToeManualCore.getBestMoves(board, player);
        if (bestMoves.length) {
            if (Math.random() < config.profileUsage) {
                const preferred = TicTacToeManualCore.getProfilePreferredMove(board, playerProfile);
                if (bestMoves.includes(preferred)) return preferred;
            }
            return bestMoves[Math.floor(Math.random() * bestMoves.length)];
        }
    }

    if (Math.random() < config.profileUsage) {
        const preferred = TicTacToeManualCore.getProfilePreferredMove(board, playerProfile);
        if (preferred !== -1) return preferred;
    }

    return pickTicTacToeRandomMove(board);
}

function getTicTacToeManualThinkTime(level) {
    const profile = TicTacToeManualCore.getManualProfile(level);
    return Math.round(profile.thinkTimeMin
        + Math.random() * (profile.thinkTimeMax - profile.thinkTimeMin));
}
