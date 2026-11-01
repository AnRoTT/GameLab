(function () {
    "use strict";
    const core = window.DeutscheDameAICore, manualBot = window.DeutscheDameManualBot, adaptiveBot = window.DeutscheDameAdaptiveBot;
    const $ = id => document.getElementById(id);
    const setup = $("setupScreen"), game = $("gameScreen"), board = $("board"), mobileGameAction = $("mobileGameAction"), backIcon = $("backIcon"), mobileSettingsBack = $("backSetup");
    const adaptivePanel = $("adaptivePanel"), adaptiveStrengthTrack = $("adaptiveStrengthTrack"), adaptiveStrengthFill = $("adaptiveStrengthFill"), adaptiveStrengthValue = $("adaptiveStrengthValue"), matchButton = $("matchButton"), matchSelect = $("match"), matchScore = $("matchScore");
    const resumeSavedButton = $("resume"), resumeConfirmBackdrop = $("resumeConfirmBackdrop"), resumeDecline = $("resumeDecline"), resumeAccept = $("resumeAccept"), resumeProgress = $("resumeProgress");
    let state = null, mode = "bot", botTimer = null, token = 0, botPreview = null, pathPreview = null, automaticPathPreview = false, selectedFrom = null, lastMove = null, keyboardIndex = 0, keyboardActive = false;
let resumePreviouslyFocused = null, pendingSavedState = null, savedInSetup = false, returningToSetup = false, leavingToMenu = false, adaptiveResultRecorded = false;
    let matchWins = { 1: 0, 2: 0 }, matchRound = 1, matchRunning = false, roundResultRecorded = false, roundAdaptive = false;
    const screens = window.AndisMobileLayout?.createScreenController?.({ setupScreen: setup, gameScreen: game, body: document.body });
    let mobilePrototype = window.AndisMobileLayout?.detectMobileSession?.() ?? false;
    const isMobile = () => mobilePrototype;
    function cancelBot() { if (botTimer) clearTimeout(botTimer); botTimer = null; botPreview = null; pathPreview = null; automaticPathPreview = false; selectedFrom = null; lastMove = null; token += 1; }
    function legal() { return state ? core.legalActions(state) : []; }
    function hasSavableGame() { return Boolean(state && ((!state.winner && !state.draw) || (matchRunning && matchSelect.value === "match"))); }
    function isResumable(saved) {
        const normalized = normalizeSavedState(saved);
        return Boolean(normalized && ((!normalized.state.winner && !normalized.state.draw)
            || (normalized.settings.match === "match" && normalized.matchRunning && normalized.roundResultRecorded)));
    }
    function createSavedState() {
        return { schemaVersion: 6, gameId: "deutsche-dame", savedAt: new Date().toISOString(), state: core.clone(state), matchWins: { ...matchWins }, matchRound, matchRunning, roundResultRecorded, adaptiveRoundSnapshot: adaptiveBot?.getRoundSnapshot?.() ?? null, settings: { mode, botType: mode === "bot" ? (roundAdaptive ? "adaptive" : "manual") : $("botType").value, botLevel: Number($("botLevel").value) || 1, adaptSpeed: $("adaptSpeed").value, match: matchSelect.value } };
    }
    function normalizeSavedState(saved) {
        // Der Speicher-Key gehört bereits exklusiv zu Deutsche Dame. Ältere
        // Spielstände ohne gameId bleiben dadurch wiederherstellbar.
        if (!saved || (saved.gameId !== undefined && saved.gameId !== "deutsche-dame") || !saved.state || !Array.isArray(saved.state.board) || saved.state.board.length !== 64) return null;
        const validPiece = piece => piece === null || (piece && (piece.player === 1 || piece.player === 2) && typeof piece.king === "boolean");
        if (!saved.state.board.every((piece, index) => validPiece(piece) && (piece === null || (Math.floor(index / 8) + index % 8) % 2 === 1))) return null;
        if ([1, 2].some(player => saved.state.board.filter(piece => piece?.player === player).length > 12)
            || (saved.state.currentPlayer != null && ![1, 2].includes(saved.state.currentPlayer))
            || ["moves", "quietMoves"].some(key => saved.state[key] != null && (!Number.isInteger(saved.state[key]) || saved.state[key] < 0))
            || (saved.state.positionHistory != null && (!Array.isArray(saved.state.positionHistory) || !saved.state.positionHistory.every(key => typeof key === "string")))
            || (saved.state.winner && saved.state.draw)) return null;
        const settings = {
            mode: saved.settings?.mode ?? saved.mode ?? "bot",
            botType: saved.settings?.botType ?? saved.botType ?? "manual",
            botLevel: saved.settings?.botLevel ?? saved.botLevel ?? 1,
            adaptSpeed: saved.settings?.adaptSpeed ?? saved.adaptSpeed ?? "normal",
            match: saved.settings?.match ?? saved.match ?? "single",
            ...(saved.settings || {})
        };
        if (!(settings.mode === "bot" || settings.mode === "human")
            || !(settings.botType === "manual" || settings.botType === "adaptive")
            || ![1, 2, 3, 4].includes(Number(settings.botLevel))
            || !["slow", "normal", "fast"].includes(settings.adaptSpeed)
            || !["single", "match"].includes(settings.match)) return null;
        const state = {
            ...saved.state,
            selected: saved.state.selected ?? null,
            chainFrom: saved.state.chainFrom ?? null,
            winner: saved.state.winner ?? null,
            draw: Boolean(saved.state.draw),
            drawReason: saved.state.drawReason ?? null,
            moves: Number.isInteger(saved.state.moves) ? saved.state.moves : 0,
            quietMoves: Number.isInteger(saved.state.quietMoves) ? saved.state.quietMoves : 0,
            positionHistory: Array.isArray(saved.state.positionHistory) ? saved.state.positionHistory : [],
            currentPlayer: saved.state.currentPlayer === 2 ? 2 : 1
        };
        if ((state.chainFrom !== null && (!Number.isInteger(state.chainFrom) || state.chainFrom < 0 || state.chainFrom >= 64
                || state.board[state.chainFrom]?.player !== state.currentPlayer || state.winner || state.draw
                || !core.legalActions(state).some(action => action.type === "capture")))
            || (state.winner !== null && ![1, 2].includes(state.winner))) return null;
        return { ...saved, gameId: "deutsche-dame", state, settings };
    }
    function isValidSavedState(saved) {
        return Boolean(normalizeSavedState(saved));
    }
    function writeSavedGame() { if (hasSavableGame()) return DeutscheDameStorage.save(createSavedState()); DeutscheDameStorage.clear(); return true; }
    function save() { if (!savedInSetup && !returningToSetup && !leavingToMenu) writeSavedGame(); }
    function updateResumeAction() {
        const saved = DeutscheDameStorage.load();
        const resumable = mobilePrototype && isResumable(saved);
        if (resumeSavedButton) {
            resumeSavedButton.hidden = !resumable;
            resumeSavedButton.setAttribute("aria-hidden", String(!resumable));
        }
    }
    function playMoveSound() { window.AndisSound?.playSmallChipDrop?.(0.18); }
    function playUiSound() { window.AndisSound?.playUiClick?.(0.22); }
    function updateMatchUI() {
        const active = matchSelect.value === "match";
        matchButton.textContent = active ? "Mehrfachrunde" : "Einzelrunde";
        matchScore.textContent = `${matchWins[1]}:${matchWins[2]}`;
        matchScore.hidden = !active;
    }
    window.updateDeutscheDameMatchUI = updateMatchUI;
    function updateAdaptiveBadge() {
        const active = state && !state.winner && !state.draw ? roundAdaptive : $("mode").value === "bot" && $("botType").value === "adaptive";
        const skill = Number(adaptiveBot?.getAdaptiveSkill?.() ?? 35);
        if (adaptivePanel) {
            adaptivePanel.hidden = !active;
            adaptivePanel.classList.toggle("active", active);
            adaptivePanel.setAttribute("aria-hidden", active ? "false" : "true");
        }
        if (adaptiveStrengthTrack) { adaptiveStrengthTrack.setAttribute("aria-valuenow", String(skill)); adaptiveStrengthTrack.setAttribute("aria-label", `Adaptive Stärke ${skill} von 100`); }
        if (adaptiveStrengthFill) adaptiveStrengthFill.style.width = `${skill}%`;
        if (adaptiveStrengthValue) adaptiveStrengthValue.textContent = `${skill}%`;
    }
    window.updateDeutscheDameAdaptiveBadge = updateAdaptiveBadge;
    function scheduleCapture(action, automatic = false) {
        const currentToken = token;
        pathPreview = action;
        automaticPathPreview = automatic;
        render();
        botTimer = setTimeout(() => {
            if (currentToken !== token) return;
            botTimer = null;
            pathPreview = null;
            automaticPathPreview = false;
            perform(action);
        }, 500);
    }
    function capturePath(from, to) {
        const cells = [], fromRow = Math.floor(from / 8), fromCol = from % 8;
        const toRow = Math.floor(to / 8), toCol = to % 8;
        const rowStep = Math.sign(toRow - fromRow), colStep = Math.sign(toCol - fromCol);
        let row = fromRow + rowStep, col = fromCol + colStep;
        while (row !== toRow || col !== toCol) {
            cells.push(row * 8 + col);
            row += rowStep;
            col += colStep;
        }
        return cells;
    }
    function keyboardNeighbor(current, key, candidates) {
        const row = Math.floor(current / 8), column = current % 8;
        const direction = key === "ArrowUp" ? [-1, 0] : key === "ArrowDown" ? [1, 0] : key === "ArrowLeft" ? [0, -1] : [0, 1];
        const directional = candidates.filter(index => {
            const deltaRow = Math.floor(index / 8) - row, deltaColumn = (index % 8) - column;
            return deltaRow * direction[0] + deltaColumn * direction[1] > 0;
        });
        if (!directional.length) return current;
        return directional.sort((first, second) => {
            const firstRow = Math.floor(first / 8) - row, firstColumn = (first % 8) - column;
            const secondRow = Math.floor(second / 8) - row, secondColumn = (second % 8) - column;
            const firstPrimary = Math.abs(firstRow * direction[0] + firstColumn * direction[1]);
            const secondPrimary = Math.abs(secondRow * direction[0] + secondColumn * direction[1]);
            const firstDistance = Math.abs(firstRow) + Math.abs(firstColumn);
            const secondDistance = Math.abs(secondRow) + Math.abs(secondColumn);
            return firstPrimary - secondPrimary || firstDistance - secondDistance;
        })[0];
    }
    function render() {
        const restoreBoardFocus = board.contains(document.activeElement);
        board.innerHTML = "";
        const actions = legal();
        const keyboardEnabled = Boolean(state && !state.winner && !state.draw && !(mode === "bot" && state.currentPlayer === 2));
        board.classList.toggle("keyboard-active", keyboardActive && keyboardEnabled);
        const activeSource = selectedFrom !== null ? selectedFrom : (state && state.chainFrom !== null ? state.chainFrom : null);
        const selectedSource = activeSource;
        const focusableIndices = keyboardEnabled
            ? [...new Set(activeSource !== null
                ? actions.filter(action => action.from === activeSource).map(action => action.to)
                : actions.map(action => action.from))]
            : [];
        const focusableSet = new Set(focusableIndices);
        if (focusableIndices.length && !focusableSet.has(keyboardIndex)) keyboardIndex = focusableIndices[0];
        const targets = new Set(actions.filter(action => activeSource !== null && action.from === activeSource).map(action => action.to));
        const captureTargets = new Set(actions.filter(action => activeSource !== null && action.from === activeSource && action.type === "capture").map(action => action.to));
        const pathActions = pathPreview ? [pathPreview] : actions.filter(action => action.type === "capture" && action.from === activeSource);
        const captureSteps = new Set();
        for (const action of pathActions) {
            for (const cell of capturePath(action.from, action.to)) {
                if (cell !== action.over && cell !== action.to) captureSteps.add(cell);
            }
        }
        const sources = new Set(actions.map(action => action.from));
        for (let i = 0; i < 64; i += 1) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cell " + (((Math.floor(i / 8) + i) % 2) ? "dark" : "light");
            const piece = state && state.board[i];
            const row = Math.floor(i / 8) + 1, column = (i % 8) + 1;
            const pieceLabel = piece ? `, ${piece.player === 1 ? "weißer" : "schwarzer"}${piece.king ? " Dame" : " Stein"}` : ", frei";
            const stateLabel = sources.has(i) ? (selectedSource === i ? ", ausgewählt" : ", auswählbar") : targets.has(i) ? ", mögliches Zielfeld" : "";
            cell.setAttribute("aria-label", `Feld ${row}, ${column}${pieceLabel}${stateLabel}`);
            cell.tabIndex = focusableSet.has(i) && i === keyboardIndex ? 0 : -1;
            if (keyboardActive && focusableSet.has(i) && i === keyboardIndex) cell.classList.add("keyboard-focus");
            if (targets.has(i)) cell.classList.add("target");
            if (captureTargets.has(i)) cell.classList.add("capture-target");
            if (captureSteps.has(i)) cell.classList.add("capture-step");
            if (lastMove && lastMove.to === i) cell.classList.add(lastMove.type === "capture" ? "capture-arrival" : "move-arrival");
            if (botPreview && botPreview.from === i) cell.classList.add("bot-source");
            if (botPreview && botPreview.to === i) cell.classList.add("bot-target");
            if (botPreview && botPreview.over === i) cell.classList.add("capture-over");
            if (pathPreview && pathPreview.from === i) cell.classList.add("bot-source");
            if (pathPreview && pathPreview.to === i) {
                cell.classList.add("bot-target");
                if (automaticPathPreview) cell.classList.add("automatic-path-target");
            }
            if (pathPreview && pathPreview.over === i) cell.classList.add("capture-over");
            if (sources.has(i)) cell.classList.add(selectedSource === i ? "selected-source" : "available-source");
            if (piece) { cell.classList.add(piece.player === 1 ? "player-one" : "player-two"); const stone = document.createElement("span"); stone.className = "muehle-stone" + (piece.king ? " king" : ""); cell.appendChild(stone); }
            cell.addEventListener("focus", () => {
                if (!keyboardActive) return;
                keyboardIndex = i;
                board.querySelectorAll(".cell").forEach(candidate => { candidate.tabIndex = candidate === cell ? 0 : -1; });
                board.classList.add("keyboard-active");
                board.querySelectorAll(".keyboard-focus").forEach(candidate => candidate.classList.remove("keyboard-focus"));
                cell.classList.add("keyboard-focus");
            });
            cell.addEventListener("pointerdown", () => {
                keyboardActive = false;
                board.classList.remove("keyboard-active");
                board.querySelectorAll(".keyboard-focus").forEach(candidate => candidate.classList.remove("keyboard-focus"));
            });
            cell.addEventListener("keydown", event => {
                const offsets = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
                if (Object.prototype.hasOwnProperty.call(offsets, event.key)) {
                    event.preventDefault();
                    keyboardActive = true;
                    board.classList.add("keyboard-active");
                    cell.classList.add("keyboard-focus");
                    const next = keyboardNeighbor(i, event.key, focusableIndices);
                    if (next === i) return;
                    keyboardIndex = next;
                    board.children[next]?.focus({ preventScroll: true });
                    return;
                }
                if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                    event.preventDefault();
                    handleCell(i);
                }
            });
            cell.addEventListener("click", () => { keyboardIndex = i; handleCell(i); });
            board.appendChild(cell);
        }
        if (restoreBoardFocus) {
            if (keyboardEnabled && focusableIndices.length) board.children[keyboardIndex]?.focus({ preventScroll: true });
            else if (state && !state.winner && !state.draw) board.focus({ preventScroll: true });
        }
        $("whiteCount").textContent = String(state ? state.board.filter(piece => piece && piece.player === 1).length : 12);
        $("blackCount").textContent = String(state ? state.board.filter(piece => piece && piece.player === 2).length : 12);
        $("whiteCount").parentElement.classList.toggle("winner", state?.winner === 1);
        $("blackCount").parentElement.classList.toggle("winner", state?.winner === 2);
        const roundEnded = Boolean(state && (state.winner || state.draw));
        const matchWinner = matchWins[1] >= 2 ? 1 : matchWins[2] >= 2 ? 2 : null;
        $("status").textContent = roundEnded && matchSelect.value === "match" && roundResultRecorded
            ? (matchWinner ? `Spieler ${matchWinner} gewinnt das Match!` : `${state.winner ? `Spieler ${state.winner} gewinnt die Runde` : "Remis"} · Zwischenstand ${matchWins[1]}:${matchWins[2]}`)
            : state && state.winner ? "Spieler " + state.winner + " gewinnt!" : state && state.draw ? "Remis" : "Spieler " + (state ? state.currentPlayer : 1) + (mode === "bot" && state && state.currentPlayer === 2 ? " (Bot)" : "") + " ist am Zug";
        $("hint").textContent = pathPreview ? `Schlag: Feld ${pathPreview.from + 1} über Feld ${pathPreview.over + 1} nach Feld ${pathPreview.to + 1}.` : state && state.winner ? (state.endReason === "blockiert" ? "Der Gegner kann keinen legalen Zug mehr ausführen." : "Alle gegnerischen Steine wurden geschlagen.") : state && state.draw ? (state.drawReason === "wiederholung" ? "Dreifache Stellungswiederholung." : "25 vollständige Züge ohne Schlag oder Krönung.") : state && state.chainFrom !== null ? "Mehrfachschlag fortsetzen." : actions.some(action => action.type === "capture") ? "Schlagzwang: wähle einen Schlag." : "Wähle einen Stein.";
        if (mobileGameAction) mobileGameAction.textContent = state && !state.winner && !state.draw ? "Spiel abbrechen" : roundEnded && matchRunning ? "Nächste Runde" : "Neues Spiel";
        board.classList.toggle("game-over", Boolean(state && (state.winner || state.draw)));
        board.classList.toggle("winner-white", state?.winner === 1);
        board.classList.toggle("winner-black", state?.winner === 2);
        $("start").textContent = roundEnded ? (matchRunning ? "Nächste Runde" : "Neues Spiel") : "Jetzt spielen";
        updateMatchUI();
        updateAdaptiveBadge();
    }
    function handleCell(index) { if (!state || state.winner || state.draw || pathPreview || (mode === "bot" && state.currentPlayer === 2)) return; const actions = legal(); if (selectedFrom === null && state.chainFrom !== null) { const continuation = actions.find(candidate => candidate.from === state.chainFrom && candidate.to === index); if (continuation) scheduleCapture(continuation); return; } if (selectedFrom === null) { const sourceActions = actions.filter(action => action.from === index); if (sourceActions.length === 1 && sourceActions[0].type === "capture") { playUiSound(); scheduleCapture(sourceActions[0], true); return; } if (sourceActions.length) { playUiSound(); selectedFrom = index; render(); } return; } const action = actions.find(candidate => candidate.from === selectedFrom && candidate.to === index); if (action) { selectedFrom = null; if (action.type === "capture") scheduleCapture(action); else perform(action); } else if (actions.some(candidate => candidate.from === index)) { playUiSound(); selectedFrom = index; render(); } }
    function scheduleBotTurn() {
        if (!state || state.winner || state.draw || mode !== "bot" || state.currentPlayer !== 2) return;
        const currentToken = token;
        const thinkTime = roundAdaptive ? adaptiveBot.getThinkTime() : manualBot.getThinkTime(Number($("botLevel").value) || 1);
        botTimer = setTimeout(() => {
            if (currentToken !== token) return;
            botTimer = null;
            let chosen;
            try { chosen = roundAdaptive ? adaptiveBot.chooseAction(state) : manualBot.chooseAction(state, 2, Number($("botLevel").value) || 1); }
            catch (error) { console.error("Dame-Bot konnte keinen Zug berechnen:", error); }
            const actions = legal();
            if (!chosen || !actions.some(action => action.type === chosen.type && action.from === chosen.from && action.to === chosen.to && action.over === chosen.over)) chosen = actions[0];
            if (!chosen) { state = core.evaluateOutcome(state); render(); if (state.winner || state.draw) finishRound(); else $("hint").textContent = "Der Bot konnte keinen Zug ausführen."; return; }
            botPreview = chosen;
            render();
            botTimer = setTimeout(() => {
                if (currentToken !== token) return;
                botTimer = null;
                botPreview = null;
                perform(chosen);
            }, 850);
        }, thinkTime);
    }
    function finishRound() {
        if (!state || (!state.winner && !state.draw)) return;
        if (roundAdaptive && !adaptiveResultRecorded) {
            if (!adaptiveBot.isRoundActive()) adaptiveBot.beginRound({ adaptSpeed: $("adaptSpeed").value });
            adaptiveBot.recordRoundResult(state.winner === 1 ? "playerWin" : state.winner === 2 ? "botWin" : "draw");
            adaptiveResultRecorded = true;
        }
        if (matchSelect.value === "match") {
            if (!roundResultRecorded && state.winner) matchWins[state.winner] += 1;
            roundResultRecorded = true;
            const matchWinner = matchWins[1] >= 2 ? 1 : matchWins[2] >= 2 ? 2 : null;
            matchRound += 1;
            matchRunning = !matchWinner;
            $("status").textContent = matchWinner ? `Spieler ${matchWinner} gewinnt das Match!` : `${state.winner ? `Spieler ${state.winner} gewinnt die Runde` : "Remis"} · Zwischenstand ${matchWins[1]}:${matchWins[2]}`;
            $("start").textContent = matchWinner ? "Neues Spiel" : "Nächste Runde";
        } else {
            matchRunning = false;
            $("start").textContent = "Neues Spiel";
        }
        render();
        save();
    }
    function perform(action) { const before = state; const next = core.applyAction(state, action); if (!next) return; if (mode === "bot" && before.currentPlayer === 1) core.trackPlayerAction?.(window.deutscheDamePlayerProfile, before, action, next); playMoveSound(); selectedFrom = null; lastMove = action; state = next; setTimeout(() => { if (lastMove === action) { lastMove = null; render(); } }, 380); if (state.winner || state.draw) { finishRound(); return; } render(); save(); if (state.chainFrom !== null) { const continuations = core.legalActions(state); if (continuations.length === 1) { scheduleCapture(continuations[0], true); return; } } scheduleBotTurn(); }
    function startRound() { cancelBot(); adaptiveBot.cancelRound?.(); adaptiveResultRecorded = false; roundResultRecorded = false; savedInSetup = false; returningToSetup = false; leavingToMenu = false; lastMove = null; mode = $("mode").value; roundAdaptive = mode === "bot" && $("botType").value === "adaptive"; if (mode === "bot") window.deutscheDamePlayerProfile.gamesAgainstBot += 1; state = core.initialState(); if (matchSelect.value === "match" && matchRound % 2 === 0) { state.currentPlayer = 2; state.positionHistory = [core.positionKey(state)]; } document.body.classList.add("game-active"); if (roundAdaptive) adaptiveBot.beginRound({ adaptSpeed: $("adaptSpeed").value }); if (isMobile()) { screens?.showGame?.(); fullscreen?.requestIfChosen?.(); } else { setup.hidden = false; game.hidden = false; } render(); save(); updateResumeAction(); scheduleBotTurn(); }
    function start() { const continueMatch = matchSelect.value === "match" && matchRunning && state && (state.winner || state.draw) && matchWins[1] < 2 && matchWins[2] < 2; if (!continueMatch) { matchWins = { 1: 0, 2: 0 }; matchRound = 1; matchRunning = matchSelect.value === "match"; } startRound(); }
    function abort() { cancelBot(); adaptiveBot.cancelRound?.(); adaptiveResultRecorded = false; savedInSetup = false; returningToSetup = false; leavingToMenu = false; matchWins = { 1: 0, 2: 0 }; matchRound = 1; matchRunning = false; roundResultRecorded = false; state = null; document.body.classList.remove("game-active"); if (isMobile()) screens?.showSetup?.(); else { setup.hidden = false; game.hidden = false; } DeutscheDameStorage.clear(); window.AndisSavedGameNotice?.hide?.(); render(); updateResumeAction(); }
    function showSetupAfterSavedGame() {
        state = null;
        savedInSetup = false;
        returningToSetup = false;
        leavingToMenu = false;
        document.body.classList.remove("game-active");
        if (isMobile()) screens?.showSetup?.(); else { setup.hidden = false; game.hidden = false; }
        render();
        updateResumeAction();
    }
    function returnToSetup() {
        if (returningToSetup) return;
        if (!hasSavableGame()) { cancelBot(); showSetupAfterSavedGame(); return; }
        if (writeSavedGame() === false) { window.AndisSavedGameNotice?.show?.("Speichern fehlgeschlagen. Das Spiel bleibt geöffnet.", 3000); return; }
        cancelBot();
        savedInSetup = true;
        returningToSetup = true;
        window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, showSetupAfterSavedGame);
    }
    function leaveToMenu() {
        if (leavingToMenu) return;
        if (hasSavableGame()) {
            if (writeSavedGame() === false) { window.AndisSavedGameNotice?.show?.("Speichern fehlgeschlagen. Das Spiel bleibt geöffnet.", 3000); return; }
            leavingToMenu = true;
            cancelBot();
            fullscreen?.exit?.();
            window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => { window.location.href = "../index.html?menu=1"; });
            return;
        }
        leavingToMenu = true;
        DeutscheDameStorage.clear();
        window.location.href = "../index.html?menu=1";
    }
    function restoreSavedGame(saved) {
        saved = normalizeSavedState(saved);
        if (!saved) return false;
        cancelBot();
        savedInSetup = false;
        returningToSetup = false;
        leavingToMenu = false;
        const settings = saved.settings || { mode: saved.mode, botType: saved.botType };
        mode = settings.mode || "bot";
        $("mode").value = mode;
        $("modeButton").textContent = mode === "human" ? "2 Spieler" : "1 Spieler";
        $("botType").value = settings.botType || "manual";
        $("botLevel").value = String([1, 2, 3, 4].includes(Number(settings.botLevel)) ? Number(settings.botLevel) : 1);
        $("match").value = settings.match === "match" ? "match" : "single";
        matchWins = { 1: Number(saved.matchWins?.[1]) || 0, 2: Number(saved.matchWins?.[2]) || 0 };
        matchRound = Math.max(1, Number(saved.matchRound) || 1);
        matchRunning = Boolean(saved.matchRunning);
        roundResultRecorded = Boolean(saved.roundResultRecorded);
        $("adaptSpeed").value = ["slow", "normal", "fast"].includes(settings.adaptSpeed) ? settings.adaptSpeed : "normal";
        $("botButton").textContent = settings.botType === "adaptive" ? "Adaptiv" : ({ 1: "Anfänger", 2: "Hobbyspieler", 3: "Vereinsspieler", 4: "Meister" }[$("botLevel").value] || "Anfänger");
        $("adaptiveButton").disabled = settings.botType !== "adaptive" || mode !== "bot";
        $("adaptiveButton").textContent = settings.botType === "adaptive" ? ({ slow: "Langsam", normal: "Normal", fast: "Schnell" }[$("adaptSpeed").value] || "Normal") : "—";
        adaptiveResultRecorded = false;
        roundAdaptive = mode === "bot" && settings.botType === "adaptive";
        if (roundAdaptive && !saved.state.winner && !saved.state.draw) adaptiveBot.beginRound({ adaptSpeed: $("adaptSpeed").value, roundSnapshot: saved.adaptiveRoundSnapshot });
        state = core.evaluateOutcome(core.clone(saved.state));
        document.body.classList.add("game-active");
        if (isMobile()) { screens?.showGame?.(); fullscreen?.requestIfChosen?.(); } else { setup.hidden = false; game.hidden = false; }
        if ((state.winner || state.draw) && !saved.state.winner && !saved.state.draw) { finishRound(); updateResumeAction(); return true; }
        render();
        updateResumeAction();
        if (state.chainFrom !== null && !(mode === "bot" && state.currentPlayer === 2) && core.legalActions(state).length === 1) scheduleCapture(core.legalActions(state)[0], true);
        else scheduleBotTurn();
        return true;
    }
    function closeResumeConfirm() {
        resumeConfirmBackdrop.hidden = true;
        pendingSavedState = null;
        if (resumePreviouslyFocused?.focus) resumePreviouslyFocused.focus();
        resumePreviouslyFocused = null;
    }
    function requestResume(saved) {
        saved = normalizeSavedState(saved);
        if (!saved) return;
        pendingSavedState = saved;
        resumePreviouslyFocused = document.activeElement;
        const settings = saved.settings || { mode: saved.mode, botType: saved.botType };
        const pieces = saved.state.board.filter(Boolean).length;
        resumeProgress.textContent = `${settings.mode === "bot" ? "Spiel gegen den Bot" : "Spiel für zwei Spieler"} · ${pieces} Steine auf dem Brett`;
        resumeConfirmBackdrop.hidden = false;
        resumeAccept.focus();
    }
    function checkForSavedGame() {
        if (state || !resumeConfirmBackdrop?.hidden) return;
        const saved = DeutscheDameStorage.load();
        if (isResumable(saved)) requestResume(saved);
    }
    $("start").addEventListener("click", () => { playUiSound(); start(); });
    resumeSavedButton?.addEventListener("click", () => { playUiSound(); const saved = DeutscheDameStorage.load(); if (isValidSavedState(saved)) restoreSavedGame(saved); });
    resumeDecline?.addEventListener("click", () => { playUiSound(); DeutscheDameStorage.clear(); closeResumeConfirm(); updateResumeAction(); $("mode")?.focus(); });
    resumeAccept?.addEventListener("click", () => { playUiSound(); const saved = pendingSavedState; closeResumeConfirm(); restoreSavedGame(saved); });
    resumeConfirmBackdrop?.addEventListener("click", event => { if (event.target === resumeConfirmBackdrop) { playUiSound(); closeResumeConfirm(); } });
    document.addEventListener("keydown", event => {
        if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Spacebar"].includes(event.key)) keyboardActive = true;
    }, true);
    document.addEventListener("pointerdown", () => {
        keyboardActive = false;
        board.classList.remove("keyboard-active");
        board.querySelectorAll(".keyboard-focus").forEach(candidate => candidate.classList.remove("keyboard-focus"));
    }, true);
    document.addEventListener("keydown", event => { if (resumeConfirmBackdrop?.hidden) return; if (event.key === "Escape") { event.preventDefault(); closeResumeConfirm(); return; } if (event.key !== "Tab") return; const focusable = [resumeDecline, resumeAccept].filter(Boolean); if (!focusable.length) return; const current = focusable.indexOf(document.activeElement); const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current === focusable.length - 1 ? 0 : current + 1); event.preventDefault(); focusable[next].focus(); });
    $("fullscreen").addEventListener("click", playUiSound);
    [$("abort"), mobileGameAction].filter(Boolean).forEach(button => button.addEventListener("click", () => { playUiSound(); if (state && !state.winner && !state.draw) abort(); else if (button === mobileGameAction) start(); }));
    [$("modeButton"), $("matchButton"), $("botButton"), $("helpIcon"), $("backIcon"), mobileSettingsBack].filter(Boolean).forEach(element => element.addEventListener("click", playUiSound));
    const fullscreen = screens?.bindFullscreen?.({ button: $("fullscreen"), isMobile: () => mobilePrototype });
    screens?.applyMode?.(mobilePrototype, false);
    screens?.watchResponsiveMode?.(isMobileDetected => { mobilePrototype = isMobileDetected; updateResumeAction(); render(); });
    window.AndisBoardLayout?.bindBoardLayout?.({ element: board, update: render });
    const navigationState = { isGameActive: () => document.body.classList.contains("game-active") || Boolean(state), isMatchRunning: () => Boolean(state && !state.winner && !state.draw) };
    window.AndisNavigation?.bindBackButton?.({ button: backIcon, ...navigationState, onActiveBack: leaveToMenu, onAbortConfirmed: leaveToMenu, onMenuBack: () => { window.location.href = "../index.html?menu=1"; } });
    window.AndisNavigation?.bindBackButton?.({ button: mobileSettingsBack, ...navigationState, onActiveBack: returnToSetup, onAbortConfirmed: abort, onMenuBack: returnToSetup });
    window.AndisNavigation?.bindBrowserBack?.({ ...navigationState, onAbortConfirmed: leaveToMenu });
    function saveOnPageExit() { if (hasSavableGame()) writeSavedGame(); }
    window.addEventListener("beforeunload", saveOnPageExit);
    updateResumeAction();
    render();
    checkForSavedGame();
    window.addEventListener("pageshow", checkForSavedGame);
    window.addEventListener("storage", checkForSavedGame);
})();
