(function () {
    "use strict";
    const toggle = document.getElementById("settingsToggle");
    const panel = document.getElementById("extraSettings");
    const backdrop = document.getElementById("settingsBackdrop");
    if (!toggle || !panel || !backdrop) return;

    const close = () => {
        panel.hidden = true;
        backdrop.hidden = true;
        document.body.classList.remove("settings-open");
        toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", () => {
        if (!panel.hidden) return close();
        panel.hidden = false;
        backdrop.hidden = false;
        document.body.classList.add("settings-open");
        toggle.setAttribute("aria-expanded", "true");
    });
    backdrop.addEventListener("click", close);
    document.getElementById("settingsClose")?.addEventListener("click", close);

    const soundButton = document.getElementById("settingsSound");
    const updateSound = () => {
        if (!soundButton) return;
        const muted = Boolean(window.AndisSound?.muted);
        soundButton.textContent = muted ? "🔇 Sound aus" : "🔊 Sound an";
        soundButton.setAttribute("aria-pressed", String(muted));
    };
    soundButton?.addEventListener("click", () => {
        window.AndisSound?.toggle();
        window.AndisSound?.playUiClick?.();
        updateSound();
    });
    updateSound();

    document.getElementById("resetPlayerValues")?.addEventListener("click", () => {
        document.getElementById("resetConfirm")?.removeAttribute("hidden");
    });
    document.getElementById("resetCancel")?.addEventListener("click", () => {
        document.getElementById("resetConfirm")?.setAttribute("hidden", "");
    });
    document.getElementById("resetConfirmButton")?.addEventListener("click", () => {
        const botName = document.body.dataset.adaptiveBot;
        window[botName]?.resetForLab?.(35);
        window[botName]?.clearPersistentState?.(35);
        const profileCore = botName === "ConnectFourAdaptiveBot" ? window.ConnectFourAICore
            : botName === "OthelloAdaptiveBot" ? window.OthelloAICore
            : botName === "QuartoAdaptiveBot" ? window.QuartoAICore
            : null;
        profileCore?.clearPlayerProfile?.();
        window.updateTicTacToeAdaptiveStrengthUI?.(35);
        window.updateAdaptiveStrengthUI?.();
        window.updateQuartoAdaptiveStrengthUI?.();
        window.updateOthelloAdaptiveStrengthUI?.(35);
        document.getElementById("resetConfirm")?.setAttribute("hidden", "");
    });
})();
