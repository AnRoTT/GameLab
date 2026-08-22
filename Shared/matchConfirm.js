(function () {
    "use strict";

    const dialog = document.createElement("div");
    dialog.className = "match-confirm-backdrop";
    dialog.hidden = true;
    dialog.innerHTML = `
        <section class="match-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="matchConfirmTitle">
            <h2 id="matchConfirmTitle">Spiel abbrechen?</h2>
            <p>Das laufende Spiel wirklich beenden?</p>
            <div class="match-confirm-actions">
                <button type="button" class="settings-action" data-match-confirm="no">Nein</button>
                <button type="button" class="settings-action danger" data-match-confirm="yes">Ja, abbrechen</button>
            </div>
        </section>`;
    document.body.appendChild(dialog);

    let pendingButton = null;
    let bypass = false;
    let historyMarkerActive = false;
    let pendingConfirmedButton = null;
    let pendingConfirmedCallback = null;
    let previouslyFocused = null;

    function isAbortButton(button) {
        const label = (button.textContent || "").trim().toLowerCase();
        return /match abbrechen|spiel abbrechen|match beenden/.test(label);
    }

    function close() {
        dialog.hidden = true;
        pendingButton = null;
        previouslyFocused?.focus?.();
        previouslyFocused = null;
    }

    function closeWithHistory() {
        if (historyMarkerActive) {
            history.back();
        } else {
            close();
        }
    }

    function requestConfirmation({ button = null, onConfirm, useHistory = true } = {}) {
        if (typeof onConfirm !== "function") return false;
        pendingButton = button;
        pendingConfirmedCallback = onConfirm;
        previouslyFocused = button;
        historyMarkerActive = useHistory;
        if (useHistory) history.pushState({ matchConfirmDialog: true }, "", location.href);
        dialog.hidden = false;
        dialog.querySelector('[data-match-confirm="no"]')?.focus();
        return true;
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || bypass || !isAbortButton(button)) return;
        event.preventDefault();
        event.stopPropagation();
        window.AndisSound?.playUiClick?.();
        pendingButton = button;
        previouslyFocused = button;
        history.pushState({ matchConfirmDialog: true }, "", location.href);
        historyMarkerActive = true;
        dialog.hidden = false;
        dialog.querySelector('[data-match-confirm="no"]')?.focus();
    }, true);

    dialog.addEventListener("click", (event) => {
        const action = event.target.closest("[data-match-confirm]");
        if (!action) return;
        if (action.dataset.matchConfirm === "yes" && (pendingButton || pendingConfirmedCallback)) {
            window.AndisSound?.playUiClick?.();
            const button = pendingButton;
            if (historyMarkerActive) {
                if (pendingConfirmedCallback) {
                    pendingConfirmedButton = null;
                } else {
                    pendingConfirmedButton = button;
                }
                closeWithHistory();
            } else {
                const callback = pendingConfirmedCallback;
                pendingConfirmedCallback = null;
                close();
                callback?.();
            }
            return;
        }
        window.AndisSound?.playUiClick?.();
        pendingConfirmedCallback = null;
        closeWithHistory();
    });

    dialog.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            pendingConfirmedCallback = null;
            closeWithHistory();
            return;
        }
        if (event.key === "Tab") {
            const focusable = [...dialog.querySelectorAll("button:not([disabled])")];
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

    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            pendingConfirmedCallback = null;
            closeWithHistory();
        }
    });

    window.addEventListener("popstate", () => {
        if (!historyMarkerActive) return;
        historyMarkerActive = false;
        close();
        if (pendingConfirmedButton) {
            const button = pendingConfirmedButton;
            pendingConfirmedButton = null;
            bypass = true;
            button.click();
            bypass = false;
        }
        if (pendingConfirmedCallback) {
            const callback = pendingConfirmedCallback;
            pendingConfirmedCallback = null;
            callback();
        }
    });

    window.AndisMatchConfirm = {
        request: requestConfirmation,
        isOpen: () => !dialog.hidden
    };
})();
