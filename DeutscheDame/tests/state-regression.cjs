const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness(mobile, saved = null, realCore = false) {
    const elements = new Map();
    const document = { activeElement: null, listeners: {}, body: null,
        getElementById(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); },
        createElement() { return element(""); }, addEventListener(name, fn) { this.listeners[name] = fn; } };
    function element(id) {
        const classes = new Set();
        return { id, hidden: id === "resumeConfirmBackdrop", value: "", textContent: "", children: [], parentElement: { classList: { toggle() {} } },
            classList: { add(...x) { x.forEach(v => classes.add(v)); }, remove(...x) { x.forEach(v => classes.delete(v)); }, contains(x) { return classes.has(x); }, toggle(x, v) { if (v) classes.add(x); else classes.delete(x); } },
            listeners: {}, style: {}, setAttribute() {}, addEventListener(name, fn) { const previous = this.listeners[name]; this.listeners[name] = previous ? (...args) => { previous(...args); fn(...args); } : fn; },
            appendChild(child) { this.children.push(child); }, querySelectorAll() { return []; },
            contains(child) { return child === this || this.children.includes(child); }, focus() { document.activeElement = this; this.listeners.focus?.(); },
            set innerHTML(value) { this.children = []; }, get innerHTML() { return ""; } };
    }
    document.body = element("body");
    for (const [id, value] of Object.entries({ mode: "human", botType: "manual", botLevel: "1", adaptSpeed: "normal", match: "match" })) document.getElementById(id).value = value;
    const timers = [];
    let stored = saved;
    const x = { document, console, window: null, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, location: { href: "" } };
    x.window = x; x.addEventListener = () => {};
    x.DeutscheDameStorage = { load: () => stored, save: value => { stored = structuredClone(value); return true; }, clear: () => { stored = null; } };
    x.DeutscheDameAICore = { initialState: () => ({ board: Array(64).fill(null), currentPlayer: 1, chainFrom: null, winner: null, draw: false, moves: 0 }),
        positionKey: state => `position-${state.currentPlayer}`, clone: value => structuredClone(value), legalActions: state => state && !state.winner && !state.draw ? (state.chainFrom !== null ? [{ type: "capture", from: 28, over: 21, to: 14 }] : [{ type: "move", from: 41, to: 32 }]) : [],
        applyAction: state => ({ ...state, chainFrom: null, winner: 1, currentPlayer: 2 }), evaluateOutcome: state => state };
    x.DeutscheDameManualBot = {}; x.DeutscheDameAdaptiveBot = { cancelRound() {}, getAdaptiveSkill: () => 35 };
    x.AndisMobileLayout = { detectMobileSession: () => mobile, createScreenController: () => ({ showGame() {}, showSetup() {}, applyMode() {}, watchResponsiveMode() {}, bindFullscreen() { return {}; } }) };
    x.AndisSavedGameNotice = { show(message, duration, callback) { x.lastNotice = message; callback?.(); }, hide() {} };
    x.AndisNavigation = { bindBackButton(options) { if (options.button.id === "backSetup") x.backOptions = options; }, bindBrowserBack() {} };
    vm.createContext(x);
    if (realCore) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "settings.js"), "utf8"), x);
        vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "aiCore.js"), "utf8"), x);
    }
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"), x);
    return { x, document, elements, timers, get saved() { return stored; }, click(id) { elements.get(id).listeners.click({}); } };
}

for (const mobile of [false, true]) {
    const h = harness(mobile);
    h.click("start");
    assert.ok(h.saved && !h.saved.state.winner);
    assert.equal(h.elements.get("board").children.filter(cell => cell.tabIndex === 0).length, 1);
    const save = h.x.DeutscheDameStorage.save;
    h.x.DeutscheDameStorage.save = () => false;
    h.x.backOptions.onActiveBack();
    assert.match(h.x.lastNotice, /Speichern fehlgeschlagen/);
    assert.equal(h.elements.get("board").children.filter(cell => cell.tabIndex === 0).length, 1);
    h.x.DeutscheDameStorage.save = save;
    h.elements.get("board").children[41].listeners.click();
    h.elements.get("board").children[32].listeners.click();
    assert.equal(h.saved.state.winner, 1);
    assert.equal(h.saved.matchWins[1], 1);
    assert.equal(h.saved.matchRound, 2);
    assert.equal(h.elements.get("start").textContent, "Nächste Runde");
    const resultText = h.elements.get("status").textContent;
    h.document.listeners.keydown({ key: "Tab" });
    h.elements.get("modeButton").focus();
    h.timers.at(-1)();
    assert.equal(h.elements.get("status").textContent, resultText);
    assert.equal(h.document.activeElement, h.elements.get("modeButton"));
    const resumed = harness(mobile, h.saved);
    assert.equal(resumed.elements.get("resumeConfirmBackdrop").hidden, false);
    resumed.click("resumeAccept");
    assert.equal(resumed.elements.get("modeButton").textContent, "2 Spieler");
    assert.equal(resumed.elements.get("start").textContent, "Nächste Runde");
    resumed.click("start");
    assert.equal(resumed.saved.matchRound, 2);
    assert.equal(resumed.saved.state.currentPlayer, 2);
    assert.deepEqual(resumed.saved.state.positionHistory, ["position-2"]);
    const chain = structuredClone(resumed.saved);
    chain.state.currentPlayer = 1;
    chain.state.chainFrom = 28;
    chain.state.board[28] = { player: 1, king: false };
    const capture = harness(mobile, chain);
    capture.click("resumeAccept");
    assert.ok(capture.timers.length > 0, "einzige Schlagfortsetzung wird eingeplant");
    capture.timers.at(-1)();
    assert.match(capture.elements.get("status").textContent, /Zwischenstand 2:0/);
    assert.equal(capture.elements.get("start").textContent, "Nächste Runde");
    assert.equal(capture.elements.get("mobileGameAction").textContent, "Nächste Runde");
    assert.equal(capture.saved.matchWins[1], 2);
    assert.equal(capture.saved.matchRound, 3);
    const thirdRound = harness(mobile, capture.saved);
    thirdRound.click("resumeAccept");
    assert.equal(thirdRound.elements.get("start").textContent, "Nächste Runde");
    thirdRound.click("start");
    assert.equal(thirdRound.saved.matchWins[1], 2);
    assert.equal(thirdRound.saved.matchRound, 3);
    assert.equal(thirdRound.saved.state.currentPlayer, 1);
    chain.state.chainFrom = 99;
    const invalid = harness(mobile, chain);
    assert.equal(invalid.elements.get("resumeConfirmBackdrop").hidden, true);

    const keyboard = harness(mobile);
    keyboard.x.DeutscheDameAICore.legalActions = state => state && !state.winner
        ? [{ type: "capture", from: 41, over: 34, to: 27 }] : [];
    keyboard.click("start");
    const board = keyboard.elements.get("board");
    board.children[41].focus();
    board.children[41].listeners.keydown({ key: "Enter", preventDefault() {} });
    assert.ok(keyboard.timers.length, "einziger Schlag wird per Tastatur automatisch eingeplant");
    assert.match(keyboard.elements.get("hint").textContent, /Schlag:/);

    const mouse = harness(mobile);
    mouse.click("start");
    const mouseBoard = mouse.elements.get("board");
    mouseBoard.children[41].focus();
    mouseBoard.children[41].listeners.pointerdown();
    mouseBoard.children[41].listeners.click();
    assert.equal(mouse.document.activeElement, mouseBoard.children[32], "Mausauswahl behält den Brettfokus nach dem Neuzeichnen");
    assert.equal(mouseBoard.classList.contains("keyboard-active"), false);
    mouseBoard.children[32].listeners.keydown({ key: "ArrowLeft", preventDefault() {} });
    assert.equal(mouseBoard.classList.contains("keyboard-active"), true, "Pfeiltaste aktiviert den Tastaturfokus ohne Tab");
}
for (const mobile of [false, true]) {
    const h = harness(mobile);
    const ids = ["modeButton", "mode", "botButton", "botType", "botLevel", "adaptiveButton", "adaptSpeed"];
    for (const id of ids) h.x[id] = h.elements.get(id);
    const mode = h.x.mode;
    mode.options = [{ value: "bot" }, { value: "human" }];
    Object.defineProperty(mode, "selectedIndex", {
        get() { return this.options.findIndex(option => option.value === this.value); },
        set(index) { this.value = this.options[index].value; }
    });
    h.x.URLSearchParams = URLSearchParams;
    h.x.location.search = "";
    const html = fs.readFileSync(path.join(__dirname, "..", "DeutscheDame.html"), "utf8");
    const inline = html.match(/<script>\s*(const cycle=[\s\S]*?)<\/script>/);
    assert.ok(inline, "Einstellungscode im HTML vorhanden");
    vm.runInContext(inline[1], h.x);
    mode.value = "bot";
    h.x.updateDeutscheDameSetupUI();
    assert.equal(h.x.botButton.disabled, false);
    assert.equal(h.x.botButton.textContent, "Anfänger");
    h.click("modeButton");
    assert.equal(mode.value, "human");
    assert.equal(h.x.botButton.disabled, true);
    assert.equal(h.x.botButton.textContent, "2 Spieler Modus");
    h.click("modeButton");
    assert.equal(mode.value, "bot");
    assert.equal(h.x.botButton.disabled, false);
    assert.equal(h.x.botButton.textContent, "Anfänger");
    h.x.botType.value = "adaptive";
    vm.runInContext("updateAdaptiveSetup()", h.x);
    assert.equal(h.x.botButton.textContent, "Adaptiv");
    assert.equal(h.x.adaptiveButton.disabled, false);
    h.click("modeButton");
    assert.equal(h.x.botButton.textContent, "2 Spieler Modus");
    assert.equal(h.x.adaptiveButton.disabled, true);
    h.click("modeButton");
    assert.equal(h.x.botButton.textContent, "Adaptiv");
    assert.equal(h.x.adaptiveButton.disabled, false);
}
for (const mobile of [false, true]) {
    const seed = harness(mobile, null, true);
    const core = seed.x.DeutscheDameAICore;
    let saved;
    for (let round = 1; round <= 4; round++) {
        const state = core.initialState();
        state.board.fill(null);
        state.board[42] = { player: 1, king: false };
        state.board[35] = { player: 2, king: false };
        state.currentPlayer = 1;
        state.positionHistory = [core.positionKey(state)];
        const fixture = { gameId: "deutsche-dame", state, settings: { mode: "human", botType: "manual", botLevel: 1, adaptSpeed: "normal", match: "match" }, matchWins: { 1: round - 1, 2: 0 }, matchRound: round, matchRunning: true, roundResultRecorded: false };
        const h = harness(mobile, fixture, true);
        h.click("resumeAccept");
        h.elements.get("board").children[42].listeners.click();
        h.timers.at(-1)();
        assert.equal(h.saved.state.winner, 1, `Runde ${round}: echter Schlag beendet die Runde`);
        assert.equal(h.saved.matchWins[1], round);
        assert.equal(h.saved.matchRound, round + 1);
        assert.equal(h.elements.get(mobile ? "mobileGameAction" : "start").textContent, "Nächste Runde");
        saved = h.saved;
    }
    const resumed = harness(mobile, saved, true);
    resumed.click("resumeAccept");
    resumed.click(mobile ? "mobileGameAction" : "start");
    assert.equal(resumed.saved.matchWins[1], 4);
    assert.equal(resumed.saved.matchRound, 5);
    assert.equal(resumed.saved.state.winner, null);
}
for (const mobile of [false, true]) {
    const h = harness(mobile);
    const bot = h.x.DeutscheDameAdaptiveBot;
    let active = false, results = [];
    bot.cancelRound = () => { active = false; };
    bot.beginRound = () => { active = true; };
    bot.isRoundActive = () => active;
    bot.recordRoundResult = result => { results.push(result); active = false; };
    h.x.deutscheDamePlayerProfile = { gamesAgainstBot: 0 };
    h.elements.get("mode").value = "bot";
    h.elements.get("botType").value = "adaptive";
    h.click("start");
    // Ein Zurücksetzen der Spielerwerte kann die aktive Botrunde beenden.
    bot.cancelRound();
    h.elements.get("board").children[41].listeners.click();
    h.elements.get("board").children[32].listeners.click();
    assert.deepEqual(results, ["playerWin"], "Ergebnis auch nach zurückgesetzter Botrunde genau einmal erfassen");
    h.timers.at(-1)();
    assert.deepEqual(results, ["playerWin"], "Neuzeichnen darf Ergebnis nicht erneut erfassen");
}
console.log("PASS: Match, Fokus und Schlagfortsetzung (Desktop/Mobile-Zustand)");
