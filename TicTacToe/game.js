const board = document.getElementById("board");
const playersOptions = ["1 Spieler", "2 Spieler"];
const roundsOptions = [1, 3, 5, 7];
const modeOptions = ["Verkuerzt", "Komplette Runden", "Turnier"];
const difficultyOptions = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const adaptOptions = ["Langsam", "Normal", "Schnell"];
let playersIdx = 0, roundsIdx = 0, modeIdx = 0, diffIdx = 0, adaptIdx = 1;
let settingsLocked = false;
function updateSettingAvailability() {
    const rowStates = { rowPlayers: true, rowRounds: true, rowMode: roundsOptions[roundsIdx] > 1, rowOpponent: true };
    Object.entries(rowStates).forEach(([rowId, isAvailable]) => {
        const row = document.getElementById(rowId);
        const button = row.querySelector('.cycle-button');
        row.classList.toggle('disabled', !isAvailable);
        row.classList.toggle('locked', settingsLocked);
        button.disabled = settingsLocked || !isAvailable;
    });
    const difficultyButton = document.getElementById('btnDifficulty');
    const adaptButton = document.getElementById('btnAdapt');
    const difficultyAvailable = playersIdx === 0;
    const adaptAvailable = difficultyAvailable && diffIdx === 4;
    document.getElementById('valDifficulty').textContent = difficultyAvailable ? difficultyOptions[diffIdx] : '2 Spieler Modus';
    document.getElementById('valAdapt').textContent = adaptAvailable ? adaptOptions[adaptIdx] : '—';
    difficultyButton.disabled = settingsLocked || !difficultyAvailable;
    adaptButton.disabled = settingsLocked || !adaptAvailable;
    difficultyButton.classList.toggle('button-disabled', difficultyButton.disabled);
    adaptButton.classList.toggle('button-disabled', adaptButton.disabled);
}
window.setSettingsLocked = function (locked) { settingsLocked = locked; updateSettingAvailability(); };
function updateSettingsUI() {
    document.getElementById('valPlayers').textContent = playersOptions[playersIdx];
    document.getElementById('valRounds').textContent = roundsOptions[roundsIdx];
    document.getElementById('valMode').textContent = modeOptions[modeIdx];
    window.currentPlayers = playersIdx === 0 ? 'bot' : 'human';
    window.currentRounds = roundsOptions[roundsIdx];
    window.currentMode = ['short', 'full', 'tournament'][modeIdx];
    window.currentDifficulty = diffIdx + 1;
    window.currentAdapt = ['slow', 'normal', 'fast'][adaptIdx];
    document.querySelector('.score-header')?.classList.toggle('match-active', roundsOptions[roundsIdx] > 1);
    document.getElementById('matchScore').hidden = roundsOptions[roundsIdx] === 1;
    updateSettingAvailability();
    if (typeof window.updateTicTacToeAdaptiveStrengthUI === 'function') window.updateTicTacToeAdaptiveStrengthUI();
}
function cycleSetting(values, index) { return (index + 1) % values.length; }
document.getElementById('btnPlayers').onclick = () => { playersIdx = cycleSetting(playersOptions, playersIdx); updateSettingsUI(); };
document.getElementById('btnRounds').onclick = () => {
    roundsIdx = cycleSetting(roundsOptions, roundsIdx);
    updateSettingsUI();
    document.getElementById('matchScore').hidden = roundsOptions[roundsIdx] === 1;
};
document.getElementById('btnMode').onclick = () => { modeIdx = cycleSetting(modeOptions, modeIdx); updateSettingsUI(); };
document.getElementById('btnDifficulty').onclick = () => { diffIdx = cycleSetting(difficultyOptions, diffIdx); updateSettingsUI(); };
document.getElementById('btnAdapt').onclick = () => { adaptIdx = cycleSetting(adaptOptions, adaptIdx); updateSettingsUI(); };
window.updateScore = function (x, draw, o) {
    const matchActive = Number(window.currentRounds || 1) > 1;
    document.getElementById('matchScore').textContent = `${x}:${o}`;
    document.getElementById('matchScore').hidden = !matchActive;
};
updateSettingsUI();

const TicTacToeAICore = window.TicTacToeAICore;
const status = document.getElementById("status");
const roundCountdown = document.getElementById("roundCountdown");
const reset = document.getElementById("reset");
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const mobileGameAction = document.getElementById("mobileGameAction");
const mobileSettingsBack = document.getElementById("mobileSettingsBack");
const resumeSavedButton = document.getElementById("resumeSavedButton");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const resumeConfirmBackdrop = document.getElementById("resumeConfirmBackdrop");
const resumeDecline = document.getElementById("resumeDecline");
const resumeAccept = document.getElementById("resumeAccept");
const resumeProgress = document.getElementById("resumeProgress");
function syncMobileGameAction() {
    if (!mobileGameAction) return;
    if (leavingToMenu) {
        mobileGameAction.textContent = "Spiel gespeichert";
        mobileGameAction.disabled = true;
        return;
    }
    mobileGameAction.hidden = false;
    mobileGameAction.textContent = "Spiel abbrechen";
    mobileGameAction.disabled = false;
}
function detectMobilePrototype() {
    return window.AndisMobileLayout?.detectMobileSession?.() ?? false;
}
let mobilePrototype = detectMobilePrototype();
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

function stabilizeTicTacToeBoard() {
    if (!document.fullscreenElement || !document.body.classList.contains("game-active")) {
        board?.style.removeProperty("--ttt-board-size");
        board?.style.removeProperty("--ttt-cell-size");
        return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
        const size = window.AndisBoardLayout?.viewportBoard?.({
            min: 240, max: 700, aspect: 1, widthOffset: 24, heightOffset: 58
        }) ?? Math.floor(Math.max(240, Math.min(window.innerHeight - 36, window.innerWidth - 24, 700)));
        const cell = Math.floor((size - 20) / 3);
        board.style.setProperty("--ttt-board-size", `${size}px`);
        board.style.setProperty("--ttt-cell-size", `${cell}px`);
        render();
    }));
}
window.AndisBoardLayout?.bindResponsiveBoardLayout(stabilizeTicTacToeBoard);
const winnerBanner = document.getElementById("winnerBanner");
const adaptiveStrengthPanel = document.getElementById("adaptiveStrengthPanel");
const adaptiveStrengthTrack = document.getElementById("adaptiveStrengthTrack");
const adaptiveStrengthFill = document.getElementById("adaptiveStrengthFill");
const adaptiveStrengthValue = document.getElementById("adaptiveStrengthValue");

screenController?.watchResponsiveMode?.((isMobile) => {
    mobilePrototype = isMobile;
});
/* --- Sound System --- */
const boardClickSound = new Audio("../assets/sounds/Click.mp3");
boardClickSound.volume = 0.4;

function playUiClick(volume = 0.35) {
    window.AndisSound?.playUiClick?.(volume);
}

function playBoardClick(volume = 0.4) {
    boardClickSound.volume = volume;
    boardClickSound.currentTime = 0;
    boardClickSound.play().catch(() => {});
}

let cells = Array(9).fill(null);
let current = "X";
let gameOver = false;

let activeMatch = {
    mode: "human",
    botLevel: 1,
    totalRounds: 1,
    roundMode: "short",
    adaptSpeed: "normal"
};
let scoreX = 0;
let scoreO = 0;
let scoreDraw = 0;
let roundsPlayed = 0;
let startingPlayer = "X";
let winRowGlobal = null;

let matchOver = false;
let waitingForNextRound = false;
let botMoveTimer = null;
let nextRoundCountdownTimer = null;
let keyboardCursor = 0;
let resumePreviouslyFocused = null;
let pendingSavedState = null;
let leavingToMenu = false;
let savedInSetup = false;
let returningToSetup = false;

function readSettings() {
    activeMatch = {
        mode: window.currentPlayers ?? "human",
        botLevel: window.currentDifficulty ?? 1,
        totalRounds: window.currentRounds ?? 1,
        roundMode: window.currentMode ?? "short",
        adaptSpeed: window.currentAdapt ?? "normal"
    };
}

function savedSettings() {
    return {
        mode: activeMatch.mode,
        botLevel: activeMatch.botLevel,
        totalRounds: activeMatch.totalRounds,
        roundMode: activeMatch.roundMode,
        adaptSpeed: activeMatch.adaptSpeed
    };
}

function hasSavableGame() {
    return Boolean(!matchOver && (!gameOver || waitingForNextRound || roundsPlayed > 0));
}

function saveCurrentGame() {
    if (savedInSetup) return;
    if (!hasSavableGame()) {
        window.TicTacToeStorage?.clear?.();
        return;
    }
    window.TicTacToeStorage?.save?.({
        schemaVersion: 1,
        gameId: "tictactoe",
        savedAt: new Date().toISOString(),
        settings: savedSettings(),
        cells: cells.slice(),
        current,
        gameOver,
        waitingForNextRound,
        matchOver,
        activeMatch: { ...activeMatch },
        scoreX,
        scoreO,
        scoreDraw,
        roundsPlayed,
        startingPlayer,
        winRowGlobal: winRowGlobal ? winRowGlobal.slice() : null,
        keyboardCursor,
        status: status.textContent,
        winnerBanner: winnerBanner.textContent
    });
}

function leaveToMenu() {
    if (leavingToMenu) return;
    leavingToMenu = true;
    cancelPendingBotMove();
    cancelNextRoundCountdown();
    if (savedInSetup) {
        window.location.href = "../index.html?menu=1";
        return;
    }
    saveCurrentGame();
    window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
        window.location.href = "../index.html?menu=1";
    });
}

function applySavedSettings(settings = {}) {
    playersIdx = settings.mode === "bot" ? 0 : 1;
    roundsIdx = Math.max(0, roundsOptions.indexOf(Number(settings.totalRounds)));
    modeIdx = Math.max(0, ["short", "full", "tournament"].indexOf(settings.roundMode));
    diffIdx = Math.max(0, Math.min(difficultyOptions.length - 1, Number(settings.botLevel || 1) - 1));
    adaptIdx = Math.max(0, ["slow", "normal", "fast"].indexOf(settings.adaptSpeed));
    updateSettingsUI();
}

function isValidSavedState(saved) {
    return Boolean(saved
        && saved.gameId === "tictactoe"
        && Array.isArray(saved.cells) && saved.cells.length === 9
        && saved.cells.every(value => value === null || value === "X" || value === "O")
        && (saved.current === "X" || saved.current === "O"));
}

function updateResumeAction() {
    const saved = window.TicTacToeStorage?.load?.();
    resumeSavedButton.hidden = !mobilePrototype
        || !isValidSavedState(saved)
        || Boolean(saved.matchOver);
}

function closeResumeConfirm() {
    resumeConfirmBackdrop.hidden = true;
    pendingSavedState = null;
    resumePreviouslyFocused?.focus?.({ preventScroll: true });
    resumePreviouslyFocused = null;
}

function requestResume(saved) {
    pendingSavedState = saved;
    resumePreviouslyFocused = document.activeElement;
    const filled = saved.cells.filter(Boolean).length;
    const roundText = `${saved.roundsPlayed || 0} Runde${saved.roundsPlayed === 1 ? "" : "n"}`;
    resumeProgress.textContent = `${saved.settings?.mode === "bot" ? "Gegen den Bot" : "2 Spieler"} · ${filled} gesetzte Felder · ${roundText}`;
    resumeConfirmBackdrop.hidden = false;
    resumeAccept.focus();
}

function restoreSavedGame(saved) {
    if (!isValidSavedState(saved)) return false;
    cancelPendingBotMove();
    cancelNextRoundCountdown();
    savedInSetup = false;
    applySavedSettings(saved.settings);
    activeMatch = { ...activeMatch, ...(saved.activeMatch || {}) };
    cells = saved.cells.slice();
    current = saved.current;
    gameOver = Boolean(saved.gameOver);
    waitingForNextRound = Boolean(saved.waitingForNextRound);
    matchOver = Boolean(saved.matchOver);
    scoreX = Number(saved.scoreX) || 0;
    scoreO = Number(saved.scoreO) || 0;
    scoreDraw = Number(saved.scoreDraw) || 0;
    roundsPlayed = Number(saved.roundsPlayed) || 0;
    startingPlayer = saved.startingPlayer === "O" ? "O" : "X";
    winRowGlobal = Array.isArray(saved.winRowGlobal) ? saved.winRowGlobal.slice() : null;
    keyboardCursor = Math.max(0, Math.min(8, Number(saved.keyboardCursor) || 0));
    applySettingsLock(!matchOver && (roundsPlayed > 0 || !gameOver));
    document.body.classList.add("game-active");
    if (mobilePrototype) showGameScreen();
    board.classList.toggle("locked", gameOver || waitingForNextRound || matchOver);
    board.tabIndex = gameOver || waitingForNextRound || matchOver ? -1 : 0;
    updateScore(scoreX, scoreDraw, scoreO);
    status.textContent = saved.status || `${current} ist dran`;
    winnerBanner.textContent = saved.winnerBanner || "";
    winnerBanner.classList.toggle("show", Boolean(saved.winnerBanner));
    reset.textContent = waitingForNextRound ? "Neue Runde" : matchOver ? "Neues Spiel" : "Spiel abbrechen";
    syncMobileGameAction();
    render();
    if (waitingForNextRound && !matchOver) startNextRoundCountdown();
    else if (canBotMove()) scheduleBotMove(getBotDelay(), true);
    saveCurrentGame();
    return true;
}

/* Render Board */
function render() {
    board.innerHTML = "";
    cells.forEach((value, i) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.innerHTML = value? `<span class="mark ${value}">${value}</span>` : "";

        const isPlayable = canPlayerMove(i);

        if (!value && isPlayable) {
            cell.dataset.ghost = current;
        }
        if (winRowGlobal && winRowGlobal.includes(i)) {
            cell.classList.add("win");
        }
        if (i === keyboardCursor) {
            cell.classList.add("keyboard-focus");
        }
        if (isPlayable) {
            cell.onclick = () => move(i);
            cell.style.cursor = "pointer";
        } else {
            cell.style.cursor = "default";
        }
        board.appendChild(cell);
    });
}

board.tabIndex = -1;
board.addEventListener("keydown", event => {
    if (gameOver || waitingForNextRound || matchOver || board.classList.contains("locked")) return;

    const row = Math.floor(keyboardCursor / 3);
    const col = keyboardCursor % 3;
    let nextRow = row;
    let nextCol = col;

    if (event.key === "ArrowUp") nextRow = Math.max(0, row - 1);
    else if (event.key === "ArrowDown") nextRow = Math.min(2, row + 1);
    else if (event.key === "ArrowLeft") nextCol = Math.max(0, col - 1);
    else if (event.key === "ArrowRight") nextCol = Math.min(2, col + 1);
    else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        move(keyboardCursor);
        return;
    } else {
        return;
    }

    event.preventDefault();
    keyboardCursor = nextRow * 3 + nextCol;
    render();
});

function cancelPendingBotMove() {
    if (botMoveTimer !== null) {
        clearTimeout(botMoveTimer);
        botMoveTimer = null;
    }
}

function cancelNextRoundCountdown() {
    if (nextRoundCountdownTimer !== null) {
        clearInterval(nextRoundCountdownTimer);
        nextRoundCountdownTimer = null;
    }
    roundCountdown.hidden = true;
    roundCountdown.textContent = "";
}

function startNextRoundCountdown() {
    cancelNextRoundCountdown();
    if (matchOver || activeMatch.totalRounds <= 1 || !waitingForNextRound) return;

    let seconds = 2;
    roundCountdown.hidden = false;
    roundCountdown.textContent = `Nächste Runde in ${seconds}...`;

    nextRoundCountdownTimer = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
            cancelNextRoundCountdown();
            if (waitingForNextRound && !matchOver) resetGame(false);
            return;
        }
        roundCountdown.textContent = `Nächste Runde in ${seconds}...`;
    }, 1000);
}

function canBotMove() {
    return activeMatch.mode === "bot" && current === "O" && !gameOver && !waitingForNextRound && !matchOver && cells.includes(null);
}

function canPlayerMove(index) {
    const isHumanTurn = activeMatch.mode !== "bot" || current === "X";
    return Number.isInteger(index) && cells[index] === null && isHumanTurn && !gameOver && !waitingForNextRound && !matchOver && !board.classList.contains("locked");
}

function applySettingsLock(locked) {
    if (typeof window.setSettingsLocked === "function") {
        window.setSettingsLocked(locked);
    }
}

window.updateTicTacToeAdaptiveStrengthUI = function (skillValue = null) {
    const selectedAdaptive = window.currentPlayers === "bot" && window.currentDifficulty === 5;
    const activeAdaptive = activeMatch.mode === "bot" && activeMatch.botLevel === 5;
    const visible = selectedAdaptive || activeAdaptive;
    adaptiveStrengthPanel.hidden = !visible;
    adaptiveStrengthPanel.classList.toggle("hidden", !visible);
    if (!visible) return;

    const fallbackSkill = typeof AdaptiveBot !== "undefined" && typeof AdaptiveBot.getSkillValue === "function"
        ? AdaptiveBot.getSkillValue()
        : 50;
    const skill = Math.max(0, Math.min(100, Math.round(Number(skillValue ?? fallbackSkill) || 0)));
    adaptiveStrengthValue.textContent = `${skill}%`;
    adaptiveStrengthTrack.style.setProperty("--skill", `${skill}%`);
    adaptiveStrengthTrack.setAttribute("aria-label", `Adaptive Stärke ${skill} von 100`);
    adaptiveStrengthFill.style.width = `${skill}%`;
};

function scheduleBotMove(delay, showPreview = true) {
    cancelPendingBotMove();
    if (!canBotMove()) return;

    const plannedMove = getBotMove();
    if (!Number.isInteger(plannedMove) || cells[plannedMove] !== null) return;

    if (showPreview && board.children[plannedMove]) {
        board.children[plannedMove].dataset.ghost = "O";
    }

    botMoveTimer = setTimeout(() => {
        botMoveTimer = null;
        if (showPreview && board.children[plannedMove]) {
            board.children[plannedMove].dataset.ghost = "";
        }
        if (!canBotMove()) return;
        botMove(plannedMove);
    }, delay);
}

function getBotMove() {
    if (activeMatch.botLevel === 5) {
        return AdaptiveBot.getBotMove();
    }
    return getTicTacToeManualMove({
        board: cells,
        level: activeMatch.botLevel,
        player: "O",
        opponent: "X",
        playerProfile: window.ticTacToePlayerProfile
    });
}

function getBotDelay() {
    if (activeMatch.botLevel === 5) {
        return AdaptiveBot.getBotDelay();
    }

    return getTicTacToeManualThinkTime(activeMatch.botLevel);
}

function playMove(index, player) {
    cells[index] = player;
    playBoardClick();
    board.children[index].classList.add("pop");

    const winRow = TicTacToeAICore.checkWin(player, cells);
    if (winRow) return endRound(player, winRow);
    if (!cells.includes(null)) return endRound("draw");

    current = player === "X" ? "O" : "X";
    if (activeMatch.botLevel !== 5) {
        status.textContent = `${current} ist dran`;
    }
    render();
    saveCurrentGame();

    if (canBotMove()) {
        scheduleBotMove(getBotDelay());
    }
}

/* Player Move */
function move(i) {
    if (!canPlayerMove(i)) return;

    const cellsBeforeMove = cells.slice();
    const player = current;
    if (activeMatch.mode === "bot" && player === "X") {
        TicTacToeAICore.trackPlayerMove(window.ticTacToePlayerProfile, i, cellsBeforeMove, player);

        const missedWin = TicTacToeAICore.findCritical("X", cellsBeforeMove);
        const missedBlock = TicTacToeAICore.findCritical("O", cellsBeforeMove);
        if (missedWin !== null && missedWin !== i) {
            TicTacToeAICore.recordPlayerEvent(window.ticTacToePlayerProfile, "missedWin");
        }
        if (missedBlock !== null && missedBlock !== i) {
            TicTacToeAICore.recordPlayerEvent(window.ticTacToePlayerProfile, "missedBlock");
        }
        if (activeMatch.botLevel !== 5 && TicTacToeAICore.wouldFork(cellsBeforeMove, "X", i)) {
            TicTacToeAICore.recordPlayerEvent(window.ticTacToePlayerProfile, "fork");
        }

        if (activeMatch.botLevel === 5 && typeof AdaptiveBot !== "undefined" && typeof AdaptiveBot.observePlayerMove === "function") {
            AdaptiveBot.observePlayerMove(i, cellsBeforeMove, player);
        }
    }
    playMove(i, player);
}

/* Bot Move - MENSCHLICH */
function botMove(moveIndex) {
    if (!canBotMove()) return;

    if (moveIndex === undefined) moveIndex = getBotMove();
    if (!Number.isInteger(moveIndex) || cells[moveIndex] !== null) return;

    playMove(moveIndex, "O");
}

/* End Round - MIT UNENTSCHIEDEN */
function endRound(winner, winRow = null) {
    gameOver = true;
    waitingForNextRound = true;
    board.tabIndex = -1;
    winRowGlobal = winRow || null;
    render();

    if (winner === "X") scoreX++;
    if (winner === "O") scoreO++;
    if (winner === "draw") scoreDraw++;
    roundsPlayed++;
    if (activeMatch.mode === "bot") {
        window.ticTacToePlayerProfile.gamesAgainstBot++;
        TicTacToeAICore.savePlayerProfile(window.ticTacToePlayerProfile);
    }
    updateScore(scoreX, scoreDraw, scoreO);
    document.getElementById("scoreX").classList.toggle("winner", winner === "X");
    document.getElementById("scoreO").classList.toggle("winner", winner === "O");

    startingPlayer = startingPlayer === "X"? "O" : "X";

    if (activeMatch.mode === "bot" && activeMatch.botLevel === 5 && typeof AdaptiveBot !== "undefined" && typeof AdaptiveBot.updateAfterMatch === "function") {
        AdaptiveBot.updateAfterMatch(winner);
    }

    let message = "";
    let matchFinished = false;

    if (activeMatch.roundMode === "short") {
        const needed = Math.floor(activeMatch.totalRounds / 2) + 1;
        if (scoreX >= needed || scoreO >= needed) {
            matchFinished = true;
            message = scoreX > scoreO? "Gesamtsieger: X" : "Gesamtsieger: O";
        } else if (roundsPlayed >= activeMatch.totalRounds) {
            matchFinished = true;
            message = scoreX > scoreO? "Gesamtsieger: X" : scoreO > scoreX? "Gesamtsieger: O" : "Match Unentschieden!";
        } else {
            message = winner === "draw"? "Unentschieden!" : `${winner} gewinnt Runde ${roundsPlayed}!`;
        }

    } else if (activeMatch.roundMode === "tournament") {
        if (roundsPlayed >= activeMatch.totalRounds) {
            if (scoreX === scoreO) {
                activeMatch.totalRounds++;
                message = "Verlängerung! Gleichstand";
            } else {
                matchFinished = true;
                message = `Gesamtsieger: ${scoreX > scoreO? "X" : "O"}`;
            }
        } else {
            message = winner === "draw"? "Unentschieden!" : `${winner} gewinnt Runde ${roundsPlayed}!`;
        }

    } else { /* full */
        if (roundsPlayed >= activeMatch.totalRounds) {
            matchFinished = true;
            if (scoreX > scoreO) message = `Gesamtsieger: X ${scoreX}:${scoreO}`;
            else if (scoreO > scoreX) message = `Gesamtsieger: O ${scoreX}:${scoreO}`;
            else message = `Gesamt: Unentschieden! ${scoreX}:${scoreO}`;
        } else {
            message = winner === "draw"? "Unentschieden!" : `${winner} gewinnt Runde ${roundsPlayed}!`;
        }
    }

    matchOver = matchFinished;
    applySettingsLock(!matchFinished);

if(matchFinished){
    let winnerText = "";
    if (scoreX > scoreO) winnerText = "Gesamtsieger: X";
    else if (scoreO > scoreX) winnerText = "Gesamtsieger: O";
    else winnerText = "Gesamt: Unentschieden!";
    status.textContent = `${winnerText} · Klicke 'Neues Spiel'`;
    winnerBanner.textContent = winnerText;
    winnerBanner.classList.add("show");
    reset.textContent = "Neues Spiel";
    syncMobileGameAction();
    } else {
        status.textContent = message;
    winnerBanner.classList.remove("show");
    winnerBanner.textContent = "";
    reset.textContent = "Neue Runde";
    syncMobileGameAction();
        startNextRoundCountdown();
    }
    saveCurrentGame();
}

/* Reset - ÃœBERARBEITET */
function resetGame(full = true) {
    savedInSetup = false;
    ["scoreX", "scoreO"].forEach(id => document.getElementById(id).classList.remove("winner"));
    cancelPendingBotMove();
    cancelNextRoundCountdown();
    if (full) {
        readSettings();
    }
    applySettingsLock(true);
    cells = Array(9).fill(null);
    keyboardCursor = 0;
    waitingForNextRound = false;
    winRowGlobal = null;

    gameOver = false;
    board.classList.remove("locked");
    board.tabIndex = 0;
    board.style.pointerEvents = "auto";
    board.style.opacity = "";

    if (full) {
		status.classList.remove("winner");
        matchOver = false;
        startingPlayer = "X";
        scoreX = 0;
        scoreO = 0;
        scoreDraw = 0;
        roundsPlayed = 0;
        updateScore(scoreX, scoreDraw, scoreO);
		winnerBanner.classList.remove("show");
        winnerBanner.textContent = "";
    }

    current = startingPlayer;
    const adaptiveSkillValue = activeMatch.mode === "bot" && activeMatch.botLevel === 5 && typeof AdaptiveBot !== "undefined" && typeof AdaptiveBot.beginRound === "function"
        ? AdaptiveBot.beginRound({
            full,
            roundNumber: full ? 1 : roundsPlayed + 1,
            totalRounds: activeMatch.totalRounds,
            current,
            enabled: true
        })
        : "";
    const roundLabel = full ? `Runde 1/${activeMatch.totalRounds}` : `Runde ${roundsPlayed + 1}/${activeMatch.totalRounds}`;
    status.textContent = `${roundLabel} - ${current} beginnt`;
    window.updateTicTacToeAdaptiveStrengthUI(adaptiveSkillValue);
    reset.textContent = "Spiel abbrechen";
    syncMobileGameAction();
    render();
    saveCurrentGame();

    if (canBotMove()) {
        scheduleBotMove(getBotDelay(), true);
    }
}

function showSetupScreen() {
    if (!mobilePrototype) return;
    fullscreenController?.exit();
    cancelPendingBotMove();
    cancelNextRoundCountdown();
    screenController?.showSetup();
    gameOver = true;
    waitingForNextRound = false;
    matchOver = false;
    applySettingsLock(false);
    status.textContent = "Einstellungen wählen und 'Neues Spiel' klicken";
    reset.textContent = "Neues Spiel";
    syncMobileGameAction();
    updateResumeAction();
    render();
}

function saveAndReturnToSetup() {
    if (returningToSetup) return;
    if (!hasSavableGame()) {
        showSetupScreen();
        return;
    }
    saveCurrentGame();
    savedInSetup = true;
    returningToSetup = true;
        window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
        returningToSetup = false;
        showSetupScreen();
    });
}

function showGameScreen() {
    if (!mobilePrototype) return;
    screenController?.showGame();
    browserBackGuard?.arm?.();
    fullscreenController?.requestIfChosen();
}

function abortMatch() {
    returningToSetup = false;
    window.AndisSavedGameNotice?.hide?.();
    savedInSetup = false;
    cancelPendingBotMove();
    cancelNextRoundCountdown();
    cells = Array(9).fill(null);
    keyboardCursor = 0;
    current = "X";
    gameOver = true;
    waitingForNextRound = false;
    matchOver = false;
    winRowGlobal = null;
    startingPlayer = "X";
    scoreX = 0;
    scoreO = 0;
    scoreDraw = 0;
    roundsPlayed = 0;

    board.classList.add("locked");
    board.tabIndex = -1;
    updateScore(scoreX, scoreDraw, scoreO);
    winnerBanner.classList.remove("show");
    winnerBanner.textContent = "";
    status.textContent = "Einstellungen ändern und 'Neues Spiel' klicken";
    reset.textContent = "Neues Spiel";
    applySettingsLock(false);
    render();
    window.TicTacToeStorage?.clear?.();
}

/* NEU: Reset Button Logik */
reset.onclick = () => {
    if (mobilePrototype && gameOver && !waitingForNextRound && !matchOver) {
        showGameScreen();
        resetGame(true);
        return;
    }
    if (matchOver) {
        resetGame(true);
    } else if(waitingForNextRound) {
        resetGame(false);
    } else if (gameOver) {
        resetGame(true);
    } else {
        abortMatch();
    }
};

mobileGameAction?.addEventListener("click", () => {
    playUiClick(0.2);
    reset.click();
});

/* initial start - Board beim Start sperren */
function init() {
    readSettings();
    cells = Array(9).fill(null);
    keyboardCursor = 0;
    gameOver = true;
    waitingForNextRound = false;
    winRowGlobal = null;
    board.classList.add('locked');
    board.tabIndex = -1;
    matchOver = false;
    status.textContent = "Einstellungen wählen und 'Neues Spiel' klicken";
    reset.textContent = "Neues Spiel";
    syncMobileGameAction();
    updateResumeAction();
    render();
}

/* â­ NEU: Sound fÃ¼r alle Cycle-Buttons */
document.querySelectorAll('.cycle-button').forEach(btn => {
    btn.addEventListener('click', () => {
        playUiClick(0.2);
    });
});

/* â­ NEU: Sound fÃ¼r Reset Button */
reset.addEventListener('click', () => {
    playUiClick(0.2);
});

window.addEventListener("beforeunload", saveCurrentGame);

resumeDecline.addEventListener("click", () => {
    playUiClick(0.2);
    closeResumeConfirm();
    window.TicTacToeStorage?.clear?.();
    updateResumeAction();
    document.getElementById("btnPlayers")?.focus({ preventScroll: true });
});
resumeAccept.addEventListener("click", () => {
    playUiClick(0.2);
    const saved = pendingSavedState;
    closeResumeConfirm();
    restoreSavedGame(saved);
});
resumeConfirmBackdrop.addEventListener("click", event => {
    if (event.target === resumeConfirmBackdrop) closeResumeConfirm();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !resumeConfirmBackdrop.hidden) {
        event.preventDefault();
        closeResumeConfirm();
    } else if (event.key === "Tab" && !resumeConfirmBackdrop.hidden) {
        const focusable = [resumeDecline, resumeAccept];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

const backBtn = document.getElementById("backIcon");
init();

const savedTicTacToe = window.TicTacToeStorage?.load?.();
if (isValidSavedState(savedTicTacToe) && !savedTicTacToe.matchOver) {
    const returnedFromGuide = new URLSearchParams(window.location.search).get("guide") === "1";
    if (returnedFromGuide) restoreSavedGame(savedTicTacToe);
    else requestResume(savedTicTacToe);
}

backBtn?.addEventListener("click", event => {
    event.preventDefault();
    window.AndisSound?.playUiClick?.(0.22);
    if (hasSavableGame()) leaveToMenu();
    else window.location.href = "../index.html?menu=1";
});

window.AndisNavigation?.bindBackButton?.({
    button: mobileSettingsBack,
    isGameActive: () => document.body.classList.contains("game-active")
        || !gameOver
        || roundsPlayed > 0,
    isMatchRunning: () => !gameOver && !waitingForNextRound && !matchOver,
    onActiveBack: saveAndReturnToSetup,
    onAbortConfirmed: () => {
        abortMatch();
        showSetupScreen();
    }
});

resumeSavedButton?.addEventListener("click", () => {
    playUiClick(0.2);
    const saved = window.TicTacToeStorage?.load?.();
    if (isValidSavedState(saved) && !saved.matchOver) restoreSavedGame(saved);
});

const browserBackGuard = window.AndisNavigation?.bindBrowserBack?.({
    isGameActive: () => document.body.classList.contains("game-active")
        || !gameOver
        || roundsPlayed > 0,
    isMatchRunning: () => !gameOver && !waitingForNextRound && !matchOver,
    onAbortConfirmed: () => {
        leaveToMenu();
    }
});
