const OthelloBotCore = window.OthelloAICore;

const othelloBotDiagnostics = Object.create(null);
function resetOthelloBotDiagnostics() {
    Object.keys(othelloBotDiagnostics).forEach(key => delete othelloBotDiagnostics[key]);
}
function recordOthelloBotDiagnostic(level, config, branch) {
    const key = String(level);
    const entry = othelloBotDiagnostics[key] || (othelloBotDiagnostics[key] = {
        calls: 0, minimax: 0, random: 0, learned: 0, edge: 0, corner: 0,
        strength: config.strength, curve: config.curve, depth: config.depth,
        searchChance: config.searchChance, randomChance: config.randomChance,
        errorRate: config.errorRate
    });
    entry.calls += 1;
    entry[branch] = (entry[branch] || 0) + 1;
}

// Die Abstufung folgt bewusst der manuellen Bot-Reihe.
// Das Premium-Profil bleibt davon getrennt und wird später adaptiv gesteuert.
function getLearnedProfileScore(move, playerProfile = window.othelloPlayerProfile) {
    const profile = playerProfile;
    if (!profile) return 0;

    const index = move.r * 8 + move.c;
    const position = profile.positions;
    const zone = OthelloBotCore.getOthelloZone(move.r, move.c);
    return (position.favorites[index] || 0) * 1.0
        + (position.rowBias[move.r] || 0) * 0.12
        + (position.colBias[move.c] || 0) * 0.12
        + (position.zones[zone] || 0) * 0.25;
}

function chooseLearnedMove(moves, influence = 1, playerProfile = window.othelloPlayerProfile) {
    if (!moves.length) return null;

    // Kleine Zufallsstreuung verhindert, dass der Bot immer exakt gleich spielt.
    const scored = moves.map(move => ({
        move,
        score: getLearnedProfileScore(move, playerProfile) * influence + Math.random() * 0.8
    })).sort((a, b) => b.score - a.score);

    const candidateCount = influence >= 0.95
        ? 1
        : Math.max(1, Math.min(4, Math.ceil(moves.length * (1 - influence * 0.7))));
    return scored[Math.floor(Math.random() * candidateCount)].move;
}

function getOthelloBotMove(level, player = "white", stateBoard = null, playerProfile = null) {
    const core = OthelloBotCore;
    const activeBoard = stateBoard || (typeof board !== "undefined" ? board : null);
    if (!activeBoard) return null;
    const effectiveProfile = stateBoard ? playerProfile : window.othelloPlayerProfile;
    const moves = core.getAllValidMovesForState(player, activeBoard);
    if (!moves.length) return null;

    const isCorner = core.othelloIsCornerMove;
    const isEdge = core.othelloIsEdgeMove;
    const applyMove = (state, move, p) => core.othelloApplyMoveToState(state, move, p);
    const validMovesForState = (p, state) => core.getAllValidMovesForState(p, state);

    const config = OthelloBotCore.getManualProfile(level);
    const strategicMove = depth => core.othelloChooseMinimaxMove(
        activeBoard,
        player,
        depth,
        config.randomChance * 35,
        config.weights
    );

    const randomMove = () => moves[Math.floor(Math.random() * moves.length)];
    const corners = moves.filter(isCorner);

    // Minimax ist immer der erste Entscheidungszweig. Die Difficulty-Kurve
    // steuert nur, ob die Suche erfolgreich verwendet wird; taktische,
    // zufällige und gelernte Fallbacks kommen erst danach.
    if (
        config.depth > 0 &&
        Math.random() >= config.errorRate &&
        Math.random() < config.searchChance
    ) {
        const minimaxMove = strategicMove(config.depth);
        if (minimaxMove) {
            recordOthelloBotDiagnostic(level, config, "minimax");
            return minimaxMove;
        }
    }

    if (Math.random() < config.randomChance) {
        recordOthelloBotDiagnostic(level, config, "random");
        return randomMove();
    }

    if (effectiveProfile && Math.random() < config.learnedUsage) {
        const learnedInfluence = 0.2 + config.curve * 0.6;
        recordOthelloBotDiagnostic(level, config, "learned");
        return chooseLearnedMove(moves, learnedInfluence, effectiveProfile);
    }

    const edges = moves.filter(isEdge);
    if (edges.length && Math.random() < config.edgeChance) {
        recordOthelloBotDiagnostic(level, config, "edge");
        return edges[Math.floor(Math.random() * edges.length)];
    }
    if (corners.length && Math.random() < config.cornerChance) {
        const cornerIndex = config.randomChance === 0
            ? 0
            : Math.floor(Math.random() * corners.length);
        recordOthelloBotDiagnostic(level, config, "corner");
        return corners[cornerIndex];
    }
    recordOthelloBotDiagnostic(level, config, "random");
    return randomMove();
}

function getOthelloBotMoveForState({ board, level = 1, player = "white", playerProfile = null }) {
    return getOthelloBotMove(level, player, board, playerProfile);
}

function getOthelloBotThinkTime(level, player = "white") {
    const clampedLevel = Math.max(1, Math.min(4, Math.round(level || 1)));
    const ranges = {
        1: [250, 500],
        2: [450, 800],
        3: [700, 1100],
        4: [950, 1500]
    };
    const [min, max] = ranges[clampedLevel];
    const availableMoves = typeof getAllValidMoves === "function"
        ? getAllValidMoves(player).length
        : 0;

    // Viele Möglichkeiten brauchen etwas mehr Auswahlzeit; sehr wenige
    // Züge wirken eher wie eine schnelle, aber angespannte Entscheidung.
    const positionComplexity = Math.max(-70, Math.min(180, (availableMoves - 5) * 18));
    const naturalVariation = (Math.random() - 0.5) * 140;
    const occasionalHesitation = Math.random() < 0.12 ? 80 + Math.random() * 140 : 0;

    return Math.round(Math.max(
        min,
        Math.min(max + 180, min + Math.random() * (max - min) + positionComplexity + naturalVariation + occasionalHesitation)
    ));
}

// Public adapter API for the game and the Bot-Labor.
window.getOthelloBotMoveForState = getOthelloBotMoveForState;
window.resetOthelloBotDiagnostics = resetOthelloBotDiagnostics;
window.getOthelloBotDiagnostics = () => JSON.parse(JSON.stringify(othelloBotDiagnostics));
window.getOthelloBotThinkTime = getOthelloBotThinkTime;
