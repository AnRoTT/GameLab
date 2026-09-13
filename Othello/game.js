const boardEl = document.getElementById("board");
const ADAPT_SPEEDS = [
    { key: "slow", label: "Langsam" },
    { key: "normal", label: "Normal" },
    { key: "fast", label: "Schnell" }
];
const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const MATCH_OPTIONS = ["Einzelrunde", "Abwechselnd"];

let vsComputer = true;
let botType = "adaptive";
let botLevelIndex = 0;
let adaptSpeedIndex = 1;
let showMoveHints = true;
let matchModeIndex = 0;

const settingsStartButton = document.getElementById("startBtn");
const settingsModeButton = document.getElementById("modeBtn");
const settingsMoveHintsButton = document.getElementById("moveHintsBtn");
const settingsMatchButton = document.getElementById("matchBtn");
const settingsOpponentRow = document.getElementById("botOpponentRow");
const settingsBotLevelButton = document.getElementById("botLevelBtn");
const settingsAdaptSpeedButton = document.getElementById("adaptSpeedBtn");
const settingsStrengthPanel = document.getElementById("adaptiveStrengthPanel");
const settingsStrengthValue = document.getElementById("adaptiveStrengthValue");
const settingsStrengthBar = document.getElementById("adaptiveStrengthBar");
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const mobileSettingsBack = document.getElementById("mobileSettingsBack");
const mobileGameAction = document.getElementById("mobileGameAction");
const resumeSavedButton = document.getElementById("resumeSavedButton");
const resumeConfirmBackdrop = document.getElementById("resumeConfirmBackdrop");
const resumeDecline = document.getElementById("resumeDecline");
const resumeAccept = document.getElementById("resumeAccept");
const resumeProgress = document.getElementById("resumeProgress");
let mobilePrototype = window.AndisMobileLayout?.detectMobileSession?.() ?? false;
const screenController = window.AndisMobileLayout?.createScreenController?.({
    setupScreen,
    gameScreen,
    body: document.body
});
screenController?.applyMode(mobilePrototype, false);
const fullscreenController = screenController?.bindFullscreen?.({
    button: fullscreenToggle,
    isMobile: () => mobilePrototype
});

function stabilizeFullscreenBoard() {
    if (!document.fullscreenElement || !document.body.classList.contains("game-active")) {
        boardEl.style.removeProperty("--othello-board-size");
        boardEl.style.removeProperty("--othello-cell-size");
        boardEl.style.removeProperty("--othello-piece-size");
        return;
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
        const size = window.AndisBoardLayout?.viewportBoard?.({
            min: 240, max: 760, aspect: 1, widthOffset: 24, heightOffset: 58
        }) ?? Math.max(240, Math.min(window.innerHeight - 36, window.innerWidth - 24, 760));
        const cell = Math.max(1, Math.floor((size - 16 - 7 - 6) / 8));
        boardEl.style.setProperty("--othello-board-size", `${Math.floor(size)}px`);
        boardEl.style.setProperty("--othello-cell-size", `${cell}px`);
        boardEl.style.setProperty("--othello-piece-size", `${Math.floor(cell * 0.8)}px`);
        renderBoard();
    }));
}

window.AndisBoardLayout?.bindResponsiveBoardLayout(stabilizeFullscreenBoard);
screenController?.watchResponsiveMode?.((isMobile) => {
    mobilePrototype = isMobile;
});

function updateAdaptiveStrengthUI(strength = getAdaptiveStrength()) {
    const visible = vsComputer && botType === "adaptive";
    settingsStrengthPanel.hidden = !visible;
    if (!visible) return;
    settingsStrengthValue.textContent = `${Math.round(strength)}%`;
    settingsStrengthBar.style.width = `${Math.max(1, Math.min(100, strength))}%`;
}
window.updateOthelloAdaptiveStrengthUI = updateAdaptiveStrengthUI;

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
    settingsPanel.classList.toggle("disabled", locked);
    settingsModeButton.disabled = locked;
    settingsMoveHintsButton.disabled = locked;
    settingsMatchButton.disabled = locked;
    settingsBotLevelButton.disabled = locked || !vsComputer;
    settingsAdaptSpeedButton.disabled = locked || !vsComputer || botType !== "adaptive";
    [settingsModeButton, settingsMoveHintsButton, settingsMatchButton, settingsBotLevelButton, settingsAdaptSpeedButton]
        .forEach(button => button.classList.toggle("button-disabled", button.disabled));
};

settingsStartButton.addEventListener("click", () => {
    window.AndisSound?.playUiClick?.(0.22);
    if (gameStarted && !gameOver) {
        resetGame();
        OthelloStorage.clear();
        updateResumeAction();
        return;
    }
    initGame();
    showGameScreen();
});
settingsModeButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    window.AndisSound?.playUiClick?.(0.22);
    vsComputer = !vsComputer;
    settingsModeButton.textContent = vsComputer ? "1 Spieler" : "2 Spieler";
    updateBotLevelUI();
    updateScoreLabels();
});
settingsMoveHintsButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    window.AndisSound?.playUiClick?.(0.22);
    showMoveHints = !showMoveHints;
    settingsMoveHintsButton.textContent = showMoveHints ? "Ein" : "Aus";
});
settingsMatchButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    window.AndisSound?.playUiClick?.(0.22);
    matchModeIndex = (matchModeIndex + 1) % MATCH_OPTIONS.length;
    updateMatchModeUI();
    if (typeof updateMatchInfo === "function") updateMatchInfo();
});
settingsBotLevelButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    window.AndisSound?.playUiClick?.(0.22);
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotLevelUI();
});
settingsAdaptSpeedButton.addEventListener("click", () => {
    if (settingsAdaptSpeedButton.disabled || (gameStarted && !gameOver)) return;
    window.AndisSound?.playUiClick?.(0.22);
    adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEEDS.length;
    updateBotLevelUI();
});

updateBotLevelUI();
updateMatchModeUI();

const startBtn = document.getElementById("startBtn");
const modeBtn = document.getElementById("modeBtn");
const moveHintsBtn = document.getElementById("moveHintsBtn");
const botLevelBtn = document.getElementById("botLevelBtn");
const adaptSpeedBtn = document.getElementById("adaptSpeedBtn");
const settingsPanel = document.getElementById("settingsPanel");
const scoreBlackEl = document.getElementById("scoreBlack");
const scoreWhiteEl = document.getElementById("scoreWhite");
const matchScoreEl = document.getElementById("matchScore");
const statusEl = document.getElementById("status");
const matchLineEl = document.getElementById("matchLine");
const adaptiveStrengthPanel = document.getElementById("adaptiveStrengthPanel");
const adaptiveStrengthValue = document.getElementById("adaptiveStrengthValue");
const adaptiveStrengthBar = document.getElementById("adaptiveStrengthBar");

const soundMove = new Audio("../assets/sounds/Click.mp3");
const soundError = new Audio("../assets/sounds/Error_Tock.mp3");

[soundMove, soundError].forEach(sound => {
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

function getPlayerLabel(color) {
    if (color === playerOneColor) return "Spieler 1";
    return vsComputer ? "Bot" : "Spieler 2";
}

function getColorLabel(color) {
    return color === "black" ? "Schwarz" : "Weiß";
}

function updateTurnStatus(color = currentPlayer) {
    statusEl.textContent = `${getColorLabel(color)} am Zug – ${getPlayerLabel(color)}`;
}

function updateMatchInfo() {
    if (getMatchMode() === 0) {
        matchLineEl.textContent = "Einzelrunde";
        matchScoreEl.hidden = true;
        return;
    }
    matchScoreEl.textContent = `${matchWins.playerOne}:${matchWins.playerTwo}`;
    matchScoreEl.hidden = false;
    matchLineEl.textContent = `Abwechselnd - Runde ${matchRound} - Match ${matchWins.playerOne}:${matchWins.playerTwo}`;
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
let pendingTransitionKind = null;
let resumePreviouslyFocused = null;
let pendingSavedState = null;
let savedInSetup = false;
let leavingToMenu = false;
let returningToSetup = false;

window.othelloPlayerProfile = createOthelloPlayerProfile();

function hasSavableGame() {
    return Boolean(gameStarted && (!gameOver || (matchInProgress && getMatchMode() > 0)));
}

function createSavedState() {
    return {
        schemaVersion: 1,
        gameId: "othello",
        savedAt: new Date().toISOString(),
        board: board.map(row => row.slice()),
        currentPlayer,
        gameOver,
        gameStarted,
        turnTransitionActive,
        pendingTransitionKind,
        playerOneColor,
        matchRound,
        matchWins: { ...matchWins },
        matchInProgress,
        lastMoveWasPressure,
        keyboardRow,
        keyboardCol,
        settings: {
            vsComputer,
            botLevelIndex,
            adaptSpeedIndex,
            showMoveHints,
            matchModeIndex,
            botType
        },
        status: statusEl?.textContent || "",
        scoreBlack: Number(scoreBlackEl?.textContent) || 0,
        scoreWhite: Number(scoreWhiteEl?.textContent) || 0
    };
}

function isValidSavedState(saved) {
    return Boolean(saved
        && saved.gameId === "othello"
        && Array.isArray(saved.board)
        && saved.board.length === 8
        && saved.board.every(row => Array.isArray(row)
            && row.length === 8
            && row.every(value => value === null || value === "black" || value === "white"))
        && (saved.currentPlayer === "black" || saved.currentPlayer === "white")
        && typeof saved.gameStarted === "boolean"
        && saved.gameStarted
        && saved.settings
        && typeof saved.settings.vsComputer === "boolean"
        && Number.isInteger(saved.settings.botLevelIndex)
        && saved.settings.botLevelIndex >= 0
        && saved.settings.botLevelIndex < BOT_LEVELS.length
        && Number.isInteger(saved.settings.adaptSpeedIndex)
        && saved.settings.adaptSpeedIndex >= 0
        && saved.settings.adaptSpeedIndex < ADAPT_SPEEDS.length
        && Number.isInteger(saved.settings.matchModeIndex)
        && saved.settings.matchModeIndex >= 0
        && saved.settings.matchModeIndex < MATCH_OPTIONS.length);
}

function writeSavedGame() {
    if (hasSavableGame()) OthelloStorage.save(createSavedState());
    else OthelloStorage.clear();
}

function saveCurrentGame() {
    if (savedInSetup || leavingToMenu) return;
    writeSavedGame();
}

function updateResumeAction() {
    const saved = OthelloStorage.load();
    resumeSavedButton.hidden = !mobilePrototype || !isValidSavedState(saved);
}

function initGame() {
    cancelPendingTurnTimers();
    savedInSetup = false;
    returningToSetup = false;
    pendingTransitionKind = null;
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
    document.body.classList.add("game-active");
    turnTransitionActive = false;
    boardEl.classList.remove("disabled");
    boardEl.tabIndex = 0;
    // settingsPanel.classList.add("disabled"); // NICHT sperren wegen Abbrechen
modeBtn.classList.add("disabled"); // nur Modus sperren
moveHintsBtn.classList.add("disabled"); // nur Zughilfe sperren
    renderBoard();
    updateScore();
    updateTurnStatus();
    startBtn.textContent = getMatchMode() > 0 ? "Match beenden" : "Spiel abbrechen";
    if (mobileGameAction) mobileGameAction.textContent = "Spiel abbrechen";
    lastMoveWasPressure = false;

    updateBotLevelUI();
    updateMatchInfo();
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(true);
    }
    if (vsComputer && currentPlayer === getBotColor()) {
        const openingThinkTime = botType === "adaptive" && typeof getAdaptiveBotThinkTime === "function"
            ? getAdaptiveBotThinkTime()
            : typeof getOthelloBotThinkTime === "function"
            ? getOthelloBotThinkTime(botLevelIndex + 1, currentPlayer)
            : 300;
        const openingDelay = window.getBotMoveDelay(openingThinkTime, true);
        botMoveTimer = setTimeout(() => {
            botMoveTimer = null;
            if (token !== gameToken || !gameStarted || gameOver) return;
            botMove(token);
        }, openingDelay);
    }
    saveCurrentGame();
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
    pendingTransitionKind = null;
    gameToken += 1;
}

function scheduleNextTurn(delay, token = gameToken) {
    if (nextTurnTimer !== null) clearTimeout(nextTurnTimer);
    turnTransitionActive = true;
    pendingTransitionKind = "move";
    nextTurnTimer = setTimeout(() => {
        nextTurnTimer = null;
        if (token !== gameToken || !gameStarted || gameOver) return;
        turnTransitionActive = false;
        pendingTransitionKind = null;
        nextTurn();
    }, delay);
}

function resetGame() {
    cancelPendingTurnTimers();
    savedInSetup = false;
    returningToSetup = false;
    [scoreBlackEl.parentElement, scoreWhiteEl.parentElement].forEach(element => element.classList.remove("winner"));
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    keyboardRow = 3;
    keyboardCol = 3;
    gameStarted = false;
    gameOver = false;
    document.body.classList.remove("game-active");
    turnTransitionActive = false;
    boardEl.classList.add("disabled");
    boardEl.tabIndex = -1;
modeBtn.classList.remove("disabled"); // nur Modus wieder frei
moveHintsBtn.classList.remove("disabled"); // nur Zughilfe wieder frei
    playerOneColor = "black";
    renderBoard();
    updateScore();
    statusEl.textContent = "Klick 'Jetzt spielen' um zu starten";
    startBtn.textContent = "Jetzt spielen";
    if (mobileGameAction) mobileGameAction.textContent = "Spiel abbrechen";
    lastMoveWasPressure = false;
    matchInProgress = false;
    matchRound = 1;
    matchWins = { playerOne: 0, playerTwo: 0 };
    updateMatchInfo();
    updateBotLevelUI();
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(false);
    }
}

function showSetupScreen() {
    if (!mobilePrototype) return;
    fullscreenController?.exit();
    screenController?.showSetup();
}

function showGameScreen() {
    if (!mobilePrototype) return;
    screenController?.showGame();
    fullscreenController?.requestIfChosen();
}

function showSetupAfterSavedGame() {
    fullscreenController?.exit();
    cancelPendingTurnTimers();
    document.body.classList.remove("game-active");
    gameStarted = false;
    gameOver = true;
    matchInProgress = false;
    turnTransitionActive = false;
    boardEl.classList.add("disabled");
    boardEl.tabIndex = -1;
    startBtn.textContent = "Jetzt spielen";
    if (mobileGameAction) mobileGameAction.textContent = "Spiel abbrechen";
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(false);
    }
    if (mobilePrototype) screenController?.showSetup();
    updateResumeAction();
}

function abortToSetup() {
    returningToSetup = false;
    savedInSetup = false;
    window.AndisSavedGameNotice?.hide?.();
    resetGame();
    OthelloStorage.clear();
    updateResumeAction();
    showSetupScreen();
}

function saveAndReturnToSetup() {
    if (returningToSetup) return;
    if (!hasSavableGame()) {
        showSetupScreen();
        return;
    }
    writeSavedGame();
    cancelPendingTurnTimers();
    savedInSetup = true;
    returningToSetup = true;
    window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
        returningToSetup = false;
        showSetupAfterSavedGame();
    });
}

function leaveToMenu() {
    if (leavingToMenu) return;
    leavingToMenu = true;
    if (savedInSetup) {
        window.location.href = "../index.html?menu=1";
        return;
    }
    if (hasSavableGame()) {
        writeSavedGame();
        cancelPendingTurnTimers();
        window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
            window.location.href = "../index.html?menu=1";
        });
        return;
    }
    OthelloStorage.clear();
    window.location.href = "../index.html?menu=1";
}

function restoreSavedGame(saved) {
    if (!isValidSavedState(saved)) return false;
    cancelPendingTurnTimers();
    savedInSetup = false;
    returningToSetup = false;
    leavingToMenu = false;

    vsComputer = Boolean(saved.settings.vsComputer);
    botLevelIndex = saved.settings.botLevelIndex;
    adaptSpeedIndex = saved.settings.adaptSpeedIndex;
    showMoveHints = Boolean(saved.settings.showMoveHints);
    matchModeIndex = saved.settings.matchModeIndex;
    botType = saved.settings.botType === "manual" ? "manual" : "adaptive";
    settingsModeButton.textContent = vsComputer ? "1 Spieler" : "2 Spieler";
    settingsMoveHintsButton.textContent = showMoveHints ? "Ein" : "Aus";
    updateBotLevelUI();
    updateMatchModeUI();

    board = saved.board.map(row => row.slice());
    currentPlayer = saved.currentPlayer;
    gameOver = Boolean(saved.gameOver);
    gameStarted = true;
    turnTransitionActive = Boolean(saved.turnTransitionActive);
    pendingTransitionKind = saved.pendingTransitionKind === "pass" || saved.pendingTransitionKind === "move"
        ? saved.pendingTransitionKind
        : null;
    playerOneColor = saved.playerOneColor === "white" ? "white" : "black";
    matchRound = Math.max(1, Number(saved.matchRound) || 1);
    matchWins = {
        playerOne: Math.max(0, Number(saved.matchWins?.playerOne) || 0),
        playerTwo: Math.max(0, Number(saved.matchWins?.playerTwo) || 0)
    };
    matchInProgress = Boolean(saved.matchInProgress);
    lastMoveWasPressure = Boolean(saved.lastMoveWasPressure);
    keyboardRow = Math.max(0, Math.min(7, Number(saved.keyboardRow) || 0));
    keyboardCol = Math.max(0, Math.min(7, Number(saved.keyboardCol) || 0));

    document.body.classList.add("game-active");
    boardEl.classList.toggle("disabled", gameOver || !gameStarted);
    boardEl.tabIndex = gameOver || !gameStarted || turnTransitionActive ? -1 : 0;
    renderBoard();
    updateScore();
    statusEl.textContent = saved.status || `${getColorLabel(currentPlayer)} am Zug – ${getPlayerLabel(currentPlayer)}`;
    updateMatchInfo();
    startBtn.textContent = getMatchMode() > 0 ? "Match beenden" : "Spiel abbrechen";
    if (mobileGameAction) mobileGameAction.textContent = "Spiel abbrechen";
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(true);
    }
    if (mobilePrototype) showGameScreen();
    updateResumeAction();

    const token = gameToken;
    if (!gameOver && pendingTransitionKind === "move") {
        scheduleNextTurn(0, token);
    } else if (!gameOver && pendingTransitionKind === "pass") {
        setTimeout(() => {
            if (token === gameToken) continueTurnAfterTransition();
        }, 0);
    } else if (!gameOver && vsComputer && currentPlayer === getBotColor()) {
        continueTurnAfterTransition();
    }
    saveCurrentGame();
    return true;
}

mobileGameAction?.addEventListener("click", () => {
    window.AndisSound?.playUiClick?.(0.22);
    if (gameStarted && !gameOver) {
        resetGame();
        OthelloStorage.clear();
        updateResumeAction();
        showSetupScreen();
        return;
    }
    // Nach einer beendeten Einzelrunde oder Matchrunde direkt neu starten.
    // Die Spieleinstellungen bleiben dabei unveraendert und koennen ueber
    // den separaten Zurueck-Button wieder geoeffnet werden.
    initGame();
    showGameScreen();
});

function renderBoard() {
    boardEl.innerHTML = "";
    const humanMayMove = isHumanTurn() && !turnTransitionActive;
    const validMoves = (gameStarted && !gameOver && humanMayMove)
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
            } else if(showMoveHints && validMoves.some(m => m.r === r && m.c === c)) {
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
    if (gameOver || !gameStarted || turnTransitionActive || boardEl.classList.contains("disabled")) return;
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
    updateScoreLabels();
}

function updateScoreLabels() {
    document.getElementById("scoreBlackLabel").textContent = getPlayerLabel("black");
    document.getElementById("scoreWhiteLabel").textContent = getPlayerLabel("white");
}

function continueTurnAfterTransition() {
    passTimer = null;
    if (gameOver || !gameStarted) return;

    turnTransitionActive = false;
    pendingTransitionKind = null;
    updateTurnStatus();
    renderBoard();

    if (vsComputer && currentPlayer === getBotColor()) {
        const botColor = getBotColor();
        const moves = getAllValidMoves(botColor);
        if (moves.length > 0) {
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
    saveCurrentGame();
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

        passMessage = `${getColorLabel(passedPlayer)} (${getPlayerLabel(passedPlayer)}) muss aussetzen`;
        currentPlayer = otherPlayer;
    }

    if (passMessage) {
        statusEl.textContent = passMessage;
        renderBoard();
        const token = gameToken;
        pendingTransitionKind = "pass";
        passTimer = setTimeout(() => {
            if (token !== gameToken) return;
            continueTurnAfterTransition();
        }, 800);
        return;
    }

    continueTurnAfterTransition();
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
    saveCurrentGame();
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
    document.body.classList.add("game-active");
    boardEl.tabIndex = -1;
    cancelPendingTurnTimers();
    if (vsComputer && window.othelloPlayerProfile) {
        window.othelloPlayerProfile.gamesPlayed += 1;
    }
    boardEl.classList.add("disabled");
    settingsPanel.classList.remove("disabled"); // WICHTIG: wieder freigeben
    modeBtn.classList.remove("disabled");
    moveHintsBtn.classList.remove("disabled");
    startBtn.textContent = "Jetzt spielen";

    let black = parseInt(scoreBlackEl.textContent);
    let white = parseInt(scoreWhiteEl.textContent);

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

        playerOneColor = otherColor(playerOneColor);
        matchRound += 1;
        updateMatchInfo();
        statusEl.textContent = `Runde beendet: ${winner} - Nächste Runde starten`;
        startBtn.textContent = "Nächste Runde";
        if (mobileGameAction) mobileGameAction.textContent = "Nächste Runde";
        if (typeof window.setOthelloMatchSettingsLocked === "function") {
            window.setOthelloMatchSettingsLocked(true);
        }
        saveCurrentGame();
        return;
    }
    statusEl.textContent = `Spiel vorbei! ${winner} ${black}:${white}`;
    startBtn.textContent = "Neues Spiel";
    if (mobileGameAction) mobileGameAction.textContent = "Neues Spiel";
    if (typeof window.setOthelloMatchSettingsLocked === "function") {
        window.setOthelloMatchSettingsLocked(false);
    }
    saveCurrentGame();
}

boardEl.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const invalid = gameOver || !gameStarted || turnTransitionActive || (vsComputer && currentPlayer !== playerOneColor);
    if (!invalid) return;
    e.preventDefault();
    cell.blur();
    playSound(soundError, 0.22);
}, true);

boardEl.addEventListener("click", (e) => {
    if(gameOver || !gameStarted || turnTransitionActive) return;
    if(vsComputer && currentPlayer !== playerOneColor) return; // Klick blocken wenn Bot dran

    const cell = e.target.closest(".cell");
    if(!cell) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);

    if (!isValidMove(r, c, currentPlayer)) {
        playSound(soundError, 0.22);
        return;
    }

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
        saveCurrentGame();
    } else {
        playSound(soundError, 0.22);
    }
});

resetGame();

function closeResumeConfirm() {
    resumeConfirmBackdrop.hidden = true;
    pendingSavedState = null;
    resumePreviouslyFocused?.focus?.({ preventScroll: true });
    resumePreviouslyFocused = null;
}

function requestResume(saved) {
    pendingSavedState = saved;
    resumePreviouslyFocused = document.activeElement;
    const filled = saved.board.flat().filter(Boolean).length;
    const modeText = saved.settings.vsComputer ? "Gegen den Bot" : "2 Spieler";
    resumeProgress.textContent = `${modeText} · ${filled} belegte Felder · Runde ${saved.matchRound || 1}`;
    resumeConfirmBackdrop.hidden = false;
    resumeAccept.focus();
}

resumeDecline?.addEventListener("click", () => {
    window.AndisSound?.playUiClick?.(0.22);
    closeResumeConfirm();
    OthelloStorage.clear();
    updateResumeAction();
    settingsModeButton.focus({ preventScroll: true });
});

resumeAccept?.addEventListener("click", () => {
    window.AndisSound?.playUiClick?.(0.22);
    const saved = pendingSavedState;
    closeResumeConfirm();
    restoreSavedGame(saved);
});

resumeConfirmBackdrop?.addEventListener("click", event => {
    if (event.target === resumeConfirmBackdrop) closeResumeConfirm();
});

document.addEventListener("keydown", event => {
    if (!resumeConfirmBackdrop || resumeConfirmBackdrop.hidden) return;
    if (event.key === "Escape") {
        event.preventDefault();
        closeResumeConfirm();
        return;
    }
    if (event.key !== "Tab") return;
    const focusable = [resumeDecline, resumeAccept].filter(Boolean);
    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex]?.focus();
});

window.addEventListener("beforeunload", saveCurrentGame);

const menuButton = document.getElementById("backIcon");
menuButton?.addEventListener("click", event => {
    event.preventDefault();
    window.AndisSound?.playUiClick?.(0.22);
    if (hasSavableGame()) leaveToMenu();
    else window.location.href = "../index.html?menu=1";
});

window.AndisNavigation?.bindBackButton?.({
    button: mobileSettingsBack,
    isGameActive: () => document.body.classList.contains("game-active") || gameStarted,
    isMatchRunning: () => gameStarted && !gameOver,
    onActiveBack: saveAndReturnToSetup,
    onAbortConfirmed: abortToSetup,
    onMenuBack: saveAndReturnToSetup
});

const browserBackGuard = window.AndisNavigation?.bindBrowserBack?.({
    isGameActive: () => document.body.classList.contains("game-active") || gameStarted,
    isMatchRunning: () => gameStarted && !gameOver,
    onAbortConfirmed: leaveToMenu
});

resumeSavedButton?.addEventListener("click", () => {
    window.AndisSound?.playUiClick?.(0.22);
    const saved = OthelloStorage.load();
    if (isValidSavedState(saved)) restoreSavedGame(saved);
});

updateResumeAction();
const savedOthello = OthelloStorage.load();
const returnedFromGuide = new URLSearchParams(window.location.search).get("guide") === "1";
if (isValidSavedState(savedOthello)) {
    if (returnedFromGuide) restoreSavedGame(savedOthello);
    else requestResume(savedOthello);
}
