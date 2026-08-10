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

// --- Winner Banner DOM ---
const winnerBannerEl = document.getElementById("winner-banner");
const winnerTextEl = document.getElementById("winner-text");
const nextRoundBtnEl = document.getElementById("next-round-btn");

// --- Initialisierung -------------------------------------------------------

initBoard();
attachColumnHoverZones();
positionHoverZones();
boardEl.tabIndex = -1;
updateKeyboardColumnFocus();
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
            if (chipDropActive) return;
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
    newGameButton.textContent = "Match abbrechen";
    setMatchInProgressLocked(true);
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
    if (chipDropActive) {
        window.setTimeout(() => {
            if (!chipDropActive) maybeBotMove();
        }, CHIP_DROP_DURATION);
        return;
    }
    const token = roundToken;

    const level = BOT_LEVEL_KEYS[botLevelIndex];
    let baseTime = 800;

    if (level === "adaptiv") {
        baseTime = getAdaptiveThinkTime();
    } else if (typeof getManualConnectFourThinkTime === "function") {
        baseTime = getManualConnectFourThinkTime(level);
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
    } else if (typeof getManualConnectFourMove === "function") {
        col = getManualConnectFourMove({
            board,
            level,
            player: PLAYER_YELLOW,
            opponent: PLAYER_RED
        });
    }

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

function animateChipDropLegacy(row, col, player) {
    const cell = getCell(row, col);
    if (!cell) return;

    clearDropAnimation();
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const targetChip = cell.querySelector(".chip");
    const targetChipRect = targetChip.getBoundingClientRect();
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    const defs = document.createElementNS(svgNamespace, "defs");
    const clipPath = document.createElementNS(svgNamespace, "clipPath");
    const dropCircle = document.createElementNS(svgNamespace, "circle");
    const clipId = `connect-four-drop-${Date.now()}`;
    const gradientId = `${clipId}-gradient`;
    const radius = Math.min(targetChipRect.width, targetChipRect.height) / 2;

    svg.classList.add("drop-svg");
    svg.setAttribute("width", boardRect.width.toString());
    svg.setAttribute("height", boardRect.height.toString());
    svg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.setAttribute("aria-hidden", "true");
    clipPath.setAttribute("id", clipId);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

    const gradient = document.createElementNS(svgNamespace, "radialGradient");
    gradient.setAttribute("id", gradientId);
    gradient.setAttribute("cx", "30%");
    gradient.setAttribute("cy", "22%");
    gradient.setAttribute("r", "78%");
    const gradientStops = player === PLAYER_RED
        ? [["0%", "#ff9a9a"], ["40%", "#ee3038"], ["100%", "#8d0c16"]]
        : [["0%", "#fff8bd"], ["42%", "#f5c928"], ["100%", "#a97900"]];
    gradientStops.forEach(([offset, color]) => {
        const stop = document.createElementNS(svgNamespace, "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", color);
        gradient.appendChild(stop);
    });
    defs.appendChild(gradient);

    for (let clipRow = 0; clipRow < ROWS; clipRow++) {
        const clipCell = getCell(clipRow, col);
        const clipRect = clipCell.getBoundingClientRect();
        const opening = document.createElementNS(svgNamespace, "circle");
        opening.setAttribute("cx", (clipRect.left - boardRect.left + clipRect.width / 2).toString());
        opening.setAttribute("cy", (clipRect.top - boardRect.top + clipRect.height / 2).toString());
        opening.setAttribute("r", radius.toString());
        clipPath.appendChild(opening);
    }

    dropCircle.classList.add("drop-svg-chip", player === PLAYER_RED ? "red" : "yellow");
    dropCircle.setAttribute("cx", (targetChipRect.left - boardRect.left + targetChipRect.width / 2).toString());
    dropCircle.setAttribute("cy", (-radius - 8).toString());
    dropCircle.setAttribute("r", radius.toString());
    dropCircle.setAttribute("fill", `url(#${gradientId})`);
    dropCircle.setAttribute("clip-path", `url(#${clipId})`);
    svg.appendChild(defs);
    svg.appendChild(clipPath);
    svg.appendChild(dropCircle);
    boardEl.appendChild(svg);

    chipDropActive = true;
    const finishDrop = () => {
        if (chipDropFrame !== null) {
            window.cancelAnimationFrame(chipDropFrame);
            chipDropFrame = null;
        }
        svg.remove();
        const finalChip = cell.querySelector(".chip");
        if (finalChip) {
            finalChip.classList.remove("drop-pending");
            finalChip.classList.add("visible", "landed");
        }
        chipDropActive = false;
        chipDropTimer = null;
    };

    const startTime = performance.now();
    const startY = -radius - 8;
    const targetY = targetChipRect.top - boardRect.top + targetChipRect.height / 2;
    const duration = Math.max(CHIP_DROP_DURATION, 260 + row * 95);
    prepareChipSound();
    let landingSoundScheduled = scheduleChipSound(duration);
    const animate = (now) => {
        if (!chipDropActive) return;
        const progress = Math.min(1, (now - startTime) / duration);
        let y;
        if (progress < 0.84) {
            const eased = 1 - Math.pow(1 - progress / 0.84, 3);
            y = startY + (targetY - startY) * eased;
        } else {
            const settleProgress = (progress - 0.84) / 0.16;
            y = targetY + Math.sin(settleProgress * Math.PI) * radius * 0.06 * (1 - settleProgress);
        }
        dropCircle.setAttribute("cy", y.toString());
        if (!landingSoundScheduled && progress >= 0.96) {
            landingSoundScheduled = true;
            playChipSoundFallback();
        }
        if (progress < 1) {
            chipDropFrame = window.requestAnimationFrame(animate);
        } else {
            finishDrop();
        }
    };

    chipDropFrame = window.requestAnimationFrame(animate);
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

    finalizeAdaptiveRound(player === PLAYER_RED ? 1 : -1);

    if (modeIndex === 1) {
        connectFourPlayerProfile.gamesAgainstBot++;
    }

    updateUIStatus();
    showWinner(`${playerName(player)} hat gewonnen!`);
    // Die Match-Einstellungen bleiben bis zum ausdrücklichen Abbruch gesperrt.
    setMatchInProgressLocked(true);
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

    startingPlayer = PLAYER_RED;
    currentPlayer = PLAYER_RED;

    gameOver = false;
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
    newGameButton.textContent = "Neue Runde";
}

function resetFullGame() {
    resetMatchOnly();
    resetAdaptiveState();
    updateBotButtonState();
}

function onDraw() {
    gameOver = true;
    boardEl.tabIndex = -1;
    cancelPendingBotMove();
    roundResultProcessed = true;
    document.querySelectorAll(".score").forEach(score => score.classList.remove("winner"));
    updateUIStatus();
    showWinner("Unentschieden!");
    // Auch nach einem Unentschieden bleibt die Match-Konfiguration stabil.
    setMatchInProgressLocked(true);
    newGameButton.classList.remove("button-disabled");
    newGameButton.textContent = "Neue Runde";

    finalizeAdaptiveRound(0);

    if (modeIndex === 1) {
        connectFourPlayerProfile.gamesAgainstBot++;
    }

    if (startRuleIndex === 0) {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    } else {
        startingPlayer = startingPlayer === PLAYER_RED ? PLAYER_YELLOW : PLAYER_RED;
    }
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

