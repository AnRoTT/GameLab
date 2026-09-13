(function (root) {
    "use strict";

    let timer = null;

    function ensureNotice() {
        let notice = document.getElementById("savedGameNotice");
        if (notice) return notice;

        notice = document.createElement("div");
        notice.id = "savedGameNotice";
        notice.className = "saved-game-notice";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        notice.hidden = true;
        document.body.appendChild(notice);
        return notice;
    }

    function hide() {
        if (timer) window.clearTimeout(timer);
        timer = null;
        const notice = document.getElementById("savedGameNotice");
        if (notice) notice.hidden = true;
    }

    function show(message = "Spiel gespeichert", duration = 1000, onComplete) {
        const notice = ensureNotice();
        if (timer) window.clearTimeout(timer);
        notice.textContent = message;
        notice.hidden = false;
        timer = window.setTimeout(() => {
            timer = null;
            notice.hidden = true;
            onComplete?.();
        }, duration);
    }

    root.AndisSavedGameNotice = Object.freeze({ show, hide });
})(window);
