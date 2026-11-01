(function () {
    "use strict";

    const backdrop = document.getElementById("resumeConfirmBackdrop");
    if (!backdrop) return;

    const prefix = backdrop.dataset.dialogPrefix;
    if (!prefix) return;

    const dialog = document.createElement("section");
    dialog.className = `${prefix}-confirm-dialog`;
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "resumeConfirmTitle");

    const title = document.createElement("h2");
    title.id = "resumeConfirmTitle";
    title.textContent = "Laufendes Spiel gefunden";
    const progress = document.createElement("p");
    progress.id = "resumeProgress";
    progress.className = "resume-progress";
    const actions = document.createElement("div");
    actions.className = `${prefix}-confirm-actions`;

    for (const [id, label] of [["resumeDecline", "Nein, Einstellungen"], ["resumeAccept", "Ja, fortsetzen"]]) {
        const button = document.createElement("button");
        button.id = id;
        button.type = "button";
        button.className = "settings-action";
        button.textContent = label;
        actions.appendChild(button);
    }
    dialog.append(title, progress, actions);
    backdrop.appendChild(dialog);
})();
