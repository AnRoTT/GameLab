(function () {
    "use strict";

    function detectMobileSession() {
        // Im Querformat ist ein Smartphone oft breiter als 700px. Die
        // kurze Bildschirmseite bleibt dabei der zuverlässigere Hinweis.
        const mobileViewport = window.matchMedia(
            "(max-width: 700px), (max-height: 700px)"
        ).matches;
        const mobileUserAgent = Boolean(navigator.userAgentData?.mobile)
            || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        return mobileViewport && (
            window.matchMedia("(hover: none) and (pointer: coarse)").matches
            || navigator.maxTouchPoints > 0
            || mobileUserAgent
        );
    }

    function createScreenController({ setupScreen, gameScreen, body }) {
        function showSetup() {
            setupScreen.hidden = false;
            gameScreen.hidden = true;
            body.classList.remove("game-active");
        }

        function showGame() {
            setupScreen.hidden = true;
            gameScreen.hidden = false;
            body.classList.add("game-active");
        }

        function applyMode(isMobile, gameActive) {
            body.classList.toggle("mobile-prototype", isMobile);
            if (isMobile) {
                if (gameActive) showGame();
                else showSetup();
            } else {
                setupScreen.hidden = false;
                gameScreen.hidden = false;
                body.classList.remove("game-active");
            }
        }

        function watchResponsiveMode(onMobileDetected) {
            const update = () => {
                if (body.classList.contains("mobile-prototype")) return;
                if (!detectMobileSession()) return;
                applyMode(true, body.classList.contains("game-active"));
                onMobileDetected?.(true);
            };

            window.addEventListener("resize", update, { passive: true });
            window.addEventListener("orientationchange", update, { passive: true });

            return () => {
                window.removeEventListener("resize", update);
                window.removeEventListener("orientationchange", update);
            };
        }

        function bindFullscreen({ button, isMobile = () => body.classList.contains("mobile-prototype") }) {
            let chosenThisSession = false;
            const buttons = new Set();

            async function request() {
                if (!isMobile() || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
                await document.documentElement.requestFullscreen().catch(() => {});
                update();
            }

            async function toggle() {
                window.AndisSound?.playUiClick?.();
                if (!document.fullscreenElement) {
                    await request();
                    chosenThisSession = Boolean(document.fullscreenElement);
                } else if (document.exitFullscreen) {
                    await document.exitFullscreen().catch(() => {});
                    chosenThisSession = false;
                    update();
                }
            }

            function update() {
                const active = Boolean(document.fullscreenElement);
                body.classList.toggle("is-fullscreen", active);
                for (const item of buttons) {
                    const control = item.button;
                    if (item.mobileOnly) control.hidden = !isMobile();
                    control.textContent = active ? "⛶ Vollbild aus" : "⛶ Vollbild";
                    control.setAttribute("aria-label", active ? "Vollbild verlassen" : "Vollbild aktivieren");
                    control.setAttribute("aria-pressed", String(active));
                }
            }

            function addButton(control, { mobileOnly = false } = {}) {
                if (!control || [...buttons].some(item => item.button === control)) return;
                buttons.add({ button: control, mobileOnly });
                control.addEventListener("click", toggle);
                update();
            }
            addButton(button);
            document.addEventListener("fullscreenchange", () => {
                if (!document.fullscreenElement) chosenThisSession = false;
                update();
            });
            window.addEventListener("resize", update, { passive: true });
            window.addEventListener("orientationchange", update, { passive: true });

            const controller = {
                addButton,
                requestIfChosen() {
                    if (chosenThisSession) request();
                },
                exit() {
                    if (document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    }
                },
                update
            };
            window.AndisMobileLayout.fullscreenController = controller;
            return controller;
        }

        /*
         * Spielfeld-Robustheit im mobilen Landscape-Vollbild:
         * Shared erkennt nur den Vollbildwechsel. Das jeweilige Spiel muss
         * seine eigene Brettgeometrie als Pixelwerte berechnen, weil Raster,
         * Zellzahl und Spielobjekte spielabhängig sind.
         */
        return { showSetup, showGame, applyMode, watchResponsiveMode, bindFullscreen };
    }

    window.AndisMobileLayout = { detectMobileSession, createScreenController };
})();
