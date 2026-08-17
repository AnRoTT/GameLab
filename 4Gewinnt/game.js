// --- Konfiguration ---------------------------------------------------------

const ROWS = 6;
const COLS = 7;
const connectFourAICore = window.ConnectFourAICore;
const connectFourPlayerProfile = window.connectFourPlayerProfile
    || connectFourAICore.createPlayerProfile();
window.connectFourPlayerProfile = connectFourPlayerProfile;

const PLAYER_RED = 1;
const PLAYER_YELLOW = 2;

// --- State -----------------------------------------------------------------

let board = [];
let currentPlayer = PLAYER_RED;
let startingPlayer = PLAYER_RED;

let scores = {
    [PLAYER_RED]: 0,
    [PLAYER_YELLOW]: 0
};

let gameOver = false;
let botTimeoutId = null;
let roundToken = 0;
let matchActive = false;
let roundResultProcessed = false;
let roundStartInProgress = false;
let hoveredCol = null;
let hoverInputMode = "mouse";
let keyboardColumn = 0;
let chipDropActive = false;
let chipDropTimer = null;
let chipDropFrame = null;
const CHIP_DROP_DURATION = 180;

// === SOUNDS ===
const soundChip = new Audio('../assets/sounds/Chip_Drop.mp3');
const soundButton = new Audio('../assets/sounds/Button_Click.mp3');
const soundError = new Audio('../assets/sounds/Error_Tock.mp3');

[soundChip, soundButton, soundError].forEach(s => {
    s.volume = 0.25;
    s.preload = 'auto';
});

// Einstellungen
// --- DOM -------------------------------------------------------------------

const boardEl = document.getElementById("board");
const statusLine1El = document.getElementById("statusLine1");
const matchLineEl = document.getElementById("matchLine");
const scoreRedEl = document.getElementById("scoreRed");
const scoreYellowEl = document.getElementById("scoreYellow");
const adaptiveStrengthEl = document.getElementById("adaptive-strength");
const adaptiveStrengthTrackEl = document.getElementById("adaptive-strength-track");
const adaptiveStrengthFillEl = document.getElementById("adaptive-strength-fill");

const modeButton = document.getElementById("modeButton");
const matchButton = document.getElementById("matchButton");
const roundActionButton = document.getElementById("roundActionButton");
const resetGameButton = document.getElementById("resetGameButton");
const botLevelButton = document.getElementById("botLevelButton");
const adaptSpeedButton = document.getElementById("adaptSpeedButton");

// --- Winner Banner DOM ---
const winnerBannerEl = document.getElementById("winner-banner");
const winnerTextEl = document.getElementById("winner-text");
const nextRoundBtnEl = document.getElementById("next-round-btn");
const endMatchButton = document.getElementById("endMatchButton");

const MODE_OPTIONS = ["2 Spieler", "1 Spieler"];
const MATCH_OPTIONS = ["Einzelrunde", "Abwechselnd", "Verlierer beginnt"];
const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const BOT_LEVEL_KEYS = ["anfänger", "hobby", "verein", "meister", "adaptiv"];
const ADAPT_SPEED_OPTIONS = ["Langsam", "Normal", "Schnell"];
const ADAPT_SPEED_FACTORS = [0.5, 1.0, 1.5];

let botLevelIndex = 0;
let adaptSpeedIndex = 1;
window.currentAdaptSpeedFactor = ADAPT_SPEED_FACTORS[adaptSpeedIndex];
let modeIndex = 1;
let startRuleIndex = 1;
let matchModeIndex = 0;
const RESET_BUTTON_STATES = ["Jetzt spielen", "Jetzt spielen"];
let resetButtonIndex = 0;
const ACTIVE_RESET_BUTTON_TEXT = "Match beenden";
const FINISHED_RESET_BUTTON_TEXT = "Neues Match beginnen";

const settingsBoard = boardEl;
const settingsStatusLine = statusLine1El;
const settingsModeButton = modeButton;
const settingsMatchButton = matchButton;
const settingsNewGameButton = roundActionButton;
const settingsResetGameButton = resetGameButton;
const settingsBotLevelButton = botLevelButton;
const settingsAdaptSpeedButton = adaptSpeedButton;
const settingsAdaptiveStrength = adaptiveStrengthEl;
const settingsAdaptiveTrack = adaptiveStrengthTrackEl;
const settingsAdaptiveFill = adaptiveStrengthFillEl;
const settingsAdaptiveValue = adaptiveStrengthFillEl?.parentElement?.querySelector("[data-strength-value]")
    || document.getElementById("adaptive-strength-value");

function updateBotButtonState() {
    settingsBotLevelButton.disabled = modeIndex === 0 || matchActive;
    settingsBotLevelButton.classList.toggle("button-disabled", settingsBotLevelButton.disabled);
    settingsBotLevelButton.textContent = modeIndex === 0
        ? "2 Spieler Modus"
        : BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv" ? "Adaptiv" : BOT_LEVELS[botLevelIndex];
    updateAdaptSpeedButtonState();
    updateAdaptiveStrengthUI();
}

function updateAdaptSpeedButtonState() {
    const isAdaptive = modeIndex === 1 && BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv";
    window.currentAdaptSpeedFactor = ADAPT_SPEED_FACTORS[adaptSpeedIndex];
    settingsAdaptSpeedButton.disabled = !isAdaptive || matchActive;
    settingsAdaptSpeedButton.classList.toggle("button-disabled", settingsAdaptSpeedButton.disabled);
    settingsAdaptSpeedButton.textContent = isAdaptive ? ADAPT_SPEED_OPTIONS[adaptSpeedIndex] : "—";
    updateAdaptiveStrengthUI();
}

function setMatchInProgressLocked(isLocked) {
    settingsModeButton.disabled = isLocked;
    settingsMatchButton.disabled = isLocked;
    settingsBotLevelButton.disabled = isLocked || modeIndex === 0;
    settingsAdaptSpeedButton.disabled = isLocked || modeIndex === 0 || BOT_LEVEL_KEYS[botLevelIndex] !== "adaptiv";
    settingsModeButton.classList.toggle("button-disabled", isLocked);
    settingsMatchButton.classList.toggle("button-disabled", isLocked);
    settingsBotLevelButton.classList.toggle("button-disabled", settingsBotLevelButton.disabled);
    settingsAdaptSpeedButton.classList.toggle("button-disabled", settingsAdaptSpeedButton.disabled);
}

function setNextRoundButtonState(isVisible, isEnabled) {
    // Die Rundenaktion läuft wie bei Othello über den Hauptbutton.
    roundActionButton.hidden = true;
}

function setResetButtonForRound(isRoundActive, isRoundFinished = false) {
    resetButtonIndex = isRoundActive ? 1 : 0;
    if (isRoundActive && matchModeIndex > 0) {
        settingsResetGameButton.textContent = isRoundFinished ? "Nächste Runde" : ACTIVE_RESET_BUTTON_TEXT;
    } else {
        settingsResetGameButton.textContent = isRoundActive
            ? "Spiel abbrechen"
            : isRoundFinished ? "Jetzt spielen" : RESET_BUTTON_STATES[resetButtonIndex];
    }
}

function updateAdaptiveStrengthUI() {
    const isAdaptive = modeIndex === 1 && BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv";
    if (!settingsAdaptiveStrength || !settingsAdaptiveTrack || !settingsAdaptiveFill) return;
    settingsAdaptiveStrength.classList.toggle("hidden", !isAdaptive);
    if (!isAdaptive) return;
    const strength = typeof window.ConnectFourAdaptiveBot?.getSkill === "function"
        ? window.ConnectFourAdaptiveBot.getSkill()
        : 35;
    settingsAdaptiveTrack.style.setProperty("--skill", `${strength}%`);
    settingsAdaptiveTrack.setAttribute("aria-label", `Adaptive Stärke ${strength} von 100`);
    if (settingsAdaptiveValue) settingsAdaptiveValue.textContent = `${strength}%`;
    settingsAdaptiveFill.style.width = `${strength}%`;
}

settingsModeButton.addEventListener("click", () => {
    if (settingsModeButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    modeIndex = (modeIndex + 1) % MODE_OPTIONS.length;
    settingsModeButton.textContent = MODE_OPTIONS[modeIndex];
    updateBotButtonState();
    updateUIStatus();
});

settingsMatchButton.addEventListener("click", () => {
    if (settingsMatchButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    matchModeIndex = (matchModeIndex + 1) % MATCH_OPTIONS.length;
    startRuleIndex = matchModeIndex === 2 ? 0 : 1;
    settingsMatchButton.textContent = MATCH_OPTIONS[matchModeIndex];
    setNextRoundButtonState(matchModeIndex > 0, false);
    updateUIStatus();
});

settingsBotLevelButton.addEventListener("click", () => {
    if (settingsBotLevelButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotButtonState();
    updateUIStatus();
});

settingsAdaptSpeedButton.addEventListener("click", () => {
    if (settingsAdaptSpeedButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEED_OPTIONS.length;
    updateAdaptSpeedButtonState();
    updateUIStatus();
});

settingsNewGameButton.addEventListener("click", () => {
    if (roundActionButton.disabled || matchModeIndex === 0 || !matchActive || !gameOver) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    startNewRound();
});

settingsResetGameButton.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    if (gameOver) {
        hideWinner();
        startNewRound();
        setResetButtonForRound(true);
        setMatchInProgressLocked(true);
    } else if (resetButtonIndex === 0) {
        settingsBoard.classList.remove("disabled");
        settingsBoard.style.pointerEvents = "auto";
        startNewRound();
        setResetButtonForRound(true);
        setMatchInProgressLocked(true);
    } else {
        resetMatchOnly();
        setResetButtonForRound(false);
        setMatchInProgressLocked(false);
        updateBotButtonState();
    }
});

nextRoundBtnEl.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    hideWinner();
    startNewRound();
});

// --- Initialisierung -------------------------------------------------------

initBoard();
attachColumnHoverZones();
positionHoverZones();
boardEl.tabIndex = -1;
updateKeyboardColumnFocus();
boardEl.classList.add("disabled"); // Brett sperren
updateUIStatus();
setMatchInProgressLocked(false);
setResetButtonForRound(false);
// The next-round action is visible for stable layout, but unavailable until
// a completed multi-round match has produced an actual next round.
setNextRoundButtonState(false, false);
updateBotButtonState(); // <-- NEU
window.addEventListener("resize", positionHoverZones);

// --- Board-Aufbau ----------------------------------------------------------

function initBoard() {
    board = [];
    boardEl.innerHTML = "";

    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            row.push(0);

            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = r.toString();
            cell.dataset.col = c.toString();

            const chip = document.createElement("div");
            chip.classList.add("chip");
            cell.appendChild(chip);

            boardEl.appendChild(cell);
        }
        board.push(row);
    }
}

function attachColumnHoverZones() {
    for (let c = 0; c < COLS; c++) {
        const zone = document.createElement("div");
        zone.classList.add("board-column-hover");
        zone.dataset.col = c.toString();

        // --- CLICK ---
        zone.addEventListener("click", () => {
            handleColumnClick(c);
        });

        // --- HOVER / TOUCH: Ghost nur für echte Spieler ---
        zone.addEventListener("pointerenter", (event) => {
            if (gameOver) return;
            if (chipDropActive) return;
            hoverInputMode = event.pointerType || "mouse";
            if (hoverInputMode !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
            hoveredCol = c;
            if (modeIndex === 1 && currentPlayer === PLAYER_YELLOW) return; // Bot: kein Ghost
            updateGhost(c);
        });

        zone.addEventListener("pointerleave", () => {
            if (hoveredCol === c) hoveredCol = null;
            clearGhost();
        });

        zone.addEventListener("pointerdown", (event) => {
            if (gameOver) return;
            hoverInputMode = event.pointerType || "mouse";
            const isTouchLike = hoverInputMode === "touch"
                || window.matchMedia("(hover: none), (pointer: coarse)").matches;
            if (isTouchLike) {
                boardEl.classList.add("touch-input");
                hoveredCol = null;
                clearGhost();
                boardEl.querySelectorAll(".board-column-hover.keyboard-focus").forEach((focusedZone) => {
                    focusedZone.classList.remove("keyboard-focus");
                });
                boardEl.blur();
            } else {
                boardEl.classList.remove("touch-input");
            }
        });

        boardEl.appendChild(zone);
    }
}

function updateKeyboardColumnFocus() {
    boardEl.querySelectorAll(".board-column-hover").forEach((zone, index) => {
        zone.classList.toggle("keyboard-focus", index === keyboardColumn);
    });
}

boardEl.addEventListener("keydown", event => {
    if (gameOver || !matchActive || boardEl.classList.contains("disabled")) return;
    if (modeIndex === 1 && isBotTurn()) return;

    if (event.key === "ArrowLeft") {
        keyboardColumn = Math.max(0, keyboardColumn - 1);
    } else if (event.key === "ArrowRight") {
        keyboardColumn = Math.min(COLS - 1, keyboardColumn + 1);
    } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleColumnClick(keyboardColumn);
        return;
    } else {
        return;
    }

    boardEl.classList.remove("touch-input");
    event.preventDefault();
    updateKeyboardColumnFocus();
});

function positionHoverZones() {
    const zones = boardEl.querySelectorAll(".board-column-hover");
    const boardRect = boardEl.getBoundingClientRect();
    const style = window.getComputedStyle(boardEl);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const gap = parseFloat(style.columnGap || style.gap) || 0;
    const innerWidth = boardRect.width - paddingLeft - paddingRight;
    const innerHeight = boardRect.height - paddingTop - paddingBottom;
    const zoneWidth = (innerWidth - gap * (COLS - 1)) / COLS;

    zones.forEach((zone, c) => {
        zone.style.left = `${paddingLeft + c * (zoneWidth + gap)}px`;
        zone.style.top = `${paddingTop}px`;
        zone.style.width = `${zoneWidth}px`;
        zone.style.height = `${innerHeight}px`;
    });
}

// --- UI --------------------------------------------------------------------

function updateScoreUI() {
    scoreRedEl.textContent = scores[PLAYER_RED].toString();
    scoreYellowEl.textContent = scores[PLAYER_YELLOW].toString();
    document.querySelectorAll(".score.winner").forEach(score => score.classList.remove("winner"));
}

function playerName(player) {
    return player === PLAYER_RED ? "Rot" : "Gelb";
}

function updateUIStatus(message, keepLine2 = false) {
    matchLineEl.textContent = matchModeIndex === 0
        ? "Einzelrunde - Offizielle Regeln"
        : `${matchModeIndex === 1 ? "Abwechselnd" : "Verlierer beginnt"} - Match ${scores[PLAYER_RED]}:${scores[PLAYER_YELLOW]}`;
    // A completed round owns the status line. No later refresh may make it
    // look like the next turn has already started.
    if (gameOver || roundResultProcessed) {
        statusLine1El.textContent = "Runde beendet. Starte eine neue Runde.";
        updateAdaptiveStrengthUI();
        return;
    }

    // Fall 1: Es kommt eine Sonder-Nachricht wie "Gelb denkt..."
    if (message) {
        statusLine1El.textContent = message;
        updateAdaptiveStrengthUI();
        return;
    }

    // Normaler Spielbetrieb - ZEILE 1
    const modeText = MODE_OPTIONS[modeIndex];
    const matchText = MATCH_OPTIONS[matchModeIndex];
    statusLine1El.textContent = `Am Zug: ${playerName(currentPlayer)} · Modus: ${modeText} · ${matchText}`;
    updateAdaptiveStrengthUI();
}

function finalizeAdaptiveRoundSafely(resultSign) {
    if (modeIndex !== 1 || typeof window.finalizeAdaptiveRound !== "function") return;
    try {
        window.finalizeAdaptiveRound(resultSign);
    } catch (error) {
        // Learning must never prevent the visible game round from finishing.
        console.error("Adaptive Rundenanalyse übersprungen:", error);
    }
}

// --- Spiel-Logik -----------------------------------------------------------

function startNewRound() {
    if (roundStartInProgress) return;
    roundStartInProgress = true;

    try {
    if (!matchActive) matchActive = true;
    hideWinner(); // Banner ausblenden falls es noch da ist
    cancelPendingBotMove();
    roundToken += 1;
    boardEl.classList.remove("disabled");
    boardEl.tabIndex = 0;
    boardEl.style.pointerEvents = "auto"; // NEU: sicher freischalten
	clearGhost();
    gameOver = false;
    roundResultProcessed = false;
    clearBoardVisual();
    resetBoardArray();

    currentPlayer = startingPlayer;

    updateUIStatus("Runde gestartet.");
    setMatchInProgressLocked(true);
    setResetButtonForRound(true);
    setNextRoundButtonState(matchModeIndex > 0, false);
    maybeBotMove();
    } finally {
        roundStartInProgress = false;
    }
}

function clearBoardVisual() {
    clearDropAnimation();
    const cells = boardEl.querySelectorAll(".cell");
    cells.forEach(cell => {
        cell.classList.remove("win");
        const chip = cell.querySelector(".chip");
        chip.className = "chip"; // reset classes
        chip.style.transform = "";
        chip.style.opacity = "";
    });
}

function resetBoardArray() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0;
        }
    }
}

function handleColumnClick(col) {
    if (gameOver) return;
    if (chipDropActive) return;
    if (!matchActive && resetButtonIndex === 0) return;
    if (modeIndex === 1 && isBotTurn()) return;

    const row = findFreeRow(col);
    if (row === -1) {
        soundError.currentTime = 0;
        soundError.play().catch(()=>{});
        updateUIStatus("Spalte voll. Wähle eine andere Spalte.");
        return;
    }

    const missedWin = modeIndex === 1
        ? connectFourAICore.hasMissedWin(board, col, PLAYER_RED)
        : false;
    clearGhost();
    hoveredCol = null;
    placeChip(row, col, currentPlayer);
    const winner = checkWinner();

    if (modeIndex === 1 && currentPlayer === PLAYER_RED) {
        const zugBewertung = connectFourAICore.evaluatePlayerMove(board, col, row, PLAYER_RED);
        connectFourAICore.trackPlayerMove(connectFourPlayerProfile, col, row, zugBewertung);
        if (missedWin) connectFourAICore.recordPlayerEvent(connectFourPlayerProfile, "missedWin");
        const forkCount = connectFourAICore.countWinningMoves(board, PLAYER_RED);
        if (forkCount >= 2) connectFourAICore.recordPlayerEvent(connectFourPlayerProfile, "fork");
        if (missedWin || forkCount >= 1) connectFourAICore.recordPlayerEvent(connectFourPlayerProfile, "pressure");
        if (detectWinPattern(row, col, PLAYER_RED)) connectFourPlayerProfile.style.offensive++;
    }

    if (winner) {
        onWin(winner);
        return;
    }

    if (isBoardFull()) {
        onDraw();
        return;
    }

    switchPlayer();
    updateUIStatus();
    refreshGhostForActivePlayer();
    maybeBotMove();
}

function isBotTurn() {
    // Im 1-Spieler-Modus spielt Gelb als Bot
    return modeIndex === 1 && currentPlayer === PLAYER_YELLOW; // <-- muss 1 sein
}

function maybeBotMove() {
    cancelPendingBotMove();
    if (!matchActive) return;
    if (modeIndex !== 1) return;
    if (currentPlayer !== PLAYER_YELLOW) return;
    if (gameOver) return;
    const token = roundToken;

    const level = BOT_LEVEL_KEYS[botLevelIndex];
    let baseTime = 800;

    if (level === "adaptiv") {
        try {
            baseTime = window.getAdaptiveThinkTime();
        } catch (error) {
            console.error("Adaptive Denkzeit übersprungen:", error);
            baseTime = 800;
        }
    } else if (typeof getManualConnectFourThinkTime === "function") {
        baseTime = getManualConnectFourThinkTime(level);
    }

    baseTime = baseTime + Math.random() * 400 - 200;
    // Wait slightly longer than the player chip animation, then use one
    // direct timer instead of recursively polling chipDropActive.
    baseTime = Math.max(CHIP_DROP_DURATION + 40, baseTime);

    updateUIStatus(`Gelb denkt...`, true);

    botTimeoutId = setTimeout(() => { botMove(token); }, baseTime);
}

function cancelPendingBotMove() {
    if (botTimeoutId !== null) {
        clearTimeout(botTimeoutId);
        botTimeoutId = null;
    }
}

function botMove(token) {
    if (token !== roundToken || gameOver || modeIndex !== 1 || currentPlayer !== PLAYER_YELLOW) return;
    const level = BOT_LEVEL_KEYS[botLevelIndex];
    let col = -1;

    if (level === "adaptiv") {
        try {
            col = window.getAdaptiveBotMove();
        } catch (error) {
            console.error("Adaptiver Zug übersprungen:", error);
            col = -1;
        }
    } else if (typeof getManualConnectFourMove === "function") {
        col = getManualConnectFourMove({
            board,
            level,
            player: PLAYER_YELLOW,
            opponent: PLAYER_RED
        });
    }

    if (!Number.isInteger(col) || col < 0 || col >= COLS) col = -1;

    if (col === -1) {
        const availableColumns = connectFourAICore.getAvailableColumns(board);
        col = availableColumns.length
            ? availableColumns[Math.floor(Math.random() * availableColumns.length)]
            : -1;
    }
    if (col === -1) { onDraw(); return; }
    const row = findFreeRow(col);
    if (row === -1) { onDraw(); return; }

    clearGhost();
    placeChip(row, col, currentPlayer);
    botTimeoutId = null;
    const winner = checkWinner();
    if (winner) { onWin(winner); return; }
    if (isBoardFull()) { onDraw(); return; }

    switchPlayer();
    updateUIStatus();
    refreshGhostForActivePlayer();
}

// --- Hilfsfunktionen -------------------------------------------------------

function findFreeRow(col) {
    return connectFourAICore.getFreeRow(board, col);
}

function placeChip(row, col, player) {
    board[row][col] = player;

    const cell = getCell(row, col);
    const chip = cell.querySelector(".chip");
    chip.classList.remove("ghost", "ghost-red", "ghost-yellow");

    chip.classList.add(player === PLAYER_RED ? "red" : "yellow", "drop-pending");
    animateChipDrop(row, col, player);

}

function clearDropAnimation() {
    if (chipDropTimer !== null) {
        window.clearTimeout(chipDropTimer);
        chipDropTimer = null;
    }
    if (chipDropFrame !== null) {
        window.cancelAnimationFrame(chipDropFrame);
        chipDropFrame = null;
    }
    boardEl.querySelectorAll(".drop-svg, .drop-sequence-chip, .drop-chip").forEach(dropChip => dropChip.remove());
    chipDropActive = false;
}

function animateChipDrop(row, col, player) {
    const cell = getCell(row, col);
    if (!cell) return;

    clearDropAnimation();
    const chip = cell.querySelector(".chip");
    chipDropActive = true;
    chip.classList.add("landing");
    requestAnimationFrame(() => chip.classList.add("visible"));

    chipDropTimer = window.setTimeout(() => {
        chip.classList.remove("drop-pending", "landing");
        chip.classList.add("visible", "landed");
        soundChip.currentTime = 0;
        soundChip.play().catch(() => {});
        chipDropActive = false;
        chipDropTimer = null;
    }, CHIP_DROP_DURATION);
}

function getCell(row, col) {
    return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

function updateGhost(col) {
    clearGhost(); // erst alle alten Ghosts weg

    const row = findFreeRow(col);
    if (row === -1) return; // Spalte voll

    const chip = getCell(row, col).querySelector(".chip");
    chip.classList.add('ghost');
    chip.classList.add(currentPlayer === PLAYER_RED ? 'ghost-red' : 'ghost-yellow');
}

function refreshGhostForActivePlayer() {
    if (hoveredCol === null) return;
    if (gameOver) return;
    if (modeIndex === 1 && currentPlayer === PLAYER_YELLOW) {
        clearGhost();
        return;
    }
    updateGhost(hoveredCol);
}

function clearGhost() {
    boardEl.querySelectorAll('.chip.ghost').forEach(chip => {
        chip.classList.remove('ghost', 'ghost-red', 'ghost-yellow');
    });
}

function detectWinPattern(row, col, player) {
    const patterns = [
        [[0, 1], [0, 2], [0, 3]],
        [[1, 0], [2, 0], [3, 0]],
        [[1, 1], [2, 2], [3, 3]],
        [[1, -1], [2, -2], [3, -3]]
    ];

    const types = ["horizontal", "vertical", "diagonal_down", "diagonal_up"];
    for (let i = 0; i < patterns.length; i++) {
        const seq = patterns[i];
        let count = 1;
        for (const [dr, dc] of seq) {
            const r1 = row + dr;
            const c1 = col + dc;
            const r2 = row - dr;
            const c2 = col - dc;
            if (r1 >= 0 && r1 < ROWS && c1 >= 0 && c1 < COLS && board[r1][c1] === player) count++;
            if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS && board[r2][c2] === player) count++;
        }
        if (count >= 4) return types[i];
    }
    return null;
}

function switchPlayer() {
    currentPlayer = currentPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
}

function isBoardFull() {
    return connectFourAICore.isBoardFull(board);
}

// --- Gewinnprüfung ---------------------------------------------------------

function checkWinner() {
    const winner = connectFourAICore.findWinner(board);
    if (!winner) return null;
    highlightWin(winner.coordinates);
    return winner.player;
}

function highlightWin(coords) {
    coords.forEach(([r, c]) => {
        const cell = getCell(r, c);
        cell.classList.add("win");
    });
}

// --- Rundenende & Startlogik -----------------------------------------------

function onWin(player) {
    gameOver = true;
    boardEl.tabIndex = -1;
    cancelPendingBotMove();
    scores[player] += 1;
    updateScoreUI();
    document.querySelector(`.score ${player === PLAYER_RED ? "#scoreRed" : "#scoreYellow"}`)?.parentElement.classList.add("winner");
    roundResultProcessed = true;

    if (modeIndex === 1) {
        finalizeAdaptiveRoundSafely(player === PLAYER_RED ? 1 : -1);
        connectFourPlayerProfile.gamesAgainstBot++;
    }

    if (matchModeIndex === 0) {
        matchActive = false;
        setResetButtonForRound(false, true);
    } else if (startRuleIndex === 0) {
        startingPlayer = player === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    } else {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    }
    if (matchModeIndex > 0 && matchActive) setResetButtonForRound(true, true);

    // Apply the completed-round UI only after every game-state update. This
    // prevents an adaptive/profile refresh from re-enabling the live status.
    updateUIStatus();
    showWinner(`${playerName(player)} hat gewonnen!`);
    setMatchInProgressLocked(matchModeIndex > 0);
    setNextRoundButtonState(matchModeIndex > 0 && matchActive, matchModeIndex > 0 && matchActive);
}

function resetMatchOnly() {
    clearGhost();
    cancelPendingBotMove();
    roundToken += 1;
    matchActive = false;
    scores[PLAYER_RED] = 0;
    scores[PLAYER_YELLOW] = 0;
    updateScoreUI();

    startingPlayer = PLAYER_RED;
    currentPlayer = PLAYER_RED;

    gameOver = false;
    roundResultProcessed = false;
    setMatchInProgressLocked(false);
    setResetButtonForRound(false);
    boardEl.classList.add("disabled");
    boardEl.tabIndex = -1;
    boardEl.style.pointerEvents = "none";

    initBoard();
    attachColumnHoverZones();
    positionHoverZones();
    updateKeyboardColumnFocus();

    updateUIStatus("Wähle Modus und klicke 'Spiel starten'");
    setNextRoundButtonState(matchModeIndex > 0, false);
    winnerBannerEl.classList.add("hidden");
    nextRoundBtnEl.hidden = true;
    if (endMatchButton) endMatchButton.hidden = true;
}

function resetFullGame() {
    resetMatchOnly();
    window.resetAdaptiveState?.();
    updateBotButtonState();
}

function onDraw() {
    gameOver = true;
    boardEl.tabIndex = -1;
    cancelPendingBotMove();
    roundResultProcessed = true;
    document.querySelectorAll(".score").forEach(score => score.classList.remove("winner"));
    if (modeIndex === 1) {
        finalizeAdaptiveRoundSafely(0);
        connectFourPlayerProfile.gamesAgainstBot++;
    }

    if (matchModeIndex === 0) {
        matchActive = false;
        setResetButtonForRound(false, true);
        setMatchInProgressLocked(false);
    } else if (startRuleIndex === 0) {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    } else {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    }
    if (matchModeIndex > 0 && matchActive) setResetButtonForRound(true, true);

    updateUIStatus();
    showWinner("Unentschieden!");
    setMatchInProgressLocked(matchModeIndex > 0);
    setNextRoundButtonState(matchModeIndex > 0 && matchActive, matchModeIndex > 0 && matchActive);
}

// --- Winner Banner Funktionen ---
function showWinner(text) {
    winnerTextEl.textContent = text;
    winnerBannerEl.classList.remove("hidden");
    boardEl.style.pointerEvents = "none"; // Nur Klicks sperren, nicht ausgrauen
    nextRoundBtnEl.hidden = true;
}

function hideWinner() {
    winnerBannerEl.classList.add("hidden");
    nextRoundBtnEl.hidden = true;
    boardEl.style.pointerEvents = "auto"; // Klicks wieder erlauben
    setNextRoundButtonState(matchModeIndex > 0, false);
    if (endMatchButton) endMatchButton.hidden = true;
}

