(function () {
    "use strict";

    const boardElement = document.getElementById("board");
    const poolElement = document.getElementById("piecePool");
    const statusElement = document.getElementById("statusText");
    const matchLineElement = document.getElementById("matchLine");
    const scorePlayer1Element = document.getElementById("scorePlayer1");
    const scorePlayer2Element = document.getElementById("scorePlayer2");
    const matchScoreElement = document.getElementById("matchScore");
    const scorePlayer1Label = document.getElementById("scorePlayer1Label");
    const scorePlayer2Label = document.getElementById("scorePlayer2Label");
    const modeButton = document.getElementById("modeButton");
    const matchButton = document.getElementById("matchButton");
    const botLevelButton = document.getElementById("botLevelButton");
    const adaptiveButton = document.getElementById("adaptiveButton");
    const adaptivePanel = document.getElementById("adaptivePanel");
    const adaptiveStrengthTrack = document.getElementById("adaptiveStrengthTrack");
    const adaptiveStrengthFill = document.getElementById("adaptiveStrengthFill");
    const adaptiveStrengthValue = document.getElementById("adaptiveStrengthValue");
    const startButton = document.getElementById("startButton");
    const setupScreen = document.getElementById("setupScreen");
    const gameScreen = document.getElementById("gameScreen");
    const mobileSettingsBack = document.getElementById("mobileSettingsBack");
    const mobileGameAction = document.getElementById("mobileGameAction");
    const resumeSavedButton = document.getElementById("resumeSavedButton");
    const resumeConfirmBackdrop = document.getElementById("resumeConfirmBackdrop");
    const resumeDecline = document.getElementById("resumeDecline");
    const resumeAccept = document.getElementById("resumeAccept");
    const resumeProgress = document.getElementById("resumeProgress");
    const fullscreenToggle = document.getElementById("fullscreenToggle");
    const detectMobile = () => window.AndisMobileLayout?.detectMobileSession?.() ?? false;
    const screenController = window.AndisMobileLayout?.createScreenController?.({
        setupScreen,
        gameScreen,
        body: document.body
    });
    let mobilePrototype = detectMobile();
    screenController?.applyMode(mobilePrototype, false);
    screenController?.watchResponsiveMode?.((isMobile) => {
        mobilePrototype = isMobile;
    });
    const fullscreenController = screenController?.bindFullscreen?.({
        button: fullscreenToggle,
        isMobile: () => mobilePrototype
    });

    // Robuste Landscape-Neuberechnung wie bei Othello: Quarto darf seine
    // Brettgroesse weder im normalen Landscape noch im Vollbild aus einem
    // festen Raster ableiten.
    function stabilizeLandscapeBoard() {
        if (!document.body.classList.contains("game-active") || !matchMedia("(orientation: landscape)").matches) {
            boardElement.style.removeProperty("--quarto-board-size");
            return;
        }

        requestAnimationFrame(() => requestAnimationFrame(() => {
            const wrapperWidth = window.AndisBoardLayout?.elementWidth?.(
                boardElement.parentElement,
                window.innerWidth
            ) ?? window.innerWidth;
            const size = window.AndisBoardLayout?.viewportBoard?.({
                min: 220,
                max: 520,
                aspect: 1,
                widthOffset: Math.max(0, window.innerWidth - Math.min(wrapperWidth, window.innerWidth * 0.62)),
                heightOffset: 58
            }) ?? Math.max(220, Math.min(window.innerHeight - 48, wrapperWidth, window.innerWidth * 0.62, 520));
            boardElement.style.setProperty("--quarto-board-size", `${Math.floor(size)}px`);
            render();
        }));
    }

    window.AndisBoardLayout?.bindResponsiveBoardLayout(stabilizeLandscapeBoard);
    mobileGameAction?.addEventListener("click", () => startButton.click());
    const QUARTO_BOT_PLAYER = 1;
    const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
    const ADAPT_SPEEDS = [
        { key: "slow", label: "Langsam" },
        { key: "normal", label: "Normal" },
        { key: "fast", label: "Schnell" }
    ];
    let botLevelIndex = 0;
    let adaptSpeedIndex = 1;

    const soundSelect = new Audio("../assets/sounds/Click.mp3");
    const soundPlace = new Audio("../assets/sounds/chess_piece_place.mp3");
    const soundError = new Audio("../assets/sounds/Error_Tock.mp3");
    [soundSelect, soundPlace, soundError].forEach((sound) => {
        sound.volume = 0.25;
        sound.preload = "auto";
    });

    const MATCH_OPTIONS = ["Einzelrunde", "Abwechselnd"];
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
    let winningLine = [];
    let botSearchCache = null;
    let keyboardMode = false;
    let resumePreviouslyFocused = null;
    let pendingSavedState = null;
    let savedInSetup = false;
    let leavingToMenu = false;
    let returningToSetup = false;
    const scores = [0, 0];
    const playerProfile = QuartoAICore.createPlayerProfile();
    window.quartoPlayerProfile = playerProfile;

    function hasSavableGame() {
        return Boolean(gameStarted && (!gameOver || matchInProgress));
    }

    function createSavedState() {
        return {
            schemaVersion: 1,
            gameId: "quarto",
            savedAt: new Date().toISOString(),
            board: board.slice(),
            remainingPieces: remainingPieces.slice(),
            selectedPiece,
            chooser,
            startingChooser,
            matchModeIndex,
            matchInProgress,
            gameStarted,
            gameOver,
            scores: scores.slice(),
            winningLine: winningLine.slice(),
            keyboardMode,
            settings: {
                onePlayer,
                botLevelIndex,
                adaptSpeedIndex
            },
            status: statusElement.textContent
        };
    }

    function isValidSavedState(saved) {
        const validPiece = value => value === null || (Number.isInteger(value) && value >= 0 && value < 16);
        const validList = values => Array.isArray(values)
            && values.every(value => Number.isInteger(value) && value >= 0 && value < 16)
            && new Set(values).size === values.length;
        return Boolean(saved
            && saved.gameId === "quarto"
            && Array.isArray(saved.board) && saved.board.length === 16 && saved.board.every(validPiece)
            && validList(saved.remainingPieces)
            && (saved.selectedPiece === null || (Number.isInteger(saved.selectedPiece) && saved.selectedPiece >= 0 && saved.selectedPiece < 16))
            && (saved.selectedPiece === null || !saved.remainingPieces.includes(saved.selectedPiece))
            && Number.isInteger(saved.chooser) && (saved.chooser === 0 || saved.chooser === 1)
            && Number.isInteger(saved.startingChooser) && (saved.startingChooser === 0 || saved.startingChooser === 1)
            && Number.isInteger(saved.matchModeIndex) && saved.matchModeIndex >= 0 && saved.matchModeIndex < MATCH_OPTIONS.length
            && saved.settings && typeof saved.settings.onePlayer === "boolean"
            && Number.isInteger(saved.settings.botLevelIndex) && saved.settings.botLevelIndex >= 0 && saved.settings.botLevelIndex < BOT_LEVELS.length
            && Number.isInteger(saved.settings.adaptSpeedIndex) && saved.settings.adaptSpeedIndex >= 0 && saved.settings.adaptSpeedIndex < ADAPT_SPEEDS.length
            && saved.gameStarted);
    }

    function writeSavedGame() {
        if (hasSavableGame()) QuartoStorage.save(createSavedState());
        else QuartoStorage.clear();
    }

    function saveCurrentGame() {
        if (savedInSetup || leavingToMenu) return;
        writeSavedGame();
    }

    function updateResumeAction() {
        const saved = QuartoStorage.load();
        resumeSavedButton.hidden = !mobilePrototype || !isValidSavedState(saved);
    }

    function playerName(player) { return player === 0 ? "Spieler 1" : (onePlayer ? "Bot" : "Spieler 2"); }
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
    window.updateQuartoAdaptiveStrengthUI = updateAdaptiveUI;

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
        boardElement.classList.toggle("board-disabled", !gameStarted || gameOver);
        boardElement.innerHTML = "";
        board.forEach((piece, index) => {
            const cell = document.createElement("button");
            cell.type = "button";
            const placementClass = selectedPiece !== null ? ` place-player-${(1 - chooser) + 1}` : "";
            cell.className = `board-cell${piece === null && selectedPiece !== null ? " open" : ""}${placementClass}`;
            cell.dataset.index = index;
            cell.setAttribute("role", "gridcell");
            cell.setAttribute("aria-label", piece === null ? `Freies Feld ${index + 1}` : `Feld ${index + 1}, belegt`);
            const unavailable = piece !== null || selectedPiece === null || gameOver || isBot(1 - chooser);
            // Nicht nutzbare Felder bleiben semantisch deaktiviert, werden
            // aber nicht als natives disabled-Button-Element dargestellt.
            // So greift der globale not-allowed-Cursor auf Desktop nicht.
            cell.setAttribute("aria-disabled", String(unavailable));
            cell.tabIndex = unavailable ? -1 : 0;
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
        const visiblePieces = selectedPiece === null
            ? remainingPieces
            : [...remainingPieces, selectedPiece].sort((a, b) => a - b);
        visiblePieces.forEach((piece, visibleIndex) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `piece-button selection-player-${chooser + 1}${piece === selectedPiece ? " selected" : ""}`;
            button.dataset.piece = String(piece);
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
        if (selectedPiece !== null) {
            poolElement.querySelector(`[data-piece="${selectedPiece}"]`)?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
        }
        botLevelButton.textContent = onePlayer ? BOT_LEVELS[botLevelIndex] : "2 Spieler Modus";
        botLevelButton.disabled = !onePlayer || (gameStarted && (matchModeIndex > 0 || !gameOver));
        botLevelButton.classList.toggle("button-disabled", botLevelButton.disabled);
        modeButton.disabled = gameStarted && (matchModeIndex > 0 || !gameOver);
        matchButton.disabled = gameStarted && (matchModeIndex > 0 || !gameOver);
        startButton.disabled = false;
        startButton.classList.toggle("button-disabled", startButton.disabled);
        matchLineElement.textContent = matchModeIndex === 0
            ? "Einzelrunde"
            : "Abwechselnd";
        scorePlayer1Label.textContent = "Spieler 1";
        scorePlayer2Label.textContent = onePlayer ? "Bot" : "Spieler 2";
        updateAdaptiveUI();
    }

    function setStatus(text) { statusElement.textContent = text; }

    function updateMobileGameAction(label, hidden = false) {
        if (!mobileGameAction) return;
        mobileGameAction.textContent = label;
        mobileGameAction.hidden = hidden;
    }

    function playSound(sound, volume = 0.25) {
        sound.volume = volume;
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }

    boardElement.addEventListener("pointerdown", (event) => {
        const cell = event.target.closest(".board-cell");
        if (!cell) return;
        const invalid = selectedPiece === null || cell.getAttribute("aria-disabled") === "true" || gameOver || !gameStarted;
        if (invalid) {
            event.preventDefault();
            cell.blur();
            playSound(soundError, 0.25);
        }
    }, true);

    function renderScores() {
        scorePlayer1Element.textContent = scores[0];
        scorePlayer2Element.textContent = scores[1];
        matchScoreElement.hidden = matchModeIndex === 0;
    }

    function clearWinnerScore() {
        scorePlayer1Label.parentElement.classList.remove("winner");
        scorePlayer2Label.parentElement.classList.remove("winner");
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
        saveCurrentGame();
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
        saveCurrentGame();
    }

    function scheduleBotMove(isOpeningMove = false) {
        window.clearTimeout(botTimer);
        setStatus(isAdaptiveBot() ? "Adaptiver Bot denkt ..." : "Bot denkt ...");
        render();
        const normalThinkTime = isAdaptiveBot()
            ? QuartoAdaptiveBot.getThinkTime()
            : QuartoManualBot.getThinkTime(botLevelIndex + 1);
        const delay = window.getBotMoveDelay(normalThinkTime, isOpeningMove);
        botTimer = window.setTimeout(() => {
            if (gameOver || !gameStarted || !isBot(chooser) && selectedPiece === null || !isBot(1 - chooser) && selectedPiece !== null) return;
            const state = QuartoAICore.createInitialState(board, remainingPieces, chooser, selectedPiece);
            if (selectedPiece === null) {
                const piece = isAdaptiveBot()
                    ? QuartoAdaptiveBot.choosePiece(state, botSearchCache)
                    : QuartoManualBot.choosePiece(state, QUARTO_BOT_PLAYER, botLevelIndex + 1, botSearchCache);
                choosePiece(piece, true);
            } else {
                const cell = isAdaptiveBot()
                    ? QuartoAdaptiveBot.chooseCell(state, botSearchCache)
                    : QuartoManualBot.chooseCell(state, QUARTO_BOT_PLAYER, botLevelIndex + 1, botSearchCache);
                placeSelectedPiece(cell, true);
            }
        }, delay);
    }

    function finish(message, line = [], winner = null) {
        gameOver = true;
        winningLine = line.slice();
        if (isAdaptiveBot()) {
            QuartoAdaptiveBot.recordRoundResult(winner === 0 ? "playerWin" : winner === 1 ? "botWin" : "draw");
        }
        setStatus(message);
        if (winner === 0) scores[0] += 1;
        if (winner === 1) scores[1] += 1;
        renderScores();
        clearWinnerScore();
        if (winner === 0) scorePlayer1Label.parentElement.classList.add("winner");
        if (winner === 1) scorePlayer2Label.parentElement.classList.add("winner");
        startButton.textContent = matchModeIndex === 0 ? "Jetzt spielen" : "Nächste Runde";
        updateMobileGameAction(matchModeIndex === 0 ? "Neues Spiel" : "Neue Runde");
        if (matchModeIndex === 0) {
            matchInProgress = false;
        } else {
            // Keep the match active so the next round preserves the score.
            matchInProgress = true;
            startingChooser = 1 - startingChooser;
        }
        render();
        [...boardElement.children].forEach((cell) => {
            if (winningLine.includes(Number(cell.dataset.index))) cell.classList.add("win");
        });
        if (keyboardMode) startButton.focus();
        saveCurrentGame();
    }

    function abortMatch() {
        window.clearTimeout(botTimer);
        botTimer = null;
        QuartoAdaptiveBot.cancelRound();
        board = Array(16).fill(null);
        remainingPieces = Array.from({ length: 16 }, (_, index) => index);
        botSearchCache = null;
        selectedPiece = null;
        winningLine = [];
        chooser = 0;
        startingChooser = 0;
        matchInProgress = false;
        gameStarted = false;
        if (mobilePrototype) {
            screenController?.showSetup?.();
            fullscreenController?.exit();
        }
        gameOver = true;
        document.body.classList.remove("game-active");
        renderScores();
        startButton.textContent = "Jetzt spielen";
        updateMobileGameAction("Spiel abbrechen", true);
        setStatus("Einstellungen ändern und 'Jetzt spielen' klicken.");
        render();
        if (keyboardMode) startButton.focus();
        QuartoStorage.clear();
        updateResumeAction();
    }

    function startGame() {
        window.clearTimeout(botTimer);
        botTimer = null;
        savedInSetup = false;
        returningToSetup = false;
        if (matchModeIndex === 0 || !matchInProgress) {
            scores[0] = 0;
            scores[1] = 0;
            startingChooser = 0;
            matchInProgress = matchModeIndex > 0;
            renderScores();
        }
        board = Array(16).fill(null);
        remainingPieces = Array.from({ length: 16 }, (_, index) => index);
        botSearchCache = QuartoAICore.createSearchCache();
        selectedPiece = null;
        winningLine = [];
        chooser = matchModeIndex === 0 ? 0 : startingChooser;
        clearWinnerScore();
        gameStarted = true;
        gameOver = false;
        document.body.classList.add("game-active");
        if (mobilePrototype) {
            screenController?.showGame?.();
            fullscreenController?.requestIfChosen();
        }
        QuartoAdaptiveBot.beginRound({ enabled: isAdaptiveBot(), adaptSpeed: adaptiveSpeed() });
        startButton.textContent = matchModeIndex > 0 ? "Match beenden" : "Spiel abbrechen";
        updateMobileGameAction("Spiel abbrechen");
        setStatus(`${playerName(chooser)} wählt einen Spielstein für ${playerName(1 - chooser)}.`);
        render();
        stabilizeLandscapeBoard();
        focusFirstAvailable(poolElement);
        if (isBot(chooser)) scheduleBotMove(true);
        saveCurrentGame();
    }

    function showSetupAfterSavedGame() {
        window.clearTimeout(botTimer);
        botTimer = null;
        QuartoAdaptiveBot.cancelRound();
        fullscreenController?.exit();
        document.body.classList.remove("game-active");
        gameStarted = false;
        gameOver = true;
        matchInProgress = false;
        startButton.textContent = "Jetzt spielen";
        updateMobileGameAction("Spiel abbrechen", true);
        if (mobilePrototype) screenController?.showSetup?.();
        updateResumeAction();
    }

    function saveAndReturnToSetup() {
        if (returningToSetup) return;
        if (!hasSavableGame()) {
            showSetupAfterSavedGame();
            return;
        }
        writeSavedGame();
        window.clearTimeout(botTimer);
        botTimer = null;
        returningToSetup = true;
        savedInSetup = true;
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
            window.clearTimeout(botTimer);
            botTimer = null;
            window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
                window.location.href = "../index.html?menu=1";
            });
            return;
        }
        QuartoStorage.clear();
        window.location.href = "../index.html?menu=1";
    }

    function restoreSavedGame(saved) {
        if (!isValidSavedState(saved)) return false;
        window.clearTimeout(botTimer);
        botTimer = null;
        QuartoAdaptiveBot.cancelRound();
        savedInSetup = false;
        returningToSetup = false;
        leavingToMenu = false;

        onePlayer = Boolean(saved.settings.onePlayer);
        botLevelIndex = saved.settings.botLevelIndex;
        adaptSpeedIndex = saved.settings.adaptSpeedIndex;
        modeButton.textContent = onePlayer ? "1 Spieler" : "2 Spieler";
        matchModeIndex = saved.matchModeIndex;
        matchButton.textContent = MATCH_OPTIONS[matchModeIndex];

        board = saved.board.slice();
        remainingPieces = saved.remainingPieces.slice();
        selectedPiece = saved.selectedPiece;
        chooser = saved.chooser;
        startingChooser = saved.startingChooser;
        matchInProgress = Boolean(saved.matchInProgress);
        gameStarted = true;
        gameOver = Boolean(saved.gameOver);
        scores[0] = Number(saved.scores?.[0]) || 0;
        scores[1] = Number(saved.scores?.[1]) || 0;
        winningLine = Array.isArray(saved.winningLine) ? saved.winningLine.slice() : [];
        keyboardMode = Boolean(saved.keyboardMode);
        botSearchCache = QuartoAICore.createSearchCache();
        document.body.classList.add("game-active");
        if (isAdaptiveBot()) QuartoAdaptiveBot.beginRound({ enabled: true, adaptSpeed: adaptiveSpeed() });
        renderScores();
        render();
        setStatus(saved.status || `${playerName(chooser)} wählt einen Spielstein für ${playerName(1 - chooser)}.`);
        if (gameOver) {
            startButton.textContent = matchModeIndex === 0 ? "Jetzt spielen" : "Nächste Runde";
            updateMobileGameAction(matchModeIndex === 0 ? "Neues Spiel" : "Neue Runde");
            winningLine.forEach(index => boardElement.children[index]?.classList.add("win"));
        } else {
            startButton.textContent = matchModeIndex > 0 ? "Match beenden" : "Spiel abbrechen";
            updateMobileGameAction("Spiel abbrechen");
        }
        if (mobilePrototype) {
            screenController?.showGame?.();
            fullscreenController?.requestIfChosen();
        }
        updateResumeAction();
        if (!gameOver && ((isBot(chooser) && selectedPiece === null) || (isBot(1 - chooser) && selectedPiece !== null))) {
            scheduleBotMove();
        }
        saveCurrentGame();
        return true;
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
        matchScoreElement.hidden = matchModeIndex === 0;
        setStatus("Spiel starten");
    });
    startButton.addEventListener("click", () => {
        if (!gameStarted) startGame();
        else if (gameOver) startGame();
        else abortMatch();
    });
    [modeButton, botLevelButton, adaptiveButton, matchButton, startButton]
        .filter(Boolean)
        .forEach((element) => element.addEventListener("click", () => window.AndisSound?.playUiClick?.(0.22)));
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

    function closeResumeConfirm() {
        resumeConfirmBackdrop.hidden = true;
        pendingSavedState = null;
        resumePreviouslyFocused?.focus?.({ preventScroll: true });
        resumePreviouslyFocused = null;
    }

    function requestResume(saved) {
        pendingSavedState = saved;
        resumePreviouslyFocused = document.activeElement;
        const filled = saved.board.filter(piece => piece !== null).length;
        const phase = saved.selectedPiece === null ? "Stein auswählen" : "Stein platzieren";
        resumeProgress.textContent = `${saved.settings.onePlayer ? "Gegen den Bot" : "2 Spieler"} · ${filled} von 16 Feldern · ${phase}`;
        resumeConfirmBackdrop.hidden = false;
        resumeAccept.focus();
    }

    resumeDecline?.addEventListener("click", () => {
        window.AndisSound?.playUiClick?.(0.22);
        closeResumeConfirm();
        QuartoStorage.clear();
        updateResumeAction();
        modeButton.focus({ preventScroll: true });
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

    resumeSavedButton?.addEventListener("click", () => {
        window.AndisSound?.playUiClick?.(0.22);
        const saved = QuartoStorage.load();
        if (isValidSavedState(saved)) restoreSavedGame(saved);
    });

    const navigationState = {
        isGameActive: () => document.body.classList.contains("game-active") || gameStarted,
        isMatchRunning: () => gameStarted && !gameOver
    };

    window.AndisNavigation?.bindBackButton?.({
        button: document.getElementById("backIcon"),
        ...navigationState,
        onActiveBack: leaveToMenu,
        onAbortConfirmed: leaveToMenu,
        onMenuBack: () => {
            window.AndisSound?.playUiClick?.(0.22);
            window.location.href = "../index.html?menu=1";
        }
    });

    window.AndisNavigation?.bindBackButton?.({
        button: mobileSettingsBack,
        ...navigationState,
        onActiveBack: saveAndReturnToSetup,
        onAbortConfirmed: abortMatch,
        onMenuBack: saveAndReturnToSetup
    });

    window.AndisNavigation?.bindBrowserBack?.({
        ...navigationState,
        onAbortConfirmed: leaveToMenu
    });

    updateResumeAction();
    const savedQuarto = QuartoStorage.load();
    const returnedFromGuide = new URLSearchParams(window.location.search).get("guide") === "1";
    if (isValidSavedState(savedQuarto)) {
        if (returnedFromGuide) restoreSavedGame(savedQuarto);
        else requestResume(savedQuarto);
    }
})();
