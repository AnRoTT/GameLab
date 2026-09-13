(function (root) {
    "use strict";

    const SIZE = 9;
    const range = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffle = values => {
        const result = values.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };

    function createSolution() {
        const grid = Array(81).fill(0);
        function fill() {
            const next = findEmpty(grid);
            if (next < 0) return true;
            const row = Math.floor(next / SIZE);
            const col = next % SIZE;
            for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                if (!canPlace(grid, row, col, value)) continue;
                grid[next] = value;
                if (fill()) return true;
                grid[next] = 0;
            }
            return false;
        }
        fill();
        return grid;
    }

    function findEmpty(grid) { return grid.findIndex(value => value === 0); }

    function canPlace(grid, row, col, value) {
        for (let i = 0; i < SIZE; i++) {
            if (grid[row * SIZE + i] === value || grid[i * SIZE + col] === value) return false;
        }
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
            for (let c = boxCol; c < boxCol + 3; c++) {
                if (grid[r * SIZE + c] === value) return false;
            }
        }
        return true;
    }

    function createPuzzle(level) {
        const profile = root.SudokuSettings.clues[level] || root.SudokuSettings.clues.Leicht;
        let best = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const solution = createSolution();
            const puzzle = solution.slice();
            const target = range(profile.min, profile.max);
            const order = shuffle([...Array(81).keys()]);
            for (const index of order) {
                if (puzzle.filter(Boolean).length <= target) break;
                const previous = puzzle[index];
                puzzle[index] = 0;
                if (root.SudokuSolver.countSolutions(puzzle.slice(), 2) !== 1) puzzle[index] = previous;
            }
            const clues = puzzle.filter(Boolean).length;
            if (!best || Math.abs(clues - target) < Math.abs(best.puzzle.filter(Boolean).length - target)) {
                best = { puzzle, solution };
            }
            if (clues === target) break;
        }
        return best;
    }

    root.SudokuGenerator = Object.freeze({ createSolution, createPuzzle });
})(window);
