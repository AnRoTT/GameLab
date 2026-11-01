const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function main() {
    const documentEvents = {}, windowEvents = {};
    const classes = new Set();
    const body = { classList: {
        contains: name => classes.has(name),
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
        add: name => classes.add(name), remove: name => classes.delete(name)
    } };
    const doc = { body, fullscreenElement: null,
        addEventListener(name, fn) { documentEvents[name] = fn; },
        documentElement: { async requestFullscreen() { doc.fullscreenElement = this; documentEvents.fullscreenchange(); } },
        async exitFullscreen() { doc.fullscreenElement = null; documentEvents.fullscreenchange(); }
    };
    const context = { document: doc, navigator: { userAgent: "Android", maxTouchPoints: 1 },
        matchMedia: () => ({ matches: true }), addEventListener(name, fn) { windowEvents[name] = fn; }, removeEventListener() {} };
    context.window = context;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "mobileLayout.js"), "utf8"), context);
    const makeButton = () => ({ hidden: false, attributes: {}, addEventListener(name, fn) { this[name] = fn; }, setAttribute(name, value) { this.attributes[name] = value; } });
    let mobile = true;
    const gameButton = makeButton(), settingsButton = makeButton();
    const setup = { hidden: false }, game = { hidden: true };
    const screens = context.AndisMobileLayout.createScreenController({ setupScreen: setup, gameScreen: game, body });
    const controller = screens.bindFullscreen({ button: gameButton, isMobile: () => mobile });
    controller.addButton(settingsButton, { mobileOnly: true });
    await settingsButton.click();
    assert.ok(doc.fullscreenElement);
    assert.equal(gameButton.attributes["aria-pressed"], "true");
    assert.equal(settingsButton.textContent, "⛶ Vollbild aus");
    screens.showGame(); screens.showSetup();
    assert.ok(doc.fullscreenElement, "Ansichtswechsel hält Vollbild");
    await gameButton.click();
    assert.equal(doc.fullscreenElement, null);
    assert.equal(settingsButton.attributes["aria-pressed"], "false");
    await settingsButton.click();
    await doc.exitFullscreen();
    assert.equal(gameButton.attributes["aria-pressed"], "false", "Browser-Ausstieg synchronisiert beide Schalter");
    controller.requestIfChosen();
    assert.equal(doc.fullscreenElement, null, "Browser-Ausstieg wird nicht ungefragt rückgängig gemacht");
    mobile = false; windowEvents.resize();
    assert.equal(settingsButton.hidden, true, "Desktop blendet Menüschalter aus");
    mobile = true; windowEvents.orientationchange();
    assert.equal(settingsButton.hidden, false, "mobile Ansicht zeigt Menüschalter");
    console.log("PASS: Vollbildschalter, Ansichtswechsel, Browserausstieg und mobile Sichtbarkeit");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
