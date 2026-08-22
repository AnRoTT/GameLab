const playersOptions = ["1 Spieler", "2 Spieler"];
const roundsOptions = [1, 3, 5, 7];
const modeOptions = ["Verkürzt", "Komplette Runden", "Turnier"];
const difficultyOptions = ["Anfänger", "Hobbyspieler", "Vereinsspieler", "Meister", "Adaptiv"];
const adaptOptions = ["Langsam", "Normal", "Schnell"];

let playersIdx = 0, roundsIdx = 0, modeIdx = 0, diffIdx = 0, adaptIdx = 1;
let settingsLocked = false;

function updateSettingAvailability() {
    const rowStates = {
        rowPlayers: true,
        rowRounds: true,
        rowMode: roundsOptions[roundsIdx] > 1,
        rowOpponent: true
    };

    Object.entries(rowStates).forEach(([rowId, isAvailable]) => {
        const row = document.getElementById(rowId);
        const button = row.querySelector('.cycle-button');
        row.classList.toggle('disabled', !isAvailable);
        row.classList.toggle('locked', settingsLocked);
        button.disabled = settingsLocked || !isAvailable;
    });

    const difficultyButton = document.getElementById('btnDifficulty');
    const adaptButton = document.getElementById('btnAdapt');
    const difficultyAvailable = playersIdx === 0;
    const adaptAvailable = difficultyAvailable && diffIdx === 4;

    document.getElementById('valDifficulty').textContent = difficultyAvailable
        ? difficultyOptions[diffIdx]
        : '2 Spieler Modus';
    document.getElementById('valAdapt').textContent = adaptAvailable
        ? adaptOptions[adaptIdx]
        : '—';

    difficultyButton.disabled = settingsLocked || !difficultyAvailable;
    adaptButton.disabled = settingsLocked || !adaptAvailable;
    difficultyButton.classList.toggle('button-disabled', difficultyButton.disabled);
    adaptButton.classList.toggle('button-disabled', adaptButton.disabled);
}

window.setSettingsLocked = function (locked) {
    settingsLocked = locked;
    updateSettingAvailability();
};

function updateUI() {
    document.getElementById('valPlayers').textContent = playersOptions[playersIdx];
    document.getElementById('valRounds').textContent = roundsOptions[roundsIdx];
    document.getElementById('valMode').textContent = modeOptions[modeIdx];

    window.currentPlayers = playersIdx === 0 ? 'bot' : 'human';
    window.currentRounds = roundsOptions[roundsIdx];
    window.currentMode = ['short', 'full', 'tournament'][modeIdx];
    window.currentDifficulty = diffIdx + 1;
    window.currentAdapt = ['slow', 'normal', 'fast'][adaptIdx];
    updateSettingAvailability();
    if (typeof window.updateTicTacToeAdaptiveStrengthUI === 'function') {
        window.updateTicTacToeAdaptiveStrengthUI();
    }
}

function cycleSetting(values, index) {
    return (index + 1) % values.length;
}

document.getElementById('btnPlayers').onclick = () => {
    playersIdx = cycleSetting(playersOptions, playersIdx);
    updateUI();
};
document.getElementById('btnRounds').onclick = () => {
    roundsIdx = cycleSetting(roundsOptions, roundsIdx);
    updateUI();
};
document.getElementById('btnMode').onclick = () => {
    modeIdx = cycleSetting(modeOptions, modeIdx);
    updateUI();
};
document.getElementById('btnDifficulty').onclick = () => {
    diffIdx = cycleSetting(difficultyOptions, diffIdx);
    updateUI();
};
document.getElementById('btnAdapt').onclick = () => {
    adaptIdx = cycleSetting(adaptOptions, adaptIdx);
    updateUI();
};

window.updateScore = function (x, draw, o) {
    document.getElementById('scoreX').textContent = `X: ${x}`;
    document.getElementById('scoreDraw').textContent = `Unentsch: ${draw}`;
    document.getElementById('scoreO').textContent = `O: ${o}`;
};

updateUI();
