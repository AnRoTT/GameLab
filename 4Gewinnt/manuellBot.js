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
    const poolSize = Math.min(ranked.length, config.candidatePoolSize ?? ranked.length);
    const pool = ranked.slice(0, poolSize);
    const index = Math.floor(Math.random() * pool.length);
    return pool[index]?.col ?? -1;
}

function getManualConnectFourMoveForLevel(board, level, player, opponent) {
    const config = getManualConnectFourLevelProfile(level);

    if (Math.random() < config.tacticalChance) {
        const tacticalMove = getTacticalConnectFourMove(board, player, opponent);
        if (tacticalMove !== -1) return tacticalMove;
    }

    if (Math.random() < config.randomChance) {
        return getManualConnectFourRandomMove(board);
    }

    // Minimax bleibt in jedem Level Teil des Profils; die Chance steigt mit
    // der Staerke und wird nicht mehr durch einen ungenutzten Profilwert ersetzt.
    const minimaxMove = Math.random() < config.minimaxChance
        ? getManualConnectFourMinimaxMove(board, config, player, opponent)
        : -1;
    return minimaxMove !== -1 ? minimaxMove : getManualConnectFourRandomMove(board);
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
