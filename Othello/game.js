const boardEl = document.getElementById("board");
const ADAPT_SPEEDS = [
    { key: "slow", label: "Langsam" },
    { key: "normal", label: "Normal" },
    { key: "fast", label: "Schnell" }
];
const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const MATCH_OPTIONS = ["Einzelrunde", "Mehrfachrunde - Abwechselnd", "Mehrfachrunde - Verlierer beginnt"];

let vsComputer = true;
let botType = "adaptive";
let botLevelIndex = 0;
let adaptSpeedIndex = 1;
let ruleMode = "standard";
let matchModeIndex = 0;

const settingsStartButton = document.getElementById("startBtn");
const settingsModeButton = document.getElementById("modeBtn");
const settingsRulesButton = document.getElementById("rulesBtn");
const settingsMatchButton = document.getElementById("matchBtn");
const settingsOpponentRow = document.getElementById("botOpponentRow");
const settingsBotLevelButton = document.getElementById("botLevelBtn");
const settingsAdaptSpeedButton = document.getElementById("adaptSpeedBtn");
const settingsStrengthPanel = document.getElementById("adaptiveStrengthPanel");
const settingsStrengthValue = document.getElementById("adaptiveStrengthValue");
const settingsStrengthBar = document.getElementById("adaptiveStrengthBar");

function updateAdaptiveStrengthUI(strength = getAdaptiveStrength()) {
    const visible = vsComputer && botType === "adaptive";
    settingsStrengthPanel.hidden = !visible;
    if (!visible) return;
    settingsStrengthValue.textContent = `${Math.round(strength)}%`;
    settingsStrengthBar.style.width = `${Math.max(1, Math.min(100, strength))}%`;
}

function updateBotLevelUI() {
    settingsOpponentRow.classList.remove("disabled");
    settingsBotLevelButton.disabled = !vsComputer;
    settingsBotLevelButton.classList.toggle("button-disabled", settingsBotLevelButton.disabled);
    settingsBotLevelButton.textContent = vsComputer ? BOT_LEVELS[botLevelIndex] : "2 Spieler Modus";
    botType = botLevelIndex === 4 ? "adaptive" : "manual";
    const adaptiveEnabled = vsComputer && botType === "adaptive";
    settingsAdaptSpeedButton.disabled = !adaptiveEnabled;
    settingsAdaptSpeedButton.classList.toggle("button-disabled", !adaptiveEnabled);
    settingsAdaptSpeedButton.textContent = adaptiveEnabled ? ADAPT_SPEEDS[adaptSpeedIndex].label : "—";
    updateAdaptiveStrengthUI();
}

function updateMatchModeUI() {
    settingsMatchButton.textContent = MATCH_OPTIONS[matchModeIndex];
    window.othelloMatchModeIndex = matchModeIndex;
}

window.setOthelloMatchSettingsLocked = function (locked) {
    settingsModeButton.disabled = locked;
    settingsRulesButton.disabled = locked;
    settingsMatchButton.disabled = locked;
    settingsBotLevelButton.disabled = locked || !vsComputer;
    settingsAdaptSpeedButton.disabled = locked || !vsComputer || botType !== "adaptive";
    [settingsModeButton, settingsRulesButton, settingsMatchButton, settingsBotLevelButton, settingsAdaptSpeedButton]
        .forEach(button => button.classList.toggle("button-disabled", button.disabled));
};

settingsStartButton.addEventListener("click", () => {
    playSound(soundButton, 0.22);
    if (gameStarted && !gameOver) {
        resetGame();
        return;
    }
    initGame();
});
settingsModeButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    vsComputer = !vsComputer;
    settingsModeButton.textContent = vsComputer ? "1 Spieler" : "2 Spieler";
    updateBotLevelUI();
});
settingsRulesButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    ruleMode = ruleMode === "standard" ? "tournament" : "standard";
    settingsRulesButton.textContent = ruleMode === "standard" ? "Standard" : "Turnier";
});
settingsMatchButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    matchModeIndex = (matchModeIndex + 1) % MATCH_OPTIONS.length;
    updateMatchModeUI();
    if (typeof updateMatchInfo === "function") updateMatchInfo();
});
settingsBotLevelButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotLevelUI();
});
settingsAdaptSpeedButton.addEventListener("click", () => {
    if (settingsAdaptSpeedButton.disabled || (gameStarted && !gameOver)) return;
    playSound(soundButton, 0.22);
    adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEEDS.length;
    updateBotLevelUI();
});

updateBotLevelUI();
updateMatchModeUI();

const startBtn = document.getElementById("startBtn");
const modeBtn = document.getElementById("modeBtn");
const rulesBtn = document.getElementById("rulesBtn");
const botLevelBtn = document.getElementById("botLevelBtn");
const adaptSpeedBtn = document.getElementById("adaptSpeedBtn");
const settingsPanel = document.getElementById("settingsPanel");
const scoreBlackEl = document.getElementById("scoreBlack");
const scoreWhiteEl = document.getElementById("scoreWhite");
const statusEl = document.getElementById("status");
const matchLineEl = document.getElementById("matchLine");
const adaptiveStrengthPanel = document.getElementById("adaptiveStrengthPanel");
const adaptiveStrengthValue = document.getElementById("adaptiveStrengthValue");
const adaptiveStrengthBar = document.getElementById("adaptiveStrengthBar");

const soundButton = new Audio("../assets/sounds/Button_Click.mp3");
const soundMove = new Audio("../assets/sounds/Click.mp3");
const soundError = new Audio("../assets/sounds/Error_Tock.mp3");

[soundButton, soundMove, soundError].forEach(sound => {
    sound.volume = 0.25;
    sound.preload = "auto";
});

function playSound(sound, volume = 0.25) {
    sound.volume = volume;
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

function getMatchMode() {
    return Number(window.othelloMatchModeIndex) || 0;
}

function otherColor(color) {
    return color === "black" ? "white" : "black";
}

function getBotColor() {
    return otherColor(playerOneColor);
}

function updateMatchInfo() {
    if (getMatchMode() === 0) {
        matchLineEl.textContent = "Einzelrunde - Offizielle Regeln";
        return;
    }
    matchLineEl.textContent = `Mehrfachrunde - Runde ${matchRound} - Match ${matchWins.playerOne}:${matchWins.playerTwo}`;
}

let board = [];
let currentPlayer = "black";
let gameOver = false;
let gameStarted = false;
let turnTransitionActive = false;
let playerOneColor = "black";
let matchRound = 1;
let matchWins = { playerOne: 0, playerTwo: 0 };
let matchInProgress = false;
let lastMoveWasPressure = false;
let botMoveTimer = null;
let nextTurnTimer = null;
let passTimer = null;
let gameToken = 0;
let keyboardRow = 3;
let keyboardCol = 3;

window.othelloPlayerProfile = createOthelloPlayerProfile();

function initGame() {
    cancelPendingTurnTimers();
    const token = gameToken;
    if (!matchInProgress || getMatchMode() === 0) {
        matchInProgress = getMatchMode() > 0;
        matchRound = 1;
        matchWins = { playerOne: 0, playerTwo: 0 };
        playerOneColor = "black";
    }
    if (vsComputer && botType === "adaptive" && typeof startAdaptiveRound === "function") {
        updateAdaptiveStrengthUI(startAdaptiveRound(
            window.othelloPlayerProfile,
            ADAPT_SPEEDS[adaptSpeedIndex].key
        ));
    }
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    board[3][3] = "white";
    board[3][4] = "black";
    board[4][3] = "black";
    board[4][4] = "white";

    currentPlayer = "black";
    keyboardRow = 3;
    keyboardCol = 3;
    gameOver = false;
    gameStarted = true;
    turnTransitionActive = false;
    boardEl.classList.remove("disabled");
    boardEl.tabIndex = 0;
    // settingsPanel.classList.add("disabled"); // NICHT sperren wegen Abbrechen
modeBtn.classList.add("disabled"); // nur Modus sperren
rulesBtn.classList.add("disabled"); // nur Regeln sperren
    renderBoard();
    updateScore();
    statusEl.textContent = "Schwarz am Zug";
    startBtn.textContent = getMatchMode() > 0 ? "Match beenden" : "Abbrechen";
    lastMoveWasPressure = false;

    updateBotLevelUI();
    updateMatchInfo();
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(true);
    }
    if(vsComputer && currentPlayer === getBotColor()) botMove(token); // Sofort Bot wenn er anfängt
}

function cancelPendingTurnTimers() {
    if (botMoveTimer !== null) {
        clearTimeout(botMoveTimer);
        botMoveTimer = null;
    }
    if (nextTurnTimer !== null) {
        clearTimeout(nextTurnTimer);
        nextTurnTimer = null;
    }
    if (passTimer !== null) {
        clearTimeout(passTimer);
        passTimer = null;
    }
    gameToken += 1;
}

function scheduleNextTurn(delay, token = gameToken) {
    if (nextTurnTimer !== null) clearTimeout(nextTurnTimer);
    turnTransitionActive = true;
    nextTurnTimer = setTimeout(() => {
        nextTurnTimer = null;
        if (token !== gameToken || !gameStarted || gameOver) return;
        turnTransitionActive = false;
        nextTurn();
    }, delay);
}

function resetGame() {
    cancelPendingTurnTimers();
    [scoreBlackEl.parentElement, scoreWhiteEl.parentElement].forEach(element => element.classList.remove("winner"));
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    keyboardRow = 3;
    keyboardCol = 3;
    gameStarted = false;
    gameOver = false;
    turnTransitionActive = false;
    boardEl.classList.add("disabled");
    boardEl.tabIndex = -1;
modeBtn.classList.remove("disabled"); // nur Modus wieder frei
rulesBtn.classList.remove("disabled"); // nur Regeln wieder frei
    renderBoard();
    updateScore();
    statusEl.textContent = "Klick 'Jetzt spielen' um zu starten";
    startBtn.textContent = "Jetzt spielen";
    lastMoveWasPressure = false;
    matchInProgress = false;
    matchRound = 1;
    matchWins = { playerOne: 0, playerTwo: 0 };
    playerOneColor = "black";
    updateMatchInfo();
    updateBotLevelUI();
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(false);
    }
}

function renderBoard() {
    boardEl.innerHTML = "";
    // Gültige Züge sind in beiden Regelmodi identisch. Der Turniermodus
    // verändert nur die Wertung der verbliebenen leeren Felder.
    const humanMayMove = isHumanTurn() && !turnTransitionActive;
    const validMoves = (gameStarted && !gameOver && ruleMode !== "tournament" && humanMayMove)
        ? getAllValidMoves(currentPlayer)
        : [];

    for(let r = 0; r < 8; r++) {
        for(let c = 0; c < 8; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.c = c;

            if (r === keyboardRow && c === keyboardCol) {
                cell.classList.add("keyboard-focus");
            }

            if(board[r][c]) {
                const piece = document.createElement("div");
                piece.className = `piece ${board[r][c]}`;
                cell.appendChild(piece);
            } else if(validMoves.some(m => m.r === r && m.c === c)) {
                cell.classList.add("valid");
            }
            boardEl.appendChild(cell);
        }
    }
}

function hideValidMoveHints() {
    boardEl.querySelectorAll(".cell.valid").forEach(cell => cell.classList.remove("valid"));
}

function isHumanTurn() {
    return !vsComputer || currentPlayer === playerOneColor;
}

boardEl.tabIndex = -1;
boardEl.addEventListener("keydown", event => {
    if (gameOver || !gameStarted || boardEl.classList.contains("disabled")) return;
    if (vsComputer && currentPlayer !== playerOneColor) return;

    let nextRow = keyboardRow;
    let nextCol = keyboardCol;
    if (event.key === "ArrowUp") nextRow = Math.max(0, keyboardRow - 1);
    else if (event.key === "ArrowDown") nextRow = Math.min(7, keyboardRow + 1);
    else if (event.key === "ArrowLeft") nextCol = Math.max(0, keyboardCol - 1);
    else if (event.key === "ArrowRight") nextCol = Math.min(7, keyboardCol + 1);
    else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        boardEl.querySelector(`.cell[data-r="${keyboardRow}"][data-c="${keyboardCol}"]`)?.click();
        return;
    } else {
        return;
    }

    event.preventDefault();
    keyboardRow = nextRow;
    keyboardCol = nextCol;
    renderBoard();
});

function animateMove(move, flips, player) {
    hideValidMoveHints();
    const opponent = player === "black" ? "white" : "black";
    const placedCell = boardEl.querySelector(`.cell[data-r="${move.r}"][data-c="${move.c}"]`);
    const placedPiece = placedCell?.querySelector(".piece");
    placedPiece?.classList.add("piece-pop");

    flips.forEach(([r, c], index) => {
        const cell = boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        const piece = cell?.querySelector(".piece");
        if(!piece) return;

        // Temporär die alte Farbe anzeigen und erst in der Drehmitte wechseln.
        piece.classList.remove(player);
        piece.classList.add(opponent, "piece-flip-out");

        setTimeout(() => {
            piece.classList.remove(opponent, "piece-flip-out");
            piece.classList.add(player, "piece-flip-in");
        }, 150 + index * 65);
    });
}

function getAllValidMoves(player) {
    return OthelloAICore.getAllValidMoves(player, board);
}

function isValidMove(r, c, player) {
    return OthelloAICore.isValidMove(r, c, player, board);
}

function makeMove(r, c, player) {
    const result = OthelloAICore.applyMove(board, { r, c }, player);
    if (!result) return false;
    board = result.board;
    return { move: result.move, flips: result.flips };
}

function getPressureState(player) {
    const opponent = player === "black" ? "white" : "black";
    const opponentMoves = getAllValidMoves(opponent);
    return opponentMoves.length <= 4;
}

function updateScore() {
    let black = 0, white = 0;
    board.flat().forEach(cell => {
        if(cell === "black") black++;
        if(cell === "white") white++;
    });
    scoreBlackEl.textContent = black;
    scoreWhiteEl.textContent = white;
}

function nextTurn() { // NEU: Zentrale Funktion für Spielerwechsel + Bot
    if(checkGameOver()) return;

    currentPlayer = currentPlayer === "black"? "white" : "black";
    let passMessage = null;

    // Hat der nächste Spieler keinen Zug, muss er aussetzen. Der Wechsel
    // passiert hier zentral, damit kein doppelter Spielerwechsel entsteht.
    if(getAllValidMoves(currentPlayer).length === 0) {
        const passedPlayer = currentPlayer;
        const otherPlayer = currentPlayer === "black"? "white" : "black";

        if(getAllValidMoves(otherPlayer).length === 0) {
            endGame();
            return;
        }

        passMessage = `${passedPlayer === "black"? "Schwarz" : "Weiß"} muss aussetzen`;
        currentPlayer = otherPlayer;
    }

    const continueTurn = () => {
        passTimer = null;
        if (gameOver || !gameStarted) return;

        statusEl.textContent = `${currentPlayer === "black"? "Schwarz" : "Weiß"} am Zug`;
        renderBoard();

        // Wenn Bot dran ist und Spiel läuft: nach seiner Denkzeit ziehen.
        if(vsComputer && currentPlayer === getBotColor()) {
            const botColor = getBotColor();
            const moves = getAllValidMoves(botColor);
            if(moves.length > 0) {
                const thinkTime = botType === "adaptive" && typeof getAdaptiveBotThinkTime === "function"
                    ? getAdaptiveBotThinkTime()
                    : typeof getOthelloBotThinkTime === "function"
                    ? getOthelloBotThinkTime(botLevelIndex + 1, botColor)
                    : 300;
                const token = gameToken;
                botMoveTimer = setTimeout(() => {
                    botMoveTimer = null;
                    if (token !== gameToken || !gameStarted || gameOver) return;
                    botMove(token);
                }, thinkTime);
            }
        }
    };

    if (passMessage) {
        statusEl.textContent = passMessage;
        renderBoard();
        const token = gameToken;
        passTimer = setTimeout(() => {
            if (token !== gameToken) return;
            continueTurn();
        }, 800);
        return;
    }

    continueTurn();
}

function botMove(token = gameToken) { // Bot zieht und ruft dann nextTurn
    if (token !== gameToken || !gameStarted || gameOver) return;
    const botColor = getBotColor();
    const moves = getAllValidMoves(botColor);
    if(moves.length === 0) {
        nextTurn(); // Falls doch kein Zug da ist
        return;
    }
    const m = botType === "adaptive"
        ? getAdaptiveBotMove(board, botColor, window.othelloPlayerProfile)
        : getOthelloBotMove(botLevelIndex + 1, botColor);
    const selectedMove = m && moves.some(move => move.r === m.r && move.c === m.c)
        ? m
        : moves[Math.floor(Math.random() * moves.length)];
    const result = makeMove(selectedMove.r, selectedMove.c, botColor);
    if (!result) {
        playSound(soundError, 0.22);
        scheduleNextTurn(0, token);
        return;
    }
    playSound(soundMove, 0.28);
    updateScore();
    turnTransitionActive = true;
    renderBoard();
    animateMove(result.move, result.flips, botColor);
    lastMoveWasPressure = getPressureState(botColor);
    scheduleNextTurn(430 + result.flips.length * 65, token); // Nach der Animation ist Schwarz dran
}

function checkGameOver() {
    const boardFull = board.flat().every(cell => cell!== null);

    // In beiden Regelmodi endet das Spiel, sobald das Brett voll ist oder
    // beide Spieler keinen gültigen Zug mehr haben.
    const noMoves = getAllValidMoves("black").length === 0 &&
                    getAllValidMoves("white").length === 0;

    if(boardFull || noMoves) {
        endGame();
        return true;
    }
    return false;
}
function endGame() {
    if (gameOver) return;
    gameOver = true;
    boardEl.tabIndex = -1;
    cancelPendingTurnTimers();
    if (vsComputer && window.othelloPlayerProfile) {
        window.othelloPlayerProfile.gamesPlayed += 1;
    }
    boardEl.classList.add("disabled");
    settingsPanel.classList.remove("disabled"); // WICHTIG: wieder freigeben
    modeBtn.classList.remove("disabled");
    rulesBtn.classList.remove("disabled");
    startBtn.textContent = "Jetzt spielen";

    let black = parseInt(scoreBlackEl.textContent);
    let white = parseInt(scoreWhiteEl.textContent);

    if(ruleMode === "tournament") {
        let empty = 64 - black - white;
        if(black > white) black += empty;
        else if(white > black) white += empty;
    }

    let winner = black > white? "Schwarz gewinnt!" : white > black? "Weiß gewinnt!" : "Unentschieden!";
    scoreBlackEl.parentElement.classList.toggle("winner", black > white);
    scoreWhiteEl.parentElement.classList.toggle("winner", white > black);
    const roundWinnerColor = black > white ? "black" : white > black ? "white" : null;
    if (window.othelloPlayerProfile && vsComputer && botType === "adaptive") {
        window.othelloPlayerProfile.lastResult = roundWinnerColor === null
            ? "draw"
            : roundWinnerColor === playerOneColor ? "playerWin" : "botWin";
    }

    if (getMatchMode() > 0 && matchInProgress) {
        const winnerKey = roundWinnerColor === playerOneColor ? "playerOne" : "playerTwo";
        if (roundWinnerColor) matchWins[winnerKey] += 1;

        if (getMatchMode() === 1 || roundWinnerColor === null) {
            playerOneColor = otherColor(playerOneColor);
        } else {
            playerOneColor = otherColor(roundWinnerColor);
        }
        matchRound += 1;
        updateMatchInfo();
        statusEl.textContent = `Runde beendet: ${winner} - Nächste Runde starten`;
        startBtn.textContent = "Nächste Runde";
        if (typeof window.setOthelloMatchSettingsLocked === "function") {
            window.setOthelloMatchSettingsLocked(true);
        }
        return;
    }
    statusEl.textContent = `Spiel vorbei! ${winner} ${black}:${white}`;
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(false);
    }
}

boardEl.addEventListener("click", (e) => {
    if(gameOver ||!gameStarted) return;
    if(vsComputer && currentPlayer !== playerOneColor) return; // Klick blocken wenn Bot dran

    const cell = e.target.closest(".cell");
    if(!cell) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);

    const learningBoard = board.map(row => row.slice());
    const learningPlayerMoves = getAllValidMoves(currentPlayer);
    const learningOpponent = currentPlayer === "black" ? "white" : "black";
    const learningOpponentMoves = getAllValidMoves(learningOpponent);

    const result = makeMove(r, c, currentPlayer);
    if(result) {
        playSound(soundMove, 0.28);
        if (vsComputer && window.othelloPlayerProfile && currentPlayer === playerOneColor) {
            const learningState = { board, playerProfile: window.othelloPlayerProfile };
            const pressureForMove = learningOpponentMoves.length <= 4;
            othelloTrackPlayerMove(learningState, { r, c }, currentPlayer, pressureForMove);
            othelloTrackMoveQuality(
                learningState,
                { r, c },
                currentPlayer,
                learningBoard,
                learningPlayerMoves,
                learningOpponentMoves
            );
            if (result.flips.length >= 3) {
                window.othelloPlayerProfile.style.aggressive += 1;
            } else if (result.flips.length <= 1) {
                window.othelloPlayerProfile.style.careful += 1;
            }
        }
        updateScore();
        turnTransitionActive = true;
        renderBoard();
        animateMove(result.move, result.flips, currentPlayer);
        lastMoveWasPressure = getPressureState(currentPlayer);
        scheduleNextTurn(430 + result.flips.length * 65); // Erst nach der Animation wechseln
    } else {
        playSound(soundError, 0.22);
    }
});

resetGame();
