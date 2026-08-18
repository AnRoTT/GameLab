(function () {
    "use strict";

    const SELECTOR = ".cycle-button, .primary-button, .secondary-button";
    let scheduled = false;

    function ensureLabel(button) {
        let label = button.querySelector(":scope > .button-label");
        if (label) return label;
        label = document.createElement("span");
        label.className = "button-label";
        while (button.firstChild) label.appendChild(button.firstChild);
        button.appendChild(label);
        return label;
    }

    function measure(button) {
        const label = ensureLabel(button);
        button.classList.remove("is-overflowing");
        button.style.removeProperty("--overflow-distance");
        label.style.removeProperty("--label-width");

        const overflowing = label.scrollWidth > button.clientWidth - 4;
        if (!overflowing) return;
        const distance = Math.max(12, label.scrollWidth - button.clientWidth + 8);
        button.style.setProperty("--overflow-distance", `${distance}px`);
        button.classList.add("is-overflowing");
    }

    function measureAll() {
        scheduled = false;
        document.querySelectorAll(SELECTOR).forEach(measure);
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(measureAll);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    window.addEventListener("load", schedule, { once: true });
    schedule();
})();
