(function () {
    "use strict";

    function bindResponsiveBoardLayout(update) {
        if (typeof update !== "function") return () => {};

        const schedule = () => requestAnimationFrame(() => requestAnimationFrame(update));
        const options = { passive: true };

        window.addEventListener("resize", schedule, options);
        window.addEventListener("orientationchange", schedule, options);
        document.addEventListener("fullscreenchange", schedule);
        schedule();

        return () => {
            window.removeEventListener("resize", schedule, options);
            window.removeEventListener("orientationchange", schedule, options);
            document.removeEventListener("fullscreenchange", schedule);
        };
    }

    window.AndisBoardLayout = { bindResponsiveBoardLayout };
})();
