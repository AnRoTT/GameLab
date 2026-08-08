const OthelloBotCore = window.OthelloAICore;

const MANUAL_BOT_WEIGHTS = {
    1: { position: 0, mobility: 0, pieces: 0 },
    2: { position: 1, mobility: 0, pieces: 0 },
    3: { position: 1, mobility: 6, pieces: 1 },
    4: { position: 1, mobility: 12, pieces: 2 }
};

// Die Abstufung folgt bewusst der manuellen Bot-Reihe.
// Das Premium-Profil bleibt davon getrennt und wird später adaptiv gesteuert.
const MANUAL_BOT_CONFIG = {
    1: { minimaxDepth: 0, learnedUsage: 0.10, errorChance: 0.35, randomChance: 0.75 },
    2: { minimaxDepth: 1, learnedUsage: 0.20, errorChance: 0.25, randomChance: 0.40 },
    3: { minimaxDepth: 2, learnedUsage: 0.25, errorChance: 0.12, randomChance: 0.10 },
    4: { minimaxDepth: 3, learnedUsage: 0.10, errorChance: 0.08, randomChance: 0.05 }
};

function getLearnedProfileScore(move) {
    const profile = window.othelloPlayerProfile;
    if (!profile) return 0;

    const index = move.r * 8 + move.c;
    const position = profile.positions;
    const zone = OthelloBotCore.getOthelloZone(move.r, move.c);
    return (position.favorites[index] || 0) * 1.0
        + (position.rowBias[move.r] || 0) * 0.12
        + (position.colBias[move.c] || 0) * 0.12
        + (position.zones[zone] || 0) * 0.25;
}

function chooseLearnedMove(moves, influence = 1) {
    if (!moves.length) return null;

    // Kleine Zufallsstreuung verhindert, dass der Bot immer exakt gleich spielt.
    const scored = moves.map(move => ({
        move,
        score: getLearnedProfileScore(move) * influence + Math.random() * 0.8
    })).sort((a, b) => b.score - a.score);

    const candidateCount = Math.max(1, Math.min(4, Math.ceil(moves.length * (1 - influence * 0.7))));
    return scored[Math.floor(Math.random() * candidateCount)].move;
}

function getOthelloBotMove(level, player = "white") {
    const core = OthelloBotCore;
    const moves = getAllValidMoves(player);
    if (!moves.length) return null;

    const isCorner = core.othelloIsCornerMove;
    const isEdge = core.othelloIsEdgeMove;
    const applyMove = (state, move, p) => core.othelloApplyMoveToState(state, move, p);
    const validMovesForState = (p, state) => core.getAllValidMovesForState(p, state);

    const config = MANUAL_BOT_CONFIG[Math.max(1, Math.min(4, level))];

    // Level 1: lernt bereits, setzt das Profil aber nur sehr schwach ein.
    if (level <= 1) {
        return Math.random() < config.learnedUsage
            ? chooseLearnedMove(moves, 0.2)
            : moves[Math.floor(Math.random() * moves.length)];
    }

    const randomMove = () => moves[Math.floor(Math.random() * moves.length)];
    const corners = moves.filter(isCorner);
    // Eine Ecke ist auf allen höheren Stufen grundsätzlich der beste Zug.
    if (corners.length) {
        return corners[Math.floor(Math.random() * corners.length)];
    }

    const strategicMove = depth => core.othelloChooseMinimaxMove(
        board,
        player,
        depth,
        depth === 1 ? 18 : depth === 2 ? 12 : 10,
        MANUAL_BOT_WEIGHTS[level] || MANUAL_BOT_WEIGHTS[4]
    );

    // Level 2: Minimax-Tiefe 1 plus einfache Positionsregeln.
    if (level === 2) {
        if (Math.random() < config.learnedUsage) return chooseLearnedMove(moves, 0.45);
        if (Math.random() > config.errorChance) {
            const move = strategicMove(config.minimaxDepth);
            if (move) return move;
        }
        const edges = moves.filter(isEdge);
        if (edges.length && Math.random() < 0.65) {
            return edges[Math.floor(Math.random() * edges.length)];
        }
        return randomMove();
    }

    // Level 3: Minimax-Tiefe 2; das Profil wird bei einem Teil der Züge
    // als menschliche Präferenz zugemischt.
    if (level === 3) {
        if (Math.random() < config.learnedUsage) {
            return chooseLearnedMove(moves, 0.65);
        }
        if (Math.random() < config.errorChance) {
            return chooseLearnedMove(moves, 0.35) || randomMove();
        }
        const move = strategicMove(config.minimaxDepth);
        if (move) return move;
        return randomMove();
    }

    // Level 4: Minimax bleibt führend; das Spielerprofil beeinflusst die
    // gelegentlichen unperfekten Züge und macht sie persönlicher.
    if (Math.random() < config.errorChance) {
        return Math.random() < config.learnedUsage / Math.max(config.errorChance, 0.01)
            ? chooseLearnedMove(moves, 0.8) || randomMove()
            : randomMove();
    }

    const minimaxMove = strategicMove(config.minimaxDepth);
    if (minimaxMove) return minimaxMove;
    return randomMove();
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
