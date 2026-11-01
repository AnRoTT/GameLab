const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(game, files, exportName) {
    const context = { window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, console };
    vm.createContext(context);
    const settings = path.join(__dirname, "..", game, "settings.js");
    if (fs.existsSync(settings)) vm.runInContext(fs.readFileSync(settings, "utf8"), context, { filename: `${game}/settings.js` });
    for (const file of files) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, "..", game, file), "utf8"), context, { filename: `${game}/${file}` });
    }
    return context.window[exportName];
}

{
    const core = load("TicTacToe", ["aiCore.js"], "TicTacToeAICore");
    for (const line of [[0, 1, 2], [0, 3, 6], [0, 4, 8], [2, 4, 6]]) {
        const board = Array(9).fill(null);
        line.forEach(index => { board[index] = "X"; });
        assert.ok(core.checkWin("X", board));
        assert.equal(core.checkWin("O", board), null);
        assert.ok(!core.getFreeCells(board).includes(line[0]));
    }
    const draw = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    assert.equal(core.checkWin("X", draw), null);
    assert.equal(core.checkWin("O", draw), null);
    assert.equal(core.getFreeCells(draw).length, 0);
    console.log("PASS TicTacToe: Gewinnlinien, freie Felder, Remisstellung");
}

{
    const core = load("4Gewinnt", ["aiCore.js"], "ConnectFourAICore");
    const blank = () => Array.from({ length: 6 }, () => Array(7).fill(0));
    let board = blank();
    let move = core.applyMove(board, 0, 1);
    assert.equal(move.row, 5);
    assert.equal(board[5][0], 0);
    for (let i = 0; i < 6; i++) { move = core.applyMove(board, 0, i % 2 + 1); board = move.board; }
    assert.equal(core.applyMove(board, 0, 1), null);
    for (const cells of [
        [[5,0],[5,1],[5,2],[5,3]], [[5,0],[4,0],[3,0],[2,0]],
        [[5,0],[4,1],[3,2],[2,3]], [[5,6],[4,5],[3,4],[2,3]]
    ]) {
        board = blank(); cells.forEach(([r,c]) => { board[r][c] = 1; });
        assert.equal(core.findWinner(board).player, 1);
    }
    board = [[2,2,2,1,2,1,1],[1,2,1,1,2,2,2],[1,1,1,2,1,1,1],[2,2,1,2,2,2,1],[1,1,2,2,1,2,2],[2,1,2,1,2,1,1]];
    assert.equal(core.isBoardFull(board), true);
    assert.equal(core.findWinner(board), null);
    console.log("PASS 4 Gewinnt: Schwerkraft, volle Spalte, Gewinnrichtungen, Remisstellung");
}

{
    const core = load("Muehle", ["aiCore.js"], "MuehleAICore");
    let state = core.createInitialState();
    for (const point of [0, 3, 1, 4, 2]) {
        state = core.applyAction(state, { type: "place", point });
        assert.ok(state);
    }
    assert.equal(state.phase, core.PHASES.REMOVE);
    assert.equal(state.currentPlayer, 1);
    assert.equal(core.applyAction(state, { type: "remove", point: 0 }), null);
    state = core.applyAction(state, { type: "remove", point: 3 });
    assert.equal(state.currentPlayer, 2);
    assert.equal(state.board[3], 0);
    const removal = core.createInitialState();
    [0, 1, 2].forEach(point => { removal.board[point] = 1; });
    [3, 4, 5, 9].forEach(point => { removal.board[point] = 2; });
    removal.placed = { 1: 3, 2: 4 }; removal.toPlace = { 1: 0, 2: 0 };
    removal.phase = core.PHASES.REMOVE;
    assert.equal(core.applyAction(removal, { type: "remove", point: 3 }), null);
    assert.ok(core.applyAction(removal, { type: "remove", point: 9 }));
    removal.board[9] = 0; removal.placed[2] = 3;
    const win = core.applyAction(removal, { type: "remove", point: 3 });
    assert.equal(win.winner, 1);
    const blocked = core.createInitialState();
    [1, 9, 14, 22].forEach(point => { blocked.board[point] = 1; });
    [0, 2, 21, 23].forEach(point => { blocked.board[point] = 2; });
    blocked.placed = { 1: 4, 2: 4 }; blocked.toPlace = { 1: 1, 2: 0 };
    assert.equal(core.applyAction(blocked, { type: "place", point: 6 }).winner, 1);
    const flying = core.createInitialState();
    [0, 1, 9].forEach(point => { flying.board[point] = 1; });
    flying.placed[1] = 3; flying.toPlace[1] = 0;
    assert.equal(core.canFly(flying, 1), true);
    assert.ok(core.legalTargets(flying, 0).includes(23));
    console.log("PASS Mühle: Entfernen, geschützte Steine, Spielende und Fliegen");
}

{
    const core = load("Othello", ["aiCore.js"], "OthelloAICore");
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[3][3] = "white"; board[3][4] = "black";
    board[4][3] = "black"; board[4][4] = "white";
    assert.equal(core.isValidMoveState(2, 3, "black", board), true);
    assert.equal(core.applyMove(board, { r: 0, c: 0 }, "black"), null);
    const next = core.applyMove(board, { r: 2, c: 3 }, "black");
    assert.equal(next.board[3][3], "black");
    assert.equal(board[3][3], "white");
    const pass = Array.from({ length: 8 }, () => Array(8).fill("black"));
    pass[0][0] = null; pass[0][1] = "white";
    assert.equal(core.getAllValidMovesForState("white", pass).length, 0);
    assert.ok(core.getAllValidMovesForState("black", pass).length > 0);
    pass[0][0] = "black";
    assert.equal(core.getAllValidMovesForState("black", pass).length, 0);
    assert.equal(core.getAllValidMovesForState("white", pass).length, 0);
    console.log("PASS Othello: legale Züge, Wenden und Passstellungen");
}

{
    const core = load("Quarto", ["aiCore.js"], "QuartoAICore");
    const board = Array(16).fill(null);
    let state = core.createInitialState(board, Array.from({ length: 16 }, (_, i) => i), 0);
    state = core.selectPiece(state, 2);
    assert.equal(state.chooser, 0);
    assert.equal(core.selectPiece(state, 3), null);
    state = core.placePiece(state, 0);
    assert.equal(state.lastPlacer, 1);
    assert.equal(state.chooser, 1);
    assert.ok(!state.remainingPieces.includes(2));
    assert.equal(core.placePiece(core.selectPiece(state, 3), 0), null);
    const winning = Array(16).fill(null);
    [0, 2, 4, 6].forEach((piece, index) => { winning[index] = piece; });
    assert.ok(core.findWinningLine(winning));
    winning[3] = null;
    const finish = core.createInitialState(winning, [], 0, 6);
    assert.equal(core.placePiece(finish, 3).winner, 1);
    const draw = [12,14,7,1,6,3,0,15,11,13,9,4,2,10,5,8];
    assert.equal(core.findWinningLine(draw), null);
    assert.equal(core.isTerminal(core.createInitialState(draw, [], 0)), true);
    const finalPiece = draw[15];
    const almostFull = draw.slice(); almostFull[15] = null;
    const finalMove = core.placePiece(core.createInitialState(almostFull, [], 0, finalPiece), 15);
    assert.equal(finalMove.winner, null);
    assert.equal(core.isTerminal(finalMove), true);
    console.log("PASS Quarto: Übergabe, Platzierung, Gewinn und Remisstellung");
}

{
    const solver = load("Sudoku", ["solver.js"], "SudokuSolver");
    const solution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179".split("").map(Number);
    const puzzle = solution.slice(); puzzle[0] = 0;
    assert.equal(solver.isValidGrid(solution), true);
    assert.equal(solver.countSolutions(puzzle.slice(), 2), 1);
    assert.equal(solver.solve(puzzle)[0], 5);
    assert.equal(solver.isValidPlacement(puzzle, 0, 5), true);
    assert.equal(solver.isValidPlacement(puzzle, 0, 3), false);
    const invalid = solution.slice(); invalid[0] = invalid[1];
    assert.equal(solver.isValidGrid(invalid), false);
    const source = fs.readFileSync(path.join(__dirname, "..", "Sudoku", "game.js"), "utf8");
    function actual(name) {
        const start = source.indexOf(`function ${name}(`);
        const opening = source.indexOf("{", start);
        let depth = 0;
        for (let i = opening; i < source.length; i++) {
            if (source[i] === "{") depth++;
            else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
        }
        throw Error(name);
    }
    const context = vm.createContext({
        state: { puzzle: solution.slice(), values: solution.slice(), solution: solution.slice(), mode: "generated", preview: false, completed: false },
        selected: 0, notesMode: false
    });
    for (const name of ["isGiven", "isComplete", "isCustomEditable", "enterNumber"]) vm.runInContext(actual(name), context);
    assert.equal(context.isComplete(), true);
    context.state.values[0] = 0;
    assert.equal(context.isComplete(), false);
    context.state.values[0] = 1;
    assert.equal(context.isComplete(), false);
    context.state.values[0] = solution[0];
    context.enterNumber(3);
    assert.equal(context.state.values[0], solution[0]);
    console.log("PASS Sudoku: Lösung, Widerspruch, Vollständigkeit und geschützte Vorgabe");
}

require("../DeutscheDame/tests/rules-regression.cjs");
console.log("PASS: Regelprüfungen aller sieben Spiele");
