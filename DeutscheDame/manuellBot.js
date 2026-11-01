(function (root) {
    "use strict";
    const core = root.DeutscheDameAICore;
    function config(level) { return core.getManualProfile(level === "reference" ? "reference" : Math.max(1, Math.min(4, Number(level) || 1))); }
    function chooseAction(state, player = 2, level = 1) {
        const profile = config(level);
        return core.chooseDifficultyAction(state, player, profile) || core.legalActions(state)[0] || null;
    }
    function getThinkTime(level = 1) {
        return Math.round(280 + config(level).curve * 570);
    }
    root.DeutscheDameManualBot = { LEVELS: [1, 2, 3, 4], getThinkTime, chooseAction };
})(window);
