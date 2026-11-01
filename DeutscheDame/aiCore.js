(function (root) {
    "use strict";
    const SIZE = 8;
    const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
    const index = (r, c) => r * SIZE + c;
    const row = i => Math.floor(i / SIZE), col = i => i % SIZE;
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const PLAYER_PROFILE_KEY = "andis-game-foundry-deutsche-dame-player-profile";
    // 25 vollständige Züge ohne Schlag oder Umwandlung ergeben Remis.
    const QUIET_HALF_MOVE_LIMIT = 50;
    function initialState() {
        const board = Array(64).fill(null);
        for (let r = 0; r < 3; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[index(r, c)] = { player: 2, king: false };
        for (let r = 5; r < 8; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[index(r, c)] = { player: 1, king: false };
        const state = { board, currentPlayer: 1, selected: null, chainFrom: null, winner: null, draw: false, drawReason: null, moves: 0, quietMoves: 0, positionHistory: [] };
        state.positionHistory.push(positionKey(state));
        return state;
    }
    function clone(state) {
        return { ...state, board: state.board.map(piece => piece ? { ...piece } : null), positionHistory: Array.isArray(state.positionHistory) ? state.positionHistory.slice() : state.positionHistory };
    }

    function positionKey(state) {
        const boardKey = state.board.map(piece => piece ? `${piece.player}${piece.king ? "K" : "M"}` : "-").join("");
        return `${boardKey}|${state.currentPlayer}|${state.chainFrom ?? "-"}`;
    }

    function recordCompletedTurn(state, action, promoted) {
        if (!Array.isArray(state.positionHistory)) state.positionHistory = [];
        state.positionHistory.push(positionKey(state));
        state.quietMoves = action.type === "capture" || promoted ? 0 : (Number(state.quietMoves) || 0) + 1;
    }

    function evaluateOutcome(state) {
        if (state.winner || state.draw) return state;
        if (!Array.isArray(state.positionHistory)) state.positionHistory = [positionKey(state)];
        if (!Number.isInteger(state.quietMoves) || state.quietMoves < 0) state.quietMoves = 0;

        const player = state.currentPlayer;
        const hasPiece = state.board.some(piece => piece?.player === player);
        const hasMove = legalActions(state).length > 0;
        if (!hasPiece || !hasMove) {
            state.winner = 3 - player;
            state.endReason = !hasPiece ? "keine Steine" : "blockiert";
            return state;
        }

        const currentKey = positionKey(state);
        const occurrences = state.positionHistory.reduce((count, key) => count + (key === currentKey ? 1 : 0), 0);
        if (occurrences >= 3) {
            state.draw = true;
            state.drawReason = "wiederholung";
        } else if (state.quietMoves >= QUIET_HALF_MOVE_LIMIT) {
            state.draw = true;
            state.drawReason = "zuglimit";
        }
        return state;
    }
    function forwardDirections(piece) {
        return piece.player === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    }

    function directions(piece) { return piece.king ? dirs : forwardDirections(piece); }

    function capturesFor(state, from) {
        const piece = state.board[from];
        if (!piece || piece.player !== state.currentPlayer) return [];

        const result = [], r = row(from), c = col(from);
        if (!piece.king) {
            for (const [dr, dc] of forwardDirections(piece)) {
                const mr = r + dr, mc = c + dc;
                const tr = r + dr * 2, tc = c + dc * 2;
                if (inside(tr, tc)
                    && state.board[index(mr, mc)]?.player === 3 - piece.player
                    && !state.board[index(tr, tc)]) {
                    result.push({ type: "capture", from, over: index(mr, mc), to: index(tr, tc) });
                }
            }
            return result;
        }

        // Eine Dame schlägt einen einzelnen gegnerischen Stein auf einer
        // Diagonale und landet unmittelbar dahinter (Ravensburger-Variante).
        for (const [dr, dc] of dirs) {
            let step = 1;
            while (inside(r + dr * step, c + dc * step)
                && !state.board[index(r + dr * step, c + dc * step)]) step += 1;

            if (!inside(r + dr * step, c + dc * step)) continue;
            const over = index(r + dr * step, c + dc * step);
            if (state.board[over]?.player !== 3 - piece.player) continue;

            const tr = r + dr * (step + 1), tc = c + dc * (step + 1);
            if (inside(tr, tc) && !state.board[index(tr, tc)]) {
                result.push({ type: "capture", from, over, to: index(tr, tc) });
            }
        }
        return result;
    }

    function movesFor(state, from) {
        const piece = state.board[from];
        if (!piece || piece.player !== state.currentPlayer) return [];

        const result = [], r = row(from), c = col(from);
        for (const [dr, dc] of directions(piece)) {
            let step = 1;
            while (inside(r + dr * step, c + dc * step)
                && !state.board[index(r + dr * step, c + dc * step)]) {
                result.push({ type: "move", from, to: index(r + dr * step, c + dc * step) });
                if (!piece.king) break;
                step += 1;
            }
        }
        return result;
    }
    function legalActions(state, cache = null) {
        if (cache) {
            if (!cache.legalActions) cache.legalActions = new WeakMap();
            if (cache.legalActions.has(state)) return cache.legalActions.get(state);
            const actions = legalActions(state);
            cache.legalActions.set(state, actions);
            return actions;
        }
        if (state.winner || state.draw) return [];
        if (state.chainFrom !== null) return capturesFor(state, state.chainFrom);
        const captures = []; for (let i = 0; i < 64; i++) captures.push(...capturesFor(state, i));
        if (captures.length) return captures;
        const moves = []; for (let i = 0; i < 64; i++) moves.push(...movesFor(state, i)); return moves;
    }
    function applyAction(state, action, cache = null) {
        if (!legalActions(state, cache).some(a => a.type === action.type
            && a.from === action.from
            && a.to === action.to
            && (a.type !== "capture" || a.over === action.over))) return null;
        const next = clone(state), piece = next.board[action.from]; next.board[action.from] = null; next.board[action.to] = piece;
        if (action.type === "capture") next.board[action.over] = null;

        const reached = piece.player === 1 ? row(action.to) === 0 : row(action.to) === 7;
        const promoted = !piece.king && reached;
        const continuation = action.type === "capture" && capturesFor(next, action.to);
        if (continuation.length) {
            next.chainFrom = action.to;
        } else {
            // Die Krönung wird erst nach dem vollständigen Zug wirksam.
            if (promoted) piece.king = true;
            next.chainFrom = null;
            next.selected = null;
            next.currentPlayer = 3 - state.currentPlayer;
            next.moves++;
            recordCompletedTurn(next, action, promoted);
        }
        evaluateOutcome(next);
        return next;
    }
    function searchKey(state) {
        // Remis hängt nicht nur von der Stellung ab, sondern auch von
        // Zugzähler und Stellungsverlauf.
        return `${positionKey(state)}|${Number(state.quietMoves) || 0}|${JSON.stringify(state.positionHistory || [])}`;
    }

    function sameAction(first, second) {
        return Boolean(first && second && first.type === second.type
            && first.from === second.from && first.to === second.to
            && (first.type !== "capture" || first.over === second.over));
    }

    function actionsForPlayer(state, player, cache = null) {
        if (!cache) return legalActions(stateForPlayer(state, player));
        if (!cache.playerActions) cache.playerActions = new WeakMap();
        let values = cache.playerActions.get(state);
        if (!values) { values = new Map(); cache.playerActions.set(state, values); }
        if (!values.has(player)) values.set(player, legalActions(stateForPlayer(state, player)));
        return values.get(player);
    }

    function immediateWinningActions(state, player, cache = null) {
        if (cache) {
            if (!cache.immediateWins) cache.immediateWins = new WeakMap();
            let values = cache.immediateWins.get(state);
            if (!values) { values = new Map(); cache.immediateWins.set(state, values); }
            if (values.has(player)) return values.get(player);
            const wins = immediateWinningActionsUncached(state, player, cache);
            values.set(player, wins);
            return wins;
        }
        return immediateWinningActionsUncached(state, player, null);
    }

    function immediateWinningActionsUncached(state, player, cache) {
        const view = state.currentPlayer === player && state.chainFrom !== null
            ? state : stateForPlayer(state, player);
        return legalActions(view, cache).filter(action => completedOutcomes(view, action, cache)
            .some(outcome => outcome.winner === player));
    }

    // Folgeaktionen desselben Spielers gehören zu demselben vollständigen Zug.
    function completedOutcomes(state, action, cache = null) {
        const next = cachedAction(state, action, cache);
        if (!next) return [];
        if (next.winner || next.draw || next.currentPlayer !== state.currentPlayer) return [next];
        return legalActions(next, cache).flatMap(continuation => completedOutcomes(next, continuation, cache));
    }

    function stateForPlayer(state, player) {
        // Nur eine lesende Sicht; applyAction kopiert vor jeder Änderung.
        return { ...state, currentPlayer: player, chainFrom: null, winner: null, draw: false };
    }

    function actionsForPlayerPublic(state, player) { return actionsForPlayer(state, player); }

    function createPlayerProfile(loadStored = true) {
        const profile = {
            totalMoves: 0, gamesAgainstBot: 0, captures: 0, captureChains: 0, chainSteps: 0,
            promotions: 0, menMoves: 0, kingMoves: 0,
            destinations: Array(64).fill(0), sources: Array(64).fill(0),
            phases: { opening: 0, midgame: 0, endgame: 0 },
            style: { aggressive: 0, defensive: 0, risky: 0, careful: 0 },
            mobility: { before: 0, after: 0, improved: 0, reduced: 0 },
            tactics: {
                missedPromotions: 0, allowedCaptures: 0, weakChoices: 0,
                strongCaptures: 0, forcedCaptures: 0, kingCaptures: 0,
                missedWins: 0, winsChosen: 0, missedBlocks: 0, blocksChosen: 0,
                rescuedPieces: 0, avoidableExposures: 0, missedCapturePaths: 0
            },
            directions: { forward: 0, backward: 0, left: 0, right: 0 },
            observationReady: false
        };
        Object.defineProperty(profile, "persist", { value: Boolean(loadStored), enumerable: false });
        if (!loadStored) return profile;
        try {
            const stored = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || "null");
            const merge = (target, source) => {
                if (!target || !source || typeof target !== "object" || typeof source !== "object") return;
                Object.keys(target).forEach(key => {
                    if (!(key in source)) return;
                    if (Array.isArray(target[key])) target[key] = target[key].map((value, index) => Number(source[key]?.[index]) || 0);
                    else if (target[key] && typeof target[key] === "object") merge(target[key], source[key]);
                    else if (typeof target[key] === "number") target[key] = Number(source[key]) || 0;
                    else if (typeof target[key] === "boolean") target[key] = Boolean(source[key]);
                });
            };
            merge(profile, stored);
        } catch (_) {}
        return profile;
    }

    function savePlayerProfile(profile) {
        if (profile?.persist === false) return;
        try { localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
    }

    function clearPlayerProfile(profile = root.deutscheDamePlayerProfile) {
        try { localStorage.removeItem(PLAYER_PROFILE_KEY); } catch (_) {}
        if (!profile) return;
        const fresh = createPlayerProfile(false);
        Object.keys(profile).forEach(key => { profile[key] = fresh[key]; });
    }

    function trackPlayerAction(profile, before, action, after) {
        if (!profile || !before || !action || !after || before.currentPlayer !== 1) return;
        const piece = before.board[action.from] || before.board[action.to];
        const destination = Number.isInteger(action.to) ? action.to : null;
        const source = Number.isInteger(action.from) ? action.from : null;
        const completedTurn = after.currentPlayer !== before.currentPlayer;
        const player = before.currentPlayer;
        const opponent = 3 - player;
        // moves zählt abgeschlossene Halbzüge der aktuellen Partie, nicht
        // die über alle Partien gesammelten Profilzüge.
        const moveNumber = Math.floor((Number(before.moves) || 0) / 2);
        if (completedTurn) {
            profile.totalMoves += 1;
            if (moveNumber < 8) profile.phases.opening += 1;
            else if (moveNumber < 24) profile.phases.midgame += 1;
            else profile.phases.endgame += 1;
        }
        if (destination !== null) profile.destinations[destination] += 1;
        if (source !== null) profile.sources[source] += 1;
        if (source !== null && destination !== null) {
            const rowDelta = row(destination) - row(source);
            const colDelta = col(destination) - col(source);
            if ((player === 1 && rowDelta < 0) || (player === 2 && rowDelta > 0)) profile.directions.forward += 1;
            if ((player === 1 && rowDelta > 0) || (player === 2 && rowDelta < 0)) profile.directions.backward += 1;
            if (colDelta < 0) profile.directions.left += 1;
            if (colDelta > 0) profile.directions.right += 1;
        }
        if (piece?.king) profile.kingMoves += 1; else profile.menMoves += 1;
        if (action.type === "capture") {
            profile.captures += 1;
            if (piece?.king) profile.tactics.kingCaptures += 1;
            if (after.currentPlayer === before.currentPlayer) profile.chainSteps += 1;
            else if (profile.chainSteps > 0) { profile.captureChains += 1; profile.chainSteps = 0; }
        }
        const legalBefore = legalActions(before);
        const legalCaptures = legalBefore.filter(candidate => candidate.type === "capture");
        if (legalCaptures.length === 1 && action.type === "capture") profile.tactics.forcedCaptures += 1;
        // Nur echte Auswahlentscheidungen bewerten; erzwungene automatische
        // Fortsetzungen sind keine selbst gewählte Spielertaktik.
        if (legalBefore.length > 1) {
            const analyses = legalBefore.map(candidate => {
                const outcomes = completedOutcomes(before, candidate);
                return { candidate, outcomes,
                    wins: outcomes.some(result => result.winner === player),
                    safe: outcomes.some(result => result.winner === player || result.draw || !immediateWinningActions(result, opponent).length),
                    exposed: outcomes.every(result => result.board[candidate.to]?.player === player
                        && actionsForPlayer(result, opponent).some(reply => reply.type === "capture" && reply.over === candidate.to)),
                    score: Math.max(...outcomes.map(result => evaluateState(result, player))) };
            });
            const chosen = analyses.find(entry => sameAction(entry.candidate, action));
            if (chosen) {
                if (analyses.some(entry => entry.wins)) {
                    if (!chosen.wins) profile.tactics.missedWins += 1;
                    else if (chosen.outcomes.every(result => result.winner === player)) profile.tactics.winsChosen += 1;
                } else if (analyses.some(entry => entry.safe) && analyses.some(entry => !entry.safe)) {
                    if (!chosen.safe) profile.tactics.missedBlocks += 1;
                    else if (chosen.outcomes.every(result => result.winner === player || result.draw || !immediateWinningActions(result, opponent).length)) profile.tactics.blocksChosen += 1;
                }
                if (chosen.exposed && analyses.some(entry => !entry.exposed)) profile.tactics.avoidableExposures += 1;
                const threatened = actionsForPlayer(before, opponent).some(reply => reply.type === "capture" && reply.over === action.from);
                if (threatened && !chosen.exposed) profile.tactics.rescuedPieces += 1;
                if (action.type === "capture" && Math.max(...analyses.map(entry => entry.score)) - chosen.score >= 80) profile.tactics.missedCapturePaths += 1;
            }
        }
        const reachesPromotion = candidate => {
            const targetRow = row(candidate.to);
            return !before.board[candidate.from]?.king && ((player === 1 && targetRow === 0) || (player === 2 && targetRow === 7));
        };
        if (legalBefore.some(reachesPromotion) && !reachesPromotion(action)) profile.tactics.missedPromotions += 1;
        const candidateScores = legalBefore.map(candidate => {
            const candidateNext = applyAction(before, candidate);
            return candidateNext ? evaluateState(candidateNext, player) : -Infinity;
        });
        const chosenScore = evaluateState(after, player);
        const bestScore = Math.max(...candidateScores);
        if (legalBefore.length > 1 && bestScore - chosenScore >= 80) profile.tactics.weakChoices += 1;
        const bestCaptureScore = legalCaptures.length
            ? Math.max(...legalCaptures.map(candidate => {
                const candidateNext = applyAction(before, candidate);
                return candidateNext ? evaluateState(candidateNext, player) : -Infinity;
            }))
            : -Infinity;
        if (completedTurn && action.type === "capture" && legalCaptures.length > 1
            && chosenScore >= bestCaptureScore - 40
            && !actionsForPlayer(after, opponent).some(candidate => candidate.type === "capture" && candidate.over === destination)) {
            profile.tactics.strongCaptures += 1;
        }
        const promoted = destination !== null && !piece?.king && after.board[destination]?.player === player && after.board[destination]?.king;
        if (promoted) profile.promotions += 1;
        // Während einer Schlagfolge ist der Gegner noch nicht am Zug. Seine
        // Antwortmöglichkeiten und die resultierende Mobilität erst nach
        // dem letzten Sprung bewerten.
        if (!completedTurn) {
            if (action.type === "capture") profile.style.aggressive += 1;
            savePlayerProfile(profile);
            return;
        }
        const opponentCapturesBefore = actionsForPlayer(before, opponent).filter(candidate => candidate.type === "capture").length;
        const opponentActions = actionsForPlayer(after, opponent);
        const opponentCapturesAfter = opponentActions.filter(candidate => candidate.type === "capture").length;
        if (opponentActions.some(candidate => candidate.type === "capture")) profile.tactics.allowedCaptures += 1;
        const beforeMobility = legalBefore.length;
        const afterMobility = actionsForPlayer(after, player).length;
        profile.mobility.before += beforeMobility;
        profile.mobility.after += afterMobility;
        if (afterMobility > beforeMobility) profile.mobility.improved += 1;
        if (afterMobility < beforeMobility) profile.mobility.reduced += 1;
        if (action.type === "capture" || reachesPromotion(action)) profile.style.aggressive += 1;
        if (opponentCapturesAfter < opponentCapturesBefore) profile.style.defensive += 1;
        if (opponentCapturesAfter) profile.style.risky += 1;
        else if (afterMobility >= beforeMobility) profile.style.careful += 1;
        if (completedTurn) profile.observationReady = profile.totalMoves >= 12;
        savePlayerProfile(profile);
    }

    function recordPlayerEvent(profile, event) {
        if (!profile || !profile.tactics[event] && event !== "promotion") return;
        if (event === "promotion") profile.promotions += 1;
        else profile.tactics[event] += 1;
        savePlayerProfile(profile);
    }

    function captureCount(state, player) {
        return actionsForPlayer(state, player).filter(action => action.type === "capture").length;
    }

    function pieceOptions(state, player, cell) {
        const view = stateForPlayer(state, player);
        const captures = capturesFor(view, cell);
        return captures.length ? captures : movesFor(view, cell);
    }

    function continuationLength(state, limit = 12, cache = null) {
        if (!state || state.chainFrom === null || state.winner || state.draw || limit <= 0) return 0;
        const continuations = legalActions(state, cache);
        return continuations.length ? Math.max(...continuations.map(action => 1 + continuationLength(cachedAction(state, action, cache), limit - 1, cache))) : 0;
    }

    function materialBalance(state, player) {
        return state.board.reduce((sum, piece) => sum + (piece ? (piece.player === player ? 1 : -1) * (piece.king ? 185 : 100) : 0), 0);
    }

    // Der Gegner muss bei Schlagzwang schlagen. Für jede gegnerische
    // Schlagfolge wird die beste zulässige eigene Gegenschlagfolge geprüft;
    // der Gegner darf dabei die für uns ungünstigste Fortsetzung wählen.
    function captureExchangeScore(state, player, cache = null) {
        if (!state || state.winner || state.draw || state.currentPlayer !== 3 - player) return 0;
        const replies = legalActions(state, cache).filter(action => action.type === "capture");
        if (!replies.length) return 0;
        const before = materialBalance(state, player);
        let worst = Infinity;
        for (const reply of replies) {
            for (const afterReply of completedOutcomes(state, reply, cache)) {
                if (afterReply.winner === 3 - player) return -80;
                if (afterReply.winner === player || afterReply.draw) { worst = Math.min(worst, 0); continue; }
                const recaptures = legalActions(afterReply, cache).filter(action => action.type === "capture");
                let best = materialBalance(afterReply, player);
                if (recaptures.length) {
                    best = -Infinity;
                    for (const recapture of recaptures) {
                        for (const end of completedOutcomes(afterReply, recapture, cache)) {
                            const balance = end.winner === player ? before + 400 : end.winner === 3 - player ? before - 400 : materialBalance(end, player);
                            best = Math.max(best, balance);
                        }
                    }
                }
                worst = Math.min(worst, best - before);
            }
        }
        return Number.isFinite(worst) ? Math.max(-80, Math.min(80, worst * 0.4)) : 0;
    }

    function evaluateState(state, player, cache = null) {
        if (state.winner) return state.winner === player ? 100000 : -100000;
        if (state.draw) return 0;
        const opponent = 3 - player;
        let score = 0;
        let ownMen = 0, opponentMen = 0, ownKings = 0, opponentKings = 0;
        let formation = 0, kingLines = 0;
        state.board.forEach((piece, cell) => {
            if (!piece) return;
            const own = piece.player === player;
            const value = piece.king ? 185 : 100;
            const progress = piece.king ? 0 : (piece.player === 1 ? 7 - row(cell) : row(cell)) * 4;
            const center = 3.5 - Math.abs(3.5 - col(cell)) + 3.5 - Math.abs(3.5 - row(cell));
            score += (own ? 1 : -1) * (value + progress + center * (piece.king ? 2 : 1));
            const allies = dirs.reduce((count, [dr, dc]) => count + (inside(row(cell) + dr, col(cell) + dc) && state.board[index(row(cell) + dr, col(cell) + dc)]?.player === piece.player ? 1 : 0), 0);
            formation += (own ? 1 : -1) * Math.min(2, allies);
            if (piece.king) kingLines += (own ? 1 : -1) * movesFor(stateForPlayer(state, piece.player), cell).length;
            if (own && piece.king) ownKings += 1;
            else if (!own && piece.king) opponentKings += 1;
            else if (own) ownMen += 1;
            else opponentMen += 1;
        });

        const ownActions = actionsForPlayer(state, player, cache);
        const opponentActions = actionsForPlayer(state, opponent, cache);
        const ownCaptures = ownActions.filter(action => action.type === "capture").length;
        const opponentCaptures = opponentActions.filter(action => action.type === "capture").length;
        const ownExposed = new Set(opponentActions.filter(action => action.type === "capture").map(action => action.over)).size;
        const opponentExposed = new Set(ownActions.filter(action => action.type === "capture").map(action => action.over)).size;
        const ownThreats = immediateWinningActions(state, player, cache).length;
        const opponentThreats = immediateWinningActions(state, opponent, cache).length;
        const ownBlocked = state.board.reduce((count, piece, cell) => count + (piece?.player === player && !pieceOptions(state, player, cell).length ? 1 : 0), 0);
        const opponentBlocked = state.board.reduce((count, piece, cell) => count + (piece?.player === opponent && !pieceOptions(state, opponent, cell).length ? 1 : 0), 0);
        const ownPromotionThreats = state.board.filter((piece, cell) => piece?.player === player && !piece.king
            && (player === 1 ? row(cell) <= 1 : row(cell) >= 6)).length;
        const opponentPromotionThreats = state.board.filter((piece, cell) => piece?.player === opponent && !piece.king
            && (opponent === 1 ? row(cell) <= 1 : row(cell) >= 6)).length;

        score += (ownKings - opponentKings) * 12;
        score += (ownMen - opponentMen) * 2;
        score += (ownActions.length - opponentActions.length) * 4;
        score += (ownCaptures - opponentCaptures) * 28;
        score += (opponentExposed - ownExposed) * 24;
        score += formation * 3 + kingLines * 2;
        score += (ownThreats - opponentThreats) * 600;
        score += (opponentBlocked - ownBlocked) * 16;
        score += (ownPromotionThreats - opponentPromotionThreats) * 42;
        return score;
    }

    function cachedEvaluation(state, player, cache) {
        if (!cache) return evaluateState(state, player);
        if (!cache.evaluations) cache.evaluations = new WeakMap();
        let values = cache.evaluations.get(state);
        if (!values) { values = new Map(); cache.evaluations.set(state, values); }
        if (!values.has(player)) values.set(player, evaluateState(state, player, cache));
        return values.get(player);
    }

    function cachedAction(state, action, cache) {
        if (!cache) return applyAction(state, action);
        if (!cache.nextStates) cache.nextStates = new WeakMap();
        let states = cache.nextStates.get(state);
        if (!states) { states = new Map(); cache.nextStates.set(state, states); }
        const key = `${action.type}|${action.from}|${action.to}|${action.over ?? "-"}`;
        if (!states.has(key)) states.set(key, applyAction(state, action, cache));
        return states.get(key);
    }

    function minimax(state, player, depth, alpha = -Infinity, beta = Infinity, cache = new Map()) {
        if ((depth <= 0 && state.chainFrom === null) || state.winner || state.draw) return cachedEvaluation(state, player, cache);
        const key = `${searchKey(state)}|${player}|${Number(depth).toFixed(3)}`;
        const originalAlpha = alpha, originalBeta = beta;
        const cached = cache.get(key);
        if (cached) {
            if (cached.flag === "exact") return cached.value;
            if (cached.flag === "lower") alpha = Math.max(alpha, cached.value);
            if (cached.flag === "upper") beta = Math.min(beta, cached.value);
            if (alpha >= beta) return cached.value;
        }
        const actions = legalActions(state, cache);
        if (!actions.length) return cachedEvaluation(state, player, cache);
        const maximizing = state.currentPlayer === player;
        let best = maximizing ? -Infinity : Infinity;
        for (const action of actions) {
            const next = cachedAction(state, action, cache);
            if (!next) continue;
            const nextDepth = next.currentPlayer === state.currentPlayer ? depth : depth - 1;
            const score = minimax(next, player, nextDepth, alpha, beta, cache);
            if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
            else { best = Math.min(best, score); beta = Math.min(beta, best); }
            if (beta <= alpha) break;
        }
        const flag = best <= originalAlpha ? "upper" : best >= originalBeta ? "lower" : "exact";
        cache.set(key, { value: best, flag });
        return best;
    }

    function chooseBestAction(state, player, profile = null, randomizeTies = false, sharedCache = null, scoredOutput = null) {
        const cache = sharedCache || new Map();
        const actions = legalActions(state, cache);
        if (!actions.length) return null;
        const lowDepth = Math.max(0, Math.floor(Number(profile?.lowDepth ?? profile?.depth ?? 0)));
        const highDepth = Math.max(lowDepth, Math.ceil(Number(profile?.highDepth ?? profile?.depth ?? 0)));
        const fraction = Math.max(0, Math.min(1, Number(profile?.fraction ?? 0)));
        const curve = Number(profile?.curve ?? 1);
        const scored = actions.map((action, index) => {
            const next = cachedAction(state, action, cache);
            if (!next) return { action, index, score: -Infinity };
            const consumesTurn = next.currentPlayer !== state.currentPlayer;
            const lowScore = minimax(next, player, Math.max(0, lowDepth - (consumesTurn ? 1 : 0)), -Infinity, Infinity, cache);
            const highScore = minimax(next, player, Math.max(0, highDepth - (consumesTurn ? 1 : 0)), -Infinity, Infinity, cache);
            const score = fraction > 0 && highDepth > lowDepth
                ? (root.SharedDifficulty.resolveFractionalDepth(fraction, () => lowScore, () => highScore) ?? lowScore)
                : lowScore;
            return { action, index, score };
        });
        scored.sort((a, b) => b.score - a.score || a.index - b.index);
        if (scoredOutput) scoredOutput.push(...scored);
        if (!randomizeTies) return scored[0]?.action || actions[0];
        return root.SharedDifficulty.selectSoftCandidate(scored, curve, true)?.action || scored[0].action;
    }

    const manualProfiles = root.DeutscheDameSettings.manualStrengths;
    const profileOverrides = {};
    function getManualProfile(level = 1) {
        const numericLevel = Number(level);
        const profileKey = level === "reference" ? "reference" : Number.isInteger(numericLevel) && manualProfiles[numericLevel] ? numericLevel : 1;
        const difficulty = root.SharedDifficulty.createProfile({
            mode: profileKey === "reference" ? "reference" : "manual",
            strength: profileOverrides[profileKey] ?? manualProfiles[profileKey],
            ...root.DeutscheDameSettings.difficulty,
            habitInfluence: root.DeutscheDameSettings.manualHabitInfluence,
            searchConfig: root.DeutscheDameSettings.searchConfig
        });
        return { level: profileKey, ...difficulty };
    }
    function setManualProfileStrength(level, value) {
        const key = Number(level), strength = Number(value);
        if (![1, 2, 3, 4].includes(key) || !Number.isFinite(strength)) return false;
        profileOverrides[key] = Math.max(0, Math.min(0.999, strength));
        return profileOverrides[key];
    }

    function chooseDifficultyAction(state, player, profile, options = {}) {
        const cache = new Map();
        const actions = legalActions(state, cache);
        if (!actions.length) return null;
        const tacticalAccuracy = Math.max(0, Math.min(1, Number(profile?.tacticalAccuracy) || 0));
        const tacticalWeight = 0.3 + tacticalAccuracy * 0.7;
        let minimaxAction = null;
        const openingScores = [];
        const varyOpening = profile?.mode !== "reference" && profile?.curve < 0.999 && Number(state.moves) < 8 && state.chainFrom === null;
        if (Number(profile?.depth) > 0 && Math.random() < Number(profile.searchChance ?? 1)
            && Math.random() >= Number(profile.errorRate || 0)) {
            minimaxAction = chooseBestAction(state, player, profile, false, cache, varyOpening ? openingScores : null);
        }
        const scored = actions.map((action, index) => {
            const next = cachedAction(state, action, cache);
            let score = next ? cachedEvaluation(next, player, cache) : -Infinity;
            if (next?.draw) {
                const material = state.board.reduce((sum, piece) => sum + (piece ? (piece.player === player ? 1 : -1) * (piece.king ? 185 : 100) : 0), 0);
                // Ein Remis ist bei Rückstand attraktiver, bei Vorteil weniger.
                score -= Math.max(-80, Math.min(80, material * 0.15));
            }
            if (next?.winner === player) score += 100000;
            const endings = next && next.currentPlayer === state.currentPlayer && !next.winner && !next.draw ? completedOutcomes(state, action, cache) : next ? [next] : [];
            const winningContinuation = endings.some(result => result.winner === player);
            if (winningContinuation) score += 100000;
            const opponentWinningReply = endings.length && endings.every(result => !result.winner && !result.draw && immediateWinningActions(result, 3 - player, cache).length)
                ? 1 : 0;
            if (opponentWinningReply) score -= 90000 * tacticalWeight * opponentWinningReply;
            if (action.type === "capture") score += 35 * tacticalWeight;
            if (next && next.currentPlayer === state.currentPlayer) score += continuationLength(next, 12, cache) * 45 * tacticalWeight;
            if (action.to !== undefined) {
                const targetRow = row(action.to);
                if ((player === 1 && targetRow === 0) || (player === 2 && targetRow === 7)) score += 90 * tacticalWeight;
            }
            const searchBonus = (500 + Number(profile.curve || 0) * 700) * tacticalWeight;
            if (varyOpening && openingScores.length) {
                const searchResult = openingScores.find(entry => sameAction(entry.action, action));
                const gap = searchResult ? Math.max(0, openingScores[0].score - searchResult.score) : Infinity;
                // Nahe beieinanderliegende Eröffnungszüge erhalten einen
                // abgestuften Suchbonus; schlechte Züge bleiben nachrangig.
                score += searchBonus * Math.max(0, 1 - gap / 60);
            } else if (sameAction(action, minimaxAction)) score += searchBonus;
            if (next && next.currentPlayer !== state.currentPlayer) {
                const replies = actionsForPlayer(next, 3 - player, cache).filter(reply => reply.type === "capture" && reply.over === action.to);
                const exchange = captureExchangeScore(next, player, cache);
                if (exchange < 0) score -= replies.length * 120 * tacticalWeight;
                score += exchange * tacticalWeight;
            }
            if (typeof options.scoreBonus === "function") {
                score += Number(options.scoreBonus(state, action, player, profile, next)) || 0;
            }
            return { action, index, score: score + Math.random() * Number(profile.randomChance || 0) * 40 };
        });
        return root.SharedDifficulty.selectSoftCandidate(scored, profile.curve, true)?.action || actions[0];
    }

    root.deutscheDamePlayerProfile = createPlayerProfile();
    root.DeutscheDameAICore = { initialState, clone, legalActions, applyAction, evaluateOutcome, positionKey, row, col, evaluateState, minimax, chooseBestAction, chooseDifficultyAction, captureExchangeScore, getManualProfile, getManualReferenceProfile: () => getManualProfile("reference"), setManualProfileStrength, clearManualProfileOverrides: () => { for (const key of Object.keys(profileOverrides)) delete profileOverrides[key]; }, createPlayerProfile, savePlayerProfile, clearPlayerProfile, trackPlayerAction, recordPlayerEvent, getActionsForPlayer: actionsForPlayerPublic, immediateWinningActions };
})(window);
