const TicTacToeManualCore = window.TicTacToeAICore;

function pickTicTacToeRandomMove(board) {
    const free = TicTacToeManualCore.getFreeCells(board);
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
}

function getTicTacToeManualMove({ board, level = 1, player = "O", opponent = "X", playerProfile = null }) {
    const config = TicTacToeManualCore.getManualProfile(level);

    const searchEnabled = config.depth > 0
        && Math.random() >= config.errorRate
        && Math.random() < config.searchChance;
    const scoredMoves = (searchEnabled
        ? TicTacToeManualCore.getScoredMoves(board, player, config.depth)
        : TicTacToeManualCore.getFreeCells(board).map(index => ({
            index,
            score: index === 4 ? 4 : [0, 2, 6, 8].includes(index) ? 3 : 1
        }))).map(item => {
        let score = item.score;
        if (TicTacToeManualCore.findCritical(player, board) === item.index) score += 10000 * config.curve;
        if (TicTacToeManualCore.findCritical(opponent, board) === item.index) score += 7000 * config.curve;
        if (TicTacToeManualCore.wouldFork(board, player, item.index)) score += 4200 * config.curve;
        const nextBoard = board.slice();
        nextBoard[item.index] = player;
        const opponentFork = TicTacToeManualCore.getFreeCells(nextBoard)
            .filter(cell => TicTacToeManualCore.wouldFork(nextBoard, opponent, cell)).length;
        score -= opponentFork * 2600 * config.curve;
        return { action: item.index, score: score + Math.random() * config.randomChance * 10 };
    });
    if (scoredMoves.length) {
        return window.SharedDifficulty.selectSoftCandidate(scoredMoves, config.curve, true)?.action;
    }

    return pickTicTacToeRandomMove(board);
}

function getTicTacToeManualThinkTime(level) {
    const profile = TicTacToeManualCore.getManualProfile(level);
    return Math.round(profile.thinkTimeMin
        + Math.random() * (profile.thinkTimeMax - profile.thinkTimeMin));
}

window.getTicTacToeManualMove = getTicTacToeManualMove;
window.getTicTacToeManualThinkTime = getTicTacToeManualThinkTime;
