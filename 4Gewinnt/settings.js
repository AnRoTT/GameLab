const MODE_OPTIONS = ["2 Spieler", "1 Spieler"];
const START_RULE_OPTIONS = ["Verlierer beginnt", "Nicht-Starter beginnt"];
const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const BOT_LEVEL_KEYS = ["anfänger", "hobby", "verein", "meister", "adaptiv"];
const ADAPT_SPEED_OPTIONS = ["Langsam", "Normal", "Schnell"];
const ADAPT_SPEED_FACTORS = [0.4, 1.0, 1.6];

let botLevelIndex = 0;
let adaptSpeedIndex = 1;
let modeIndex = 1;
let startRuleIndex = 0;
const RESET_BUTTON_STATES = ["Spiel starten", "Neues Spiel"];
let resetButtonIndex = 0;
const ACTIVE_RESET_BUTTON_TEXT = "Match beenden";

const settingsBoard = document.getElementById("board");
const settingsStatusLine = document.getElementById("statusLine1");
const settingsModeButton = document.getElementById("modeButton");
const settingsStartRuleButton = document.getElementById("startRuleButton");
const settingsNewGameButton = document.getElementById("newGameButton");
const settingsResetGameButton = document.getElementById("resetGameButton");
const settingsBotLevelButton = document.getElementById("botLevelButton");
const settingsAdaptSpeedButton = document.getElementById("adaptSpeedButton");
  const settingsAdaptiveStrength = document.getElementById("adaptive-strength");
  const settingsAdaptiveTrack = document.getElementById("adaptive-strength-track");
  const settingsAdaptiveFill = document.getElementById("adaptive-strength-fill");
  const settingsAdaptiveValue = document.getElementById("adaptive-strength-value");

function updateBotButtonState() {
    settingsBotLevelButton.disabled = modeIndex === 0 || matchActive;
    settingsBotLevelButton.classList.toggle("button-disabled", settingsBotLevelButton.disabled);
    settingsBotLevelButton.textContent = modeIndex === 0
        ? "2 Spieler Modus"
        : BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv"
            ? "Adaptiv"
            : BOT_LEVELS[botLevelIndex];
    updateAdaptSpeedButtonState();
    updateAdaptiveStrengthUI();
}

function updateAdaptSpeedButtonState() {
    const isAdaptive = modeIndex === 1 && BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv";
    settingsAdaptSpeedButton.disabled = !isAdaptive || matchActive;
    settingsAdaptSpeedButton.classList.toggle("button-disabled", settingsAdaptSpeedButton.disabled);
    settingsAdaptSpeedButton.textContent = isAdaptive ? ADAPT_SPEED_OPTIONS[adaptSpeedIndex] : "—";
    updateAdaptiveStrengthUI();
}

function setMatchInProgressLocked(isLocked) {
    settingsModeButton.disabled = isLocked;
    settingsStartRuleButton.disabled = isLocked;
    settingsBotLevelButton.disabled = isLocked || modeIndex === 0;
    settingsAdaptSpeedButton.disabled = isLocked || modeIndex === 0 || BOT_LEVEL_KEYS[botLevelIndex] !== "adaptiv";
    settingsModeButton.classList.toggle("button-disabled", isLocked);
    settingsStartRuleButton.classList.toggle("button-disabled", isLocked);
    settingsBotLevelButton.classList.toggle("button-disabled", settingsBotLevelButton.disabled);
    settingsAdaptSpeedButton.classList.toggle("button-disabled", settingsAdaptSpeedButton.disabled);
    settingsNewGameButton.disabled = false;
    settingsNewGameButton.classList.toggle("button-disabled", !isLocked);
    settingsNewGameButton.textContent = isLocked ? "Match abbrechen" : "Neue Runde";
}

function setResetButtonForRound(isRoundActive) {
    resetButtonIndex = isRoundActive ? 1 : 0;
    settingsResetGameButton.textContent = isRoundActive
        ? ACTIVE_RESET_BUTTON_TEXT
        : RESET_BUTTON_STATES[resetButtonIndex];
}

function updateAdaptiveStrengthUI() {
    const isAdaptive = modeIndex === 1 && BOT_LEVEL_KEYS[botLevelIndex] === "adaptiv";
    if (!settingsAdaptiveStrength || !settingsAdaptiveTrack || !settingsAdaptiveFill) return;
    settingsAdaptiveStrength.classList.toggle("hidden", !isAdaptive);
    if (!isAdaptive) return;
      const strength = Math.max(0, Math.min(100, Math.round(adaptiveSkill)));
      settingsAdaptiveTrack.style.setProperty("--skill", `${strength}%`);
      settingsAdaptiveTrack.setAttribute("aria-label", `Botstärke ${strength} von 100`);
      if (settingsAdaptiveValue) settingsAdaptiveValue.textContent = `${strength}%`;
    settingsAdaptiveFill.style.width = `${strength}%`;
}

settingsModeButton.addEventListener("click", () => {
    if (settingsModeButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    modeIndex = (modeIndex + 1) % MODE_OPTIONS.length;
    settingsModeButton.textContent = MODE_OPTIONS[modeIndex];
    updateBotButtonState();
    updateUIStatus();
});

settingsStartRuleButton.addEventListener("click", () => {
    if (settingsStartRuleButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    startRuleIndex = (startRuleIndex + 1) % START_RULE_OPTIONS.length;
    settingsStartRuleButton.textContent = START_RULE_OPTIONS[startRuleIndex];
    updateUIStatus();
});

settingsBotLevelButton.addEventListener("click", () => {
    if (settingsBotLevelButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotButtonState();
    updateUIStatus();
});

settingsAdaptSpeedButton.addEventListener("click", () => {
    if (settingsAdaptSpeedButton.disabled || matchActive) return;
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEED_OPTIONS.length;
    updateAdaptSpeedButtonState();
    updateUIStatus();
});

settingsNewGameButton.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    if (matchActive && !gameOver) {
        resetMatchOnly();
        settingsBoard.classList.add("disabled");
        setResetButtonForRound(false);
        setMatchInProgressLocked(false);
        updateBotButtonState();
        updateUIStatus("Match abgebrochen. Wähle Modus und klicke 'Spiel starten'.");
        return;
    }
    startNewRound();
});

settingsResetGameButton.addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    if (resetButtonIndex === 0) {
        settingsBoard.classList.remove("disabled");
        settingsBoard.style.pointerEvents = "auto";
        startNewRound();
        setResetButtonForRound(true);
        setMatchInProgressLocked(true);
    } else {
        resetMatchOnly();
        setResetButtonForRound(false);
        setMatchInProgressLocked(false);
        settingsNewGameButton.classList.add("button-disabled");
        updateBotButtonState();
    }
});

document.getElementById("next-round-btn").addEventListener("click", () => {
    soundButton.currentTime = 0;
    soundButton.play().catch(() => {});
    hideWinner();
    startNewRound();
});
