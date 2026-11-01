const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const games = [
    ["TicTacToe", "TicTacToeStorage"], ["4Gewinnt", "ConnectFourStorage"],
    ["Muehle", "MuehleStorage"], ["Othello", "OthelloStorage"],
    ["Quarto", "QuartoStorage"], ["Sudoku", "SudokuStorage"]
];

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, name);
    let depth = 0;
    const opening = source.indexOf("{", start);
    for (let i = opening; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`Unvollständige Funktion: ${name}`);
}

for (const [game, storageName] of games) {
    let fail = false, stored = null, cancelled = 0, message = null, callback = null;
    const storage = {
        setItem(key, value) { if (fail) throw new Error("Speicher gesperrt"); stored = value; },
        getItem() { return stored; }, removeItem() { stored = null; }
    };
    const window = { SudokuSettings: { storageKey: "test" }, location: { href: "" },
        clearTimeout() { cancelled++; },
        AndisSavedGameNotice: { show(text, duration, fn) { message = text; callback = fn; } } };
    const context = { window, localStorage: storage, console };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", game, "storage.js"), "utf8"), context);
    const api = window[storageName];
    assert.equal(api.save({ example: 1 }), true, game);
    assert.equal(JSON.parse(stored).example, 1, game);
    fail = true;
    assert.equal(api.save({ example: 2 }), false, game);
    assert.equal(JSON.parse(stored).example, 1, game);

    Object.assign(context, {
        [storageName]: api, state: { preview: false, completed: false, mode: "normal" },
        returningToSetup: false, leavingToMenu: false, savedInSetup: false,
        hasSavableGame: () => true, createSavedState: () => ({ example: 3 }),
        saveCurrentGame: () => api.save({ example: 3 }),
        cancelBot: () => { cancelled++; }, cancelPendingBotMove: () => { cancelled++; },
        cancelNextRoundCountdown: () => { cancelled++; }, cancelPendingTurnTimers: () => { cancelled++; },
        clearDropAnimation: () => { cancelled++; }, roundToken: 0, botTimer: 1,
        fullscreenController: { exit() { cancelled++; } },
        showSetupScreen() {}, showSetupAfterSavedGame() {}, abortToSetup() {}
    });
    const source = fs.readFileSync(path.join(__dirname, "..", game, "game.js"), "utf8");
    if (!["TicTacToe", "Sudoku"].includes(game)) vm.runInContext(functionSource(source, "writeSavedGame"), context);
    vm.runInContext(functionSource(source, "saveAndReturnToSetup"), context);
    vm.runInContext(functionSource(source, "leaveToMenu"), context);
    for (const action of ["saveAndReturnToSetup", "leaveToMenu"]) {
        message = null; callback = null; cancelled = 0;
        context[action]();
        assert.match(message, /Speichern fehlgeschlagen/, `${game}: ${action}`);
        assert.equal(callback, undefined, game);
        assert.equal(cancelled, 0, `${game}: laufende Aktion bleibt aktiv`);
        assert.equal(context.returningToSetup, false, game);
        assert.equal(context.leavingToMenu, false, game);
        assert.equal(context.savedInSetup, false, game);
        assert.equal(window.location.href, "", game);
    }
    fail = false;
    message = null;
    context.saveAndReturnToSetup();
    assert.equal(message, "Spiel gespeichert", game);
    assert.equal(context.savedInSetup, true, game);
    assert.equal(typeof callback, "function", game);
    context.savedInSetup = false;
    context.returningToSetup = false;
    message = null;
    callback = null;
    context.leaveToMenu();
    assert.equal(message, "Spiel gespeichert", game);
    assert.equal(context.leavingToMenu, true, game);
    assert.equal(typeof callback, "function", game);
    callback();
    assert.equal(window.location.href, "../index.html?menu=1", game);
}
console.log("PASS: Speichererfolg und -fehler bei Rückkehr und Menü in sechs Spielen");
