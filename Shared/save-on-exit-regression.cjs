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

for (const game of ["TicTacToe", "4Gewinnt", "Muehle", "Othello", "Quarto", "DeutscheDame"]) {
    let active = false, calls = 0;
    const context = vm.createContext({
        hasSavableGame: () => active,
        saveCurrentGame: () => { calls++; },
        writeSavedGame: () => { calls++; }
    });
    const source = fs.readFileSync(path.join(__dirname, "..", game, "game.js"), "utf8");
    vm.runInContext(extract(source, "saveOnPageExit"), context);
    context.saveOnPageExit();
    assert.equal(calls, 0, `${game}: vorhandener Spielstand bleibt vor der Wiederherstellung erhalten`);
    active = true;
    context.saveOnPageExit();
    assert.equal(calls, 1, `${game}: laufende Partie wird gespeichert`);
}

{
    let calls = 0;
    const context = vm.createContext({
        state: null, savedInSetup: false, pendingSavedState: null,
        SudokuStorage: { save() { calls++; } }
    });
    const source = fs.readFileSync(path.join(__dirname, "..", "Sudoku", "game.js"), "utf8");
    vm.runInContext(extract(source, "saveOnPageExit"), context);
    context.saveOnPageExit();
    context.state = { preview: true };
    context.saveOnPageExit();
    context.state = { preview: false, completed: false };
    context.pendingSavedState = {};
    context.saveOnPageExit();
    context.pendingSavedState = null;
    context.savedInSetup = true;
    context.saveOnPageExit();
    assert.equal(calls, 0, "Sudoku: gespeicherter Stand wird nicht durch Vorschau oder Setup überschrieben");
    context.savedInSetup = false;
    context.saveOnPageExit();
    assert.equal(calls, 1, "Sudoku: laufendes Rätsel wird gespeichert");
}
console.log("PASS: Spielstände beim Verlassen in sieben Spielen geschützt");
