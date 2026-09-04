const ConnectFourManualCore = window.ConnectFourAICore;

/*
 * Manuelle Bots fuer 4 Gewinnt
 * ----------------------------
 *
 * Die manuellen Bots bleiben fest, aber ihre Stufen werden ueber eine
 * gemeinsame, kontinuierliche Kurve abgeleitet. So entstehen keine harten
 * Spruenge zwischen den Stufen und die Staffelung bleibt besser vergleichbar.
 */

function normalizeLevel(level) {
    const key = String(level || "anfanger")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss");
    if (key === "anfanger" || key === "anfaenger" || key === "anfÃ¤nger") return "anfanger";
    return key;
}

function getManualConnectFourRandomMove(board) {
    const columns = ConnectFourManualCore.getAvailableColumns(board);
    return columns.length ? columns[Math.floor(Math.random() * columns.length)] : -1;
}

function findImmediateConnectFourMove(board, player) {
    for (const col of ConnectFourManualCore.getAvailableColumns(board)) {
        const result = ConnectFourManualCore.applyMove(board, col, player);
        if (result && ConnectFourManualCore.hasWinner(result.board, player)) {
            return col;
        }
    }
    return -1;
}

function getTacticalConnectFourMove(board, player, opponent) {
    const winningMove = findImmediateConnectFourMove(board, player);
    if (winningMove !== -1) return winningMove;
    return findImmediateConnectFourMove(board, opponent);
}

function getManualConnectFourLevelProfile(levelOrStrength) {
    const normalizedLevel = normalizeLevel(levelOrStrength);
    return ConnectFourManualCore.getManualProfile(normalizedLevel);
}

function getManualConnectFourMinimaxMove(board, config, player, opponent) {
    if (config.depth <= 0) return -1;
    const ranked = ConnectFourManualCore.getRankedMoves(board, config.depth, player, opponent);
    if (!ranked.length) return -1;

    // Die Kandidatenbreite kommt ausschließlich aus dem Difficulty-Core.
    const tactical = ranked.map(item => {
        const win = findImmediateConnectFourMove(board, player) === item.col;
        const block = findImmediateConnectFourMove(board, opponent) === item.col;
        const next = ConnectFourManualCore.applyMove(board, item.col, player);
        const forks = next ? ConnectFourManualCore.countWinningMoves(next.board, player) : 0;
        return {
            ...item,
            score: item.score
                + (win ? 10000 : 0) * config.curve
                + (block ? 7000 : 0) * config.curve
                + Math.max(0, forks - 1) * 900 * config.curve
        };
    });
    const selected = window.SharedDifficulty.selectSoftCandidate(tactical, config.curve, true);
    return selected?.col ?? -1;
}

function getManualConnectFourMoveForLevel(board, level, player, opponent) {
    const config = getManualConnectFourLevelProfile(level);
    if (Math.random() < config.tacticalAccuracy) {
        const tactical = getTacticalConnectFourMove(board, player, opponent);
        if (tactical !== -1) return tactical;
    }

    const minimaxMove = Math.random() >= (config.errorRate || 0) && Math.random() < (config.searchChance ?? config.minimaxChance ?? 0)
        ? getManualConnectFourMinimaxMove(board, config, player, opponent)
        : -1;
    if (minimaxMove !== -1) return minimaxMove;
    const fallback = ConnectFourManualCore.getAvailableColumns(board).map(col => ({
        col,
        score: (3 - Math.abs(3 - col)) * config.curve + Math.random() * config.randomChance
    }));
    return window.SharedDifficulty.selectSoftCandidate(fallback, config.curve, true)?.col ?? -1;
}

function getManualConnectFourBeginnerMove(board, player, opponent) {
    return getManualConnectFourMoveForLevel(board, "anfanger", player, opponent);
}

function getManualConnectFourHobbyMove(board, player, opponent) {
    return getManualConnectFourMoveForLevel(board, "hobby", player, opponent);
}

function getManualConnectFourClubMove(board, player, opponent) {
    return getManualConnectFourMoveForLevel(board, "verein", player, opponent);
}

function getManualConnectFourMasterMove(board, player, opponent) {
    return getManualConnectFourMoveForLevel(board, "meister", player, opponent);
}

function getManualConnectFourMove({ board, level = "anfanger", player = 2, opponent = 1 }) {
    const movesByLevel = {
        anfanger: getManualConnectFourBeginnerMove,
        hobby: getManualConnectFourHobbyMove,
        verein: getManualConnectFourClubMove,
        meister: getManualConnectFourMasterMove,
        referenz: (board, player, opponent) => getManualConnectFourMoveForLevel(board, "referenz", player, opponent)
    };
    const moveFunction = movesByLevel[normalizeLevel(level)] || movesByLevel.anfanger;
    return moveFunction(board, player, opponent);
}

function getManualConnectFourThinkTime(level) {
    const profile = getManualConnectFourLevelProfile(level);
    const base = profile.thinkTime ?? 300;
    return Math.round(base - 60 + Math.random() * 120);
}

window.getManualConnectFourMove = getManualConnectFourMove;
window.getManualConnectFourBeginnerMove = getManualConnectFourBeginnerMove;
window.getManualConnectFourHobbyMove = getManualConnectFourHobbyMove;
window.getManualConnectFourClubMove = getManualConnectFourClubMove;
window.getManualConnectFourMasterMove = getManualConnectFourMasterMove;
window.getManualConnectFourLevelProfile = getManualConnectFourLevelProfile;
window.getManualConnectFourThinkTime = getManualConnectFourThinkTime;
