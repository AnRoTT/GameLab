const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const games = {
    TicTacToe: "tictactoe", "4Gewinnt": "connect-four", Muehle: "muehle",
    Othello: "othello", Quarto: "quarto", Sudoku: "sudoku", DeutscheDame: "deutsche-dame"
};
const source = fs.readFileSync(path.join(__dirname, "resumeGameDialog.js"), "utf8");
function element(tag) {
    return { tag, children: [], attributes: {}, appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); }, setAttribute(key, value) { this.attributes[key] = value; } };
}
for (const [game, prefix] of Object.entries(games)) {
    const html = fs.readFileSync(path.join(__dirname, "..", game, `${game}.html`), "utf8");
    assert.ok(html.includes(`data-dialog-prefix="${prefix}"`), `${game}: Dialogplatzhalter`);
    const dialogScript = html.indexOf('../Shared/resumeGameDialog.js');
    assert.ok(dialogScript >= 0 && dialogScript < html.indexOf('game.js'), `${game}: Ladereihenfolge`);
    const backdrop = element("div");
    backdrop.dataset = { dialogPrefix: prefix };
    vm.runInNewContext(source, { document: { getElementById: () => backdrop, createElement: element } });
    const dialog = backdrop.children[0];
    assert.equal(dialog.className, `${prefix}-confirm-dialog`);
    assert.equal(dialog.attributes["aria-modal"], "true");
    assert.equal(dialog.attributes["aria-labelledby"], "resumeConfirmTitle");
    assert.equal(dialog.children[0].textContent, "Laufendes Spiel gefunden");
    assert.equal(dialog.children[1].id, "resumeProgress");
    assert.deepEqual(Array.from(dialog.children[2].children, button => button.id), ["resumeDecline", "resumeAccept"]);
}
console.log("PASS: Gemeinsamer Wiederherstellungsdialog in sieben Spielen eingebunden");
