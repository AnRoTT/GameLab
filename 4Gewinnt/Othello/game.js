const boardEl = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const modeBtn = document.getElementById("modeBtn");
const rulesBtn = document.getElementById("rulesBtn");
const botLevelBtn = document.getElementById("botLevelBtn");
const adaptSpeedBtn = document.getElementById("adaptSpeedBtn");
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
let gameStarted = false;
let lastMoveWasPressure = false;
let botMoveTimer = null;
let nextTurnTimer = null;
let passTimer = null;
let gameToken = 0;
let keyboardRow = 3;
let keyboardCol = 3;

window.othelloPlayerProfile = createOthelloPlayerProfile();

const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

function initGame() {
    cancelPendingTurnTimers();
    const token = gameToken;
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
    boardEl.classList.remove("disabled");
    boardEl.tabIndex = 0;
    // settingsPanel.classList.add("disabled"); // NICHT sperren wegen Abbrechen
modeBtn.classList.add("disabled"); // nur Modus sperren
rulesBtn.classList.add("disabled"); // nur Regeln sperren
    renderBoard();
    updateScore();
    statusEl.textContent = "Schwarz am Zug";
    startBtn.textContent = "Abbrechen";
    lastMoveWasPressure = false;

    updateBotLevelUI();
    if(vsComputer && currentPlayer === "white") botMove(token); // Sofort Bot wenn er anfängt
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
    nextTurnTimer = setTimeout(() => {
        nextTurnTimer = null;
        if (token !== gameToken || !gameStarted || gameOver) return;
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
    boardEl.classList.add("disabled");
    boardEl.tabIndex = -1;
modeBtn.classList.remove("disabled"); // nur Modus wieder frei
rulesBtn.classList.remove("disabled"); // nur Regeln wieder frei
    renderBoard();
    updateScore();
    statusEl.textContent = "Klick 'Jetzt spielen' um zu starten";
    startBtn.textContent = "Jetzt spielen";
    lastMoveWasPressure = false;
    updateBotLevelUI();
}

function renderBoard() {
    boardEl.innerHTML = "";
    // Gültige Züge sind in beiden Regelmodi identisch. Der Turniermodus
    // verändert nur die Wertung der verbliebenen leeren Felder.
    const humanMayMove = !vsComputer || currentPlayer === "black";
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

boardEl.tabIndex = -1;
boardEl.addEventListener("keydown", event => {
    if (gameOver || !gameStarted || boardEl.classList.contains("disabled")) return;
    if (vsComputer && currentPlayer === "white") return;

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
        if(vsComputer && currentPlayer === "white") {
            const moves = getAllValidMoves("white");
            if(moves.length > 0) {
                const thinkTime = botType === "adaptive" && typeof getAdaptiveBotThinkTime === "function"
                    ? getAdaptiveBotThinkTime()
                    : typeof getOthelloBotThinkTime === "function"
                    ? getOthelloBotThinkTime(botLevelIndex + 1, "white")
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
    const moves = getAllValidMoves("white");
    if(moves.length === 0) {
        nextTurn(); // Falls doch kein Zug da ist
        return;
    }
    const m = botType === "adaptive"
        ? getAdaptiveBotMove(board, "white", window.othelloPlayerProfile)
        : getOthelloBotMove(botLevelIndex + 1, "white");
    const selectedMove = m && moves.some(move => move.r === m.r && move.c === m.c)
        ? m
        : moves[Math.floor(Math.random() * moves.length)];
    const result = makeMove(selectedMove.r, selectedMove.c, "white");
    if (!result) {
        playSound(soundError, 0.22);
        scheduleNextTurn(0, token);
        return;
    }
    playSound(soundMove, 0.28);
    updateScore();
    renderBoard();
    animateMove(result.move, result.flips, "white");
    lastMoveWasPressure = getPressureState("white");
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
    if (window.othelloPlayerProfile && vsComputer && botType === "adaptive") {
        window.othelloPlayerProfile.lastResult = black > white ? "playerWin" : white > black ? "botWin" : "draw";
    }
    statusEl.textContent = `Spiel vorbei! ${winner} ${black}:${white}`;
}

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
        scheduleNextTurn(430 + result.flips.length * 65); // Erst nach der Animation wechseln
    } else {
        playSound(soundError, 0.22);
    }
});

resetGame();
