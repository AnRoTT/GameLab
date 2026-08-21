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
        playUiClick() {
            if (this.muted) return;
            const script = document.querySelector('script[src*="soundManager.js"]');
            const soundUrl = script
                ? new URL("../assets/sounds/Button_Click.mp3", script.src).href
                : new URL("assets/sounds/Button_Click.mp3", document.baseURI).href;
            const sound = new Audio(soundUrl);
            sound.volume = 0.22;
            sound.play().catch(() => {});
        },
        updateButton() {
            const button = document.getElementById("soundToggle");
            if (!button) return;
            button.textContent = this.muted ? "🔇" : "🔊";
            button.removeAttribute("aria-pressed");
            button.setAttribute("aria-label", this.muted ? "Ton einschalten" : "Ton ausschalten");
        }
    };

    // Der obere Soundhinweis ist nur eine Statusanzeige. Die Umschaltung
    // erfolgt ausschließlich im Einstellungsmenü.
    window.AndisSound.updateButton();

    function updateScrolledHeader() {
        document.body.classList.toggle("is-scrolled", window.scrollY > 12);
    }

    window.addEventListener("scroll", updateScrolledHeader, { passive: true });
    updateScrolledHeader();
})();
