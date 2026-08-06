const boardEl = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const modeBtn = document.getElementById("modeBtn");
const rulesBtn = document.getElementById("rulesBtn");
const botLevelRow = document.getElementById("botLevelRow");
const botLevelBtn = document.getElementById("botLevelBtn");
const settingsPanel = document.getElementById("settingsPanel");
const scoreBlackEl = document.getElementById("scoreBlack");
const scoreWhiteEl = document.getElementById("scoreWhite");
const statusEl = document.getElementById("status");
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

let board = [];
let currentPlayer = "black";
let gameOver = false;
let vsComputer = true;
let botType = "adaptive";
let botLevelIndex = 0;
let ruleMode = "standard";
let gameStarted = false;
let lastMoveWasPressure = false;

const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];

window.othelloPlayerProfile = createOthelloPlayerProfile();

const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

function initGame() {
    if (vsComputer && botType === "adaptive" && typeof startAdaptiveRound === "function") {
        updateAdaptiveStrengthUI(startAdaptiveRound(window.othelloPlayerProfile));
    }
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    board[3][3] = "white";
    board[3][4] = "black";
    board[4][3] = "black";
    board[4][4] = "white";

    currentPlayer = "black";
    gameOver = false;
    gameStarted = true;
    boardEl.classList.remove("disabled");
    // settingsPanel.classList.add("disabled"); // NICHT sperren wegen Abbrechen
modeBtn.classList.add("disabled"); // nur Modus sperren
rulesBtn.classList.add("disabled"); // nur Regeln sperren
    renderBoard();
    updateScore();
    statusEl.textContent = "Schwarz am Zug";
    startBtn.textContent = "Abbrechen";
    lastMoveWasPressure = false;

    updateBotLevelUI();
    if(vsComputer && currentPlayer === "white") botMove(); // Sofort Bot wenn er anfängt
}

function resetGame() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    gameStarted = false;
    gameOver = false;
    boardEl.classList.add("disabled");
modeBtn.classList.remove("disabled"); // nur Modus wieder frei
rulesBtn.classList.remove("disabled"); // nur Regeln wieder frei
    renderBoard();
    updateScore();
    statusEl.textContent = "Klick 'Jetzt spielen' um zu starten";
    startBtn.textContent = "Jetzt spielen";
    lastMoveWasPressure = false;
    if (window.othelloPlayerProfile) window.othelloPlayerProfile.gamesPlayed += 1;
    updateBotLevelUI();
}

function updateAdaptiveStrengthUI(strength = getAdaptiveStrength()) {
    const visible = vsComputer && botType === "adaptive";
    adaptiveStrengthPanel.hidden = !visible;
    if (!visible) return;
    adaptiveStrengthValue.textContent = `${Math.round(strength)}%`;
    adaptiveStrengthBar.style.width = `${Math.max(1, Math.min(100, strength))}%`;
}

function updateBotLevelUI() {
    botLevelRow.classList.toggle("disabled", !vsComputer);
    botLevelBtn.disabled = !vsComputer;
    botLevelBtn.classList.toggle("button-disabled", !vsComputer);
    botLevelBtn.textContent = BOT_LEVELS[botLevelIndex];
    botType = botLevelIndex === 4 ? "adaptive" : "manual";
    updateAdaptiveStrengthUI();
}

function renderBoard() {
    boardEl.innerHTML = "";
    // Gültige Züge sind in beiden Regelmodi identisch. Der Turniermodus
    // verändert nur die Wertung der verbliebenen leeren Felder.
    const validMoves = (gameStarted && !gameOver) ? getAllValidMoves(currentPlayer) : [];

    for(let r = 0; r < 8; r++) {
        for(let c = 0; c < 8; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.c = c;

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

function animateMove(move, flips, player) {
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
    const moves = [];
    for(let r = 0; r < 8; r++) {
        for(let c = 0; c < 8; c++) {
            if(isValidMove(r, c, player)) moves.push({r, c});
        }
    }
    return moves;
}

function isValidMove(r, c, player) {
    if(board[r][c]) return false;
    const opponent = player === "black"? "white" : "black";
    for(const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        let foundOpponent = false;
        while(nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opponent) {
            foundOpponent = true;
            nr += dr;
            nc += dc;
        }
        if(foundOpponent && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === player) {
            return true;
        }
    }
    return false;
}

function makeMove(r, c, player) {
    if(!isValidMove(r, c, player)) return false;
    const opponent = player === "black"? "white" : "black";
    const flipped = [];
    board[r][c] = player;

    for(const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        const toFlip = [];
        while(nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opponent) {
            toFlip.push([nr, nc]);
            nr += dr;
            nc += dc;
        }
        if(toFlip.length && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === player) {
            toFlip.forEach(([fr, fc]) => board[fr][fc] = player);
            flipped.push(...toFlip);
        }
    }
    return { move: {r, c}, flips: flipped };
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

    // Hat der nächste Spieler keinen Zug, muss er aussetzen. Der Wechsel
    // passiert hier zentral, damit kein doppelter Spielerwechsel entsteht.
    if(getAllValidMoves(currentPlayer).length === 0) {
        const passedPlayer = currentPlayer;
        const otherPlayer = currentPlayer === "black"? "white" : "black";

        if(getAllValidMoves(otherPlayer).length === 0) {
            endGame();
            return;
        }

        statusEl.textContent = `${passedPlayer === "black"? "Schwarz" : "Weiß"} muss aussetzen`;
        currentPlayer = otherPlayer;
    }

    statusEl.textContent = `${currentPlayer === "black"? "Schwarz" : "Weiß"} am Zug`;
    renderBoard();

    // Wenn Bot dran ist und Spiel läuft: sofort ziehen
    if(vsComputer && currentPlayer === "white" &&!gameOver) {
        const moves = getAllValidMoves("white");
        if(moves.length > 0) {
            const thinkTime = botType === "adaptive" && typeof getAdaptiveBotThinkTime === "function"
                ? getAdaptiveBotThinkTime()
                : typeof getOthelloBotThinkTime === "function"
                ? getOthelloBotThinkTime(botLevelIndex + 1, "white")
                : 300;
            setTimeout(botMove, thinkTime);
        }
    }
}

function botMove() { // Bot zieht und ruft dann nextTurn
    const moves = getAllValidMoves("white");
    if(moves.length === 0) {
        nextTurn(); // Falls doch kein Zug da ist
        return;
    }
    const m = botType === "adaptive"
        ? getAdaptiveBotMove(board, "white", window.othelloPlayerProfile)
        : getOthelloBotMove(botLevelIndex + 1, "white");
    const selectedMove = m || moves[Math.floor(Math.random() * moves.length)];
    const result = makeMove(selectedMove.r, selectedMove.c, "white");
    playSound(soundMove, 0.28);
    updateScore();
    renderBoard();
    animateMove(result.move, result.flips, "white");
    lastMoveWasPressure = getPressureState("white");
    setTimeout(() => nextTurn(), 430 + result.flips.length * 65); // Nach der Animation ist Schwarz dran
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
    gameOver = true;
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
    if (window.othelloPlayerProfile && vsComputer && botType === "adaptive") {
        window.othelloPlayerProfile.lastResult = black > white ? "playerWin" : white > black ? "botWin" : "draw";
    }
    statusEl.textContent = `Spiel vorbei! ${winner} ${black}:${white}`;
}

// Events
startBtn.addEventListener("click", () => {
    playSound(soundButton, 0.22);
    if(gameStarted &&!gameOver) {
        resetGame();
        return;
    }
    initGame();
});

modeBtn.addEventListener("click", () => {
    if(gameStarted &&!gameOver) return;
    playSound(soundButton, 0.22);
    vsComputer =!vsComputer;
    modeBtn.textContent = vsComputer? "1 Spieler" : "2 Spieler";
    updateBotLevelUI();
    console.log("Modus:", vsComputer ? "1 Spieler" : "2 Spieler"); // zum Testen
});

rulesBtn.addEventListener("click", () => {
    if(gameStarted &&!gameOver) return;
    playSound(soundButton, 0.22);
    ruleMode = ruleMode === "standard"? "tournament" : "standard";
    rulesBtn.textContent = ruleMode === "standard"? "Standard" : "Turnier";
});

botLevelBtn.addEventListener("click", () => {
    if(gameStarted &&!gameOver) return;
    playSound(soundButton, 0.22);
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotLevelUI();
});

boardEl.addEventListener("click", (e) => {
    if(gameOver ||!gameStarted) return;
    if(vsComputer && currentPlayer === "white") return; // Klick blocken wenn Bot dran

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
        if (vsComputer && window.othelloPlayerProfile && currentPlayer === "black") {
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
        renderBoard();
        animateMove(result.move, result.flips, currentPlayer);
        lastMoveWasPressure = getPressureState(currentPlayer);
        setTimeout(() => nextTurn(), 430 + result.flips.length * 65); // Erst nach der Animation wechseln
    } else {
        playSound(soundError, 0.22);
    }
});

resetGame();
