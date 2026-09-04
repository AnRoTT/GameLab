(function () {
    "use strict";
    const core = window.MuehleAICore;
    function config(level) { return String(level).toLowerCase() === "reference" ? core.getManualReferenceProfile() : core.getManualProfile(Math.max(1, Math.min(4, Number(level) || 1))); }
    function chooseAction(state, player, level) {
        const profile = config(level); const actions = core.getLegalActions(state); if (!actions.length) return null;
        const isReference = String(level).toLowerCase() === "reference" || String(level).toLowerCase() === "referenz";
        if (isReference) return core.chooseBestActionDeterministic(state, player, profile.depth) || actions[0];
        return core.chooseDifficultyAction(state, player, profile) || actions[0];
    }
    function getThinkTime(level = 1) {
        const profile = config(level);
        return Math.round(280 + profile.curve * 570);
    }
    window.MuehleManualBot = { LEVELS: [1, 2, 3, 4], getThinkTime, chooseAction, choosePlace: chooseAction, chooseSource: chooseAction, chooseTarget: chooseAction, chooseRemove: chooseAction };
    window.MuehleReferenceBot = { chooseAction(state, player) { return chooseAction(state, player, "reference"); }, getProfile() { return core.getManualReferenceProfile(); } };
})();
