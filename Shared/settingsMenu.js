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

    // Gemeinsamer Löschdialog für alle Spiele. Die jeweilige Seite liefert nur
    // den Namen ihres Storage-Moduls über data-game-storage.
    const closeButton = document.getElementById("settingsClose");
    const hasPlayerValues = Boolean(document.body.dataset.adaptiveBot);
    const storage = window[document.body.dataset.gameStorage];

    const deleteButton = document.createElement("button");
    deleteButton.id = "deleteDataButton";
    deleteButton.className = "settings-action danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Löschen …";
    closeButton?.before(deleteButton);

    const choicePanel = document.createElement("div");
    choicePanel.id = "deleteChoicePanel";
    choicePanel.className = "reset-confirm";
    choicePanel.hidden = true;
    choicePanel.innerHTML = `<p>Was möchtest du löschen?</p>
        <div><button class="settings-action danger" type="button" data-delete-kind="player">Spielerwerte</button>
        <button class="settings-action danger" type="button" data-delete-kind="state">Spielstände</button></div>
        <button id="deleteCancel" class="settings-action" type="button">Abbrechen</button>`;
    closeButton?.before(choicePanel);

    const confirmPanel = document.createElement("div");
    confirmPanel.id = "deleteConfirmPanel";
    confirmPanel.className = "reset-confirm";
    confirmPanel.hidden = true;
    confirmPanel.innerHTML = `<p id="deleteConfirmText"></p>
        <div><button id="deleteConfirmCancel" class="settings-action" type="button">Abbrechen</button>
        <button id="deleteConfirmButton" class="settings-action danger" type="button">Ja, löschen</button></div>`;
    closeButton?.before(confirmPanel);

    const hideDeletePanels = () => {
        choicePanel.hidden = true;
        confirmPanel.hidden = true;
    };
    const playClick = () => window.AndisSound?.playUiClick?.();
    const resetPlayerValues = () => {
        const botName = document.body.dataset.adaptiveBot;
        window[botName]?.resetForLab?.(35);
        window[botName]?.clearPersistentState?.(35);
        const profileCore = botName === "ConnectFourAdaptiveBot" ? window.ConnectFourAICore
            : botName === "OthelloAdaptiveBot" ? window.OthelloAICore
            : botName === "QuartoAdaptiveBot" ? window.QuartoAICore
            : null;
        profileCore?.clearPlayerProfile?.();
        window.TicTacToeAdaptiveBot?.clearPersistentState?.(35);
        window.updateTicTacToeAdaptiveStrengthUI?.(35);
        window.updateAdaptiveStrengthUI?.();
        window.updateQuartoAdaptiveStrengthUI?.();
        window.updateOthelloAdaptiveStrengthUI?.(35);
    };

    if (!hasPlayerValues) choicePanel.querySelector('[data-delete-kind="player"]')?.remove();
    deleteButton.addEventListener("click", () => {
        playClick();
        deleteButton.hidden = true;
        choicePanel.hidden = false;
    });
    choicePanel.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        playClick();
        if (button.id === "deleteCancel") {
            hideDeletePanels();
            deleteButton.hidden = false;
            return;
        }
        const kind = button.dataset.deleteKind;
        document.getElementById("deleteConfirmText").textContent = kind === "player"
            ? "Spielerwerte wirklich löschen?"
            : "Spielstände wirklich löschen?";
        choicePanel.hidden = true;
        confirmPanel.hidden = false;
        confirmPanel.dataset.deleteKind = kind;
    }));
    document.getElementById("deleteConfirmCancel")?.addEventListener("click", () => {
        playClick();
        hideDeletePanels();
        deleteButton.hidden = false;
    });
    document.getElementById("deleteConfirmButton")?.addEventListener("click", () => {
        playClick();
        const kind = confirmPanel.dataset.deleteKind;
        hideDeletePanels();
        deleteButton.hidden = false;
        close();
        if (kind === "player") {
            resetPlayerValues();
            window.AndisSavedGameNotice?.show?.("Spielerwerte gelöscht");
            return;
        }
        storage?.clear?.();
        window.AndisSavedGameNotice?.show?.("Spielstände gelöscht", 1000, () => window.location.reload());
    });
    closeButton?.addEventListener("click", playClick);
})();
