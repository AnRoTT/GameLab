const board = document.getElementById("board");
const status = document.getElementById("status");
const reset = document.getElementById("reset");
const winnerBanner = document.getElementById("winnerBanner");
const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

/* --- Sound System --- */
const uiClickSound = new Audio("../assets/sounds/Button_Click.mp3");
uiClickSound.volume = 0.35;

const boardClickSound = new Audio("../assets/sounds/Click.mp3");
boardClickSound.volume = 0.4;

function playUiClick(volume = 0.35) {
    uiClickSound.volume = volume;
    uiClickSound.currentTime = 0;
    uiClickSound.play().catch(() => {});
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

/* Legacy-Habits fÃ¼r die festen Bots 1-4 */
let habits = {
    favoriteCells: [0,0,0,0,0,0,0,0,0],
    mistakes: 0
};

function readSettings() {
    activeMatch = {
        mode: window.currentPlayers ?? "human",
        botLevel: window.currentDifficulty ?? 1,
        totalRounds: window.currentRounds ?? 1,
        roundMode: window.currentMode ?? "short",
        adaptSpeed: window.currentAdapt ?? "normal"
    };
}

/* NEU: Array mischen */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
        if (isPlayable) {
            cell.onclick = () => move(i);
            cell.style.cursor = "pointer";
        } else {
            cell.style.cursor = "default";
        }
        board.appendChild(cell);
    });
}

/* Particles */
function spawnParticles(x, y) {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        p.style.left = x + "px";
        p.style.top = y + "px";
        p.style.setProperty("--px", Math.cos(angle) * dist + "px");
        p.style.setProperty("--py", Math.sin(angle) * dist + "px");
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 400);
    }
}

function cancelPendingBotMove() {
    if (botMoveTimer !== null) {
        clearTimeout(botMoveTimer);
        botMoveTimer = null;
    }
    board.classList.remove("bot-thinking");
}

function canBotMove() {
    return activeMatch.mode === "bot" && current === "O" && !gameOver && !waitingForNextRound && !matchOver && cells.includes(null);
}

function canPlayerMove(index) {
    const isHumanTurn = activeMatch.mode !== "bot" || current === "X";
    return Number.isInteger(index) && cells[index] === null && isHumanTurn && !gameOver && !waitingForNextRound && !matchOver && !board.classList.contains("locked");
}

function setSettingsLocked(locked) {
    if (typeof window.setSettingsLocked === "function") {
        window.setSettingsLocked(locked);
    }
}

function renderAdaptiveStrengthBar(skillValue) {
    const skill = Math.max(0, Math.min(100, Math.round(Number(skillValue) || 0)));
    const label = "Bot-Stärke";
    return `
        <span class="adaptive-strength-label">${label}</span>
        <span class="adaptive-strength-track" style="--skill:${skill}%" aria-label="${label} ${skill} von 100">
            <span class="adaptive-strength-fill"></span>
            <span class="adaptive-strength-knob"></span>
        </span>
    `;
}

function scheduleBotMove(delay, showPreview = true) {
    cancelPendingBotMove();
    if (!canBotMove()) return;

    const plannedMove = getBotMove();
    if (!Number.isInteger(plannedMove) || cells[plannedMove] !== null) return;

    if (showPreview && board.children[plannedMove]) {
        board.children[plannedMove].dataset.ghost = "O";
        board.classList.add("bot-thinking");
    }

    botMoveTimer = setTimeout(() => {
        botMoveTimer = null;
        if (showPreview && board.children[plannedMove]) {
            board.children[plannedMove].dataset.ghost = "";
        }
        board.classList.remove("bot-thinking");

        if (!canBotMove()) return;
        botMove(plannedMove);
    }, delay);
}

function getBotMove() {
    if (activeMatch.botLevel === 5) {
        return AdaptiveBot.getBotMove();
    }
    if (activeMatch.botLevel === 1) return botRandom();
    if (activeMatch.botLevel === 2) return botMedium();
    if (activeMatch.botLevel === 3) return botHard();
    if (activeMatch.botLevel === 4) return botPerfect(false);
    return null;
}

function getBotDelay() {
    if (activeMatch.botLevel === 5) {
        return AdaptiveBot.getBotDelay();
    }

    const delays = {
        1: 300 + Math.random() * 200,
        2: 500 + Math.random() * 300,
        3: 700 + Math.random() * 400,
        4: 1000 + Math.random() * 500
    };
    return delays[activeMatch.botLevel] ?? 500;
}

function playMove(index, player) {
    cells[index] = player;
    playBoardClick();
    board.children[index].classList.add("pop");
    const rect = board.children[index].getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);

    const winRow = checkWin(player);
    if (winRow) return endRound(player, winRow);
    if (!cells.includes(null)) return endRound("draw");

    current = player === "X" ? "O" : "X";
    if (activeMatch.botLevel !== 5) {
        status.textContent = `${current} ist dran`;
    }
    render();

    if (canBotMove()) {
        scheduleBotMove(getBotDelay());
    }
}

/* Player Move */
function move(i) {
    if (!canPlayerMove(i)) return;

    const cellsBeforeMove = cells.slice();
    const player = current;
    if (activeMatch.mode === "bot") {
        if (activeMatch.botLevel !== 5) {
            updateHabits(i, player);
            if (player === "X" && isMistake(i, player, cellsBeforeMove)) {
                habits.mistakes++;
            }
        } else if (player === "X" && typeof AdaptiveBot !== "undefined" && typeof AdaptiveBot.observePlayerMove === "function") {
            AdaptiveBot.observePlayerMove(i, cellsBeforeMove, player);
        }
    }
    playMove(i, player);
}

/* â­ HABIT HELPER */
function updateHabits(move, player) {
    if (player === "X") {
        habits.favoriteCells[move]++;
    }
}

function getTopFavoriteCells(n) {
    return habits.favoriteCells
       .map((v, i) => ({i, v}))
       .sort((a,b) => b.v - a.v)
       .slice(0, n)
       .map(x => x.i);
}

function wouldFork(board, player, move) {
    const test = board.slice();
    test[move] = player;
    let wins = 0;
    for(let i=0; i<9; i++) {
        if(test[i] === null) {
            test[i] = player;
            if(checkWin(player, test)) wins++;
            test[i] = null;
        }
    }
    return wins >= 2;
}

/* T2: Perfekte ErÃ¶ffnung */
function getPerfectOpening() {
    if (cells[4] === null) return 4; // Mitte
    const corners = [0,2,6,8].filter(i => cells[i] === null);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return null;
}

/* T4: Ist Zug ein Fehler? */
function isMistake(move, player, state) {
    // Fehler = einen direkten Gewinnzug des Gegners nicht blocken
    const opponent = player === "X" ? "O" : "X";
    const block = findCritical(opponent, state);
    if(block!== null && move!== block) return true;
    return false;
}

/* Bot Move - MENSCHLICH */
function botMove(moveIndex) {
    if (!canBotMove()) return;

    if (moveIndex === undefined) moveIndex = getBotMove();
    if (!Number.isInteger(moveIndex) || cells[moveIndex] !== null) return;

    playMove(moveIndex, "O");
}

/* === MENSCHLICHER BOT === */

/* Hilfsfunktion: Freie Felder */
function getFreeCells() {
    return cells.map((v, i) => v === null? i : null).filter(v => v!== null);
}

/* NEU: Hilfsfunktion fÃ¼r Zufall aus Top N */
function pickFromBest(moves, topN = 2) {
    const count = Math.min(topN, moves.length);
    if(count === 0) return null;
    return moves[Math.floor(Math.random() * count)];
}

/* NEU: Gibt alle gleich guten Minimax ZÃ¼ge zurÃ¼ck - GEMISCHT */
function getBestMovesFromMinimax(board, player) {
    let bestScore = -Infinity;
    let bestMoves = [];
    const free = shuffleArray(board.map((v, i) => v === null? i : null).filter(v => v!== null));

    for (let i of free) {
        const newBoard = board.slice();
        newBoard[i] = player;
        const result = minimax(newBoard, player === "O"? "X" : "O");
        const currentScore = player === "O"? result.score : -result.score;

        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestMoves = [i];
        } else if (currentScore === bestScore) {
            bestMoves.push(i);
        }
    }
    return bestMoves;
}

/* GEÃ„NDERT: Menschliche Zug-PrioritÃ¤t: Mitte > Ecken > Kanten - JETZT GEMISCHT + 20% Kante statt Ecke */
function getHumanPriorityMoves() {
    const free = getFreeCells();
    const corners = shuffleArray([0,2,6,8].filter(i => free.includes(i)));
    const edges = shuffleArray([1,3,5,7].filter(i => free.includes(i)));

    let priority = [];
    if(free.includes(4)) priority.push(4);

    // 80% Chance: klassisch Ecken vor Kanten
    // 20% Chance: "Druckfehler" - Kanten vor Ecken
    if(Math.random() < 0.8) {
        priority.push(...corners);
        priority.push(...edges);
    } else {
        priority.push(...edges);
        priority.push(...corners);
    }

    return priority;
}

/* Bot Level 1: Zufall + 10% Lieblingsfeld */
function botRandom() {
    const free = getFreeCells();
    const habitRoll = Math.random();

    // 20% Glücksmoment: spielt einmal optimal per Minimax
    if(Math.random() < 0.2) {
        const bestMoves = getBestMovesFromMinimax(cells, "O");
        if(bestMoves.length > 0) return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    // 10% nimmt Lieblingsfeld
    if(habitRoll < 0.1) {
        const fav = getTopFavoriteCells(1)[0];
        if(fav!== undefined && cells[fav] === null) return fav;
    }

    // 20% dummer Kanten-Zug
    if(Math.random() < 0.2) {
        const badMoves = free.filter(i =>![0,2,4,6,8].includes(i));
        if(badMoves.length > 0) return badMoves[Math.floor(Math.random() * badMoves.length)];
    }
	
    // 30% spielt "menschlich": bevorzugt Ecken
    if(Math.random() < 0.3) {
        const corners = [0,2,6,8].filter(i => cells[i] === null);
        if(corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
    }
    return free[Math.floor(Math.random() * free.length)];
}

/* Bot Level 2: 30% Lieblingsfeld blocken + Blocken/Gewinnen */
function botMedium() {
    const habitStrength = 0.6;

    // 20% spielt Mitte wenn frei - sehr menschlich
    if(cells[4] === null && Math.random() < 0.2) return 4;
	
    // 60% blockt Top-2 Lieblingsfelder
    if(Math.random() < habitStrength) {
        const favs = getTopFavoriteCells(2);
        const favMove = favs.find(i => cells[i] === null);
        if(favMove!== undefined) return favMove;
    }

    const win = findCritical("O");
    if(win!== null && Math.random() < 0.7) return win;

    const block = findCritical("X");
    if(block!== null && Math.random() < 0.6) return block;

    // 50% spielt optimal per Minimax
    if(Math.random() < 0.5) {
        const bestMoves = getBestMovesFromMinimax(cells, "O");
        return pickFromBest(bestMoves, 2);
    }

    return pickFromBest(getHumanPriorityMoves(), 2) || botRandom();
}

/* Bot Level 3: Mittel */
function botHard() { // L3 Mittel
    const free = getFreeCells();

    // 1. GEWINNEN IMMER
    const win = findCritical("O");
    if(win!== null) return win;

    // 2. BLOCKEN IMMER
    const block = findCritical("X");
    if(block!== null) return block;

    // 3. Erst dann der Rest

    // 70% nimmt Lieblingsfeld Top-2
    if(Math.random() < 0.7) {
        const favs = getTopFavoriteCells(2);
        const favMove = favs.find(i => cells[i] === null);
        if(favMove!== undefined) return favMove;
    }

    // T1: 60% Gabel stellen
    if(Math.random() < 0.6) {
        const fork = free.find(i => wouldFork(cells, "O", i));
        if(fork!== undefined) return fork;
    }

    // T3: 70% Gegen-Gabel
    if(Math.random() < 0.7) {
        const antiFork = free.find(i => wouldFork(cells, "X", i));
        if(antiFork!== undefined) return free[Math.floor(Math.random() * free.length)];
    }

    // T4: Ab 3 Fehlern 60% aggressiv
    if(habits.mistakes >= 3 && Math.random() < 0.6) {
        const fork = free.find(i => wouldFork(cells, "O", i));
        if(fork!== undefined) return fork;
    }

    // 70% spielt okay per Minimax
    if(Math.random() < 0.7) {
        const bestMoves = getBestMovesFromMinimax(cells, "O");
        return pickFromBest(bestMoves, 2); // nimmt 1 von Top 2
    }

    return pickFromBest(getHumanPriorityMoves(), 3) || botRandom();
}

/* Bot Level 4: Schwer */
function botPerfect(isGodmode = false) { // NEU: Parameter
    // 1. GEWINNEN IMMER
    const win = findCritical("O");
    if(win!== null) return win;

    // 2. BLOCKEN IMMER
    const block = findCritical("X");
    if(block!== null) return block;

    // 3. Erst dann der Rest
    const movesMade = cells.filter(c => c!== null).length;
    if(movesMade < 2) {
        const opening = getPerfectOpening();
        if(opening!== null) return opening;
    }

    const favs = getTopFavoriteCells(3);
    const favMove = favs.find(i => cells[i] === null);
    if(favMove!== undefined && Math.random() < 0.85) return favMove;

    const fork = getFreeCells().find(i => wouldFork(cells, "O", i));
    if(fork!== undefined && Math.random() < 0.95) return fork;

    const antiFork = getFreeCells().find(i => wouldFork(cells, "X", i));
    if(antiFork!== undefined && Math.random() < 0.95) return antiFork;

    if(habits.mistakes >= 1 && Math.random() < 0.9) {
        const fork = getFreeCells().find(i => wouldFork(cells, "O", i));
        if(fork!== undefined) return fork;
    }

    // PATZER NUR WENN KEIN GODMODE
    if (!isGodmode) {
        const patzerChance = 0.05;
        if(Math.random() < patzerChance) {
            const safeMoves = getFreeCells().filter(i => {
                const testCells = [...cells];
                testCells[i] = "O";
                return findCritical("X", testCells) === null;
            });
            const free = safeMoves.length > 0? safeMoves : getFreeCells();
            return free[Math.floor(Math.random() * free.length)];
        }
    }

    const bestMoves = getBestMovesFromMinimax(cells, "O");
    return bestMoves[0];
}

/* Bot Level 1.5: Mix L1/L2 */
function botL1_5() {
    return Math.random() < 0.5? botRandom() : botMedium();
}

/* Bot Level 2.5: Mix L2/L3 */
function botL2_5() {
    return Math.random() < 0.5? botMedium() : botHard();
}

/* Bot Level 3.5: Mix L3/L4 */
function botL3_5() {
    return Math.random() < 0.5? botHard() : botPerfect(false);
}

/* Bot Level 6: VERSTECKT - Perfekt */
function botGodmode() {
    const win = findCritical("O");
    if(win!== null) return win;
    const block = findCritical("X");
    if(block!== null) return block;

    const movesMade = cells.filter(c => c!== null).length;
    if(movesMade < 2) {
        const opening = getPerfectOpening();
        if(opening!== null) return opening;
    }

    const free = getFreeCells();
    const fork = free.find(i => wouldFork(cells, "O", i));
    if(fork!== undefined) return fork;

    const antiFork = free.find(i => wouldFork(cells, "X", i));
    if(antiFork!== undefined) return antiFork;

    const bestMoves = getBestMovesFromMinimax(cells, "O");
    return bestMoves[0];
}

/* findCritical bleibt gleich */
function findCritical(player, state = cells) {
    for (let w of WINNING_LINES) {
        const [a,b,c] = w;
        const line = [state[a], state[b], state[c]];
        if (line.filter(v => v === player).length === 2 && line.includes(null)) {
            return w[line.indexOf(null)];
        }
    }
    return null;
}

/* Minimax bleibt gleich */
function minimax(boardState, player) {
    const free = boardState.map((v, i) => v === null? i : null).filter(v => v!== null);
    if (checkWin("X", boardState)) return { score: -10 };
    if (checkWin("O", boardState)) return { score: 10 };
    if (free.length === 0) return { score: 0 };
    const moves = [];
    for (let i of free) {
        const newState = [...boardState];
        newState[i] = player;
        const result = minimax(newState, player === "O"? "X" : "O");
        moves.push({ index: i, score: result.score });
    }
    return player === "O"? moves.reduce((best, m) => m.score > best.score? m : best) : moves.reduce((best, m) => m.score < best.score? m : best);
}

/* Win Check */
function checkWin(p, state = cells) {
    for (let w of WINNING_LINES) {
        if (w.every(i => state[i] === p)) {
            return w;
        }
    }
    return null;
}

/* Shake Board */
function shakeBoard() {
    board.classList.add("shake");
    setTimeout(() => board.classList.remove("shake"), 500);
}

/* Firework Effect */
function fireworkEffect() {
    const container = document.body;
    const centerX = window.innerWidth / 2;
    const centerY = board.offsetTop + board.offsetHeight / 2;
    const colors = ["#3d7dff", "#00e5ff", "#a970ff", "#34C759", "#ffcc00", "#ff2a2a"];
    for (let i = 0; i < 60; i++) {
        const fw = document.createElement("div");
        fw.className = "firework";
        const angle = Math.random() * Math.PI * 2;
        const distance = 120 + Math.random() * 180;
        fw.style.left = centerX + "px";
        fw.style.top = centerY + "px";
        fw.style.background = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.random() * 14;
        fw.style.width = fw.style.height = size + "px";
        fw.style.setProperty("--dx", Math.cos(angle) * distance + "px");
        fw.style.setProperty("--dy", Math.sin(angle) * distance + "px");
        container.appendChild(fw);
        setTimeout(() => fw.remove(), 1000);
    }
}

/* End Round - MIT UNENTSCHIEDEN */
function endRound(winner, winRow = null) {
    gameOver = true;
    waitingForNextRound = true;
    winRowGlobal = winRow || null;
    render();

    if (winner === "X") scoreX++;
    if (winner === "O") scoreO++;
    if (winner === "draw") scoreDraw++;
    roundsPlayed++;
    updateScore(scoreX, scoreDraw, scoreO);

    if (activeMatch.mode === "bot") {
        if (winner === "O") shakeBoard();
        if (winner === "X") fireworkEffect();
    }

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
    setSettingsLocked(!matchFinished);

if(matchFinished){
    let parts = [];
    parts.push(`Match beendet`);
    status.textContent = parts.join(" ") + ". Klicke 'Neues Spiel'";
    let winnerText = "";
    if (scoreX > scoreO) winnerText = "Gesamtsieger: X";
    else if (scoreO > scoreX) winnerText = "Gesamtsieger: O";
    else winnerText = "Gesamt: Unentschieden!";
    winnerBanner.textContent = winnerText;
    winnerBanner.classList.add("show");
    reset.textContent = "Neues Spiel";
} else {
    status.textContent = message + ". Klicke 'Neue Runde'";
    winnerBanner.classList.remove("show");
    winnerBanner.textContent = "";
    reset.textContent = "Neue Runde";
}
}

/* Reset - ÃœBERARBEITET */
function resetGame(full = true) {
    cancelPendingBotMove();
    if (full) {
        readSettings();
    }
    setSettingsLocked(true);
    cells = Array(9).fill(null);
    waitingForNextRound = false;
    winRowGlobal = null;

    gameOver = false;
    board.classList.remove("locked");

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
    if (activeMatch.mode === "bot" && activeMatch.botLevel === 5 && adaptiveSkillValue !== "") {
        status.innerHTML = `${roundLabel} - ${current} beginnt. ${renderAdaptiveStrengthBar(adaptiveSkillValue)}`;
    } else {
        status.textContent = `${roundLabel} - ${current} beginnt`;
    }
    reset.textContent = "Match abbrechen";
    render();

    if (canBotMove()) {
        scheduleBotMove(300, false);
    }
}

function abortMatch() {
    cancelPendingBotMove();
    cells = Array(9).fill(null);
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
    updateScore(scoreX, scoreDraw, scoreO);
    winnerBanner.classList.remove("show");
    winnerBanner.textContent = "";
    status.textContent = "Einstellungen ändern und 'Neues Spiel' klicken";
    reset.textContent = "Neues Spiel";
    setSettingsLocked(false);
    render();
}

/* NEU: Reset Button Logik */
reset.onclick = () => {
    if (gameOver && board.classList.contains("locked")) {
        resetGame(true);
    } else if(matchOver) {
        resetGame(true);
    } else if(waitingForNextRound) {
        resetGame(false);
    } else {
        abortMatch();
    }
};

/* initial start - Board beim Start sperren */
function init() {
    readSettings();
    cells = Array(9).fill(null);
    gameOver = true;
    waitingForNextRound = false;
    winRowGlobal = null;
    board.classList.add('locked');
    matchOver = false;
    status.textContent = "Einstellungen wählen und 'Neues Spiel' klicken";
    reset.textContent = "Neues Spiel";
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

/* â­ NEU: Sound fÃ¼r Back Button */
const backBtn = document.getElementById("backIcon");
if(backBtn) {
    backBtn.addEventListener('click', () => {
        setTimeout(() => {
            window.location.href = "../index.html?menu=1";
        }, 100);
    });
}

init();




