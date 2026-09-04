(function () {
    "use strict";
    const core = window.MuehleAICore;
    const boardEl = document.getElementById("board");
    const statusEl = document.getElementById("status");
    const phaseEl = document.getElementById("phase");
    const hintEl = document.getElementById("actionHint");
    const adaptivePanel = document.getElementById("adaptivePanel");
    const adaptiveStrengthTrack = document.getElementById("adaptiveStrengthTrack");
    const adaptiveStrengthFill = document.getElementById("adaptiveStrengthFill");
    const adaptiveStrengthValue = document.getElementById("adaptiveStrengthValue");
    const matchScoreEl = document.getElementById("matchScore");
    const startButton = document.getElementById("startButton");
    const modeSelect = document.getElementById("modeSelect");
    const botTypeSelect = document.getElementById("botTypeSelect");
    const botLevelSelect = document.getElementById("botLevelSelect");
    const speedSelect = document.getElementById("speedSelect");
    const modeButton = document.getElementById("modeButton");
    const matchButton = document.getElementById("matchButton");
    const botLevelButton = document.getElementById("botLevelButton");
    const adaptiveButton = document.getElementById("adaptiveButton");
    const matchSelect = document.getElementById("matchSelect");
    const gameScreen = document.getElementById("gameScreen");
    const setupScreen = document.getElementById("setupScreen");
    const mobileGameAction = document.getElementById("mobileGameAction");
    const mobileSettingsBack = document.getElementById("mobileSettingsBack");
    const backIcon = document.getElementById("backIcon");
    const pointPositions = [[10,10],[50,10],[90,10],[22,22],[50,22],[78,22],[34,34],[50,34],[66,34],[10,50],[22,50],[34,50],[66,50],[78,50],[90,50],[34,66],[50,66],[66,66],[22,78],[50,78],[78,78],[10,90],[50,90],[90,90]];
    let state = null, gameStarted = false, botTimer = null, gameToken = 0, keyboardPoint = 0, keyboardMode = false;
    let matchWins = { 1: 0, 2: 0 }, matchRound = 1, matchRunning = false;
    const isComputer = () => modeSelect.value === "computer";
    const botPlayer = () => 2;
    const humanPlayer = () => 1;

    function playMoveSound() { window.AndisSound?.playUiClick?.(0.18); }
    function cancelBot() { if (botTimer !== null) { clearTimeout(botTimer); botTimer = null; } gameToken += 1; }
    function phaseLabel() { return ({ placing: "Aufbauphase", "select-source": "Stein auswählen", "select-target": "Zielpunkt auswählen", flying: "Flugphase", "remove-opponent": "Stein entfernen", "round-ended": "Runde beendet", draw: "Remis" })[state?.phase] || "Aufbauphase"; }
    function playerName(player) { return player === 1 ? "Spieler 1" : (isComputer() ? "Bot" : "Spieler 2"); }
    function updateSettings() { const computer = isComputer(); const adaptive = botTypeSelect.value === "adaptive"; const locked = gameStarted; modeButton.textContent = computer ? "1 Spieler" : "2 Spieler"; matchButton.textContent = matchSelect.value === "match" ? "Abwechselnd" : "Einzelrunde"; botLevelButton.textContent = !computer ? "2 Spieler Modus" : (adaptive ? "Adaptiv" : ({ 1: "Anfänger", 2: "Hobbyspieler", 3: "Vereinsspieler", 4: "Meister" }[botLevelSelect.value] || "Anfänger")); modeButton.disabled = locked; matchButton.disabled = locked; botLevelButton.disabled = locked || !computer; adaptiveButton.disabled = locked || !computer || !adaptive; [modeButton, matchButton, botLevelButton, adaptiveButton].forEach(button => button.classList.toggle("button-disabled", button.disabled)); adaptiveButton.textContent = adaptive ? ({ slow: "Langsam", normal: "Normal", fast: "Schnell" }[speedSelect.value] || "Normal") : "—"; updateAdaptiveBadge(); updateMatchScore(); }
    function updateLabels() { document.getElementById("playerOneName").textContent = playerName(1); document.getElementById("playerTwoName").textContent = playerName(2); }
    function updateMobileGameAction() {
        if (!mobileGameAction) return;
        if (gameStarted) {
            mobileGameAction.textContent = "Spiel abbrechen";
            return;
        }
        const nextRoundPending = matchSelect.value === "match"
            && (state?.winner || state?.draw)
            && matchWins[1] < 2
            && matchWins[2] < 2;
        mobileGameAction.textContent = nextRoundPending ? "Neue Runde" : "Neues Spiel";
    }
    function updateMatchScore() {
        const active = matchSelect.value === "match";
        matchScoreEl.textContent = `${matchWins[1]}:${matchWins[2]}`;
        matchScoreEl.hidden = !active;
    }
    function statusText() { if (!state) return "Spiel starten"; if (state.winner) return `${playerName(state.winner)} gewinnt!`; if (state.draw) return `Remis – ${state.drawReason === "repetition" ? "Stellungswiederholung" : state.drawReason === "no-progress" ? "50 Vollzüge ohne Mühle" : "keine Entscheidung"}`; return `${playerName(state.currentPlayer)} ist am Zug`; }
    function hintText() { if (!state) return "Setze einen Stein."; if (state.winner) return `Gewinner ${playerName(state.winner)}`; if (state.draw) return "Remis"; if (state.phase === "placing") return "Wähle einen freien Punkt."; if (state.phase === "select-source" || state.phase === "flying") return "Wähle einen eigenen Stein."; if (state.phase === "select-target") return "Wähle ein markiertes Ziel."; if (state.phase === "remove-opponent") return "Entferne einen gegnerischen Stein."; return ""; }
    function updateAdaptiveBadge() { const active = isComputer() && botTypeSelect.value === "adaptive"; const skill = Number(window.MuehleAdaptiveBot?.getAdaptiveSkill?.() ?? 35); adaptivePanel.classList.toggle("active", active); adaptiveStrengthTrack.setAttribute("aria-valuenow", String(skill)); adaptiveStrengthFill.style.width = `${skill}%`; adaptiveStrengthValue.textContent = `${skill}%`; }
    function updateMuehleGeometry() {
        const boardWrapper = document.getElementById("boardWrapper");
        const landscapeMobile = document.body.classList.contains("mobile-prototype")
            && window.matchMedia("(orientation: landscape) and (max-height: 700px)").matches;
        if (landscapeMobile && boardWrapper) {
            const panelWidth = document.querySelector(".game-side-panel")?.getBoundingClientRect().width || 280;
            const boardSize = window.AndisBoardLayout?.viewportBoard?.({
                min: 240,
                max: 600,
                aspect: 1,
                widthOffset: panelWidth + 40,
                heightOffset: 58
            });
            if (boardSize) boardWrapper.style.width = `${Math.floor(boardSize)}px`;
        } else if (boardWrapper) {
            boardWrapper.style.removeProperty("width");
        }
        const boardWidth = window.AndisBoardLayout?.elementWidth?.(boardEl, 0) || boardEl.getBoundingClientRect().width || 0;
        // Wie bei Othello und 4 Gewinnt wird aus einer tatsächlichen
        // Feldgröße skaliert: Der kleinste Punktabstand des Mühlebretts
        // beträgt 12 % der Brettbreite.
        const pointCell = Math.max(24, Math.round(boardWidth * 0.12));
        boardEl.style.setProperty("--muehle-cell-size", `${pointCell}px`);
        boardEl.style.setProperty("--muehle-half-cell", `${pointCell / 2}px`);
        boardEl.style.setProperty("--muehle-marker-size", `${Math.round(pointCell * 0.34)}px`);
        boardEl.style.setProperty("--muehle-stone-visual-size", `${Math.round(pointCell * 0.76)}px`);
        render();
    }
    function stabilizeMuehleGeometry() {
        requestAnimationFrame(() => requestAnimationFrame(updateMuehleGeometry));
    }
    function keyboardNeighbor(point, key) {
        const [x, y] = pointPositions[point];
        const horizontal = key === "ArrowLeft" || key === "ArrowRight";
        const direction = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
        const candidates = pointPositions.map((position, index) => ({ position, index }))
            .filter(({ position, index }) => index !== point && (horizontal ? position[1] === y : position[0] === x) && (horizontal ? (position[0] - x) * direction > 0 : (position[1] - y) * direction > 0))
            .sort((a, b) => (horizontal ? Math.abs(a.position[0] - x) - Math.abs(b.position[0] - x) : Math.abs(a.position[1] - y) - Math.abs(b.position[1] - y)));
        return candidates[0]?.index ?? point;
    }
    function focusKeyboardPoint() { boardEl.querySelector(`[data-point="${keyboardPoint}"]`)?.focus({ preventScroll: true }); }
    function handleKeyboardPointKeydown(event, point) {
        if (!gameStarted || !state || !humanTurn()) return;
        const activation = event.key === "Enter" || event.key === " " || event.key === "Spacebar";
        const direction = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
        if (!activation && !direction) return;
        event.preventDefault();
        event.stopPropagation();
        keyboardMode = true;
        keyboardPoint = activation ? point : keyboardNeighbor(point, event.key);
        if (activation) handlePoint(point);
        else render();
    }
    function render() {
        const keyboardEnabled = gameStarted && state && humanTurn();
        const boardLocked = !gameStarted || !state || state.winner || state.draw;
        boardEl.classList.toggle("board-disabled", boardLocked);
        boardEl.tabIndex = keyboardEnabled ? 0 : -1;
        if (!keyboardEnabled) {
            keyboardMode = false;
            boardEl.classList.remove("keyboard-active");
            if (boardEl.contains(document.activeElement)) document.activeElement.blur();
        }
        boardEl.innerHTML = "";
        core.MILLS.forEach(line => { for (let segment = 0; segment < 2; segment += 1) { const a = pointPositions[line[segment]]; const b = pointPositions[line[segment + 1]]; const length = Math.hypot(b[0] - a[0], b[1] - a[1]); const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; const el = document.createElement("span"); el.className = "mill-line"; el.style.left = `${a[0]}%`; el.style.top = `${a[1]}%`; el.style.width = `${length}%`; el.style.transform = `rotate(${angle}deg)`; boardEl.appendChild(el); } });
        const legal = gameStarted && !state.winner && !state.draw ? core.getLegalActions(state) : [];
        const validPoints = new Set(legal.map(action => action.point ?? action.to));
        const pointLayer = document.createElement("div");
        pointLayer.className = "muehle-point-layer";
        boardEl.appendChild(pointLayer);
        const gridValues = [10, 22, 34, 50, 66, 78, 90];
        for (let point = 0; point < 24; point += 1) {
            const button = document.createElement("button");
            const stone = document.createElement("span");
            button.type = "button";
            button.className = "point-button";
            button.tabIndex = keyboardEnabled ? 0 : -1;
            button.setAttribute("aria-disabled", String(!keyboardEnabled));
            stone.className = "muehle-point";
            button.appendChild(stone);
            button.dataset.point = String(point);
            button.style.gridColumn = String(gridValues.indexOf(pointPositions[point][0]) + 1);
            button.style.gridRow = String(gridValues.indexOf(pointPositions[point][1]) + 1);
            const occupant = state?.board[point];
            if (occupant === 1) { button.classList.add("player-one"); stone.className = "muehle-stone"; }
            if (occupant === 2) { button.classList.add("player-two"); stone.className = "muehle-stone"; }
            if (validPoints.has(point)) {
                if (state.phase === "remove-opponent") button.classList.add("removal-target");
                else if (state.phase === "select-target") button.classList.add("valid-target");
                else if (state.phase === "select-source" || state.phase === "flying") button.classList.add("available-source");
            }
            if (state?.selectedSource === point) button.classList.add("selected-source");
            if (keyboardMode && keyboardPoint === point) button.classList.add("keyboard-focus");
            button.setAttribute("aria-label", `Punkt ${point + 1}${occupant ? `, ${playerName(occupant)}` : ", frei"}`);
            button.addEventListener("pointerdown", () => { keyboardMode = false; boardEl.classList.remove("keyboard-active"); });
            button.addEventListener("focus", () => { pointLayer.querySelectorAll(".keyboard-focus").forEach(element => element.classList.remove("keyboard-focus")); if (keyboardMode) { keyboardPoint = point; boardEl.classList.add("keyboard-active"); button.classList.add("keyboard-focus"); } });
            button.addEventListener("keydown", event => handleKeyboardPointKeydown(event, point));
            button.addEventListener("click", () => handlePoint(point));
            pointLayer.appendChild(button);
        }
        if (keyboardMode) focusKeyboardPoint();
        document.getElementById("playerOneCount").textContent = String(state?.placed?.[1] ?? 0); document.getElementById("playerTwoCount").textContent = String(state?.placed?.[2] ?? 0); document.getElementById("playerOneCount").parentElement.classList.toggle("winner", state?.winner === 1); document.getElementById("playerTwoCount").parentElement.classList.toggle("winner", state?.winner === 2); statusEl.textContent = statusText(); phaseEl.textContent = phaseLabel(); hintEl.textContent = hintText(); updateAdaptiveBadge(); updateLabels(); updateMatchScore(); updateMobileGameAction();
    }
    function humanTurn() { return !isComputer() || state.currentPlayer === humanPlayer(); }
    function handlePoint(point) { if (!gameStarted || !state || !humanTurn()) return; let action = null; if (state.phase === "placing") action = { type: "place", point }; else if (state.phase === "select-source" || state.phase === "flying") action = { type: "select", point }; else if (state.phase === "select-target") action = { type: "move", from: state.selectedSource, to: point }; else if (state.phase === "remove-opponent") action = { type: "remove", point }; if (action) perform(action); }
    function perform(action) { const before = state; const next = core.applyAction(state, action); if (!next) { statusEl.textContent = "Dieser Zug ist nicht möglich."; return; } state = next; if (isComputer() && before.currentPlayer === humanPlayer()) core.trackPlayerAction(window.muehlePlayerProfile, before, action, state, { deferSave: state.phase === core.PHASES.REMOVE }); playMoveSound(); render(); if (state.winner || state.draw) finishRound(); else if (state.currentPlayer === botPlayer() && isComputer()) scheduleBot(); }
    function botAction() { if (!gameStarted || !state || state.winner || state.draw || !isComputer() || state.currentPlayer !== botPlayer()) return; const level = botTypeSelect.value === "adaptive" ? null : Number(botLevelSelect.value); const action = botTypeSelect.value === "adaptive" ? window.MuehleAdaptiveBot.chooseAction(state, botPlayer(), window.muehlePlayerProfile) : window.MuehleManualBot.chooseAction(state, botPlayer(), level); perform(action || core.getLegalActions(state)[0]); }
    function scheduleBot() { cancelBot(); const token = gameToken; const delay = botTypeSelect.value === "adaptive" ? window.MuehleAdaptiveBot.getThinkTime() : window.MuehleManualBot.getThinkTime(Number(botLevelSelect.value)); botTimer = setTimeout(() => { botTimer = null; if (token !== gameToken) return; botAction(); }, window.getBotMoveDelay(delay, state.moveNumber === 0)); }
    function startRound() { const startPlayer = matchSelect.value === "match" ? (matchRound % 2 === 1 ? 1 : 2) : 1; cancelBot(); state = core.createInitialState(startPlayer); gameStarted = true; matchRunning = true; updateSettings(); document.body.classList.add("game-active"); if (mobilePrototype) { screens?.showGame?.(); fullscreen?.requestIfChosen?.(); } else { setupScreen.hidden = false; gameScreen.hidden = false; } render(); stabilizeMuehleGeometry(); startButton.textContent = "Spiel abbrechen"; window.MuehleAdaptiveBot?.beginRound?.({ enabled: isComputer() && botTypeSelect.value === "adaptive", adaptSpeed: speedSelect.value }); if (state.currentPlayer === botPlayer() && isComputer()) scheduleBot(); }
    function finishRound() { cancelBot(); gameStarted = false; state.roundStatus = state.draw ? "draw" : "ended"; if (isComputer() && botTypeSelect.value === "adaptive") window.MuehleAdaptiveBot.recordRoundResult(state.winner === 1 ? "playerWin" : state.winner === 2 ? "botWin" : "draw"); if (matchSelect.value === "match") { if (state.winner) matchWins[state.winner] += 1; matchRound += 1; if (matchWins[1] >= 2 || matchWins[2] >= 2) { state.matchStatus = "ended"; startButton.textContent = "Neues Spiel"; statusEl.textContent += ` Matchstand ${matchWins[1]}:${matchWins[2]}.`; } else { startButton.textContent = "Nächste Runde"; statusEl.textContent += state.winner ? ` Matchstand ${matchWins[1]}:${matchWins[2]}.` : " Nächste Runde."; } } else { startButton.textContent = "Neues Spiel"; } updateSettings(); render(); }
    function abortGame() { cancelBot(); gameStarted = false; matchRunning = false; state = null; document.body.classList.remove("game-active"); if (mobilePrototype) { screens?.showSetup?.(); fullscreen?.exit?.(); } else { setupScreen.hidden = false; gameScreen.hidden = false; } startButton.textContent = "Jetzt spielen"; updateSettings(); render(); }
    function startButtonClick() { if (!gameStarted) { if ((state?.winner || state?.draw) && matchSelect.value === "match" && matchWins[1] < 2 && matchWins[2] < 2) { startRound(); } else { matchWins = { 1: 0, 2: 0 }; matchRound = 1; startRound(); } } else { abortGame(); } }
    boardEl.addEventListener("keydown", event => { if (event.target !== boardEl || !gameStarted || !state || !humanTurn()) return; if (!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"," ","Spacebar"].includes(event.key)) return; event.preventDefault(); keyboardMode = true; boardEl.classList.add("keyboard-active"); if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") { handlePoint(keyboardPoint); return; } keyboardPoint = keyboardNeighbor(keyboardPoint, event.key); render(); });
    boardEl.addEventListener("pointerdown", () => { keyboardMode = false; boardEl.classList.remove("keyboard-active"); }); startButton.addEventListener("click", startButtonClick); mobileGameAction.addEventListener("click", () => { window.AndisSound?.playUiClick?.(0.22); if (gameStarted) abortGame(); else startButtonClick(); }); modeButton.addEventListener("click", () => { modeSelect.value = isComputer() ? "human" : "computer"; updateSettings(); }); matchButton.addEventListener("click", () => { matchSelect.value = matchSelect.value === "single" ? "match" : "single"; updateSettings(); }); botLevelButton.addEventListener("click", () => { const current = botTypeSelect.value === "adaptive" ? 5 : Number(botLevelSelect.value); const next = current >= 5 ? 1 : current + 1; if (next === 5) botTypeSelect.value = "adaptive"; else { botTypeSelect.value = "manual"; botLevelSelect.value = String(next); } updateSettings(); }); adaptiveButton.addEventListener("click", () => { if (botTypeSelect.value !== "adaptive") return; const values = ["slow", "normal", "fast"]; speedSelect.value = values[(values.indexOf(speedSelect.value) + 1) % values.length]; window.MuehleAdaptiveBot?.setAdaptSpeed?.(speedSelect.value); updateSettings(); }); [modeButton, matchButton, botLevelButton, adaptiveButton, startButton].filter(Boolean).forEach((element) => element.addEventListener("click", () => window.AndisSound?.playUiClick?.(0.22))); updateSettings(); updateLabels(); render();
    const screens = window.AndisMobileLayout?.createScreenController?.({ setupScreen, gameScreen, body: document.body }); let mobilePrototype = window.AndisMobileLayout?.detectMobileSession?.() ?? false; screens?.applyMode?.(mobilePrototype, false); const fullscreen = screens?.bindFullscreen?.({ button: document.getElementById("fullscreenToggle"), isMobile: () => mobilePrototype }); screens?.watchResponsiveMode?.((isMobile) => { mobilePrototype = isMobile; stabilizeMuehleGeometry(); }); window.AndisBoardLayout?.bindBoardLayout?.({ element: boardEl, update: stabilizeMuehleGeometry }); stabilizeMuehleGeometry();
    const navigationState = {
        isGameActive: () => gameStarted,
        isMatchRunning: () => gameStarted,
        onAbortConfirmed: abortGame
    };
    window.AndisNavigation?.bindBackButton?.({
        button: backIcon,
        ...navigationState,
        onMenuBack: () => {
            window.AndisSound?.playUiClick?.(0.22);
            setTimeout(() => { window.location.href = "../index.html?menu=1"; }, 100);
        }
    });
    window.AndisNavigation?.bindBackButton?.({ button: mobileSettingsBack, ...navigationState });
    window.AndisNavigation?.bindBrowserBack?.(navigationState);
    window.muehlePlayerProfile = core.createPlayerProfile();
    document.getElementById("resetConfirmButton")?.addEventListener("click", () => {
        core.clearPlayerProfile(window.muehlePlayerProfile);
        window.MuehleAdaptiveBot?.clearPersistentState?.(35);
    });
    window.MuehleGame = { getState: () => core.cloneState(state), startRound, reset: abortGame, cancelTimers: cancelBot };
})();
