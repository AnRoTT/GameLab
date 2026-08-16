(function () {
    "use strict";

    const boardElement = document.getElementById("board");
    const poolElement = document.getElementById("piecePool");
    const statusElement = document.getElementById("statusText");
    const matchLineElement = document.getElementById("matchLine");
    const scorePlayer1Element = document.getElementById("scorePlayer1");
    const scorePlayer2Element = document.getElementById("scorePlayer2");
    const modeButton = document.getElementById("modeButton");
    const matchButton = document.getElementById("matchButton");
    const botLevelButton = document.getElementById("botLevelButton");
    const adaptiveButton = document.getElementById("adaptiveButton");
    const adaptivePanel = document.getElementById("adaptivePanel");
    const adaptiveStrengthTrack = document.getElementById("adaptiveStrengthTrack");
    const adaptiveStrengthFill = document.getElementById("adaptiveStrengthFill");
    const adaptiveStrengthValue = document.getElementById("adaptiveStrengthValue");
    const startButton = document.getElementById("startButton");
    const endMatchButton = document.getElementById("endMatchButton");
    const QUARTO_BOT_PLAYER = 1;
    const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
    const ADAPT_SPEEDS = [
        { key: "slow", label: "Langsam" },
        { key: "normal", label: "Normal" },
        { key: "fast", label: "Schnell" }
    ];
    let botLevelIndex = 0;
    let adaptSpeedIndex = 1;

    const soundButton = new Audio("../assets/sounds/Button_Click.mp3");
    const soundSelect = new Audio("../assets/sounds/Click.mp3");
    const soundPlace = new Audio("../assets/sounds/chess_piece_place.mp3");
    [soundButton, soundSelect, soundPlace].forEach((sound) => {
        sound.volume = 0.25;
        sound.preload = "auto";
    });

    const MATCH_OPTIONS = ["Einzelrunde", "Mehrfachrunde - Abwechselnd", "Mehrfachrunde - Verlierer beginnt"];
    let onePlayer = true;
    let board = Array(16).fill(null);
    let remainingPieces = Array.from({ length: 16 }, (_, index) => index);
    let selectedPiece = null;
    let chooser = 0;
    let startingChooser = 0;
    let matchModeIndex = 0;
    let matchInProgress = false;
    let gameStarted = false;
    let gameOver = false;
    let botTimer = null;
    let keyboardMode = false;
    const scores = [0, 0];
    const playerProfile = QuartoAICore.createPlayerProfile();
    window.quartoPlayerProfile = playerProfile;

    function playerName(player) { return player === 0 ? "Spieler 1" : "Spieler 2"; }
    function isBot(player) { return onePlayer && player === 1; }
    function isAdaptiveBot() { return onePlayer && botLevelIndex === 4; }
    function adaptiveSpeed() { return ADAPT_SPEEDS[adaptSpeedIndex].key; }
    function openCells() { return board.map((piece, index) => piece === null ? index : -1).filter((index) => index >= 0); }

    function updateAdaptiveUI() {
        const active = isAdaptiveBot();
        const skill = window.QuartoAdaptiveBot.getAdaptiveSkill();
        adaptivePanel.classList.toggle("active", active);
        adaptiveButton.classList.toggle("is-active", active);
        adaptiveButton.textContent = active ? ADAPT_SPEEDS[adaptSpeedIndex].label : "—";
        adaptiveButton.disabled = !active || (gameStarted && (matchModeIndex > 0 || !gameOver));
        adaptiveButton.classList.toggle("button-disabled", adaptiveButton.disabled);
        adaptiveStrengthTrack.setAttribute("aria-valuenow", String(skill));
        adaptiveStrengthFill.style.width = `${skill}%`;
        adaptiveStrengthValue.textContent = `${skill}%`;
    }

    function pieceClasses(piece) {
        return [
            "piece-shape",
            (piece & 1) ? "light" : "dark",
            (piece & 2) ? "round" : "square",
            (piece & 4) ? "tall" : "short",
            (piece & 8) ? "solid" : "hollow"
        ].join(" ");
    }

    function pieceMarkup(piece) { return `<span class="${pieceClasses(piece)}" aria-hidden="true"></span>`; }

    function pieceDescription(piece) {
        return `Spielstein ${piece + 1}: ${(piece & 1) ? "hell" : "dunkel"}, ${(piece & 2) ? "rund" : "eckig"}, ${(piece & 4) ? "hoch" : "klein"}, ${(piece & 8) ? "gefüllt" : "mit Loch"}`;
    }

    function clearKeyboardFocus() {
        keyboardMode = false;
        document.querySelectorAll(".keyboard-focus").forEach((element) => element.classList.remove("keyboard-focus"));
    }

    function focusElement(element) {
        if (!element || element.disabled) return;
        element.classList.toggle("keyboard-focus", keyboardMode);
        element.focus({ preventScroll: true });
    }

    function focusFirstAvailable(container) {
        if (!keyboardMode) return;
        const element = [...container.children].find((child) => !child.disabled);
        focusElement(element);
    }

    function gridColumnCount(container, fallback) {
        const columns = getComputedStyle(container).gridTemplateColumns.split(" ").filter(Boolean).length;
        return columns || fallback;
    }

    function moveGridFocus(container, currentIndex, columns, rowDelta, columnDelta) {
        const total = container.children.length;
        if (!total) return;
        let row = Math.floor(currentIndex / columns);
        let column = currentIndex % columns;
        const rows = Math.ceil(total / columns);
        for (let attempt = 0; attempt < total; attempt += 1) {
            row = (row + rowDelta + rows) % rows;
            column = (column + columnDelta + columns) % columns;
            const nextIndex = row * columns + column;
            const next = container.children[nextIndex];
            if (next && !next.disabled) {
                focusElement(next);
                return;
            }
        }
    }

    function handleGridKeydown(event, container, index, columns, activate) {
        const key = event.key;
        const activationKey = key === "Enter" || key === " " || key === "Spacebar";
        const directions = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1]
        };
        if (!activationKey && !directions[key]) return;
        event.preventDefault();
        keyboardMode = true;
        if (activationKey) {
            activate();
            return;
        }
        const [rowDelta, columnDelta] = directions[key];
        moveGridFocus(container, index, columns, rowDelta, columnDelta);
    }

    function render() {
        boardElement.innerHTML = "";
        board.forEach((piece, index) => {
            const cell = document.createElement("button");
            cell.type = "button";
            const placementClass = selectedPiece !== null ? ` place-player-${(1 - chooser) + 1}` : "";
            cell.className = `board-cell${piece === null && selectedPiece !== null ? " open" : ""}${placementClass}`;
            cell.dataset.index = index;
            cell.setAttribute("role", "gridcell");
            cell.setAttribute("aria-label", piece === null ? `Freies Feld ${index + 1}` : `Feld ${index + 1}, belegt`);
            cell.disabled = piece !== null || selectedPiece === null || gameOver || isBot(1 - chooser);
            cell.innerHTML = piece === null ? "" : pieceMarkup(piece);
            cell.addEventListener("click", () => placeSelectedPiece(index));
            cell.addEventListener("keydown", (event) => handleGridKeydown(
                event,
                boardElement,
                index,
                4,
                () => placeSelectedPiece(index)
            ));
            boardElement.appendChild(cell);
        });

        poolElement.innerHTML = "";
        const visiblePieces = selectedPiece === null ? remainingPieces : [selectedPiece];
        visiblePieces.forEach((piece, visibleIndex) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `piece-button selection-player-${chooser + 1}${piece === selectedPiece ? " selected" : ""}`;
            button.innerHTML = pieceMarkup(piece);
            button.disabled = !gameStarted || gameOver || selectedPiece !== null || !remainingPieces.includes(piece) || isBot(chooser);
            button.setAttribute("aria-label", pieceDescription(piece));
            button.setAttribute("aria-pressed", String(piece === selectedPiece));
            button.title = pieceDescription(piece);
            button.addEventListener("click", () => choosePiece(piece));
            button.addEventListener("keydown", (event) => handleGridKeydown(
                event,
                poolElement,
                visibleIndex,
                gridColumnCount(poolElement, 8),
                () => choosePiece(piece)
            ));
            poolElement.appendChild(button);
        });
        botLevelButton.textContent = onePlayer ? BOT_LEVELS[botLevelIndex] : "2 Spieler Modus";
        botLevelButton.disabled = !onePlayer || (gameStarted && (matchModeIndex > 0 || !gameOver));
        botLevelButton.classList.toggle("button-disabled", botLevelButton.disabled);
        modeButton.disabled = gameStarted && (matchModeIndex > 0 || !gameOver);
        matchButton.disabled = gameStarted && (matchModeIndex > 0 || !gameOver);
        startButton.disabled = matchModeIndex > 0 && gameStarted && !gameOver;
        startButton.classList.toggle("button-disabled", startButton.disabled);
        matchLineElement.textContent = matchModeIndex === 0
            ? "Einzelrunde - Offizielle Regeln"
            : `Mehrfachrunde - ${matchModeIndex === 1 ? "Abwechselnd" : "Verlierer beginnt"} - Match ${scores[0]}:${scores[1]}`;
        endMatchButton.hidden = !(matchModeIndex > 0 && matchInProgress && gameStarted);
        updateAdaptiveUI();
    }

    function setStatus(text) { statusElement.textContent = text; }

    function playSound(sound, volume = 0.25) {
        sound.volume = volume;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }

    function renderScores() {
        scorePlayer1Element.textContent = scores[0];
        scorePlayer2Element.textContent = scores[1];
    }

    function clearWinnerScore() {
        scorePlayer1Element.parentElement.classList.remove("winner");
        scorePlayer2Element.parentElement.classList.remove("winner");
    }

    function choosePiece(piece, fromBot = false) {
        if (!gameStarted || gameOver || selectedPiece !== null || !remainingPieces.includes(piece) || (isBot(chooser) && !fromBot)) return;
        if (!fromBot && onePlayer && chooser === 0) {
            const state = QuartoAICore.createInitialState(board, remainingPieces, chooser, selectedPiece);
            QuartoAICore.trackPlayerSelection(playerProfile, piece, state, 1);
        }
        if (!fromBot) playSound(soundSelect, 0.2);
        selectedPiece = piece;
        remainingPieces = remainingPieces.filter((item) => item !== piece);
        setStatus(`${playerName(1 - chooser)} ist am Zug und platziert den Spielstein.`);
        render();
        focusFirstAvailable(boardElement);
        if (isBot(1 - chooser)) scheduleBotMove();
    }

    function placeSelectedPiece(index, fromBot = false) {
        if (!gameStarted || gameOver || selectedPiece === null || board[index] !== null || (isBot(1 - chooser) && !fromBot)) return;
        if (!fromBot && onePlayer && (1 - chooser) === 0) {
            const state = QuartoAICore.createInitialState(board, remainingPieces, chooser, selectedPiece);
            QuartoAICore.trackPlayerPlacement(playerProfile, selectedPiece, index, state);
        }
        playSound(soundPlace, 0.3);
        board[index] = selectedPiece;
        selectedPiece = null;
        const winningLine = QuartoAICore.findWinningLine(board);
        if (winningLine) {
            const attributes = QuartoAICore.getCommonAttributes(winningLine.map((lineIndex) => board[lineIndex]));
            const reason = attributes.length === 1
                ? attributes[0]
                : `${attributes.slice(0, -1).join(", ")} und ${attributes[attributes.length - 1]}`;
            return finish(`${playerName(1 - chooser)} gewinnt: vier ${reason} Steine.`, winningLine, 1 - chooser);
        }
        if (!remainingPieces.length) return finish("Unentschieden - alle Spielsteine sind platziert.");
        chooser = 1 - chooser;
        setStatus(`${playerName(chooser)} wählt einen Spielstein für ${playerName(1 - chooser)}.`);
        render();
        focusFirstAvailable(poolElement);
        if (isBot(chooser)) scheduleBotMove();
    }

    function scheduleBotMove() {
        window.clearTimeout(botTimer);
        setStatus(isAdaptiveBot() ? "Adaptiver Bot denkt ..." : "Bot denkt ...");
        render();
        botTimer = window.setTimeout(() => {
            if (gameOver || !gameStarted || !isBot(chooser) && selectedPiece === null || !isBot(1 - chooser) && selectedPiece !== null) return;
            const state = QuartoAICore.createInitialState(board, remainingPieces, chooser, selectedPiece);
            if (selectedPiece === null) {
                const piece = isAdaptiveBot()
                    ? QuartoAdaptiveBot.choosePiece(state)
                    : QuartoManualBot.choosePiece(state, QUARTO_BOT_PLAYER, botLevelIndex + 1);
                choosePiece(piece, true);
            } else {
                const cell = isAdaptiveBot()
                    ? QuartoAdaptiveBot.chooseCell(state)
                    : QuartoManualBot.chooseCell(state, QUARTO_BOT_PLAYER, botLevelIndex + 1);
                placeSelectedPiece(cell, true);
            }
        }, 450);
    }

    function finish(message, winningLine = [], winner = null) {
        gameOver = true;
        if (isAdaptiveBot()) {
            QuartoAdaptiveBot.recordRoundResult(winner === 0 ? "playerWin" : winner === 1 ? "botWin" : "draw");
        }
        setStatus(message);
        if (message.includes("Spieler 1 gewinnt")) scores[0] += 1;
        if (message.includes("Spieler 2 gewinnt")) scores[1] += 1;
        renderScores();
        clearWinnerScore();
        if (winner === 0) scorePlayer1Element.parentElement.classList.add("winner");
        if (winner === 1) scorePlayer2Element.parentElement.classList.add("winner");
        startButton.textContent = matchModeIndex === 0 ? "Neues Spiel" : "Neue Runde";
        if (matchModeIndex === 0) {
            matchInProgress = false;
        } else {
            startingChooser = winner === null
                ? 1 - startingChooser
                : matchModeIndex === 2 ? 1 - winner : 1 - startingChooser;
        }
        render();
        [...boardElement.children].forEach((cell) => {
            if (winningLine.includes(Number(cell.dataset.index))) cell.classList.add("win");
        });
        if (keyboardMode) startButton.focus();
    }

    function abortMatch() {
        window.clearTimeout(botTimer);
        QuartoAdaptiveBot.cancelRound();
        board = Array(16).fill(null);
        remainingPieces = Array.from({ length: 16 }, (_, index) => index);
        selectedPiece = null;
        chooser = 0;
        startingChooser = 0;
        matchInProgress = false;
        gameStarted = false;
        gameOver = true;
        renderScores();
        startButton.textContent = "Spiel starten";
        setStatus("Einstellungen ändern und 'Spiel starten' klicken.");
        render();
        if (keyboardMode) startButton.focus();
    }

    function startGame() {
        window.clearTimeout(botTimer);
        if (matchModeIndex === 0 || !matchInProgress) {
            scores[0] = 0;
            scores[1] = 0;
            startingChooser = 0;
            matchInProgress = matchModeIndex > 0;
            renderScores();
        }
        board = Array(16).fill(null);
        remainingPieces = Array.from({ length: 16 }, (_, index) => index);
        selectedPiece = null;
        chooser = matchModeIndex === 0 ? 0 : startingChooser;
        clearWinnerScore();
        gameStarted = true;
        gameOver = false;
        QuartoAdaptiveBot.beginRound({ enabled: isAdaptiveBot(), adaptSpeed: adaptiveSpeed() });
        startButton.textContent = matchModeIndex > 0 ? "Neue Runde" : "Spiel abbrechen";
        setStatus(`${playerName(chooser)} wählt einen Spielstein für ${playerName(1 - chooser)}.`);
        render();
        focusFirstAvailable(poolElement);
        if (isBot(chooser)) scheduleBotMove();
    }

    modeButton.addEventListener("click", () => {
        if (gameStarted && !gameOver) return;
        onePlayer = !onePlayer;
        modeButton.textContent = onePlayer ? "1 Spieler" : "2 Spieler";
        setStatus("Spiel starten");
        render();
    });
    botLevelButton.addEventListener("click", () => {
        if (botLevelButton.disabled) return;
        botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
        render();
        setStatus("Spiel starten");
    });
    adaptiveButton.addEventListener("click", () => {
        if (adaptiveButton.disabled) return;
        adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEEDS.length;
        QuartoAdaptiveBot.setAdaptSpeed(adaptiveSpeed());
        render();
        setStatus("Spiel starten");
    });
    matchButton.addEventListener("click", () => {
        if (gameStarted && !gameOver) return;
        matchModeIndex = (matchModeIndex + 1) % MATCH_OPTIONS.length;
        matchButton.textContent = MATCH_OPTIONS[matchModeIndex];
        render();
        setStatus("Spiel starten");
    });
    startButton.addEventListener("click", () => {
        if (!gameStarted) startGame();
        else if (gameOver) startGame();
        else abortMatch();
    });
    endMatchButton.addEventListener("click", abortMatch);
    [modeButton, botLevelButton, adaptiveButton, matchButton, startButton, endMatchButton, document.getElementById("helpIcon"), document.getElementById("backIcon")]
        .filter(Boolean)
        .forEach((element) => element.addEventListener("click", () => playSound(soundButton, 0.22)));
    document.addEventListener("keydown", (event) => {
        if (["Tab", "Enter", " ", "Spacebar", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            keyboardMode = true;
        }
    });
    document.addEventListener("focusin", (event) => {
        document.querySelectorAll(".keyboard-focus").forEach((element) => element.classList.remove("keyboard-focus"));
        if (keyboardMode && (event.target.closest("#piecePool, #board"))) {
            event.target.classList.add("keyboard-focus");
        }
    });
    document.addEventListener("pointerdown", clearKeyboardFocus);
    renderScores();
    render();
})();
