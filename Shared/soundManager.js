(function () {
    "use strict";

    const STORAGE_KEY = "andis-game-foundry-muted";
    const originalPlay = HTMLMediaElement.prototype.play;

    if (!HTMLMediaElement.prototype.__andisSoundGuard) {
        HTMLMediaElement.prototype.play = function (...args) {
            if (window.AndisSound?.muted) {
                this.pause();
                this.currentTime = 0;
                return Promise.resolve();
            }
            return originalPlay.apply(this, args);
        };
        HTMLMediaElement.prototype.__andisSoundGuard = true;
    }

    let storedMuted = false;
    try {
        storedMuted = localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
        storedMuted = false;
    }

    window.AndisSound = {
        muted: storedMuted,
        toggle() {
            this.muted = !this.muted;
            try {
                localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0");
            } catch (_) {
                // Der Schalter funktioniert auch ohne dauerhafte Speicherung.
            }
            this.updateButton();
        },
        updateButton() {
            const button = document.getElementById("soundToggle");
            if (!button) return;
            button.textContent = this.muted ? "🔇" : "🔊";
            button.setAttribute("aria-pressed", String(this.muted));
            button.setAttribute("aria-label", this.muted ? "Ton einschalten" : "Ton ausschalten");
        }
    };

    const button = document.getElementById("soundToggle");
    if (button) {
        button.addEventListener("click", () => window.AndisSound.toggle());
        window.AndisSound.updateButton();
    }

    function updateScrolledHeader() {
        document.body.classList.toggle("is-scrolled", window.scrollY > 12);
    }

    window.addEventListener("scroll", updateScrolledHeader, { passive: true });
    updateScrolledHeader();
})();
