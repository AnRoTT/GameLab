const ConnectFourManualCore = window.ConnectFourAICore;

/*
 * Manuelle Bots fuer 4 Gewinnt
 * ----------------------------
 *
 * Diese Bots lernen nicht und veraendern ihre Staerke nicht waehrend des
 * Spiels. Jede Stufe hat feste Regeln. Dadurch bleiben die manuellen Bots
 * vorhersehbar und eignen sich als klare Schwierigkeitsstufen.
 *
 * Ablauf eines Zuges:
 * 1. Mit tacticalChance wird geprueft, ob der Bot sofort gewinnen oder blocken
 *    soll.
 * 2. Mit randomChance wird geprueft, ob ein bewusst einfacher Zufallszug folgt.
 * 3. Sonst wird Minimax mit der Tiefe der jeweiligen Stufe verwendet.
 *
 * Auch Meister bleibt durch randomChance bewusst schlagbar.
 */

// depth: Minimax-Tiefe; je hoeher, desto weiter schaut der Bot voraus.
// tacticalChance: Wahrscheinlichkeit fuer sofortigen Gewinn oder Block.
// randomChance: Wahrscheinlichkeit fuer einen bewusst zufaelligen Zug.
const CONNECT_FOUR_MANUAL_LEVELS = {
    "anfänger": { randomChance: 0.80, tacticalChance: 0.20, depth: 0 }, // fast zufaellig
    hobby: { randomChance: 0.30, tacticalChance: 0.70, depth: 1 }, // erste Vorausplanung
    verein: { randomChance: 0.12, tacticalChance: 0.90, depth: 2 }, // solide Taktik
    meister: { randomChance: 0.05, tacticalChance: 1.00, depth: 4 } // stark, aber nicht perfekt
};

// Die Denkzeit ist nur eine Spielillusion und veraendert nicht die Spielstaerke.
const CONNECT_FOUR_MANUAL_THINK_TIMES = {
    "anfänger": [250, 450],
    hobby: [450, 700],
    verein: [650, 950],
    meister: [900, 1300]
};

function getManualConnectFourRandomMove(board) {
    const columns = ConnectFourManualCore.getAvailableColumns(board);
    return columns.length
        ? columns[Math.floor(Math.random() * columns.length)]
        : -1;
}

// Findet einen Zug, mit dem der angegebene Spieler sofort vier gewinnt.
function findImmediateConnectFourMove(board, player) {
    for (const col of ConnectFourManualCore.getAvailableColumns(board)) {
        const result = ConnectFourManualCore.applyMove(board, col, player);
        if (result && ConnectFourManualCore.hasWinner(result.board, player)) {
            return col;
        }
    }
    return -1;
}

// Eigener Gewinnzug hat Vorrang. Gibt es keinen, wird ein Gewinnzug des
// Gegners blockiert.
function getTacticalConnectFourMove(board, player, opponent) {
    const winningMove = findImmediateConnectFourMove(board, player);
    if (winningMove !== -1) return winningMove;
    return findImmediateConnectFourMove(board, opponent);
}

// Fragt den gemeinsamen KI-Kern nach dem besten Zug innerhalb der erlaubten
// Suchtiefe. Der Kern enthaelt Minimax und Alpha-Beta-Pruning.
function getManualConnectFourMinimaxMove(board, config, player, opponent) {
    if (config.depth <= 0) return -1;
    const result = ConnectFourManualCore.minimax(
        board,
        config.depth,
        true,
        player,
        opponent
    );
    return result && Number.isInteger(result.col) ? result.col : -1;
}

// Zentrale Entscheidungsroutine fuer alle vier manuellen Schwierigkeitsstufen.
function getManualConnectFourMoveForLevel(board, level, player, opponent) {
    const config = CONNECT_FOUR_MANUAL_LEVELS[level] || CONNECT_FOUR_MANUAL_LEVELS["anfänger"];

    if (Math.random() < config.tacticalChance) {
        const tacticalMove = getTacticalConnectFourMove(board, player, opponent);
        if (tacticalMove !== -1) return tacticalMove;
    }

    if (Math.random() < config.randomChance) {
        return getManualConnectFourRandomMove(board);
    }

    const minimaxMove = getManualConnectFourMinimaxMove(board, config, player, opponent);
    return minimaxMove !== -1 ? minimaxMove : getManualConnectFourRandomMove(board);
}

// Die vier benannten Funktionen machen die Stufen bewusst sichtbar und
// erleichtern spaetere Anpassungen einzelner Bots.
function getManualConnectFourBeginnerMove(board, player, opponent) {
    return getManualConnectFourMoveForLevel(board, "anfänger", player, opponent);
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

// Oeffentliche Schnittstelle fuer game.js. game.js muss nur Level und Brett
// uebergeben und kennt die interne Entscheidungslogik nicht.
function getManualConnectFourMove({ board, level = "anfänger", player = 2, opponent = 1 }) {
    const movesByLevel = {
        "anfänger": getManualConnectFourBeginnerMove,
        hobby: getManualConnectFourHobbyMove,
        verein: getManualConnectFourClubMove,
        meister: getManualConnectFourMasterMove
    };
    const moveFunction = movesByLevel[level] || movesByLevel["anfänger"];
    return moveFunction(board, player, opponent);
}

// Liefert eine zufaellige Denkzeit fuer die Anzeige im Spiel.
function getManualConnectFourThinkTime(level) {
    const [min, max] = CONNECT_FOUR_MANUAL_THINK_TIMES[level]
        || CONNECT_FOUR_MANUAL_THINK_TIMES["anfänger"];
    return Math.round(min + Math.random() * (max - min));
}
