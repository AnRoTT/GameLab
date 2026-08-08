const ADAPT_SPEEDS = [
    { key: "slow", label: "Langsam" },
    { key: "normal", label: "Normal" },
    { key: "fast", label: "Schnell" }
];
const BOT_LEVELS = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];

let vsComputer = true;
let botType = "adaptive";
let botLevelIndex = 0;
let adaptSpeedIndex = 1;
let ruleMode = "standard";

const settingsBoard = document.getElementById("board");
const settingsStartButton = document.getElementById("startBtn");
const settingsModeButton = document.getElementById("modeBtn");
const settingsRulesButton = document.getElementById("rulesBtn");
const settingsOpponentRow = document.getElementById("botOpponentRow");
const settingsBotLevelButton = document.getElementById("botLevelBtn");
const settingsAdaptSpeedButton = document.getElementById("adaptSpeedBtn");
const settingsStrengthPanel = document.getElementById("adaptiveStrengthPanel");
const settingsStrengthValue = document.getElementById("adaptiveStrengthValue");
const settingsStrengthBar = document.getElementById("adaptiveStrengthBar");

function updateAdaptiveStrengthUI(strength = getAdaptiveStrength()) {
    const visible = vsComputer && botType === "adaptive";
    settingsStrengthPanel.hidden = !visible;
    if (!visible) return;
    settingsStrengthValue.textContent = `${Math.round(strength)}%`;
    settingsStrengthBar.style.width = `${Math.max(1, Math.min(100, strength))}%`;
}

function updateBotLevelUI() {
    settingsOpponentRow.classList.remove("disabled");
    settingsBotLevelButton.disabled = !vsComputer;
    settingsBotLevelButton.classList.toggle("button-disabled", settingsBotLevelButton.disabled);
    settingsBotLevelButton.textContent = vsComputer ? BOT_LEVELS[botLevelIndex] : "2 Spieler Modus";
    botType = botLevelIndex === 4 ? "adaptive" : "manual";
    const adaptiveEnabled = vsComputer && botType === "adaptive";
    settingsAdaptSpeedButton.disabled = !adaptiveEnabled;
    settingsAdaptSpeedButton.classList.toggle("button-disabled", !adaptiveEnabled);
    settingsAdaptSpeedButton.textContent = adaptiveEnabled ? ADAPT_SPEEDS[adaptSpeedIndex].label : "—";
    updateAdaptiveStrengthUI();
}

settingsStartButton.addEventListener("click", () => {
    playSound(soundButton, 0.22);
    if (gameStarted && !gameOver) {
        resetGame();
        return;
    }
    initGame();
});

settingsModeButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    vsComputer = !vsComputer;
    settingsModeButton.textContent = vsComputer ? "1 Spieler" : "2 Spieler";
    updateBotLevelUI();
});

settingsRulesButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    ruleMode = ruleMode === "standard" ? "tournament" : "standard";
    settingsRulesButton.textContent = ruleMode === "standard" ? "Standard" : "Turnier";
});

settingsBotLevelButton.addEventListener("click", () => {
    if (gameStarted && !gameOver) return;
    playSound(soundButton, 0.22);
    botLevelIndex = (botLevelIndex + 1) % BOT_LEVELS.length;
    updateBotLevelUI();
});

settingsAdaptSpeedButton.addEventListener("click", () => {
    if (settingsAdaptSpeedButton.disabled || (gameStarted && !gameOver)) return;
    playSound(soundButton, 0.22);
    adaptSpeedIndex = (adaptSpeedIndex + 1) % ADAPT_SPEEDS.length;
    updateBotLevelUI();
});

updateBotLevelUI();
