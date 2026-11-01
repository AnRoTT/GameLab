const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const games = {
    TicTacToe: "AdaptiveBot", "4Gewinnt": "ConnectFourAdaptiveBot", Muehle: "MuehleAdaptiveBot",
    Othello: "OthelloAdaptiveBot", Quarto: "QuartoAdaptiveBot", DeutscheDame: "DeutscheDameAdaptiveBot"
};
function loadGame(game, data) {
    const context = { console, localStorage: {
        getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)
    }, setTimeout() {}, clearTimeout() {} };
    context.window = context;
    vm.createContext(context);
    for (const file of ["Shared/difficultyCore.js", `${game}/settings.js`, `${game}/aiCore.js`, `${game}/adaptiveBot.js`]) {
        const filename = path.join(root, file);
        if (fs.existsSync(filename)) vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
    }
    if (game === "Quarto") context.quartoPlayerProfile = context.QuartoAICore.createPlayerProfile();
    if (game === "Muehle") context.muehlePlayerProfile = context.MuehleAICore.createPlayerProfile(false);
    return context;
}
function skill(bot) { return (bot.getAdaptiveSkill || bot.getSkillValue || bot.getSkill).call(bot); }
function result(game, context, value) {
    const bot = context[games[game]];
    if (game === "DeutscheDame") { bot.beginRound({ adaptSpeed: "normal" }); bot.recordRoundResult(value); }
    else if (game === "Quarto") { bot.beginRound({ enabled: true, adaptSpeed: "normal" }); bot.recordRoundResult(value); }
    else if (game === "Muehle") { bot.beginRound({ adaptSpeed: "normal" }); bot.recordRoundResult(value); }
    else bot.recordLabResult(value);
}
for (const game of Object.keys(games)) {
    const data = new Map();
    let context = loadGame(game, data);
    context[games[game]].clearPersistentState(35);
    result(game, context, "draw");
    result(game, context, "draw");
    assert.equal(skill(context[games[game]]), 35, `${game}: erste Remis neutral`);
    context = loadGame(game, data);
    result(game, context, "draw");
    assert.ok(skill(context[games[game]]) > 35, `${game}: drittes Remis nach Neuladen`);
    context[games[game]].clearPersistentState(35);
    context = loadGame(game, data);
    result(game, context, "botWin");
    assert.ok(skill(context[games[game]]) < 35, `${game}: Niederlage nach Reset`);
    const afterLoss = skill(context[games[game]]);
    context = loadGame(game, data);
    assert.equal(skill(context[games[game]]), afterLoss, `${game}: Anpassung dauerhaft gespeichert`);
    console.log(`PASS ${game}: Remisserie und Reset`);
}

function quartoScenario(resume, keepSnapshot = true) {
    const data = new Map();
    let context = loadGame("Quarto", data), bot = context.QuartoAdaptiveBot;
    const profile = context.quartoPlayerProfile;
    Object.assign(profile, { totalMoves: 20, selectionCount: 20 });
    Object.assign(profile.tactics, { winningMoves: 8, missedWins: 5, dangerousGifts: 4, safeGifts: 8 });
    bot.beginRound({ enabled: true, adaptSpeed: "normal" });
    const snapshot = JSON.parse(JSON.stringify(bot.getRoundSnapshot()));
    Object.assign(profile, { totalMoves: 32, selectionCount: 32 });
    Object.assign(profile.tactics, { winningMoves: 20, missedWins: 5, dangerousGifts: 4, safeGifts: 8 });
    if (resume) {
        const restoredProfile = JSON.parse(JSON.stringify(profile));
        context = loadGame("Quarto", data);
        context.quartoPlayerProfile = restoredProfile;
        bot = context.QuartoAdaptiveBot;
        bot.beginRound({ enabled: true, adaptSpeed: "normal", savedRoundSnapshot: keepSnapshot ? snapshot : null });
    }
    bot.recordRoundResult("playerWin");
    return bot.getAdaptiveSkill();
}
assert.equal(quartoScenario(true), quartoScenario(false), "Quarto: fortgesetzte Runde bewertet wie ununterbrochene Runde");
assert.notEqual(quartoScenario(true, false), quartoScenario(false), "Quarto: Test erkennt verlorenen Rundenausgangspunkt");
console.log("PASS Quarto: Profilbewertung nach Wiederherstellung");
