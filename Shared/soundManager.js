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
        soundUrl(fileName) {
            const script = document.querySelector('script[src*="soundManager.js"]');
            return script
                ? new URL(`../assets/sounds/${fileName}`, script.src).href
                : new URL(`assets/sounds/${fileName}`, document.baseURI).href;
        },
        playFile(fileName, volume = 0.22) {
            if (this.muted) return;
            const sound = new Audio(this.soundUrl(fileName));
            sound.volume = volume;
            sound.play().catch(() => {});
        },
        playUiClick(volume = 0.22) { this.playFile("Button_Click.mp3", volume); },
        playSmallChipDrop(volume = 0.18) { this.playFile("Small_Chip_Drop.mp3", volume); },
        playBigChipDrop(volume = 0.3) { this.playFile("Big_Chip_Drop.mp3", volume); },
        playFallingChipDrop(volume = 0.25) { this.playFile("Falling_Chip_Drop.mp3", volume); },
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
