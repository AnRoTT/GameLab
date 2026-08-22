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

    function clamp(value, min, max) {
        return Math.floor(Math.max(min, Math.min(value, max)));
    }

    function viewportSquare({ min, max, widthOffset = 0, heightOffset = 0, widthFactor = 1, heightFactor = 1 }) {
        return clamp(
            Math.min(
                (window.innerWidth - widthOffset) * widthFactor,
                (window.innerHeight - heightOffset) * heightFactor
            ),
            min,
            max
        );
    }

    function viewportBoard({ min, max, aspect = 1, widthOffset = 0, heightOffset = 0 }) {
        const availableWidth = Math.max(0, window.innerWidth - widthOffset);
        const availableHeight = Math.max(0, window.innerHeight - heightOffset);
        return clamp(
            Math.min(availableWidth, availableHeight * aspect),
            min,
            max
        );
    }

    function elementWidth(element, fallback = window.innerWidth) {
        return element?.getBoundingClientRect?.().width || element?.clientWidth || fallback;
    }

    function bindBoardLayout({ element, update }) {
        const unbindResponsive = bindResponsiveBoardLayout(update);
        const observer = typeof ResizeObserver === "function" && element
            ? new ResizeObserver(() => requestAnimationFrame(update))
            : null;
        observer?.observe(element);
        return () => {
            unbindResponsive();
            observer?.disconnect();
        };
    }

    window.AndisBoardLayout = {
        bindResponsiveBoardLayout,
        bindBoardLayout,
        clamp,
        viewportSquare,
        viewportBoard,
        elementWidth
    };
})();
