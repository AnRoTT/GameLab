(function () {
    "use strict";

    function bindBackButton({
        button,
        isGameActive,
        isMatchRunning,
        onAbortConfirmed,
        onMenuBack
    }) {
        if (!button) return;

        button.addEventListener("click", (event) => {
            event.preventDefault();

            if (!isGameActive?.()) {
                onMenuBack?.();
                return;
            }

            if (!isMatchRunning?.()) {
                onAbortConfirmed?.();
                return;
            }

            const requested = window.AndisMatchConfirm?.request?.({
                button,
                onConfirm: onAbortConfirmed
            });

            if (!requested) onAbortConfirmed?.();
        });
    }

    function bindBrowserBack({ isGameActive, isMatchRunning, onAbortConfirmed }) {
        let armed = false;

        function arm() {
            if (armed) return;
            history.pushState({ andisGameScreen: true }, "", location.href);
            armed = true;
        }

        window.addEventListener("popstate", () => {
            if (window.AndisMatchConfirm?.isOpen?.()) return;

            if (!isGameActive?.()) {
                armed = false;
                return;
            }

            if (!isMatchRunning?.()) {
                armed = false;
                onAbortConfirmed?.();
                return;
            }

            armed = false;
            arm();
            window.AndisMatchConfirm?.request?.({
                useHistory: false,
                onConfirm: () => {
                    armed = false;
                    onAbortConfirmed?.();
                }
            });
        });

        return { arm };
    }

    window.AndisNavigation = { bindBackButton, bindBrowserBack };
})();
