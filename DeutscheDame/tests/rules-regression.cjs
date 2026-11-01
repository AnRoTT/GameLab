const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { window: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "settings.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "aiCore.js"), "utf8"), context);
const core = context.window.DeutscheDameAICore;
function position(pieces, currentPlayer = 1) {
    const state = core.initialState();
    state.board.fill(null);
    for (const [cell, player, king = false] of pieces) state.board[cell] = { player, king };
    state.currentPlayer = currentPlayer;
    state.positionHistory = [core.positionKey(state)];
    return state;
}
function move(state, from, to) {
    const action = core.legalActions(state).find(candidate => candidate.from === from && candidate.to === to);
    assert.ok(action, `Zug ${from} → ${to} muss erlaubt sein`);
    return core.applyAction(state, action);
}
let state = position([[41, 1], [43, 1], [34, 2], [20, 2], [2, 2]]);
assert.ok(core.legalActions(state).every(action => action.type === "capture"));
state = move(state, 41, 27);
assert.equal(state.chainFrom, 27);
assert.equal(state.currentPlayer, 1);
state = move(state, 27, 13);
assert.equal(state.chainFrom, null);
assert.equal(state.currentPlayer, 2);
assert.equal(state.moves, 1);
state = position([[8, 1], [62, 2]]);
state = move(state, 8, 1);
assert.equal(state.board[1].king, true);
assert.equal(state.quietMoves, 0);
state = position([[57, 1, true], [6, 2, true]], 2);
for (let cycle = 0; cycle < 2; cycle++) {
    state = move(state, 6, 15);
    state = move(state, 57, 48);
    state = move(state, 15, 6);
    state = move(state, 48, 57);
}
assert.equal(state.drawReason, "wiederholung");
state = position([[57, 1, true], [6, 2, true]]);
state.quietMoves = 49;
state = move(state, 57, 48);
assert.equal(state.drawReason, "zuglimit");
state = position([[1, 1], [62, 2]], 1);
core.evaluateOutcome(state);
assert.equal(state.winner, 2);
assert.equal(state.endReason, "blockiert");
state = position([[41, 1, true], [27, 2], [29, 2], [2, 2]]);
state = move(state, 41, 20);
assert.equal(state.chainFrom, 20);
state = move(state, 20, 38);
assert.equal(state.currentPlayer, 2);
assert.equal(state.moves, 1);
assert.equal(state.board[38].king, true);
console.log("PASS: Schlagzwang, Mehrfachschlag, Krönung, Remis und Blockade");
