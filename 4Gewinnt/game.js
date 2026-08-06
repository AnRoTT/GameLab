// --- Konfiguration ---------------------------------------------------------

const ROWS = 6;
const COLS = 7;

const PLAYER_RED = 1;
const PLAYER_YELLOW = 2;

const MODE_OPTIONS = ["2 Spieler", "1 Spieler"];
const START_RULE_OPTIONS = [
    "Verlierer beginnt",
    "Nicht-Starter beginnt"
];
// --- Bot Stufen ---
const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const BOT_LEVEL_KEYS = ["anfänger", "hobby", "verein", "meister", "adaptiv"];
let botLevelIndex = 0; // 0 = Anfänger

// --- ADAPTIV GESCHWINDIGKEIT ---
const ADAPT_SPEED_OPTIONS = ["Langsam", "Normal", "Schnell"];
const ADAPT_SPEED_FACTORS = [0.4, 1.0, 1.6];
let adaptSpeedIndex = 1; // 1 = Normal

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
let hoveredCol = null;
let hoverInputMode = "mouse";
let playerSkill = 24;
let inertiaCounter = 0;
let lastBotIndex = 2;

// === SOUNDS ===
const soundChip = new Audio('../assets/sounds/Chip_Drop.mp3');
const soundButton = new Audio('../assets/sounds/Button_Click.mp3');
const soundError = new Audio('../assets/sounds/Error_Tock.mp3');

[soundChip, soundButton, soundError].forEach(s => {
    s.volume = 0.25;
    s.preload = 'auto';
});

// Einstellungen
let modeIndex = 1; // 0: 2 Spieler, 1: 1 Spieler
let startRuleIndex = 0; // 0: loser starts, 1: non-starter starts
const RESET_BUTTON_STATES = ["Spiel starten", "Neues Spiel"];
let resetButtonIndex = 0; // 0 = Spiel starten, 1 = Neues Spiel
const ACTIVE_RESET_BUTTON_TEXT = "Match beenden";

// --- DOM -------------------------------------------------------------------

const boardEl = document.getElementById("board");
const statusLine1El = document.getElementById("statusLine1");
const scoreRedEl = document.getElementById("scoreRed");
const scoreYellowEl = document.getElementById("scoreYellow");
const adaptiveStrengthEl = document.getElementById("adaptive-strength");
const adaptiveStrengthTrackEl = document.getElementById("adaptive-strength-track");
const adaptiveStrengthFillEl = document.getElementById("adaptive-strength-fill");

const modeButton = document.getElementById("modeButton");
const startRuleButton = document.getElementById("startRuleButton");
const newGameButton = document.getElementById("newGameButton");
const resetGameButton = document.getElementById("resetGameButton");
const botLevelButton = document.getElementById("botLevelButton");
const adaptSpeedButton = document.getElementById("adaptSpeedButton");

// --- Helper: Bot Button State ---
function updateBotButtonState() {
    botLevelButton.disabled = (modeIndex === 0 || matchActive);
    botLevelButton.classList.toggle("button-disabled", botLevelButton.disabled);
    if(modeIndex === 0) {
        botLevelButton.textContent = "2 Spieler Modus";
    } else {
        if(BOT_LEVEL_KEYS[botLevelIndex] === 'adaptiv'){
            botLevelButton.textContent = `Adaptiv`;
        } else {
            botLevelButton.textContent = BOT_LEVELS[botLevelIndex];
        }
    }
    updateAdaptSpeedButtonState(); // <-- NEU HINZU
    updateAdaptiveStrengthUI();
}

// --- Helper: Adapt Speed Button State ---
function updateAdaptSpeedButtonState() {
    const isAdaptiv = BOT_LEVEL_KEYS[botLevelIndex] === 'adaptiv';
    adaptSpeedButton.disabled = !isAdaptiv || matchActive;
    adaptSpeedButton.classList.toggle("button-disabled", adaptSpeedButton.disabled);

    if(isAdaptiv) {
        adaptSpeedButton.textContent = ADAPT_SPEED_OPTIONS[adaptSpeedIndex];
    } else {
        adaptSpeedButton.textContent = "—";
    }
    updateAdaptiveStrengthUI();
}

function setMatchInProgressLocked(isLocked) {
    modeButton.disabled = isLocked;
    startRuleButton.disabled = isLocked;
    botLevelButton.disabled = isLocked || modeIndex === 0;
    adaptSpeedButton.disabled = isLocked || modeIndex === 0 || BOT_LEVEL_KEYS[botLevelIndex] !== 'adaptiv';
    modeButton.classList.toggle("button-disabled", isLocked);
    startRuleButton.classList.toggle("button-disabled", isLocked);
    botLevelButton.classList.toggle("button-disabled", botLevelButton.disabled);
    adaptSpeedButton.classList.toggle("button-disabled", adaptSpeedButton.disabled);
    newGameButton.disabled = false;
    newGameButton.classList.toggle("button-disabled", !isLocked);
    newGameButton.textContent = isLocked ? "Match abbrechen" : "Neue Runde";
}

function setResetButtonForRound(isRoundActive) {
    if (isRoundActive) {
        resetButtonIndex = 1;
        resetGameButton.textContent = ACTIVE_RESET_BUTTON_TEXT;
    } else {
        resetButtonIndex = 0;
        resetGameButton.textContent = RESET_BUTTON_STATES[resetButtonIndex];
    }
}

function isMatchLocked() {
    return matchActive;
}

// --- Winner Banner DOM ---
const winnerBannerEl = document.getElementById("winner-banner");
const winnerTextEl = document.getElementById("winner-text");
const nextRoundBtnEl = document.getElementById("next-round-btn");

// --- Initialisierung -------------------------------------------------------

initBoard();
attachColumnHoverZones();
positionHoverZones();
boardEl.classList.add("disabled"); // Brett sperren
updateUIStatus();
newGameButton.classList.add("button-disabled");
setMatchInProgressLocked(false);
setResetButtonForRound(false);
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
            hoverInputMode = event.pointerType || "mouse";
            if (hoverInputMode === "touch") return;
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
            if (hoverInputMode === "touch") {
                hoveredCol = null;
                clearGhost();
            }
        });

        boardEl.appendChild(zone);
    }
}

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
}

function updateAdaptiveStrengthUI() {
    const isAdaptive = modeIndex === 1 && BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv";
    if (!adaptiveStrengthEl || !adaptiveStrengthTrackEl || !adaptiveStrengthFillEl) return;

    adaptiveStrengthEl.classList.toggle("hidden", !isAdaptive);
    if (!isAdaptive) return;

    const strength = Math.max(0, Math.min(100, Math.round(adaptiveSkill)));
    adaptiveStrengthTrackEl.style.setProperty("--skill", `${strength}%`);
    adaptiveStrengthFillEl.style.width = `${strength}%`;
}

function playerName(player) {
    return player === PLAYER_RED ? "Rot" : "Gelb";
}

function updateUIStatus(message, keepLine2 = false) {
    // Fall 1: Es kommt eine Sonder-Nachricht wie "Gelb denkt..."
    if (message) {
        statusLine1El.textContent = message;
        updateAdaptiveStrengthUI();
        return;
    }

    // Fall 2: Spiel ist vorbei
    if (gameOver) {
        statusLine1El.textContent = "Runde beendet. Starte eine neue Runde.";
        updateAdaptiveStrengthUI();
        return;
    }

    // Fall 3: Normaler Spielbetrieb - ZEILE 1
    const modeText = MODE_OPTIONS[modeIndex];
    const startRuleText = START_RULE_OPTIONS[startRuleIndex];
    statusLine1El.textContent = `Am Zug: ${playerName(currentPlayer)} · Modus: ${modeText} · Wechsel: ${startRuleText}`;
    updateAdaptiveStrengthUI();
}

// --- CycleButtons ----------------------------------------------------------

modeButton.addEventListener("click", () => {
    if (modeButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    modeIndex = (modeIndex + 1) % MODE_OPTIONS.length;
    modeButton.textContent = MODE_OPTIONS[modeIndex];

    updateBotButtonState(); // <-- NEU
    updateAdaptSpeedButtonState(); // <-- NEU HINZU: damit "Normal" -> "—" und disabled wird

    updateUIStatus();
});

startRuleButton.addEventListener("click", () => {
    if (startRuleButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    startRuleIndex = (startRuleIndex + 1) % START_RULE_OPTIONS.length;
    startRuleButton.textContent = START_RULE_OPTIONS[startRuleIndex];
    updateUIStatus();
});

newGameButton.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    if (matchActive && !gameOver) {
        resetMatchOnly();
        boardEl.classList.add("disabled");
        setResetButtonForRound(false);
        setMatchInProgressLocked(false);
        updateBotButtonState();
        updateUIStatus("Match abgebrochen. Wähle Modus und klicke 'Spiel starten'.");
        return;
    }
    startNewRound();
});

botLevelButton.addEventListener("click", () => {
    if (botLevelButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotButtonState(); // <-- lässt die Funktion den richtigen Text setzen
    updateAdaptSpeedButtonState(); // <-- NEU HINZU
    updateUIStatus();
});

resetGameButton.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    if (resetButtonIndex === 0) {
        // Spiel starten
        boardEl.classList.remove("disabled");
        boardEl.style.pointerEvents = "auto";
        startNewRound();
        setResetButtonForRound(true);
        setMatchInProgressLocked(true);
    } else {
        // Match beenden
        resetMatchOnly();
        setResetButtonForRound(false);
        setMatchInProgressLocked(false);
        newGameButton.classList.add("button-disabled");
        updateBotButtonState();
    }
});
// --- Spiel-Logik -----------------------------------------------------------

function startNewRound() {
    if (!matchActive) matchActive = true;
    hideWinner(); // Banner ausblenden falls es noch da ist
    cancelPendingBotMove();
    roundToken += 1;
    boardEl.classList.remove("disabled");
    boardEl.style.pointerEvents = "auto"; // NEU: sicher freischalten
	clearGhost();
    gameOver = false;
    roundResultProcessed = false;
    clearBoardVisual();
    resetBoardArray();

    currentPlayer = startingPlayer;

    updateUIStatus("Runde gestartet.");
    newGameButton.textContent = "Match abbrechen";
    setMatchInProgressLocked(true);
    maybeBotMove();
}

function clearBoardVisual() {
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
    if (!matchActive && resetButtonIndex === 0) return;
    if (modeIndex === 1 && isBotTurn()) return;

    const row = findFreeRow(col);
    if (row === -1) {
        soundError.currentTime = 0;
        soundError.play().catch(()=>{});
        updateUIStatus("Spalte voll. Wähle eine andere Spalte.");
        return;
    }

    const missedWin = modeIndex === 1 ? hatSpielerGewinnzugVerpasstForBoard(col) : false;
    clearGhost();
    hoveredCol = null;
    placeChip(row, col, currentPlayer);
    const winner = checkWinner();

    if (modeIndex === 1 && currentPlayer === PLAYER_RED) {
        const zugBewertung = bewertenZugVomSpieler(col, row);
        updateSpielerProfil(col, zugBewertung);
        if (missedWin) playerProfile.hatGewinnzugVerpasst++;
        if (countDirectWinningMoves(PLAYER_RED) >= 2) playerProfile.gingInGabel++;
        if (missedWin || countDirectWinningMoves(PLAYER_RED) >= 1) playerProfile.druckVerlaesst++;
        if (detectWinPattern(row, col, PLAYER_RED)) playerProfile.offensivZuege++;
    }

    if (winner) {
        onWin(winner);
        updateUIStatus();
        return;
    }

    if (isBoardFull()) {
        onDraw();
        updateUIStatus();
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
    let activeBotIndex = lastBotIndex;

    if (level === "anfänger") { baseTime = 300; activeBotIndex = 0; }
    else if (level === "hobby") { baseTime = 600; activeBotIndex = 2; }
    else if (level === "verein") { baseTime = 900; activeBotIndex = 4; }
    else if (level === "meister") { baseTime = 1200; activeBotIndex = 6; }
    else if (level === "adaptiv") {
        baseTime = getAdaptiveThinkTime();
    }

    baseTime = baseTime + Math.random() * 400 - 200;
    baseTime = Math.max(100, baseTime);

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
        col = getAdaptiveBotMove();
    } else if (level === "anfänger") {
        col = botAnfaenger();
    } else if (level === "hobby") {
        col = getBotMoveHarmonisch(2);
    } else if (level === "verein") {
        col = getBotMoveHarmonisch(4);
    } else if (level === "meister") {
        col = getBotMoveHarmonisch(6);
    }

    if (col === -1) col = botRandom();
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
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            return r;
        }
    }
    return -1;
}

function placeChip(row, col, player) {
    board[row][col] = player;

    const cell = getCell(row, col);
    const chip = cell.querySelector(".chip");
    chip.classList.remove("ghost", "ghost-red", "ghost-yellow");

    // 1. Farbe setzen, aber noch nicht sichtbar machen
    chip.classList.add(player === PLAYER_RED? "red" : "yellow");

    // 2. Im nächsten Frame sichtbar machen = startet die Fall-Animation
    requestAnimationFrame(() => {
        chip.classList.add("visible");
    });

    // 3. Sound abspielen
    soundChip.currentTime = 0;
    soundChip.play().catch(()=>{});
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
    for (let c = 0; c < COLS; c++) {
        if (findFreeRow(c) !== -1) return false;
    }
    return true;
}

// --- Gewinnprüfung ---------------------------------------------------------

function checkWinner() {
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            const v = board[r][c];
            if (v && v === board[r][c + 1] && v === board[r][c + 2] && v === board[r][c + 3]) {
                highlightWin([[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]);
                return v;
            }
        }
    }

    // Vertikal
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r <= ROWS - 4; r++) {
            const v = board[r][c];
            if (v && v === board[r + 1][c] && v === board[r + 2][c] && v === board[r + 3][c]) {
                highlightWin([[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]);
                return v;
            }
        }
    }

    // Diagonal (â†˜)
    for (let r = 0; r <= ROWS - 4; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            const v = board[r][c];
            if (v && v === board[r + 1][c + 1] && v === board[r + 2][c + 2] && v === board[r + 3][c + 3]) {
                highlightWin([[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]);
                return v;
            }
        }
    }

    // Diagonal (â†™)
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c <= COLS - 4; c++) {
            const v = board[r][c];
            if (v && v === board[r - 1][c + 1] && v === board[r - 2][c + 2] && v === board[r - 3][c + 3]) {
                highlightWin([[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]);
                return v;
            }
        }
    }

    return null;
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
    cancelPendingBotMove();
    scores[player] += 1;
    updateScoreUI();
    roundResultProcessed = true;

    finalizeAdaptiveRound(player === PLAYER_RED ? 1 : -1);

    if (modeIndex === 1) {
        playerProfile.spieleGegenBot++;
    }

    updateUIStatus();
    showWinner(`${playerName(player)} hat gewonnen!`);
    setMatchInProgressLocked(false);
    newGameButton.classList.remove("button-disabled");
    newGameButton.textContent = "Neue Runde";

    if (startRuleIndex === 0) {
        startingPlayer = player === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    } else {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    }
}

function resetMatchOnly() {
    clearGhost();
    cancelPendingBotMove();
    roundToken += 1;
    matchActive = false;
    scores[PLAYER_RED] = 0;
    scores[PLAYER_YELLOW] = 0;
    updateScoreUI();

    modeIndex = 0;
    startRuleIndex = 0;
    modeButton.textContent = MODE_OPTIONS[modeIndex];
    startRuleButton.textContent = START_RULE_OPTIONS[startRuleIndex];

    startingPlayer = PLAYER_RED;
    currentPlayer = PLAYER_RED;

    gameOver = false;
    setMatchInProgressLocked(false);
    setResetButtonForRound(false);
    boardEl.classList.add("disabled");
    boardEl.style.pointerEvents = "none";

    initBoard();
    attachColumnHoverZones();
    positionHoverZones();

    updateUIStatus("Wähle Modus und klicke 'Spiel starten'");
    newGameButton.textContent = "Neue Runde";
}

function resetFullGame() {
    resetMatchOnly();
    resetAdaptiveState();
    updateBotButtonState();
}

function onDraw() {
    gameOver = true;
    cancelPendingBotMove();
    roundResultProcessed = true;
    updateUIStatus();
    showWinner("Unentschieden!");
    setMatchInProgressLocked(false);
    newGameButton.classList.remove("button-disabled");
    newGameButton.textContent = "Neue Runde";

    finalizeAdaptiveRound(0);

    if (modeIndex === 1) {
        playerProfile.spieleGegenBot++;
    }

    if (startRuleIndex === 0) {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    } else {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    }
}

// --- BOT LOGIK ---

function botRandom() {
    const availableCols = [];
    for (let c = 0; c < COLS; c++) {
        if (findFreeRow(c)!== -1) availableCols.push(c);
    }
    if (availableCols.length === 0) return -1;
    return availableCols[Math.floor(Math.random() * availableCols.length)];
}

function botAnfaenger() {
    // L1 = "Minimal Minimax Tiefe 1"
    // 1. Kann ich gewinnen? 20% Chance dass er es sieht
    if (Math.random() < 0.2) {
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c);
            if (r === -1) continue;
            board[r][c] = PLAYER_YELLOW;
            if (checkWinnerTemp() === PLAYER_YELLOW) { board[r][c] = 0; return c; }
            board[r][c] = 0;
        }
    }

    // 2. Muss ich blocken? 20% Chance dass er es sieht
    if (Math.random() < 0.2) {
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c);
            if (r === -1) continue;
            board[r][c] = PLAYER_RED;
            if (checkWinnerTemp() === PLAYER_RED) { board[r][c] = 0; return c; }
            board[r][c] = 0;
        }
    }

    // 3. 80% der Zeit: spielt er trotzdem dumm random
    return botRandom();
}

function botHobby() {
    // 1. Kann ich gewinnen? 70% Chance dass er es sieht
    if (Math.random() < 0.7) {
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c);
            if (r === -1) continue;
            board[r][c] = PLAYER_YELLOW;
            if (checkWinnerTemp() === PLAYER_YELLOW) { board[r][c] = 0; return c; }
            board[r][c] = 0;
        }
    }

    // 2. Muss ich Rot blocken? 70% Chance dass er es sieht
    if (Math.random() < 0.7) {
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c);
            if (r === -1) continue;
            board[r][c] = PLAYER_RED;
            if (checkWinnerTemp() === PLAYER_RED) { board[r][c] = 0; return c; }
            board[r][c] = 0;
        }
    }

    // 3. 30% der Zeit: spielt er dumm random und ignoriert Mitte
    return botRandom();
}

function checkWinnerTemp() {
    // Gleiche Logik wie checkWinner, aber ohne highlight
    for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) {
        const v = board[r][c];
        if (v && v === board[r][c + 1] && v === board[r][c + 2] && v === board[r][c + 3]) return v;
    }
    for (let c = 0; c < COLS; c++) for (let r = 0; r <= ROWS - 4; r++) {
        const v = board[r][c];
        if (v && v === board[r + 1][c] && v === board[r + 2][c] && v === board[r + 3][c]) return v;
    }
    for (let r = 0; r <= ROWS - 4; r++) for (let c = 0; c <= COLS - 4; c++) {
        const v = board[r][c];
        if (v && v === board[r + 1][c + 1] && v === board[r + 2][c + 2] && v === board[r + 3][c + 3]) return v;
    }
    for (let r = 3; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) {
        const v = board[r][c];
        if (v && v === board[r - 1][c + 1] && v === board[r - 2][c + 2] && v === board[r - 3][c + 3]) return v;
    }
    return null;
}

function botMinimax(depth) {
    // 1. KANN ICH JETZT GEWINNEN? - Muss jeder Bot können
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_YELLOW;
        if (checkWinnerTemp() === PLAYER_YELLOW) { board[r][c] = 0; return c; }
        board[r][c] = 0;
    }

    // 2. MUSS ICH BLOCKEN? - Muss jeder Bot können
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_RED;
        if (checkWinnerTemp() === PLAYER_RED) { board[r][c] = 0; return c; }
        board[r][c] = 0;
    }

    // 3. Erst jetzt Strategie mit Minimax-Tiefe
    let bestScore = -Infinity;
    let bestCol = 3; // Fallback Mitte
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_YELLOW;
        let score = minimax(depth - 1, false);
        board[r][c] = 0;
        if (score > bestScore) { bestScore = score; bestCol = c; }
    }
    return bestCol;
}

// --- ADAPTIV LOGIK ---

const ADAPTIVE_BOTS = [
  {name: "Anfänger", tiefe: 1, fehler: 0.70}, // 0-11 Stärke 1.5
  {name: "Anfänger+", tiefe: 1, fehler: 0.50}, // 12-23 Stärke 2.2
  {name: "Hobbyspieler", tiefe: 2, fehler: 0.40}, // 24-35 Stärke 3.0 <- Du startest
  {name: "Hobby+", tiefe: 2, fehler: 0.35}, // 36-47 Stärke 4.0
  {name: "Vereinsspieler",tiefe: 2, fehler: 0.20}, // 48-59 Stärke 5.0
  {name: "Verein+", tiefe: 3, fehler: 0.12}, // 60-71 Stärke 6.2
  {name: "Meister", tiefe: 4, fehler: 0.05}, // 72-84 Stärke 7.5
  {name: "Meister+", tiefe: 5, fehler: 0.02}, // 85-99 Stärke 8.8
  {name: "GODMODE", tiefe: 6, fehler: 0.00} // 100 Stärke 10.0
];

function getBotIndexForSkill(skill){
  if(skill <= 11) return 0;
  if(skill <= 23) return 1;
  if(skill <= 35) return 2;
  if(skill <= 47) return 3;
  if(skill <= 59) return 4;
  if(skill <= 71) return 5;
  if(skill <= 84) return 6;
  if(skill <= 99) return 7;
  return 8;
}

function updatePlayerSkill(delta){
  let speedFaktor = ADAPT_SPEED_FACTORS[adaptSpeedIndex]; // 0.4 / 1.0 / 2.0
  let botFaktor = 0.8 + (lastBotIndex * 0.15); // L0=0.8 bis L8=2.0

  delta = delta * speedFaktor * botFaktor;
  delta = Math.max(-8, Math.min(6, delta)); // HARTES CAP: max +/-8 pro Aufruf

  let alterSkill = playerSkill;
  playerSkill = Math.max(0, Math.min(100, playerSkill + delta));
  playerSkill = Math.round(playerSkill);

  let alterBotIndex = getBotIndexForSkill(alterSkill);
  let newBotIndex = getBotIndexForSkill(playerSkill);
  newBotIndex = Math.max(0, Math.min(8, newBotIndex));

  // Anti-Jump: Max 1 Level pro Aufruf
  if(newBotIndex > alterBotIndex + 1) newBotIndex = alterBotIndex + 1;
  if(newBotIndex < alterBotIndex - 1) newBotIndex = alterBotIndex - 1;

  if(newBotIndex!== lastBotIndex){
    lastBotIndex = newBotIndex;
    inertiaCounter = 0;
    updateBotButtonState();
    updateUIStatus();
  }

  return ADAPTIVE_BOTS[lastBotIndex];
}

// GODMODE: Perfekt = Tiefe 6 + Gewinn/Block Check
function botGod(){
    // 1. Gewinnzug
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_YELLOW;
        if (checkWinnerTemp() === PLAYER_YELLOW) { board[r][c] = 0; return c; }
        board[r][c] = 0;
    }
    // 2. Blocken
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_RED;
        if (checkWinnerTemp() === PLAYER_RED) { board[r][c] = 0; return c; }
        board[r][c] = 0;
    }
    // 3. Perfekt spielen
    return botMinimax(6);
}

function getBotMoveHarmonisch(botIndex){
    const bot = ADAPTIVE_BOTS[botIndex];

    // 1. FEHLER: Hat er heute einen schlechten Tag?
    if(Math.random() < bot.fehler){
        return botRandom();
    }

    // 2. GEWINN/BLOCK: Ab Tiefe 2 kann er das immer
    if(bot.tiefe >= 2){
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c); if (r === -1) continue;
            board[r][c] = PLAYER_YELLOW;
            if (checkWinnerTemp() === PLAYER_YELLOW) { board[r][c] = 0; return c; }
            board[r][c] = 0;
        }
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c); if (r === -1) continue;
            board[r][c] = PLAYER_RED;
            if (checkWinnerTemp() === PLAYER_RED) { board[r][c] = 0; return c; }
            board[r][c] = 0;
        }
    }

    // 3. MINIMAX + TAKTIK: HIER WIRD DEIN PROFIL GELESEN
    let kandidaten = getTopMinimaxZuege(bot.tiefe);
    if(kandidaten.length === 1) return kandidaten[0].col;

    // WICHTIG: Erst nach 3 Spielen fängt er an dich zu analysieren
    const adaptiveMode = BOT_LEVEL_KEYS[botLevelIndex] === 'adaptiv';
    if(adaptiveMode || playerProfile.spieleGegenBot >= 3){
        kandidaten = bewerteKandidatenMitTaktik(kandidaten, botIndex, bot.tiefe); // <-- HIER
        kandidaten.sort((a,b) => b.score - a.score);
    }

    let taktikZug = kandidaten[0];
    let besterZug = getTopMinimaxZuege(bot.tiefe)[0];

    // SICHERHEIT: Taktik darf keinen sicheren Gewinn verschenken
    if(taktikZug.col!== besterZug.col){
        let scoreUnterschied = besterZug.score - taktikZug.score;
        if(scoreUnterschied < (adaptiveMode ? 12 : 20)){
            return taktikZug.col;
        }
    }
    return besterZug.col;
}

function getTopMinimaxZuege(depth){
    let kandidaten = [];
    let bestScore = -Infinity;
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_YELLOW;
        let score = minimax(depth - 1, false);
        board[r][c] = 0;
        if(score > bestScore){
            bestScore = score;
            kandidaten = [{col:c, score:score}];
        } else if(score === bestScore){
            kandidaten.push({col:c, score:score});
        }
    }
    return kandidaten;
}

function bewerteKandidatenMitTaktik(kandidaten, botIndex, stufe){
    if (modeIndex !== 1 || playerProfile.gesamtZuege < 20) return kandidaten;
    let total = playerProfile.ersterZugMitte + playerProfile.ersterZugEcke + playerProfile.ersterZugRand;
    const adaptiveMode = BOT_LEVEL_KEYS[botLevelIndex] === 'adaptiv';
    const tacticalBoost = adaptiveMode ? 1.15 : 1;
    const favoriteCol = getFavoritePlayerColumn();
    const pressureWeight = Math.min(1, (playerProfile.druckVerlaesst + playerProfile.druckZuege) / Math.max(1, playerProfile.gesamtZuege));
    const openingWeight = Math.min(1, playerProfile.eroeffnungZuege / Math.max(1, playerProfile.gesamtZuege));
    const middleWeight = Math.min(1, playerProfile.mittelspielZuege / Math.max(1, playerProfile.gesamtZuege));
    const endWeight = Math.min(1, playerProfile.endspielZuege / Math.max(1, playerProfile.gesamtZuege));

    // Prio 2: 1.Zug Konter
    // L1: sehr vorsichtig, nur bei klar erkennbarem Muster
    if(botIndex <= 1 && Math.random() < 0.15 && playerProfile.spieleGegenBot >= 3 && total >= 6){
        if(playerProfile.ersterZugMitte / total > 0.7){ // liebt Mitte sehr
            kandidaten.forEach(k => { if(k.col === 0 || k.col === 6) k.score += 8 * tacticalBoost; }); // schwacher Bonus
        }
        if(playerProfile.ersterZugEcke / total > 0.7){ // liebt Ecke sehr
            kandidaten.forEach(k => { if(k.col === 3) k.score += 8 * tacticalBoost; });
        }
    }

    // L2: zuverlässig, aber noch konservativ
    if(botIndex >= 2 && playerProfile.spieleGegenBot >= 3 && total >= 4){
        if(playerProfile.ersterZugMitte / total > 0.6){ // liebt Mitte
            kandidaten.forEach(k => { if(k.col === 0 || k.col === 6) k.score += 15 * tacticalBoost; });
        }
        if(playerProfile.ersterZugEcke / total > 0.6){ // liebt Ecke
            kandidaten.forEach(k => { if(k.col === 3) k.score += 15 * tacticalBoost; });
        }
    }

    if (favoriteCol !== null) {
        kandidaten.forEach(k => {
            if (k.col === favoriteCol) k.score += 4 * tacticalBoost;
            if (Math.abs(k.col - favoriteCol) === 1) k.score += 2 * tacticalBoost;
        });
    }

    kandidaten.forEach(k => {
        if (openingWeight > 0.45 && (k.col === 3 || k.col === 2 || k.col === 4)) k.score += 3 * tacticalBoost;
        if (middleWeight > 0.35 && (k.col === 2 || k.col === 4)) k.score += 2 * tacticalBoost;
        if (endWeight > 0.35 && (k.col === 3 || k.col === 1 || k.col === 5)) k.score += 2 * tacticalBoost;
        if (pressureWeight > 0.3 && k.col === favoriteCol) k.score += 2 * tacticalBoost;
    });

    // L3: reagiert auf erkennbare Gabelmuster
    if(botIndex >= 3 && playerProfile.spieleGegenBot >= 3 && playerProfile.gingInGabel / playerProfile.spieleGegenBot > 0.35){
        kandidaten.forEach(k => {
            const r = findFreeRow(k.col);
            if(r!== -1){
                board[r][k.col] = PLAYER_YELLOW;
                let anzahlDreier = countDirectWinningMoves(PLAYER_YELLOW);
                board[r][k.col] = 0;
                if(anzahlDreier >= 2) k.score += 20 * tacticalBoost; // Gabel-Bonus
            }
        });
    }

    // L4: taktisch scharf, auch aktive Gabel-Suche / Block
    if(botIndex >= 7 && playerProfile.spieleGegenBot >= 3){
        kandidaten.forEach(k => {
            // 1. KANN ICH EINE GABEL STELLEN? +30 Punkte
            if(erzeugtZugGabel(k.col, PLAYER_YELLOW)){
                k.score += 30 * tacticalBoost;
            }
            // 2. MUSS ICH EINE GABEL VON ROT BLOCKEN? +40 Punkte
            if(erzeugtZugGabel(k.col, PLAYER_RED)){
                k.score += 40 * tacticalBoost; // Blocken ist wichtiger als stellen
            }
        });
    }

    return kandidaten;
}

function bewertenZugVomSpieler(col, row){
    let delta = 1;
    if(row === undefined || row === null || row < 0 || row >= ROWS) return -3;

    const previous = board[row][col];
    board[row][col] = PLAYER_RED;
    if(checkWinnerTemp() === PLAYER_RED) delta += 15;
    if(col === 3) delta += 2; // Mitte
    if(col === 2 || col === 4) delta += 1; // neben Mitte
    board[row][col] = previous;

    return delta;
}

// NEU: Prüft ob es irgendeinen Gewinnzug für Rot gab
function hatSpielerGewinnzugVerpasst(){
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_RED; // teste Rot
        let gewinn = checkWinnerTemp() === PLAYER_RED;
        board[r][c] = 0; // wieder zurücksetzen
        if(gewinn) return true; // es gab mindestens 1 Gewinnzug
    }
    return false;
}

function hatSpielerGewinnzugVerpasstForBoard(chosenCol) {
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = PLAYER_RED;
        const gewinn = checkWinnerTemp() === PLAYER_RED;
        board[r][c] = 0;
        if (gewinn && c !== chosenCol) return true;
    }
    return false;
}

function countDirectWinningMoves(player) {
    let count = 0;
    for (let c = 0; c < COLS; c++) {
        const r = findFreeRow(c);
        if (r === -1) continue;
        board[r][c] = player;
        const win = checkWinnerTemp() === player;
        board[r][c] = 0;
        if (win) count++;
    }
    return count;
}

// --- Winner Banner Funktionen ---
function showWinner(text) {
    winnerTextEl.textContent = text;
    winnerBannerEl.classList.remove("hidden");
    boardEl.style.pointerEvents = "none"; // Nur Klicks sperren, nicht ausgrauen
    newGameButton.classList.add("button-disabled");
}

function hideWinner() {
    winnerBannerEl.classList.add("hidden");
    boardEl.style.pointerEvents = "auto"; // Klicks wieder erlauben
    newGameButton.classList.remove("button-disabled");
}

// Button für nächste Runde
nextRoundBtnEl.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    hideWinner();
    startNewRound();
});

// --- NEU: Tempo Button für Adaptiv ---
adaptSpeedButton.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(()=>{});
    adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEED_OPTIONS.length;
    updateAdaptSpeedButtonState();
});

function minimax(depth, isMaximizing) {
    const winner = checkWinnerTemp();
    if (winner === PLAYER_YELLOW) return 100000;
    if (winner === PLAYER_RED) return -100000;
    if (depth === 0 || isBoardFull()) return evaluateBoard();

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c);
            if (r === -1) continue;
            board[r][c] = PLAYER_YELLOW;
            bestScore = Math.max(bestScore, minimax(depth - 1, false));
            board[r][c] = 0;
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let c = 0; c < COLS; c++) {
            const r = findFreeRow(c);
            if (r === -1) continue;
            board[r][c] = PLAYER_RED;
            bestScore = Math.min(bestScore, minimax(depth - 1, true));
            board[r][c] = 0;
        }
        return bestScore;
    }
}

function evaluateBoard() {
    let score = 0;

    // 1. Zentrum bevorzugen - Spalte 3 ist König
    for (let r = 0; r < ROWS; r++) {
        if (board[r][3] === PLAYER_YELLOW) score += 3;
    }

    // 2. Punkte für alle Richtungen
    score += scorePosition(PLAYER_YELLOW, 4) * 100000; // Gewinn
    score += scorePosition(PLAYER_YELLOW, 3) * 120; // 3er
    score += scorePosition(PLAYER_YELLOW, 2) * 12; // 2er
    score -= scorePosition(PLAYER_RED, 4) * 100000; // Verlust verhindern
    score -= scorePosition(PLAYER_RED, 3) * 110; // Blocken wichtiger
    score -= scorePosition(PLAYER_RED, 2) * 10;

    return score;
}

function scorePosition(player, count) {
    let score = 0;
    const emptyTarget = 4 - count;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
            score += evaluateWindow(window, player, count, emptyTarget);
        }
    }
    // Vertikal
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            let window = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
            score += evaluateWindow(window, player, count, emptyTarget);
        }
    }
    // Diagonal \
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
            score += evaluateWindow(window, player, count, emptyTarget);
        }
    }
    // Diagonal /
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]];
            score += evaluateWindow(window, player, count, emptyTarget);
        }
    }
    return score;
}
function evaluateWindow(window, player, playerTarget, emptyTarget) {
    let score = 0;
    let playerCount = window.filter(cell => cell === player).length;
    let emptyCount = window.filter(cell => cell === 0).length;
    let opponentCount = window.filter(cell => cell!== 0 && cell!== player).length;

    if (playerCount === playerTarget && emptyCount === emptyTarget) {
        if (playerTarget === 4) score += 100;
        else if (playerTarget === 3) score += 12;
        else if (playerTarget === 2) score += 3;
    }

    if (opponentCount === 3 && emptyCount === 1) score -= 80; // Gegner fast gewonnen = blocken!

    return score;
}
// Zählt wie viele "offene 3er" ein Zug erzeugen würde = Gabel
function countGabelnFuerSpieler(spieler){
    let gabeln = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const supported = r === ROWS - 1 || board[r + 1][c] !== 0;
            if(board[r][c] === 0 && supported){
                board[r][c] = spieler;
                let offeneDreier = countDirectWinningMoves(spieler);
                board[r][c] = 0;
                if(offeneDreier >= 2) gabeln++; // 2+ Wege zu gewinnen
            }
        }
    }
    return gabeln;
}

// Checkt ob ein bestimmter Zug eine Gabel erzeugt
function erzeugtZugGabel(col, spieler){
    const r = findFreeRow(col);
    if(r === -1) return false;
    board[r][col] = spieler;
    let offeneDreier = countDirectWinningMoves(spieler);
    board[r][col] = 0;
    return offeneDreier >= 2;
}

