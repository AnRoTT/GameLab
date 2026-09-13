(function (root) {
    "use strict";

    const SIZE = 9;
    const BOX = 3;

    function clone(grid) { return grid.slice(); }

    function candidates(grid, index) {
        if (grid[index]) return [];
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const used = new Set();
        for (let i = 0; i < SIZE; i++) {
            used.add(grid[row * SIZE + i]);
            used.add(grid[i * SIZE + col]);
        }
        const boxRow = Math.floor(row / BOX) * BOX;
        const boxCol = Math.floor(col / BOX) * BOX;
        for (let r = boxRow; r < boxRow + BOX; r++) {
            for (let c = boxCol; c < boxCol + BOX; c++) used.add(grid[r * SIZE + c]);
        }
        return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !used.has(n));
    }

    function findBestEmpty(grid) {
        let best = -1;
        let bestOptions = null;
        for (let i = 0; i < grid.length; i++) {
            if (grid[i]) continue;
            const options = candidates(grid, i);
            if (!options.length) return { index: i, options };
            if (!bestOptions || options.length < bestOptions.length) {
                best = i;
                bestOptions = options;
                if (options.length === 1) break;
            }
        }
        return best < 0 ? null : { index: best, options: bestOptions };
    }

    function countSolutions(grid, limit = 2) {
        const next = findBestEmpty(grid);
        if (!next) return 1;
        if (!next.options.length) return 0;
        let total = 0;
        for (const value of next.options) {
            grid[next.index] = value;
            total += countSolutions(grid, limit);
            grid[next.index] = 0;
            if (total >= limit) return total;
        }
        return total;
    }

    function solve(grid) {
        const work = clone(grid);
        function search() {
            const next = findBestEmpty(work);
            if (!next) return true;
            for (const value of next.options) {
                work[next.index] = value;
                if (search()) return true;
                work[next.index] = 0;
            }
            return false;
        }
        return search() ? work : null;
    }

    function isValidPlacement(grid, index, value) {
        if (!Number.isInteger(value) || value < 1 || value > 9) return false;
        const copy = clone(grid);
        copy[index] = 0;
        return candidates(copy, index).includes(value);
    }

    function isValidGrid(grid) {
        if (!Array.isArray(grid) || grid.length !== SIZE * SIZE) return false;
        if (grid.some(value => !Number.isInteger(value) || value < 0 || value > SIZE)) return false;
        return ALL_UNITS.every(unit => {
            const values = unit.map(index => grid[index]).filter(Boolean);
            return new Set(values).size === values.length;
        });
    }

    function createUnits() {
        const units = [];
        for (let row = 0; row < SIZE; row++) units.push([...Array(SIZE)].map((_, col) => row * SIZE + col));
        for (let col = 0; col < SIZE; col++) units.push([...Array(SIZE)].map((_, row) => row * SIZE + col));
        for (let boxRow = 0; boxRow < BOX; boxRow++) {
            for (let boxCol = 0; boxCol < BOX; boxCol++) {
                const unit = [];
                for (let row = boxRow * BOX; row < boxRow * BOX + BOX; row++) {
                    for (let col = boxCol * BOX; col < boxCol * BOX + BOX; col++) unit.push(row * SIZE + col);
                }
                units.push(unit);
            }
        }
        return units;
    }

    function buildCandidateSets(grid) {
        return grid.map((value, index) => value ? new Set() : new Set(candidates(grid, index)));
    }

    function removeFromSet(set, values) {
        let removed = 0;
        for (const value of values) {
            if (set.delete(value)) removed++;
        }
        return removed;
    }

    function applySingles(grid, sets, units, stats) {
        for (let index = 0; index < grid.length; index++) {
            if (!grid[index] && sets[index].size === 1) {
                grid[index] = [...sets[index]][0];
                stats.nakedSingles++;
                stats.logicalSteps++;
                return true;
            }
        }
        for (const unit of units) {
            for (let number = 1; number <= SIZE; number++) {
                const possible = unit.filter(index => !grid[index] && sets[index].has(number));
                if (possible.length === 1) {
                    grid[possible[0]] = number;
                    stats.hiddenSingles++;
                    stats.logicalSteps++;
                    return true;
                }
            }
        }
        return false;
    }

    function applyLockedCandidates(grid, sets, stats) {
        let removed = 0;
        for (let box = 0; box < 9; box++) {
            const boxUnit = unitsForBox(box);
            for (let number = 1; number <= SIZE; number++) {
                const possible = boxUnit.filter(index => !grid[index] && sets[index].has(number));
                if (possible.length < 2) continue;
                const rows = new Set(possible.map(index => Math.floor(index / SIZE)));
                const cols = new Set(possible.map(index => index % SIZE));
                if (rows.size === 1) {
                    const row = [...rows][0];
                    for (const index of unitsForRow(row)) {
                        if (!boxUnit.includes(index)) removed += removeFromSet(sets[index], [number]);
                    }
                }
                if (cols.size === 1) {
                    const col = [...cols][0];
                    for (const index of unitsForColumn(col)) {
                        if (!boxUnit.includes(index)) removed += removeFromSet(sets[index], [number]);
                    }
                }
            }
        }
        if (removed) stats.lockedCandidates++;
        return removed > 0;
    }

    function applyNakedPairs(grid, sets, stats) {
        let removed = 0;
        for (const unit of ALL_UNITS) {
            const pairs = new Map();
            for (const index of unit) {
                if (grid[index] || sets[index].size !== 2) continue;
                const key = [...sets[index]].sort((a, b) => a - b).join(",");
                if (!pairs.has(key)) pairs.set(key, []);
                pairs.get(key).push(index);
            }
            for (const [key, pairIndexes] of pairs) {
                if (pairIndexes.length !== 2) continue;
                const pair = key.split(",").map(Number);
                for (const index of unit) {
                    if (!pairIndexes.includes(index)) removed += removeFromSet(sets[index], pair);
                }
            }
        }
        if (removed) stats.nakedPairs++;
        return removed > 0;
    }

    function applyXWings(grid, sets, stats) {
        let removed = 0;
        for (let number = 1; number <= SIZE; number++) {
            const rowPairs = [];
            for (let row = 0; row < SIZE; row++) {
                const cols = unitsForRow(row).filter(index => !grid[index] && sets[index].has(number)).map(index => index % SIZE);
                if (cols.length === 2) rowPairs.push({ row, cols: cols.join(",") });
            }
            for (let i = 0; i < rowPairs.length; i++) {
                for (let j = i + 1; j < rowPairs.length; j++) {
                    if (rowPairs[i].cols !== rowPairs[j].cols) continue;
                    const cols = rowPairs[i].cols.split(",").map(Number);
                    for (const row of [...Array(SIZE).keys()]) {
                        if (row === rowPairs[i].row || row === rowPairs[j].row) continue;
                        for (const col of cols) removed += removeFromSet(sets[row * SIZE + col], [number]);
                    }
                }
            }
            const columnPairs = [];
            for (let col = 0; col < SIZE; col++) {
                const rows = unitsForColumn(col).filter(index => !grid[index] && sets[index].has(number)).map(index => Math.floor(index / SIZE));
                if (rows.length === 2) columnPairs.push({ col, rows: rows.join(",") });
            }
            for (let i = 0; i < columnPairs.length; i++) {
                for (let j = i + 1; j < columnPairs.length; j++) {
                    if (columnPairs[i].rows !== columnPairs[j].rows) continue;
                    const rows = columnPairs[i].rows.split(",").map(Number);
                    for (const col of [...Array(SIZE).keys()]) {
                        if (col === columnPairs[i].col || col === columnPairs[j].col) continue;
                        for (const row of rows) removed += removeFromSet(sets[row * SIZE + col], [number]);
                    }
                }
            }
        }
        if (removed) stats.xWings++;
        return removed > 0;
    }

    function unitsForRow(row) { return [...Array(SIZE)].map((_, col) => row * SIZE + col); }
    function unitsForColumn(col) { return [...Array(SIZE)].map((_, row) => row * SIZE + col); }
    function unitsForBox(box) {
        const boxRow = Math.floor(box / BOX) * BOX;
        const boxCol = (box % BOX) * BOX;
        const unit = [];
        for (let row = boxRow; row < boxRow + BOX; row++) {
            for (let col = boxCol; col < boxCol + BOX; col++) unit.push(row * SIZE + col);
        }
        return unit;
    }

    const ALL_UNITS = createUnits();

    function analyze(grid) {
        const work = clone(grid);
        let sets = buildCandidateSets(work);
        const stats = { logicalSteps: 0, nakedSingles: 0, hiddenSingles: 0, lockedCandidates: 0, nakedPairs: 0, xWings: 0 };
        let changed = true;
        let guard = 0;
        while (changed && guard++ < 500) {
            changed = false;
            if (applySingles(work, sets, ALL_UNITS, stats)) {
                sets = buildCandidateSets(work);
                changed = true;
                continue;
            }
            if (applyLockedCandidates(work, sets, stats)) { changed = true; continue; }
            if (applyNakedPairs(work, sets, stats)) { changed = true; continue; }
            if (applyXWings(work, sets, stats)) { changed = true; continue; }
        }
        return {
            clues: grid.filter(Boolean).length,
            ...stats,
            unresolved: work.filter(value => !value).length,
            requiresSearch: work.some(value => !value)
        };
    }

    root.SudokuSolver = Object.freeze({ clone, candidates, countSolutions, solve, isValidPlacement, isValidGrid, analyze });
})(window);
