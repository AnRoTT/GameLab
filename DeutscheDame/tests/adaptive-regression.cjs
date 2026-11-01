const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "../..");
const data = new Map();
const context = { window: {}, localStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
} };
vm.createContext(context);
function load(relative) { vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context); }
load("Shared/difficultyCore.js");
load("DeutscheDame/adaptiveBot.js");
let bot = context.window.DeutscheDameAdaptiveBot;
// Entspricht dem gemeinsamen Einstellungsmenü beim Löschen von Spielerwerten.
bot.resetForLab(35);
bot.clearPersistentState(35);
bot.beginRound({ adaptSpeed: "normal" });
assert.ok(bot.recordRoundResult("botWin") < 35);
const afterLoss = bot.getAdaptiveSkill();
load("DeutscheDame/adaptiveBot.js");
bot = context.window.DeutscheDameAdaptiveBot;
assert.equal(bot.getAdaptiveSkill(), afterLoss, "Anpassung nach Reset und Neuladen erhalten");
const stored = [...data.values()][0];
bot.resetForLab(35);
bot.beginRound({ adaptSpeed: "normal" });
bot.recordLabResult("playerWin");
assert.equal([...data.values()][0], stored, "Laborergebnis verändert keine Spielerwerte");
bot.finishLab();
assert.equal(bot.getAdaptiveSkill(), afterLoss, "Labor gibt ursprünglichen Wert zurück");
bot.beginRound({ adaptSpeed: "normal" });
assert.ok(bot.recordRoundResult("playerWin") > afterLoss);
console.log("PASS: Adaptive Ergebnisse, Reset, Speicherung und Laborisolation");
