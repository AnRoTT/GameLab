(function () {
    "use strict";

    const EMPTY = 0;
    const PLAYERS = Object.freeze({ ONE: 1, TWO: 2 });
    const NO_CAPTURE_HALFMOVES_FOR_DRAW = 100; // 50 Vollzüge: 50 Züge pro Spieler
    const PLAYER_PROFILE_KEY = "andis-game-foundry-muehle-player-profile";
    const PHASES = Object.freeze({ SETUP: "setup", PLACE: "placing", SOURCE: "select-source", TARGET: "select-target", FLY: "flying", REMOVE: "remove-opponent", ROUND_END: "round-ended", MATCH_END: "match-ended", DRAW: "draw" });
    const ADJACENCY = Object.freeze([
        [1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13], [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16], [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22]
    ]);
    const MILLS = Object.freeze([
        [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
        [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]
    ]);
    const MILLS_BY_POINT = Object.freeze(Array.from({ length: 24 }, (_, point) =>
        MILLS.filter(line => line.includes(point))
    ));

    function clone(value) {
        // Mühle-Suchen erzeugen sehr viele Zustände. Eine gezielte Kopie ist
        // deutlich günstiger als JSON-serialisieren und bewahrt trotzdem die
        // vollständige Wiederholungshistorie für die Remisregel.
        if (!value || typeof value !== "object") return value;
        return {
            ...value,
            board: Array.isArray(value.board) ? value.board.slice() : value.board,
            toPlace: value.toPlace ? { ...value.toPlace } : value.toPlace,
            placed: value.placed ? { ...value.placed } : value.placed,
            selectedSource: value.selectedSource,
            selectedTarget: value.selectedTarget,
            millStatus: value.millStatus ? {
                1: value.millStatus[1]?.slice?.() || [],
                2: value.millStatus[2]?.slice?.() || []
            } : value.millStatus,
            history: value.history ? { ...value.history } : {},
            lastAction: value.lastAction ? { ...value.lastAction } : value.lastAction,
            botStatus: value.botStatus ? { ...value.botStatus } : value.botStatus
        };
    }
    function other(player) { return player === PLAYERS.ONE ? PLAYERS.TWO : PLAYERS.ONE; }
    function count(board, player) { return board.reduce((n, value) => n + (value === player ? 1 : 0), 0); }
    function emptyPoints(board) { return board.map((value, point) => value === EMPTY ? point : -1).filter(point => point >= 0); }
    function getMillsForPoint(point) { return isValidPoint(point) ? MILLS_BY_POINT[point] : []; }
    function isMill(board, point, player) { return getMillsForPoint(point).some(line => line.every(index => board[index] === player)); }
    function allMills(board, player) { return MILLS.filter(line => line.every(index => board[index] === player)); }
    function millThreatPoints(board, player) {
        return board.map((value, point) => value === EMPTY && getMillsForPoint(point)
            .some(line => line.filter(index => board[index] === player).length === 2 && line.includes(point)) ? point : -1)
            .filter(point => point >= 0);
    }
    function zwickmuehlen(board, player) {
        // Zwei oder mehr unterschiedliche freie Abschlussfelder bedeuten,
        // dass der Gegner nicht alle Mühlendrohungen in einem Zug blockieren
        // kann. Mehrere Abschlussfelder werden als stärkere Zwickmühle gewertet.
        return millThreatPoints(board, player).length;
    }
    function reopeningMillPressure(board, player) {
        // Eine geschlossene Mühle, deren Stein zugleich eine zweite offene
        // Zweierlinie stützt, ist die Grundlage für Wechsel- und Pendelmühlen.
        // Sie wird getrennt von bloßen freien Abschlussfeldern bewertet.
        let pressure = 0;
        for (const closedLine of allMills(board, player)) {
            for (const point of closedLine) {
                const supportsOpenLine = getMillsForPoint(point).some(line =>
                    line !== closedLine
                    && line.filter(index => board[index] === player).length === 2
                    && line.filter(index => board[index] === EMPTY).length === 1
                );
                if (supportsOpenLine) pressure += 1;
            }
        }
        return pressure;
    }
    function isValidPoint(point) { return Number.isInteger(point) && point >= 0 && point < 24; }
    function canFly(state, player) { return state.placed[player] === 3 && state.toPlace[player] === 0; }

    function createInitialState(startPlayer = PLAYERS.ONE) {
        return {
            board: Array(24).fill(EMPTY), currentPlayer: startPlayer, toPlace: { 1: 9, 2: 9 }, placed: { 1: 0, 2: 0 },
            selectedSource: null, selectedTarget: null, phase: PHASES.PLACE, millStatus: { 1: [], 2: [] },
            removalPending: false, winner: null, draw: false, drawReason: null, roundStatus: "running", matchStatus: "running",
            history: {}, historyHash: 0, noCaptureMoves: 0, moveNumber: 0, lastAction: null, botStatus: { thinking: false, token: 0, mode: null }, timerToken: 0
        };
    }

    function stateKey(state) {
        return [state.board.join(""), state.currentPlayer, state.phase, state.toPlace[1], state.toPlace[2], state.placed[1], state.placed[2]].join("|");
    }

    function historyEntryHash(key, countValue) {
        let hash = 2166136261;
        for (let index = 0; index < key.length; index += 1) {
            hash ^= key.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        hash ^= Number(countValue) || 0;
        hash = Math.imul(hash, 16777619);
        return hash >>> 0;
    }

    function calculateHistoryHash(history) {
        let hash = 0;
        for (const [key, countValue] of Object.entries(history || {})) {
            hash ^= historyEntryHash(key, countValue);
        }
        return hash >>> 0;
    }

    function withHistory(state) {
        // applyAction has already created an isolated state. Mutating its
        // private history avoids a second full-state copy per simulation.
        const key = stateKey(state);
        const previousCount = state.history[key] || 0;
        let hash = Number.isInteger(state.historyHash)
            ? state.historyHash >>> 0
            : calculateHistoryHash(state.history);
        if (previousCount > 0) hash ^= historyEntryHash(key, previousCount);
        const nextCount = previousCount + 1;
        state.history[key] = nextCount;
        hash ^= historyEntryHash(key, nextCount);
        state.historyHash = hash >>> 0;
        return state;
    }

    function legalRemovalPoints(state, player = other(state.currentPlayer)) {
        const occupied = state.board.map((value, point) => value === player ? point : -1).filter(point => point >= 0);
        const outside = occupied.filter(point => !isMill(state.board, point, player));
        return outside.length ? outside : occupied;
    }

    function legalTargets(state, source, player = state.currentPlayer) {
        if (!isValidPoint(source) || state.board[source] !== player) return [];
        if (canFly(state, player)) return emptyPoints(state.board);
        return ADJACENCY[source].filter(point => state.board[point] === EMPTY);
    }

    function getLegalActions(state) {
        if (!state || state.winner || state.draw) return [];
        if (state.phase === PHASES.PLACE) return emptyPoints(state.board).map(point => ({ type: "place", point }));
        if (state.phase === PHASES.REMOVE) return legalRemovalPoints(state).map(point => ({ type: "remove", point }));
        if (state.phase === PHASES.SOURCE || state.phase === PHASES.FLY || state.phase === PHASES.TARGET) {
            if (state.phase === PHASES.TARGET) return legalTargets(state, state.selectedSource).map(to => ({ type: "move", from: state.selectedSource, to }));
            return state.board.map((value, point) => value === state.currentPlayer && legalTargets(state, point).length ? { type: "select", point } : null).filter(Boolean);
        }
        return [];
    }

    function checkEnd(next, playerToCheck = next.currentPlayer) {
        const opponent = playerToCheck;
        if (next.placed[opponent] < 3 && next.toPlace[opponent] === 0) {
            next.winner = other(opponent); next.roundStatus = "ended"; next.phase = PHASES.ROUND_END; return next;
        }
        const sources = next.board.some((value, point) => value === opponent && legalTargets(next, point, opponent).length > 0);
        if (next.toPlace[opponent] === 0 && !sources) {
            next.winner = other(opponent); next.roundStatus = "ended"; next.phase = PHASES.ROUND_END; return next;
        }
        if (next.noCaptureMoves >= NO_CAPTURE_HALFMOVES_FOR_DRAW) {
            next.draw = true; next.drawReason = "no-progress"; next.roundStatus = "draw"; next.phase = PHASES.DRAW; return next;
        }
        const key = stateKey(next);
        if ((next.history[key] || 0) >= 3) {
            next.draw = true; next.drawReason = "repetition"; next.roundStatus = "draw"; next.phase = PHASES.DRAW; return next;
        }
        return next;
    }

    function finishAction(next, player, formedMill) {
        next.lastAction = { player, formedMill };
        next.selectedSource = null; next.selectedTarget = null;
        if (formedMill) { next.removalPending = true; next.phase = PHASES.REMOVE; return withHistory(next); }
        next.currentPlayer = other(player);
        next.moveNumber = (Number(next.moveNumber) || 0) + 1;
        next.phase = next.toPlace[next.currentPlayer] > 0 ? PHASES.PLACE : (canFly(next, next.currentPlayer) ? PHASES.FLY : PHASES.SOURCE);
        return checkEnd(withHistory(next));
    }

    function applyAction(state, action) {
        if (!state || !action || state.winner || state.draw) return null;
        const player = state.currentPlayer;
        if (state.phase === PHASES.PLACE && action.type === "place" && emptyPoints(state.board).includes(action.point)) {
            const next = clone(state); next.board[action.point] = player; next.toPlace[player] -= 1; next.placed[player] += 1;
            const formed = isMill(next.board, action.point, player);
            return finishAction(next, player, formed);
        }
        if ((state.phase === PHASES.SOURCE || state.phase === PHASES.FLY) && action.type === "select" && legalTargets(state, action.point, player).length) {
            const next = clone(state); next.selectedSource = action.point; next.phase = PHASES.TARGET; return next;
        }
        if (state.phase === PHASES.TARGET && action.type === "move" && action.from === state.selectedSource && legalTargets(state, action.from, player).includes(action.to)) {
            const next = clone(state); next.board[action.from] = EMPTY; next.board[action.to] = player; next.selectedTarget = action.to;
            next.noCaptureMoves += 1; const formed = isMill(next.board, action.to, player); return finishAction(next, player, formed);
        }
        if (state.phase === PHASES.REMOVE && action.type === "remove" && legalRemovalPoints(state).includes(action.point)) {
            const next = clone(state); next.board[action.point] = EMPTY; next.placed[other(player)] -= 1; next.removalPending = false; next.noCaptureMoves = 0;
            next.currentPlayer = other(player); next.moveNumber = (Number(next.moveNumber) || 0) + 1; next.phase = next.toPlace[next.currentPlayer] > 0 ? PHASES.PLACE : (canFly(next, next.currentPlayer) ? PHASES.FLY : PHASES.SOURCE);
            return checkEnd(withHistory(next), next.currentPlayer);
        }
        return null;
    }

    function simulate(state, action) { return applyAction(state, action); }
    function actionKey(action) {
        return [action?.type, action?.point, action?.from, action?.to].join("|");
    }
    function createSearchCache() {
        return {
            actions: new Map(),
            nextStates: new Map(),
            evaluations: new Map(),
            immediateWins: new Map(),
            replyAnalyses: new Map(),
            tactical: new Map(),
            transposition: new Map(),
            bestActions: new Map()
        };
    }
    function cachedActions(state, cache) {
        if (!cache) return getLegalActions(state);
        const key = `${searchStateKey(state)}|actions`;
        if (!cache.actions.has(key)) cache.actions.set(key, getLegalActions(state));
        return cache.actions.get(key);
    }
    function cachedSimulation(state, action, cache) {
        if (!cache) return simulate(state, action);
        const key = `${searchStateKey(state)}|next|${actionKey(action)}`;
        if (!cache.nextStates.has(key)) cache.nextStates.set(key, simulate(state, action));
        return cache.nextStates.get(key);
    }
    function actionCompletesImmediateWin(state, action, player, cache = null, continuationDepth = 0) {
        const next = cachedSimulation(state, action, cache);
        if (!next) return false;
        if (next.winner === player) return true;
        if (next.winner || next.draw || next.currentPlayer !== player || continuationDepth >= 2) return false;

        // Auswahl, Zielzug und ein anschließendes Schlagen sind intern mehrere
        // Aktionen, gehören regeltechnisch aber zu genau einem Spielerzug.
        return cachedActions(next, cache).some(followUp =>
            actionCompletesImmediateWin(next, followUp, player, cache, continuationDepth + 1)
        );
    }

    function getImmediateWinningActions(state, player, cache = null) {
        const key = cache ? `${searchStateKey(state)}|wins|${player}` : null;
        if (cache?.immediateWins.has(key)) return cache.immediateWins.get(key);
        const wins = cachedActions(state, cache).filter(action =>
            actionCompletesImmediateWin(state, action, player, cache)
        );
        if (cache) cache.immediateWins.set(key, wins);
        return wins;
    }
    function allowsImmediateWin(state, action, player, cache = null) {
        const next = cachedSimulation(state, action, cache);
        if (!next || next.winner || next.draw) return false;
        const opponent = other(player);
        return getImmediateWinningActions(next, opponent, cache).length > 0;
    }
    function analyzeReplySet(state, action, player, cache = null) {
        const cacheKey = cache ? `${searchStateKey(state)}|replies|${actionKey(action)}|${player}` : null;
        if (cache?.replyAnalyses.has(cacheKey)) return cache.replyAnalyses.get(cacheKey);
        const next = cachedSimulation(state, action, cache);
        if (!next || next.winner || next.draw || next.currentPlayer === player) return null;
        const replies = cachedActions(next, cache);
        if (!replies.length) {
            const empty = { replies, replyOptions: [], ownWinningReplies: 0, ownForkReplies: 0, opponentForkReplies: 0 };
            if (cache) cache.replyAnalyses.set(cacheKey, empty);
            return empty;
        }
        let ownWinningReplies = 0;
        let ownForkReplies = 0;
        let opponentForkReplies = 0;
        const replyOptions = [];
        const includePressure = next.phase === PHASES.SOURCE || next.phase === PHASES.FLY;
        for (const reply of replies) {
            const afterReply = cachedSimulation(next, reply, cache);
            if (!afterReply || afterReply.winner || afterReply.draw) {
                replyOptions.push(0);
                continue;
            }
            if (getImmediateWinningActions(afterReply, player, cache).length) ownWinningReplies += 1;
            if (zwickmuehlen(afterReply.board, player) >= 2) ownForkReplies += 1;
            if (zwickmuehlen(afterReply.board, other(player)) >= 2) opponentForkReplies += 1;
            if (!includePressure) {
                replyOptions.push(0);
                continue;
            }
            const followUps = cachedActions(afterReply, cache).length;
            const opponentMoves = afterReply.board.reduce((sum, value, index) =>
                sum + (value === other(player) ? legalTargets(afterReply, index, other(player)).length : 0), 0);
            const ownMoves = afterReply.board.reduce((sum, value, index) =>
                sum + (value === player ? legalTargets(afterReply, index, player).length : 0), 0);
            replyOptions.push((6 - Math.min(6, followUps)) * 18 + (ownMoves - opponentMoves) * 6);
        }
        const analysis = { replies, replyOptions, ownWinningReplies, ownForkReplies, opponentForkReplies };
        if (cache) cache.replyAnalyses.set(cacheKey, analysis);
        return analysis;
    }
    function removalTacticalValue(state, point, opponent, cache = null) {
        if (!Number.isInteger(point) || state.board[point] !== opponent) return 0;
        const millCount = getMillsForPoint(point).filter(line => line.every(index => state.board[index] === opponent)).length;
        const mobility = legalTargets(state, point, opponent).length;
        const adjacent = ADJACENCY[point].filter(index => state.board[index] === opponent).length;
        const supportLines = getMillsForPoint(point).filter(line =>
            line.filter(index => state.board[index] === opponent).length >= 2
        ).length;
        const next = cachedSimulation(state, { type: "remove", point }, cache);
        if (!next) return 0;
        const own = other(opponent);
        const opponentThreatsBefore = millThreatPoints(state.board, opponent).length;
        const opponentThreatsAfter = millThreatPoints(next.board, opponent).length;
        const ownThreatsBefore = millThreatPoints(state.board, own).length;
        const ownThreatsAfter = millThreatPoints(next.board, own).length;
        const opponentZwickBefore = Math.max(0, zwickmuehlen(state.board, opponent) - 1);
        const opponentZwickAfter = Math.max(0, zwickmuehlen(next.board, opponent) - 1);
        const opponentImmediateWins = getImmediateWinningActions(next, opponent, cache).length;
        const opponentMobilityBefore = state.board.reduce((sum, value, index) =>
            sum + (value === opponent ? legalTargets(state, index, opponent).length : 0), 0);
        const opponentMobilityAfter = next.board.reduce((sum, value, index) =>
            sum + (value === opponent ? legalTargets(next, index, opponent).length : 0), 0);
        const connectedThreatLines = getMillsForPoint(point).filter(line => {
            const values = line.map(index => state.board[index]);
            return values.filter(value => value === opponent).length >= 1
                && values.filter(value => value === own).length === 0
                && values.includes(EMPTY);
        }).length;
        // Das Reduzieren von vier auf drei Steine verschafft dem Gegner die
        // Flugphase. Materialgewinn bleibt wertvoll, darf aber nicht mit einem
        // zusätzlichen Bonus überbewertet werden.
        const enablesFlying = state.placed[opponent] === 4 && next.placed[opponent] === 3;
        return millCount * 220
            + supportLines * 95
            + connectedThreatLines * 55
            + mobility * 10
            + adjacent * 6
            + (opponentMobilityBefore - opponentMobilityAfter) * 18
            + (opponentThreatsBefore - opponentThreatsAfter) * 140
            + (opponentZwickBefore - opponentZwickAfter) * 190
            + (ownThreatsAfter - ownThreatsBefore) * 80
            - (enablesFlying ? 110 : 0)
            - opponentImmediateWins * 260;
    }
    function zugzwangScore(state, action, player, cache = null) {
        const next = cachedSimulation(state, action, cache);
        if (!next || next.winner || next.draw || next.currentPlayer === player) return 0;
        if (next.phase !== PHASES.SOURCE && next.phase !== PHASES.FLY) return 0;
        const analysis = analyzeReplySet(state, action, player, cache);
        if (!analysis?.replies.length) return 240;
        const { replyOptions } = analysis;
        const bestReplyPressure = Math.max(...replyOptions);
        const averageReplyPressure = replyOptions.reduce((sum, value) => sum + value, 0) / replyOptions.length;
        return bestReplyPressure * 0.65 + averageReplyPressure * 0.35;
    }
    function tacticalContinuationScore(state, action, player, cache = null) {
        const next = cachedSimulation(state, action, cache);
        if (!next || next.winner || next.draw || next.currentPlayer === player) return 0;
        const analysis = analyzeReplySet(state, action, player, cache);
        if (!analysis?.replies.length) return 0;
        const { replies, ownWinningReplies, ownForkReplies, opponentForkReplies } = analysis;
        return (ownWinningReplies * 180 + ownForkReplies * 70 - opponentForkReplies * 110) / replies.length;
    }
    function tacticalActionScore(state, action, player, curve = 1, cache = null) {
        const next = cachedSimulation(state, action, cache);
        if (!next) return -Infinity;
        const opponent = other(player);
        const strength = Math.max(0, Math.min(1, Number(curve) || 0));
        let score = 0;
        const ownThreatsBefore = millThreatPoints(state.board, player).length;
        const ownThreatsAfter = millThreatPoints(next.board, player).length;
        const opponentThreatsBefore = millThreatPoints(state.board, opponent).length;
        const opponentThreatsAfter = millThreatPoints(next.board, opponent).length;
        // Mühlen, Drohungen und das Unterbinden gegnerischer Drohungen werden
        // auf höheren Profilen stärker berücksichtigt.
        score += (ownThreatsAfter - ownThreatsBefore) * 48;
        score += (opponentThreatsBefore - opponentThreatsAfter) * 64;
        score += tacticalContinuationScore(state, action, player, cache) * strength;
        score += zugzwangScore(state, action, player, cache) * strength;
        if ((action.type === "place" || action.type === "move")
            && next.lastAction?.formedMill && next.lastAction.player === player) score += 220;
        if (action.type === "remove") score += removalTacticalValue(state, action.point, opponent, cache) * 0.9;
        const phaseFactor = state.phase === PHASES.PLACE ? 0.75 : state.phase === PHASES.FLY ? 1.25 : 1;
        return score * strength * phaseFactor;
    }
    function evaluate(state, player) {
        const opponent = other(player); if (state.winner === player) return 100000; if (state.winner === opponent) return -100000; if (state.draw) return 0;
        const ownMoves = state.board.reduce((n, value, point) => n + (value === player ? legalTargets(state, point, player).length : 0), 0);
        const oppMoves = state.board.reduce((n, value, point) => n + (value === opponent ? legalTargets(state, point, opponent).length : 0), 0);
        const ownMills = allMills(state.board, player).length, oppMills = allMills(state.board, opponent).length;
        const ownThreats = zwickmuehlen(state.board, player);
        const oppThreats = zwickmuehlen(state.board, opponent);
        const ownZwick = Math.max(0, ownThreats - 1);
        const oppZwick = Math.max(0, oppThreats - 1);
        const ownReopeningPressure = reopeningMillPressure(state.board, player);
        const oppReopeningPressure = reopeningMillPressure(state.board, opponent);
        const phaseWeight = state.phase === PHASES.PLACE ? 0.8 : state.phase === PHASES.FLY ? 1.25 : 1;
        const ownMillsValue = ownMills * 100 * phaseWeight;
        const opponentMillsValue = oppMills * 100 * phaseWeight;
        const ownThreatValue = ownThreats * 32 * phaseWeight;
        const opponentThreatValue = oppThreats * 42 * phaseWeight;
        const ownZwickValue = ownZwick * ownZwick * 115 * phaseWeight;
        const opponentZwickValue = oppZwick * oppZwick * 145 * phaseWeight;
        const formedMill = state.lastAction?.formedMill ? (state.lastAction.player === player ? 150 : -150) : 0;
        const blockedOpponent = oppZwick > 0 ? -90 * oppZwick : 0;
        return (state.placed[player] - state.placed[opponent]) * 120
            + (ownMoves - oppMoves) * (state.phase === PHASES.SOURCE || state.phase === PHASES.FLY ? 12 : 8)
            + ownMillsValue - opponentMillsValue
            + ownThreatValue - opponentThreatValue
            + ownZwickValue - opponentZwickValue
            + (ownReopeningPressure - oppReopeningPressure) * 58 * phaseWeight
            + formedMill + blockedOpponent;
    }

    function cachedEvaluation(state, player, cache = null) {
        if (!cache) return evaluate(state, player);
        const key = `${searchStateKey(state)}|${player}`;
        if (!cache.evaluations.has(key)) cache.evaluations.set(key, evaluate(state, player));
        return cache.evaluations.get(key);
    }

    function historyFingerprint(state) {
        return Number.isInteger(state?.historyHash)
            ? state.historyHash >>> 0
            : calculateHistoryHash(state?.history);
    }

    function searchStateKey(state) {
        return [
            state.board.join(""), state.currentPlayer, state.phase,
            state.selectedSource, state.selectedTarget,
            state.toPlace[1], state.toPlace[2], state.placed[1], state.placed[2],
            state.winner, state.draw, state.noCaptureMoves, historyFingerprint(state)
        ].join("|");
    }

    function sameAction(first, second) {
        return Boolean(first && second)
            && first.type === second.type
            && first.point === second.point
            && first.from === second.from
            && first.to === second.to;
    }

    // Eine Mühle-Bewegung besteht intern aus "Stein auswählen" und
    // "Zielpunkt wählen". Für die Suche zählt die Auswahl nicht als eigener
    // Ply, damit die konfigurierte Tiefe vollständige Züge beschreibt.
    function nextSearchDepth(state, next, depth) {
        // Die Tiefe beschreibt vollständige Spielerzüge. Interne Fortsetzungen
        // wie Quellstein wählen oder nach einer Mühle schlagen verbrauchen
        // keine zusätzliche Tiefe; reduziert wird erst beim Spielerwechsel.
        return next?.currentPlayer === state?.currentPlayer ? depth : depth - 1;
    }

    function orderSearchActions(state, actions, cache = null, preferredAction = null) {
        if (actions.length < 2) return actions;
        const actor = state.currentPlayer;
        const opponent = other(actor);
        const stateSearchKey = searchStateKey(state);
        const cacheKey = `${stateSearchKey}|order`;
        let tacticalContext = cache?.tactical.get(cacheKey);
        if (!tacticalContext) {
            tacticalContext = {
                ownThreats: new Set(millThreatPoints(state.board, actor)),
                opponentThreats: new Set(millThreatPoints(state.board, opponent))
            };
            cache?.tactical.set(cacheKey, tacticalContext);
        }

        const scoreAction = action => {
            if (preferredAction && sameAction(action, preferredAction)) return Number.MAX_SAFE_INTEGER;
            const next = cachedSimulation(state, action, cache);
            if (!next) return -Infinity;
            if (next.winner === actor) return 1000000;

            if (action.type === "remove") {
                const point = action.point;
                const millMembership = getMillsForPoint(point)
                    .filter(line => line.every(index => state.board[index] === opponent)).length;
                const supportedLines = getMillsForPoint(point)
                    .filter(line => line.filter(index => state.board[index] === opponent).length >= 2).length;
                return 30000 + millMembership * 4000 + supportedLines * 900
                    + legalTargets(state, point, opponent).length * 80;
            }

            if (action.type === "select") {
                const targets = legalTargets(state, action.point, actor);
                const bestTarget = targets.reduce((best, target) => Math.max(best,
                    (tacticalContext.ownThreats.has(target) ? 12000 : 0)
                    + (tacticalContext.opponentThreats.has(target) ? 7000 : 0)
                    + ADJACENCY[target].length * 20
                ), 0);
                return bestTarget + targets.length * 15;
            }

            const destination = action.type === "move" ? action.to : action.point;
            let score = ADJACENCY[destination]?.length * 20 || 0;
            if (next.lastAction?.formedMill && next.lastAction.player === actor) score += 20000;
            if (tacticalContext.ownThreats.has(destination)) score += 12000;
            if (tacticalContext.opponentThreats.has(destination)) score += 7000;
            return score;
        };

        return actions.map((action, index) => ({ action, index, score: scoreAction(action) }))
            .sort((first, second) => second.score - first.score || first.index - second.index)
            .map(entry => entry.action);
    }

    function minimax(state, player, depth, alpha = -Infinity, beta = Infinity, cache = null) {
        if (depth <= 0 || state.winner || state.draw) {
            return cachedEvaluation(state, player, cache);
        }
        const stateKey = `${searchStateKey(state)}|${player}`;
        const transpositionKey = `${stateKey}|d:${Number(depth).toFixed(4)}`;
        const originalAlpha = alpha;
        const originalBeta = beta;
        const cached = cache?.transposition.get(transpositionKey);
        if (cached) {
            if (cached.flag === "exact") return cached.value;
            if (cached.flag === "lower") alpha = Math.max(alpha, cached.value);
            if (cached.flag === "upper") beta = Math.min(beta, cached.value);
            if (alpha >= beta) return cached.value;
        }
        const actions = cachedActions(state, cache);
        if (!actions.length) return cachedEvaluation(state, player, cache);
        const preferredAction = cache?.bestActions.get(stateKey);
        const orderedActions = orderSearchActions(state, actions, cache, preferredAction);
        const fractionalScore = window.SharedDifficulty.resolveFractionalDepth(
            depth,
            () => cachedEvaluation(state, player, cache),
            () => {
                const current = cachedEvaluation(state, player, cache);
                const maximizing = state.currentPlayer === player;
                const values = orderedActions.map(action => {
                    const next = cachedSimulation(state, action, cache);
                    return next ? cachedEvaluation(next, player, cache) : current;
                });
                return maximizing ? Math.max(...values) : Math.min(...values);
            }
        );
        if (fractionalScore !== null) {
            cache?.transposition.set(transpositionKey, { value: fractionalScore, flag: "exact", depth });
            return fractionalScore;
        }
        const maximizing = state.currentPlayer === player; let best = maximizing ? -Infinity : Infinity;
        let bestAction = null;
        for (const action of orderedActions) {
            const next = cachedSimulation(state, action, cache);
            if (!next) continue;
            const score = minimax(next, player, nextSearchDepth(state, next, depth), alpha, beta, cache);
            if (maximizing) {
                if (score > best) { best = score; bestAction = action; }
                alpha = Math.max(alpha, best);
            } else {
                if (score < best) { best = score; bestAction = action; }
                beta = Math.min(beta, best);
            }
            if (beta <= alpha) break;
        }
        const flag = best <= originalAlpha ? "upper" : best >= originalBeta ? "lower" : "exact";
        cache?.transposition.set(transpositionKey, { value: best, flag, depth });
        if (bestAction) cache?.bestActions.set(stateKey, bestAction);
        return best;
    }

    const plannedTargets = new Map();
    function plannedTargetKey(state, player, depth, randomizeTies, selectionCurve) {
        return `${searchStateKey(state)}|plan|${player}|d:${Number(depth).toFixed(4)}|r:${randomizeTies ? 1 : 0}|c:${Number(selectionCurve).toFixed(4)}`;
    }
    function chooseBestAction(state, player, depth = 2, randomizeTies = true, selectionCurve = 1, sharedCache = null, planFollowUp = true) {
        const cache = sharedCache || createSearchCache();
        const actions = cachedActions(state, cache);
        if (!actions.length) return null;
        if (state.phase === PHASES.TARGET) {
            const planKey = plannedTargetKey(state, player, depth, randomizeTies, selectionCurve);
            const planned = plannedTargets.get(planKey);
            plannedTargets.delete(planKey);
            if (planned && actions.some(action => sameAction(action, planned))) return planned;
        }
        const scoreRoot = searchDepth => actions.map(action => {
            const next = cachedSimulation(state, action, cache);
            const nextDepth = nextSearchDepth(state, next, searchDepth);
            const searchScore = next ? minimax(next, player, Math.max(0, nextDepth), -Infinity, Infinity, cache) : -Infinity;
            const safetyPenalty = allowsImmediateWin(state, action, player, cache)
                ? 900 * Math.max(0, Math.min(1, Number(selectionCurve) || 0))
                : 0;
            return { action, score: searchScore + tacticalActionScore(state, action, player, selectionCurve, cache) - safetyPenalty };
        });
        // Direkt mit der vom Profil vorgegebenen Tiefe suchen. Zusätzliche
        // Vorab-Suchen würden Mühle bei jedem Zug unnötig verlangsamen.
        const scored = scoreRoot(Math.max(0, Number(depth) || 0));
        const immediateWins = getImmediateWinningActions(state, player, cache);
        if (immediateWins.length) {
            const winning = scored.filter(item => immediateWins.some(action => sameAction(action, item.action)));
            const winner = (randomizeTies && winning.length > 1)
                ? winning[Math.floor(Math.random() * winning.length)].action
                : winning[0].action;
            return winner;
        }
        // Ab L3-Niveau werden Züge verworfen, die dem Gegner unmittelbar
        // einen Gewinnzug eröffnen. Die niedrigeren Profile dürfen weiterhin
        // bewusst solche Fehler machen.
        const selected = window.SharedDifficulty.selectSoftCandidate(scored, selectionCurve, randomizeTies);
        const chosen = selected?.action || actions[0];
        if (planFollowUp && chosen?.type === "select") {
            const targetState = cachedSimulation(state, chosen, cache);
            if (targetState?.phase === PHASES.TARGET) {
                const target = chooseBestAction(targetState, player, depth, randomizeTies, selectionCurve, cache);
                if (target) plannedTargets.set(plannedTargetKey(targetState, player, depth, randomizeTies, selectionCurve), target);
            }
        }
        return chosen;
    }

    const difficultyPlannedTargets = new Map();
    function difficultyPlanKey(state, player, difficulty) {
        return `${searchStateKey(state)}|difficulty-plan|${player}|d:${Number(difficulty?.depth || 0).toFixed(4)}|c:${Number(difficulty?.curve || 0).toFixed(4)}`;
    }

    // Gemeinsame Stärke-Pipeline für manuelle und adaptive Bots. Der adaptive
    // Bot kann ausschließlich über scoreBonus einen gelernten Profilanteil
    // ergänzen; Suche, Fehleranteile und Zufall bleiben für beide identisch.
    function chooseDifficultyAction(state, player, difficulty, options = {}) {
        const profile = difficulty || {};
        const cache = options.sharedCache || createSearchCache();
        const scoreBonus = typeof options.scoreBonus === "function" ? options.scoreBonus : null;
        const allowPlan = options.allowPlan !== false;
        const actions = cachedActions(state, cache);
        if (!actions.length) return null;

        if (state.phase === PHASES.TARGET) {
            const key = difficultyPlanKey(state, player, profile);
            const planned = difficultyPlannedTargets.get(key);
            difficultyPlannedTargets.delete(key);
            if (planned && actions.some(action => sameAction(action, planned))) return planned;
        }

        const immediateWins = getImmediateWinningActions(state, player, cache);
        if (immediateWins.length) return immediateWins[Math.floor(Math.random() * immediateWins.length)];

        let minimaxAction = null;
        if (Number(profile.depth) > 0 && Math.random() < Number(profile.searchChance ?? 1)) {
            minimaxAction = chooseBestAction(state, player, profile.depth, true, profile.curve, cache, false);
            if (minimaxAction && Math.random() < Number(profile.errorRate || 0) * 0.35) minimaxAction = null;
        }

        const selectionCurve = Math.max(0, Math.min(1, Number(profile.curve) || 0));
        const randomChance = Math.max(0, Number(profile.randomChance) || 0);
        const scored = actions.map(action => {
            const next = cachedSimulation(state, action, cache);
            let score = next ? cachedEvaluation(next, player, cache) : -Infinity;
            score += tacticalActionScore(state, action, player, selectionCurve, cache);
            if (allowsImmediateWin(state, action, player, cache)) score -= 900 * selectionCurve;
            if (next?.winner === player) score += 100000;
            if ((action.type === "place" || action.type === "move")
                && next?.lastAction?.formedMill && next.lastAction.player === player) score += 180;
            if (sameAction(action, minimaxAction)) score += 600 + selectionCurve * 900;
            if (scoreBonus) score += Number(scoreBonus(state, action, player, profile, cache)) || 0;
            return { action, score: score + Math.random() * randomChance * 30 };
        });
        const chosen = window.SharedDifficulty.selectSoftCandidate(scored, selectionCurve, true)?.action || actions[0];

        if (allowPlan && chosen?.type === "select") {
            const targetState = cachedSimulation(state, chosen, cache);
            if (targetState?.phase === PHASES.TARGET) {
                const target = chooseDifficultyAction(targetState, player, profile, {
                    sharedCache: cache,
                    scoreBonus,
                    allowPlan: false
                });
                if (target) difficultyPlannedTargets.set(difficultyPlanKey(targetState, player, profile), target);
            }
        }
        return chosen;
    }

    const MANUAL_PROFILES = window.MuehleSettings.manualStrengths;

    const profileOverrides = {};
    function getManualProfile(level = 1) {
        const numericLevel = Number(level);
        const normalizedLevel = String(level).toLowerCase();
        const profileKey = normalizedLevel === "reference" || normalizedLevel === "referenz"
            ? "reference"
            : (Number.isInteger(numericLevel) && MANUAL_PROFILES[numericLevel] ? numericLevel : 1);
        const base = MANUAL_PROFILES[profileKey];
        // MuehleSettings.manualStrengths enthält direkte Zahlenwerte, keine
        // Objekte mit einer .strength-Eigenschaft.
        const baseStrength = typeof base === "number" ? base : base?.strength;
        const strength = profileKey === "reference" ? baseStrength : (profileOverrides[profileKey] ?? baseStrength);
        const difficulty = window.SharedDifficulty.createProfile({ mode: "manual", strength, ...window.MuehleSettings.difficulty, habitInfluence: window.MuehleSettings.manualHabitInfluence, searchConfig: window.MuehleSettings.searchConfig });
        return { level: profileKey === "reference" ? "reference" : Number(profileKey), ...difficulty };
    }
    function setManualProfileStrength(level, value) {
        const normalizedLevel = String(level).toLowerCase();
        if (normalizedLevel === "reference" || normalizedLevel === "referenz") {
            const reference = MANUAL_PROFILES.reference;
            return typeof reference === "number" ? reference : reference?.strength;
        }
        profileOverrides[level] = Math.max(0, Math.min(0.999, Number(value) || 0));
        return profileOverrides[level];
    }
    function createPlayerProfile(loadStored = true) {
        const profile = {
            totalMoves: 0, placements: 0, moves: 0, removals: 0,
            points: Array(24).fill(0), sourcePoints: Array(24).fill(0), targetPoints: Array(24).fill(0),
            opening: { points: Array(24).fill(0), moves: 0 },
            phases: { placing: 0, moving: 0, flying: 0, removal: 0 },
            mobility: { before: 0, after: 0, preserved: 0, reduced: 0, improved: 0 },
            style: { offensive: 0, defensive: 0, risky: 0, careful: 0 },
            tactics: {
                mills: 0, setupMills: 0, movementMills: 0, reopenedMills: 0,
                zwickmuehlen: 0, blockedZwickmuehlen: 0, captures: 0,
                qualityRemovals: 0, missedBlocks: 0, missedWins: 0
            },
            patterns: {
                millLines: Array(MILLS.length).fill(0),
                threatPoints: Array(24).fill(0),
                supportPoints: Array(24).fill(0)
            },
            observationReady: false
        };
        Object.defineProperty(profile, "persist", { value: Boolean(loadStored), enumerable: false, writable: false });
        if (!loadStored) return profile;
        try {
            const stored = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || "null");
            const merge = (target, source) => {
                if (!target || !source || typeof target !== "object" || typeof source !== "object") return target;
                Object.keys(target).forEach(key => {
                    if (!(key in source)) return;
                    if (Array.isArray(target[key])) {
                        target[key] = target[key].map((value, index) => Number.isFinite(Number(source[key]?.[index])) ? Number(source[key][index]) : value);
                    } else if (target[key] && typeof target[key] === "object") {
                        merge(target[key], source[key]);
                    } else if (typeof target[key] === "number" && Number.isFinite(Number(source[key]))) {
                        target[key] = Number(source[key]);
                    } else if (typeof target[key] === "boolean") {
                        target[key] = Boolean(source[key]);
                    }
                });
                return target;
            };
            return merge(profile, stored) || profile;
        } catch (_) { return profile; }
    }
    function savePlayerProfile(profile) {
        if (!profile || profile.persist === false) return;
        try { localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
    }
    function profilePhase(phase) {
        if (phase === PHASES.PLACE) return "placing";
        if (phase === PHASES.FLY) return "flying";
        if (phase === PHASES.REMOVE) return "removal";
        if (phase === PHASES.SOURCE || phase === PHASES.TARGET) return "moving";
        return null;
    }
    function playerMobility(state, player) {
        if (!state?.board) return 0;
        return state.board.reduce((total, value, point) => total + (value === player ? legalTargets(state, point, player).length : 0), 0);
    }
    function trackPlayerAction(profile, state, action, next, options = {}) {
        if (!profile || !state || !action || !next) return;
        // Die Quellenauswahl ist nur eine UI-Teilaktion. Für Beobachtung und
        // Adaptivität zählen vollständige Platzierungs- oder Bewegungszüge.
        if (action.type === "select") return;
        const player = state.currentPlayer;
        const destination = action.type === "move" ? action.to : action.point;
        const source = action.type === "move" ? action.from : null;
        const phase = profilePhase(state.phase);
        const opponent = other(player);
        const ownThreatsBefore = millThreatPoints(state.board, player).length;
        const ownThreatsAfter = millThreatPoints(next.board, player).length;
        const opponentThreatsBefore = millThreatPoints(state.board, opponent).length;
        const opponentThreatsAfter = millThreatPoints(next.board, opponent).length;
        const ownZwickBefore = zwickmuehlen(state.board, player);
        const ownZwickAfter = zwickmuehlen(next.board, player);
        const opponentZwickBefore = zwickmuehlen(state.board, opponent);
        const opponentZwickAfter = zwickmuehlen(next.board, opponent);
        const patterns = profile.patterns || (profile.patterns = {
            millLines: Array(MILLS.length).fill(0),
            threatPoints: Array(24).fill(0),
            supportPoints: Array(24).fill(0)
        });
        if (action.type === "place" || action.type === "move") profile.totalMoves += 1;
        if (action.type === "place") profile.placements += 1;
        if (action.type === "move") profile.moves += 1;
        if (action.type === "remove") profile.removals += 1;
        if (Number.isInteger(destination)) {
            profile.points[destination] += 1;
            if (phase === "placing") profile.opening.points[destination] += 1;
        }
        if (Number.isInteger(source)) profile.sourcePoints[source] += 1;
        if (Number.isInteger(destination) && action.type === "move") profile.targetPoints[destination] += 1;
        if (phase && profile.phases[phase] !== undefined) profile.phases[phase] += 1;
        if (phase === "placing") profile.opening.moves += 1;
        const formedMill = (action.type === "place" || action.type === "move")
            && next?.lastAction?.player === player && next?.lastAction?.formedMill;
        if (formedMill) {
            profile.tactics.mills += 1;
            if (phase === "placing") profile.tactics.setupMills += 1;
            if (phase === "moving" || phase === "flying") profile.tactics.movementMills += 1;
            if (action.type === "move" && Number.isInteger(source) && isMill(state.board, source, player)) {
                profile.tactics.reopenedMills += 1;
            }
            profile.style.offensive += 1;
        }
        if (ownZwickAfter >= 2 && ownZwickBefore < 2) profile.tactics.zwickmuehlen += 1;
        if (opponentZwickBefore >= 2 && opponentZwickAfter < 2) profile.tactics.blockedZwickmuehlen += 1;
        if (action.type === "remove") {
            profile.tactics.captures += 1;
            const opponentMobilityBefore = playerMobility(state, opponent);
            const opponentMobilityAfter = playerMobility(next, opponent);
            if (opponentThreatsAfter < opponentThreatsBefore
                || opponentZwickAfter < opponentZwickBefore
                || opponentMobilityAfter < opponentMobilityBefore) {
                profile.tactics.qualityRemovals += 1;
            }
        }
        if (action.type === "place" || action.type === "move" || action.type === "remove") {
            MILLS.forEach((line, lineIndex) => {
                const ownPoints = line.filter(index => next.board[index] === player);
                const empty = line.filter(index => next.board[index] === EMPTY);
                if (ownPoints.length >= 2 && empty.length) {
                    patterns.millLines[lineIndex] += 1;
                    ownPoints.forEach(index => { patterns.supportPoints[index] += 1; });
                    empty.forEach(index => { patterns.threatPoints[index] += 1; });
                }
            });
        }
        const beforeMobility = playerMobility(state, player);
        const afterMobility = playerMobility(next, player);
        profile.mobility.before += beforeMobility;
        profile.mobility.after += afterMobility;
        if (afterMobility < beforeMobility) {
            profile.mobility.reduced += 1;
            profile.style.risky += 1;
        } else if (afterMobility > beforeMobility) {
            profile.mobility.improved += 1;
            profile.style.careful += 1;
        } else {
            profile.mobility.preserved += 1;
        }
        profile.observationReady = profile.totalMoves >= 12;
        if (!options.deferSave) savePlayerProfile(profile);
    }
    function clearPlayerProfile(profile) {
        try { localStorage.removeItem(PLAYER_PROFILE_KEY); } catch (_) {}
        if (!profile) return createPlayerProfile();
        const persist = profile.persist !== false;
        const fresh = createPlayerProfile(persist);
        Object.keys(profile).forEach(key => delete profile[key]);
        Object.assign(profile, fresh);
        return profile;
    }

    window.MuehleAICore = Object.freeze({ EMPTY, PLAYERS, PHASES, ADJACENCY, MILLS, NO_CAPTURE_HALFMOVES_FOR_DRAW, createInitialState, cloneState: clone, stateKey, getMillsForPoint, isMill, allMills, millThreatPoints, zwickmuehlen, canFly, legalTargets, legalRemovalPoints, getLegalActions, getCachedLegalActions: cachedActions, getImmediateWinningActions, allowsImmediateWin, tacticalActionScore, applyAction, simulate, simulateCached: cachedSimulation, evaluate, evaluateCached: cachedEvaluation, createSearchCache, chooseBestAction, chooseBestActionDeterministic: (state, player, depth = 2) => chooseBestAction(state, player, depth, false), chooseDifficultyAction, getManualProfile, getManualReferenceProfile: () => getManualProfile("reference"), setManualProfileStrength, createPlayerProfile, trackPlayerAction, clearPlayerProfile });
})();
