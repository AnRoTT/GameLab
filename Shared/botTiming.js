(function () {
    "use strict";

    const DEFAULT_OPENING_DELAY = 800;

    // Each game supplies its own manual/adaptive think time. The shared rule
    // only enforces a minimum pause for the first bot action of a round.
    window.getBotMoveDelay = function (thinkTime, isOpeningMove = false, openingDelay = DEFAULT_OPENING_DELAY) {
        const safeThinkTime = Math.max(0, Number(thinkTime) || 0);
        const safeOpeningDelay = Math.max(0, Number(openingDelay) || DEFAULT_OPENING_DELAY);
        return isOpeningMove ? Math.max(safeThinkTime, safeOpeningDelay) : safeThinkTime;
    };

    window.BOT_OPENING_DELAY = DEFAULT_OPENING_DELAY;
})();
