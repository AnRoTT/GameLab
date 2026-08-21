(function () {
    "use strict";
    const toggle = document.getElementById("settingsToggle");
    const panel = document.getElementById("extraSettings");
    const backdrop = document.getElementById("settingsBackdrop");
    if (!toggle || !panel || !backdrop) return;

    document.getElementById("mobileSettingsBack")?.addEventListener("click", () => {
        window.AndisSound?.playUiClick?.();
    });

    let historyMarkerActive = false;
    let previouslyFocused = null;

    const applyClose = () => {
        panel.hidden = true;
        backdrop.hidden = true;
        document.body.classList.remove("settings-open");
        toggle.setAttribute("aria-expanded", "false");
        previouslyFocused?.focus?.();
        previouslyFocused = null;
    };
    const close = () => {
        if (historyMarkerActive) {
            history.back();
            return;
        }
        applyClose();
    };
    toggle.addEventListener("click", () => {
        if (!panel.hidden) {
            window.AndisSound?.playUiClick?.();
            return close();
        }
        window.AndisSound?.playUiClick?.();
        previouslyFocused = document.activeElement;
        panel.hidden = false;
        backdrop.hidden = false;
        document.body.classList.add("settings-open");
        toggle.setAttribute("aria-expanded", "true");
        history.pushState({ settingsDialog: true }, "", location.href);
        historyMarkerActive = true;
        document.getElementById("settingsClose")?.focus();
    });
    backdrop.addEventListener("click", close);
    document.getElementById("settingsClose")?.addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            event.preventDefault();
            close();
            return;
        }
        if (event.key === "Tab" && !panel.hidden) {
            const focusable = [...panel.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
    window.addEventListener("popstate", () => {
        if (!historyMarkerActive) return;
        historyMarkerActive = false;
        applyClose();
    });

    const soundButton = document.getElementById("settingsSound");
    document.getElementById("setupExtraSettingsToggle")?.addEventListener("click", () => toggle.click());
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

    ["resetPlayerValues", "settingsClose", "resetCancel", "resetConfirmButton"]
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .forEach(button => {
            button.addEventListener("click", () => {
                window.AndisSound?.playUiClick?.();
            });
        });

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
