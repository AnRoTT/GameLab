const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extract(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, name);
    let depth = 0;
    for (let i = source.indexOf("{", start); i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
    }
    throw Error(name);
}
function validator(game, extra = {}, name = "isValidSavedState") {
    const source = fs.readFileSync(path.join(__dirname, "..", game, "game.js"), "utf8");
    const context = vm.createContext({ ...extra });
    vm.runInContext(extract(source, name), context);
    return value => Boolean(context[name](value));
}
function check(name, valid, state, bad) {
    assert.equal(valid(state), true, `${name}: gültiger Spielstand`);
    for (const corrupt of bad) {
        const changed = structuredClone(state);
        corrupt(changed);
        assert.equal(valid(changed), false, `${name}: beschädigter Spielstand`);
    }
}

check("TicTacToe", validator("TicTacToe"), { gameId: "tictactoe", cells: Array(9).fill(null), current: "X" },
    [s => { s.cells[0] = "X"; s.cells[1] = "X"; }, s => { s.cells[0] = "Z"; }, s => { s.roundsPlayed = -1; }]);
check("4Gewinnt", validator("4Gewinnt", { ROWS: 6, COLS: 7, PLAYER_RED: 1, PLAYER_YELLOW: 2, MODE_OPTIONS: [0, 1], MATCH_OPTIONS: [0, 1] }),
    { gameId: "connect-four", board: Array.from({ length: 6 }, () => Array(7).fill(0)), currentPlayer: 1, startingPlayer: 1, scores: { 1: 0, 2: 0 }, modeIndex: 0, matchModeIndex: 0, matchActive: true },
    [s => { s.board[2][0] = 1; }, s => { s.scores[1] = -1; }]);
check("Muehle", validator("Muehle"), { gameId: "muehle", state: { board: Array(24).fill(0), currentPlayer: 1, phase: "placing", placed: { 1: 0, 2: 0 }, toPlace: { 1: 9, 2: 9 } }, settings: { mode: "human", botType: "manual", match: "single", botLevel: 1, speed: "normal" } },
    [s => { s.state.phase = "kaputt"; }, s => { s.state.placed[1] = 1; }, s => { s.state.phase = "select-target"; s.state.selectedSource = 0; }]);
check("Quarto", validator("Quarto", { MATCH_OPTIONS: [0, 1], BOT_LEVELS: [0], ADAPT_SPEEDS: [0] }),
    { gameId: "quarto", board: Array(16).fill(null), remainingPieces: Array.from({ length: 16 }, (_, i) => i), selectedPiece: null, chooser: 0, startingChooser: 0, matchModeIndex: 0, settings: { onePlayer: false, botLevelIndex: 0, adaptSpeedIndex: 0 }, gameStarted: true },
    [s => { s.board[0] = 0; }, s => { s.remainingPieces.pop(); }, s => { s.remainingPieces[1] = 0; }]);
check("Sudoku", validator("Sudoku"), { puzzle: Array(81).fill(0), solution: Array(81).fill(1), values: Array(81).fill(0), notes: Array.from({ length: 81 }, () => []) },
    [s => { s.values[0] = 10; }, s => { s.puzzle[0] = 1; }, s => { s.solution = null; s.checked = true; }]);
check("Dame", validator("DeutscheDame", { core: { legalActions: () => [] } }, "normalizeSavedState"),
    { state: { board: Array(64).fill(null), currentPlayer: 1 } },
    [s => { s.state.currentPlayer = 9; }, s => { s.state.quietMoves = -1; }, s => { s.state.positionHistory = [42]; }]);
const othello = validator("Othello", { BOT_LEVELS: [0], ADAPT_SPEEDS: [0], MATCH_OPTIONS: [0] });
check("Othello", othello, { gameId: "othello", board: Array.from({ length: 8 }, () => Array(8).fill(null)), currentPlayer: "black", gameStarted: true, settings: { vsComputer: false, botLevelIndex: 0, adaptSpeedIndex: 0, matchModeIndex: 0 } },
    [s => { s.board[0][0] = "blue"; }, s => { s.currentPlayer = "invalid"; }]);
{
    let stored = null, blocked = false;
    const localStorage = {
        setItem(key, value) { if (blocked) throw new Error("Speicher gesperrt"); stored = value; },
        getItem() { return stored; }, removeItem() { stored = null; }
    };
    const context = vm.createContext({ window: {}, localStorage });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "DeutscheDame", "storage.js"), "utf8"), context);
    assert.equal(context.window.DeutscheDameStorage.save({ test: 1 }), true);
    blocked = true;
    assert.equal(context.window.DeutscheDameStorage.save({ test: 2 }), false);
    assert.equal(context.window.DeutscheDameStorage.load().test, 1);
}
console.log("PASS: gültige und beschädigte Spielstände in sieben Spielen");
