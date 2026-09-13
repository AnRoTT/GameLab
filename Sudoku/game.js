(function () {
    "use strict";

    const levels = window.SudokuSettings.levels;
    const setupScreen = document.getElementById("setupScreen");
    const gameScreen = document.getElementById("gameScreen");
    const board = document.getElementById("board");
    const numberPad = document.getElementById("numberPad");
    const difficultyButton = document.getElementById("difficultyButton");
    const startButton = document.getElementById("startButton");
    const resumeSavedButton = document.getElementById("resumeSavedButton");
    const newPuzzleButton = document.getElementById("newPuzzleButton");
    const newPuzzleConfirmBackdrop = document.getElementById("newPuzzleConfirmBackdrop");
    const newPuzzleCancel = document.getElementById("newPuzzleCancel");
    const newPuzzleConfirm = document.getElementById("newPuzzleConfirm");
    const resumeConfirmBackdrop = document.getElementById("resumeConfirmBackdrop");
    const resumeDecline = document.getElementById("resumeDecline");
    const resumeAccept = document.getElementById("resumeAccept");
    const resumeProgress = document.getElementById("resumeProgress");
    const customPuzzleTools = document.getElementById("customPuzzleTools");
    const customValidateButton = document.getElementById("customValidateButton");
    const customResetButton = document.getElementById("customResetButton");
    const customSolveButton = document.getElementById("customSolveButton");
    const customImportButton = document.getElementById("customImportButton");
    const customImportInput = document.getElementById("customImportInput");
    const customPuzzleStatus = document.getElementById("customPuzzleStatus");
    const customImportAssistant = document.getElementById("customImportAssistant");
    const ocrProgressBadge = document.getElementById("ocrProgressBadge");
    const customImportCanvas = document.getElementById("customImportCanvas");
    const customImportMagnifier = document.getElementById("customImportMagnifier");
    const customImportHint = document.getElementById("customImportHint");
    const customImportQuality = document.getElementById("customImportQuality");
    const customImportInstruction = document.getElementById("customImportInstruction");
    const customImportCancel = document.getElementById("customImportCancel");
    const customImportAccept = document.getElementById("customImportAccept");
    const customImportReview = document.getElementById("customImportReview");
    const customReviewQuestion = document.getElementById("customReviewQuestion");
    const customReviewGridCanvas = document.getElementById("customReviewGridCanvas");
    const customReviewCanvas = document.getElementById("customReviewCanvas");
    const customReviewCandidates = document.getElementById("customReviewCandidates");
    const customReviewNumbers = document.getElementById("customReviewNumbers");
    const screenController = window.AndisMobileLayout?.createScreenController?.({ setupScreen, gameScreen, body: document.body });
    let mobilePrototype = window.AndisMobileLayout?.detectMobileSession?.() ?? false;
    screenController?.applyMode(mobilePrototype, false);
    if (!mobilePrototype) {
        setupScreen.hidden = false;
        gameScreen.hidden = true;
    }
    screenController?.watchResponsiveMode?.(isMobile => { mobilePrototype = isMobile; });
    const fullscreenController = screenController?.bindFullscreen?.({
        button: document.getElementById("fullscreenToggle"),
        isMobile: () => mobilePrototype
    });

    let selected = 0;
    let notesMode = false;
    let levelIndex = 0;
    let customMode = false;
    let state = null;
    let undoStack = [];
    let redoStack = [];
    let newPuzzlePreviouslyFocused = null;
    let resumePreviouslyFocused = null;
    let pendingSavedState = null;
    let leavingToMenu = false;
    let savedInSetup = false;
    let returningToSetup = false;
    let pendingImport = null;
    let importDragIndex = -1;
    let importHoverIndex = -1;
    let customReviewQueue = [];
    let importDragHandle = null;
    let lastImportedGridSource = null;
    let lastImportQuality = null;
    let automaticConflictReviewPass = 0;

    function solvePerspectiveSystem(matrix, values) {
        const size = values.length;
        const augmented = matrix.map((row, index) => row.concat(values[index]));
        for (let column = 0; column < size; column++) {
            let pivot = column;
            for (let row = column + 1; row < size; row++) {
                if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
            }
            if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
            [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
            const divisor = augmented[column][column];
            for (let entry = column; entry <= size; entry++) augmented[column][entry] /= divisor;
            for (let row = 0; row < size; row++) {
                if (row === column) continue;
                const factor = augmented[row][column];
                for (let entry = column; entry <= size; entry++) augmented[row][entry] -= factor * augmented[column][entry];
            }
        }
        return augmented.map(row => row[size]);
    }

    function createPerspectiveMatrix(points, outputSize) {
        const lastPixel = outputSize - 1;
        const destination = [
            { x: 0, y: 0 },
            { x: lastPixel, y: 0 },
            { x: lastPixel, y: lastPixel },
            { x: 0, y: lastPixel }
        ];
        const matrix = [];
        const values = [];
        destination.forEach((target, index) => {
            const source = points[index];
            matrix.push([target.x, target.y, 1, 0, 0, 0, -source.x * target.x, -source.x * target.y]);
            values.push(source.x);
            matrix.push([0, 0, 0, target.x, target.y, 1, -source.y * target.x, -source.y * target.y]);
            values.push(source.y);
        });
        return solvePerspectiveSystem(matrix, values);
    }

    function createOcrSourceCanvas(image) {
        // Die Vorschau bleibt bewusst klein und handlich. Für die eigentliche
        // Erkennung verwenden wir jedoch mehr Details des Originalfotos.
        const maximumDimension = 1800;
        const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function rectifyImportCanvas(points, sourceCanvas) {
        // 120 Pixel pro Feld bewahren bei dünnem Zeitungsdruck deutlich mehr
        // Zeicheninformation als die bisherige 100-Pixel-Rasterung.
        const outputSize = 1080;
        const matrix = createPerspectiveMatrix(points, outputSize);
        if (!matrix) throw new Error("Die vier Eckpunkte konnten nicht verarbeitet werden.");
        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
        const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const output = document.createElement("canvas");
        output.width = outputSize;
        output.height = outputSize;
        const outputContext = output.getContext("2d");
        const outputPixels = outputContext.createImageData(outputSize, outputSize);
        for (let y = 0; y < outputSize; y++) {
            for (let x = 0; x < outputSize; x++) {
                const denominator = matrix[6] * x + matrix[7] * y + 1;
                const sourceX = (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator;
                const sourceY = (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator;
                const targetOffset = (y * outputSize + x) * 4;
                if (sourceX < 0 || sourceY < 0 || sourceX >= sourceCanvas.width || sourceY >= sourceCanvas.height) {
                    outputPixels.data[targetOffset] = 255;
                    outputPixels.data[targetOffset + 1] = 255;
                    outputPixels.data[targetOffset + 2] = 255;
                    outputPixels.data[targetOffset + 3] = 255;
                    continue;
                }
                // Keine harte Rundung: Sie lässt dünne Querstriche und Kanten
                // beim perspektivischen Entzerren ausfransen. Bilineare
                // Abtastung erhält die Zeichenform wesentlich gleichmäßiger.
                const left = Math.floor(sourceX);
                const top = Math.floor(sourceY);
                const right = Math.min(left + 1, sourceCanvas.width - 1);
                const bottom = Math.min(top + 1, sourceCanvas.height - 1);
                const weightX = sourceX - left;
                const weightY = sourceY - top;
                const topLeft = (top * sourceCanvas.width + left) * 4;
                const topRight = (top * sourceCanvas.width + right) * 4;
                const bottomLeft = (bottom * sourceCanvas.width + left) * 4;
                const bottomRight = (bottom * sourceCanvas.width + right) * 4;
                for (let channel = 0; channel < 3; channel++) {
                    const topValue = sourcePixels.data[topLeft + channel] * (1 - weightX)
                        + sourcePixels.data[topRight + channel] * weightX;
                    const bottomValue = sourcePixels.data[bottomLeft + channel] * (1 - weightX)
                        + sourcePixels.data[bottomRight + channel] * weightX;
                    outputPixels.data[targetOffset + channel] = Math.round(topValue * (1 - weightY) + bottomValue * weightY);
                }
                outputPixels.data[targetOffset + 3] = 255;
            }
        }
        outputContext.putImageData(outputPixels, 0, 0);
        return output;
    }

    function createOcrCellBase(source, row, col) {
        const cellSize = source.width / 9;
        const inset = cellSize * .12;
        const cell = document.createElement("canvas");
        cell.width = 220;
        cell.height = 220;
        const context = cell.getContext("2d", { willReadFrequently: true });
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, cell.width, cell.height);
        // Der etwas grössere Beschnitt entfernt die Sudoku-Linien. Der
        // gleichmässige weisse Rand hilft Tesseract bei Einzelziffern.
        context.drawImage(source, col * cellSize + inset, row * cellSize + inset,
            cellSize - inset * 2, cellSize - inset * 2, 24, 24, 172, 172);
        return cell;
    }

    function prepareReviewCell(source, row, col) {
        const cellSize = source.width / 9;
        const inset = cellSize * .12;
        const cell = document.createElement("canvas");
        cell.width = 220;
        cell.height = 220;
        const context = cell.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, cell.width, cell.height);
        // Die Prüfansicht zeigt bewusst den unveränderten Fotoausschnitt.
        // Kontrast, Graustufen und Schwellenwerte bleiben ausschließlich der OCR
        // vorbehalten, damit der Vergleich mit dem Zeitungsrätsel eindeutig ist.
        context.drawImage(source, col * cellSize + inset, row * cellSize + inset,
            cellSize - inset * 2, cellSize - inset * 2, 24, 24, 172, 172);
        return cell;
    }

    function grayscaleImage(image) {
        for (let index = 0; index < image.data.length; index += 4) {
            const gray = Math.round(image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114);
            image.data[index] = gray;
            image.data[index + 1] = gray;
            image.data[index + 2] = gray;
            image.data[index + 3] = 255;
        }
        return image;
    }

    function normalizeOcrContrast(image) {
        const histogram = new Uint32Array(256);
        for (let index = 0; index < image.data.length; index += 4) histogram[image.data[index]]++;
        const total = image.width * image.height;
        const percentile = fraction => {
            const target = total * fraction;
            let count = 0;
            for (let value = 0; value < 256; value++) {
                count += histogram[value];
                if (count >= target) return value;
            }
            return 255;
        };
        const low = percentile(.015);
        const high = percentile(.985);
        if (high - low < 24) return image;
        for (let index = 0; index < image.data.length; index += 4) {
            const value = Math.max(0, Math.min(255, Math.round((image.data[index] - low) * 255 / (high - low))));
            image.data[index] = value;
            image.data[index + 1] = value;
            image.data[index + 2] = value;
        }
        return image;
    }

    

    function strengthenOcrContrast(image) {
        // Die reine Histogramm-Normalisierung macht den Gesamtbereich nutzbar.
        // Dieser zweite, vorsichtige Kontrastschritt trennt dunkle Druckfarbe
        // deutlicher vom leicht grauen Zeitungspapier. Er wird nur für eine
        // zusätzliche OCR-Meinung verwendet, nie für die Fotoanzeige.
        const pivot = 160;
        const factor = 1.55;
        for (let index = 0; index < image.data.length; index += 4) {
            const value = Math.max(0, Math.min(255, Math.round(pivot + (image.data[index] - pivot) * factor)));
            image.data[index] = value;
            image.data[index + 1] = value;
            image.data[index + 2] = value;
        }
        return image;
    }

    function otsuThreshold(image) {
        const histogram = new Uint32Array(256);
        for (let index = 0; index < image.data.length; index += 4) {
            histogram[image.data[index]]++;
        }
        const total = image.width * image.height;
        let sum = 0;
        for (let gray = 0; gray < 256; gray++) sum += gray * histogram[gray];
        let sumBackground = 0;
        let weightBackground = 0;
        let bestThreshold = 128;
        let bestVariance = 0;
        for (let gray = 0; gray < 256; gray++) {
            weightBackground += histogram[gray];
            if (!weightBackground) continue;
            const weightForeground = total - weightBackground;
            if (!weightForeground) break;
            sumBackground += gray * histogram[gray];
            const meanBackground = sumBackground / weightBackground;
            const meanForeground = (sum - sumBackground) / weightForeground;
            const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
            if (variance > bestVariance) {
                bestVariance = variance;
                bestThreshold = gray;
            }
        }
        for (let index = 0; index < image.data.length; index += 4) {
            const value = image.data[index] < bestThreshold ? 0 : 255;
            image.data[index] = value;
            image.data[index + 1] = value;
            image.data[index + 2] = value;
            image.data[index + 3] = 255;
        }
        return image;
    }

    function adaptiveThreshold(image) {
        const { width, height, data } = image;
        const integral = new Uint32Array((width + 1) * (height + 1));
        for (let y = 1; y <= height; y++) {
            let rowSum = 0;
            for (let x = 1; x <= width; x++) {
                rowSum += data[((y - 1) * width + (x - 1)) * 4];
                integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
            }
        }
        const radius = 18;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const left = Math.max(0, x - radius);
                const top = Math.max(0, y - radius);
                const right = Math.min(width - 1, x + radius);
                const bottom = Math.min(height - 1, y + radius);
                const sum = integral[(bottom + 1) * (width + 1) + (right + 1)]
                    - integral[top * (width + 1) + (right + 1)]
                    - integral[(bottom + 1) * (width + 1) + left]
                    + integral[top * (width + 1) + left];
                const mean = sum / ((right - left + 1) * (bottom - top + 1));
                const offset = (y * width + x) * 4;
                const value = data[offset] < mean - 12 ? 0 : 255;
                data[offset] = value;
                data[offset + 1] = value;
                data[offset + 2] = value;
            }
        }
        return image;
    }

function normalizeLocalIllumination(image) {
        const { width, height, data } = image;
        const integral = new Uint32Array((width + 1) * (height + 1));
        for (let y = 1; y <= height; y++) {
            let rowSum = 0;
            for (let x = 1; x <= width; x++) {
                const offset = ((y - 1) * width + (x - 1)) * 4;
                rowSum += data[offset];
                integral[y * (width + 1) + x] =
                    integral[(y - 1) * (width + 1) + x] + rowSum;
            }
        }
        const radius = Math.max(10, Math.round(Math.min(width, height) * .09));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const left = Math.max(0, x - radius);
                const top = Math.max(0, y - radius);
                const right = Math.min(width - 1, x + radius);
                const bottom = Math.min(height - 1, y + radius);
                const area = (right - left + 1) * (bottom - top + 1);
                const localSum = integral[(bottom + 1) * (width + 1) + right + 1]
                    - integral[top * (width + 1) + right + 1]
                    - integral[(bottom + 1) * (width + 1) + left]
                    + integral[top * (width + 1) + left];
                const localMean = localSum / area;
                const offset = (y * width + x) * 4;
                const normalized = Math.max(0, Math.min(255,
                    Math.round(150 + (data[offset] - localMean) * 1.55)));
                data[offset] = normalized;
                data[offset + 1] = normalized;
                data[offset + 2] = normalized;
            }
        }
        return image;
    }

    function prepareOcrCell(source, row, col, variant = "otsu") {
        const cell = createOcrCellBase(source, row, col);
        const context = cell.getContext("2d", { willReadFrequently: true });
        const image = grayscaleImage(context.getImageData(0, 0, cell.width, cell.height));
        normalizeOcrContrast(image);
        // Lokale Korrektur und adaptive Schwellenwerte helfen Tesseract,
        // beeinflussen aber niemals die Originalbild-Belegungserkennung.
        if (variant === "local" || variant === "adaptive" || variant === "enhanced") {
            normalizeLocalIllumination(image);
        }
        if (variant === "otsu" || variant === "adaptive" || variant === "enhanced") {
            if (variant === "enhanced") strengthenOcrContrast(image);
            if (variant === "adaptive") adaptiveThreshold(image);
            else otsuThreshold(image);
        }
        context.putImageData(image, 0, 0);
        return cell;
    }

    function analyzeCellInk(source, row, col) {
        const context = source.getContext("2d", { willReadFrequently: true });
        const cellSize = source.width / 9;
        const size = Math.max(24, Math.round(cellSize * .70));
        const inset = cellSize * .15;
        const x0 = Math.max(0, Math.round(col * cellSize + inset));
        const y0 = Math.max(0, Math.round(row * cellSize + inset));
        const pixels = context.getImageData(
            x0,
            y0,
            Math.min(size, source.width - x0),
            Math.min(size, source.height - y0)
        );
        const width = pixels.width;
        const height = pixels.height;
        const area = width * height;
        if (!area) return { score: 0, reviewable: false };

        let best = {
            score: 0,
            darkRatio: 0,
            componentRatio: 0,
            density: 0,
            widthRatio: 0,
            heightRatio: 0,
            centerDistance: 1
        };
        let evidenceCount = 0;

        // Eine echte Druckziffer muss bei mehreren Schwellenwerten als
        // kompakte, zentral liegende Struktur sichtbar bleiben. Schatten und
        // Papierfaser tauchen dagegen meist nur bei einer hohen Schwelle auf
        // oder bilden breite, flache Komponenten.
        for (const threshold of [65, 85, 105, 125, 145]) {
            const dark = new Uint8Array(area);
            let darkCount = 0;
            for (let index = 0; index < pixels.data.length; index += 4) {
                const gray = pixels.data[index] * .299
                    + pixels.data[index + 1] * .587
                    + pixels.data[index + 2] * .114;
                if (gray < threshold) {
                    dark[index / 4] = 1;
                    darkCount++;
                }
            }
            if (!darkCount) continue;

            let largest = 0;
            let largestWidth = 0;
            let largestHeight = 0;
            let largestDensity = 0;
            let largestCenterX = width / 2;
            let largestCenterY = height / 2;
            const queue = [];

            for (let start = 0; start < area; start++) {
                if (!dark[start]) continue;
                dark[start] = 0;
                queue.push(start);
                let componentSize = 0;
                let minX = width;
                let minY = height;
                let maxX = 0;
                let maxY = 0;
                while (queue.length) {
                    const current = queue.pop();
                    componentSize++;
                    const x = current % width;
                    const y = Math.floor(current / width);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    for (let offsetY = -1; offsetY <= 1; offsetY++) {
                        for (let offsetX = -1; offsetX <= 1; offsetX++) {
                            if (!offsetX && !offsetY) continue;
                            const neighborX = x + offsetX;
                            const neighborY = y + offsetY;
                            if (neighborX < 0 || neighborX >= width
                                || neighborY < 0 || neighborY >= height) continue;
                            const neighbor = neighborY * width + neighborX;
                            if (dark[neighbor]) {
                                dark[neighbor] = 0;
                                queue.push(neighbor);
                            }
                        }
                    }
                }
                if (componentSize > largest) {
                    largest = componentSize;
                    largestWidth = maxX - minX + 1;
                    largestHeight = maxY - minY + 1;
                    largestDensity = componentSize / (largestWidth * largestHeight);
                    largestCenterX = (minX + maxX) / 2;
                    largestCenterY = (minY + maxY) / 2;
                }
            }

            const darkRatio = darkCount / area;
            const componentRatio = largest / area;
            const widthRatio = largestWidth / width;
            const heightRatio = largestHeight / height;
            const centerDistance = Math.hypot(
                (largestCenterX / width) - .5,
                (largestCenterY / height) - .5
            );
            const plausibleShape = componentRatio >= .012
                && componentRatio <= .34
                && widthRatio >= .07
                && widthRatio <= .72
                && heightRatio >= .16
                && heightRatio <= .92
                && largestDensity >= .07
                && centerDistance <= .34;
            if (plausibleShape) evidenceCount++;

            const shapeScore = plausibleShape
                ? Math.min(1, largestDensity / .22)
                    * Math.min(1, componentRatio / .035)
                : 0;
            const score = darkRatio * .35 + shapeScore * .65;
            if (score > best.score) {
                best = {
                    score,
                    darkRatio,
                    componentRatio,
                    density: largestDensity,
                    widthRatio,
                    heightRatio,
                    centerDistance
                };
            }
        }

        const reviewable = evidenceCount >= 2
            && best.componentRatio >= .012
            && best.density >= .07
            && best.centerDistance <= .34;
        return { ...best, evidenceCount, reviewable };
    }

    function cellContainsDarkMark(source, row, col) {
        return analyzeCellInk(source, row, col).reviewable;
    }

    function cellContainsDarkMark(source, row, col) {
        return analyzeCellInk(source, row, col).reviewable;
    }

    function assessSudokuImageQuality(source) {
        const context = source.getContext("2d", { willReadFrequently: true });
        const pixels = context.getImageData(0, 0, source.width, source.height).data;
        let sum = 0;
        let sumSquares = 0;
        let darkPixels = 0;
        let edgeEnergy = 0;
        let previous = null;
        const step = Math.max(1, Math.floor(Math.min(source.width, source.height) / 420));
        let samples = 0;
        for (let y = 0; y < source.height; y += step) {
            for (let x = 0; x < source.width; x += step) {
                const offset = (y * source.width + x) * 4;
                const gray = pixels[offset] * .299 + pixels[offset + 1] * .587 + pixels[offset + 2] * .114;
                sum += gray;
                sumSquares += gray * gray;
                if (gray < 75) darkPixels++;
                if (previous !== null) edgeEnergy += Math.abs(gray - previous);
                previous = gray;
                samples++;
            }
        }
        const mean = samples ? sum / samples : 0;
        const contrast = samples ? Math.sqrt(Math.max(0, sumSquares / samples - mean * mean)) : 0;
        const darkRatio = samples ? darkPixels / samples : 1;
        const averageEdge = samples > 1 ? edgeEnergy / (samples - 1) : 0;
        const visibleCells = Array.from({ length: 81 }, (_, index) =>
            cellContainsDarkMark(source, Math.floor(index / 9), index % 9)
        ).filter(Boolean).length;
        const issues = [];
        if (contrast < 20) issues.push("zu wenig Kontrast");
        else if (contrast < 30) issues.push("niedriger Kontrast");
        if (averageEdge < 7) issues.push("möglicherweise unscharf");
        if (mean < 45) issues.push("zu dunkel");
        if (mean > 235) issues.push("überbelichtet");
        if (darkRatio > .42) issues.push("zu viele dunkle Bereiche");
        if (visibleCells > 70) issues.push("ungewöhnlich viele dunkle Zellen");
        const score = Math.max(0, Math.min(100,
            100
            - Math.max(0, 30 - contrast) * 1.5
            - Math.max(0, 7 - averageEdge) * 4
            - (mean < 45 || mean > 235 ? 18 : 0)
            - (darkRatio > .42 ? 20 : 0)
            - (visibleCells > 70 ? 18 : 0)
        ));
        return {
            score: Math.round(score),
            label: score >= 75 ? "Gut" : score >= 50 ? "Unsicher" : "Schlecht",
            issues,
            visibleCells
        };
    }

    function updateImportQuality(source) {
        if (!customImportQuality) return;
        const quality = assessSudokuImageQuality(source);
        const detail = quality.issues.length ? " (" + quality.issues.join(", ") + ")" : "";
        customImportQuality.textContent = "Fotoqualität: " + quality.label + " – " + quality.score + "/100" + detail;
        customImportQuality.classList.toggle("warning", quality.score < 75);
        customImportQuality.classList.toggle("error", quality.score < 50);
        return quality;
    }

    const emptyNotes = () => Array.from({ length: 81 }, () => []);
    const click = () => window.AndisSound?.playUiClick?.();
    const currentLevel = () => levels[levelIndex];

    let ocrBadgeTimer = null;
    function setOcrProgress(message) {
        if (!ocrProgressBadge) return;
        if (ocrBadgeTimer) window.clearTimeout(ocrBadgeTimer);
        delete ocrProgressBadge.dataset.persistent;
        ocrProgressBadge.classList.remove("fade-out");
        ocrProgressBadge.textContent = message;
        ocrProgressBadge.hidden = false;
    }

    function showCustomEntryHint() {
        if (!ocrProgressBadge) return;
        if (ocrBadgeTimer) window.clearTimeout(ocrBadgeTimer);
        ocrProgressBadge.dataset.persistent = "custom-entry";
        ocrProgressBadge.classList.remove("fade-out");
        ocrProgressBadge.textContent = "Feld markieren und Zahl eingeben oder Foto importieren";
        ocrProgressBadge.hidden = false;
    }

    function dismissCustomEntryHint() {
        if (!ocrProgressBadge || ocrProgressBadge.dataset.persistent !== "custom-entry") return;
        if (ocrBadgeTimer) window.clearTimeout(ocrBadgeTimer);
        delete ocrProgressBadge.dataset.persistent;
        ocrProgressBadge.classList.add("fade-out");
        ocrBadgeTimer = window.setTimeout(() => {
            ocrProgressBadge.hidden = true;
            ocrProgressBadge.classList.remove("fade-out");
            ocrBadgeTimer = null;
        }, 350);
    }

    function clearCustomEntryHint() {
        if (!ocrProgressBadge || ocrProgressBadge.dataset.persistent !== "custom-entry") return;
        if (ocrBadgeTimer) window.clearTimeout(ocrBadgeTimer);
        delete ocrProgressBadge.dataset.persistent;
        ocrProgressBadge.classList.remove("fade-out");
        ocrProgressBadge.hidden = true;
        ocrBadgeTimer = null;
    }

    function finishOcrProgress(message = "Import abgeschlossen", duration = 1200) {
        if (!ocrProgressBadge) return;
        setOcrProgress(message);
        ocrBadgeTimer = window.setTimeout(() => {
            ocrProgressBadge.hidden = true;
            ocrBadgeTimer = null;
        }, duration);
    }

    const ocrProgressTarget = {
        set textContent(value) {
            setOcrProgress(value);
        }
    };

    function drawImportAssistant() {
        if (!pendingImport || !customImportCanvas) return;
        const context = customImportCanvas.getContext("2d");
        context.clearRect(0, 0, customImportCanvas.width, customImportCanvas.height);
        if (pendingImport.rectified) {
            context.drawImage(pendingImport.rectifiedCanvas, 0, 0, customImportCanvas.width, customImportCanvas.height);
            context.strokeStyle = "rgba(123, 92, 255, .9)";
            context.lineWidth = 2;
            for (let index = 1; index < 9; index++) {
                const position = (customImportCanvas.width / 9) * index;
                context.beginPath();
                context.moveTo(position, 0);
                context.lineTo(position, customImportCanvas.height);
                context.moveTo(0, position);
                context.lineTo(customImportCanvas.width, position);
                context.stroke();
            }
            customImportMagnifier.classList.remove("visible");
            return;
        }
        context.drawImage(pendingImport.image, 0, 0, customImportCanvas.width, customImportCanvas.height);
        const points = pendingImport.points;
        context.save();
        context.fillStyle = "rgba(8, 10, 16, .42)";
        context.beginPath();
        context.rect(0, 0, customImportCanvas.width, customImportCanvas.height);
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => context.lineTo(point.x, point.y));
        context.closePath();
        context.fill("evenodd");
        context.strokeStyle = "#64d6a0";
        context.lineWidth = Math.max(3, customImportCanvas.width / 240);
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => context.lineTo(point.x, point.y));
        context.closePath();
        context.stroke();
        const handles = points;
        handles.forEach((point, index) => {
            const markerSize = Math.max(12, customImportCanvas.width / 48);
            context.strokeStyle = index === importDragIndex
                ? "#f0c86f"
                : index >= 4 ? "#64d6a0" : "#4f8cff";
            context.lineWidth = Math.max(2, customImportCanvas.width / 500);
            context.beginPath();
            context.moveTo(point.x - markerSize, point.y);
            context.lineTo(point.x + markerSize, point.y);
            context.moveTo(point.x, point.y - markerSize);
            context.lineTo(point.x, point.y + markerSize);
            context.stroke();
        });
        context.restore();
        drawImportMagnifier();
    }

    function drawImportMagnifier() {
        if (!pendingImport || Math.max(importDragIndex, importHoverIndex) < 0) {
            customImportMagnifier.classList.remove("visible");
            return;
        }
        const index = importDragIndex >= 0 ? importDragIndex : importHoverIndex;
        const handles = pendingImport.points;
        const point = handles[index];
        const context = customImportMagnifier.getContext("2d");
        const sourceRadius = Math.max(42, customImportCanvas.width / 14);
        context.clearRect(0, 0, customImportMagnifier.width, customImportMagnifier.height);
        context.fillStyle = "#080a10";
        context.fillRect(0, 0, customImportMagnifier.width, customImportMagnifier.height);
        context.drawImage(
            customImportCanvas,
            point.x - sourceRadius,
            point.y - sourceRadius,
            sourceRadius * 2,
            sourceRadius * 2,
            0,
            0,
            customImportMagnifier.width,
            customImportMagnifier.height
        );
        context.strokeStyle = "#f0c86f";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, customImportMagnifier.height / 2);
        context.lineTo(customImportMagnifier.width, customImportMagnifier.height / 2);
        context.moveTo(customImportMagnifier.width / 2, 0);
        context.lineTo(customImportMagnifier.width / 2, customImportMagnifier.height);
        context.stroke();
        customImportMagnifier.classList.add("visible");
    }

    function openImportAssistant(file) {
        if (!file) return;
        const imageUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(imageUrl);
            const width = image.naturalWidth;
            const height = image.naturalHeight;
            const scale = Math.min(1, 1100 / Math.max(width, height));
            customImportCanvas.width = Math.max(1, Math.round(width * scale));
            customImportCanvas.height = Math.max(1, Math.round(height * scale));
            pendingImport = {
                file,
                image,
                rectified: false,
                rectifiedCanvas: null,
                points: [
                    { x: customImportCanvas.width * .135, y: customImportCanvas.height * .13 },
                    { x: customImportCanvas.width * .925, y: customImportCanvas.height * .13 },
                    { x: customImportCanvas.width * .925, y: customImportCanvas.height * .80 },
                    { x: customImportCanvas.width * .135, y: customImportCanvas.height * .80 }
                ]
            };
            importDragIndex = -1;
            importHoverIndex = -1;
            customImportCancel.textContent = "Abbrechen";
            customImportAccept.textContent = "Raster begradigen";
            customImportHint.textContent = "Die Ausrichtung wird zuerst nur geprüft.";
            if (customImportQuality) customImportQuality.textContent = "";
            customImportInstruction.textContent = "Ziehe die vier Eckpunkte genau auf den äußeren Sudoku-Rahmen.";
            customImportAssistant.hidden = false;
            drawImportAssistant();
        };
        image.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            customPuzzleStatus.textContent = "Das Bild konnte nicht gelesen werden.";
        };
        image.src = imageUrl;
    }

    function closeImportAssistant() {
        customImportAssistant.hidden = true;
        pendingImport = null;
        importDragIndex = -1;
        importHoverIndex = -1;
        customImportInput.value = "";
        customImportInstruction.textContent = "Ziehe die vier Eckpunkte genau auf den äußeren Sudoku-Rahmen.";
    }

    function updateSetup() {
        difficultyButton.textContent = customMode ? "Rätsel-Sandkasten" : currentLevel();
        const customEntry = Boolean(state?.mode === "custom" && state.customPhase === "entry");
        const readyPreview = Boolean(state?.preview && state.puzzle?.some(Boolean)
            && (state.mode !== "custom" || state.customPhase === "ready"));
        const running = Boolean(state && !state.preview && !state.completed && !savedInSetup && !customEntry);
        const mobileCustomSetup = Boolean(mobilePrototype && customMode && !state);
        const mobileGeneratedSetup = Boolean(mobilePrototype && !customMode && !state);
        const primaryReady = running || readyPreview || mobileCustomSetup || mobileGeneratedSetup;
        difficultyButton.disabled = running;
        difficultyButton.classList.toggle("button-disabled", running);
        startButton.disabled = !primaryReady;
        startButton.classList.toggle("button-disabled", !primaryReady);
        if (running) startButton.textContent = "Spiel abbrechen";
        else if (readyPreview) startButton.textContent = "Jetzt spielen";
        else if (mobileCustomSetup) startButton.textContent = "Rätsel erstellen";
        else if (mobileGeneratedSetup) startButton.textContent = "Neues Rätsel";
        else startButton.textContent = "Jetzt spielen";
        const mobileGameAction = document.getElementById("mobileGameAction");
        if (mobileGameAction) {
            mobileGameAction.textContent = readyPreview ? "Jetzt spielen" : running ? "Spiel abbrechen" : "Zurück";
        }
    }

    difficultyButton.addEventListener("click", () => {
        if (difficultyButton.disabled) return;
        if (customMode) {
            customMode = false;
            levelIndex = 0;
        } else if (levelIndex === levels.length - 1) {
            customMode = true;
        } else {
            levelIndex++;
        }
        updateSetup();
        if (state && (state.preview || state.mode === "custom")) {
            state.mode = customMode ? "custom" : "generated";
            state.level = customMode ? "Rätsel-Sandkasten" : currentLevel();
            state.customPhase = customMode ? "entry" : null;
            state.preview = !customMode;
            state.started = false;
            state.puzzle = Array(81).fill(0);
            state.solution = null;
            state.values = Array(81).fill(0);
            state.notes = emptyNotes();
            state.conflictIndexes = [];
            selected = 0;
            if (customMode) showCustomEntryHint();
            else clearCustomEntryHint();
            render();
        }
        click();
    });
    function newGame() {
        savedInSetup = false;
        lastImportedGridSource = null;
        lastImportQuality = null;
        clearCustomEntryHint();
        const generated = window.SudokuGenerator.createPuzzle(currentLevel());
        state = {
            started: false,
            preview: true,
            level: currentLevel(),
            mode: "generated",
            customPhase: null,
            puzzle: generated.puzzle,
            solution: generated.solution,
            values: generated.puzzle.slice(),
            notes: emptyNotes(),
            checked: false,
            completed: false,
            hintIndex: null,
            hintedEntries: Array(81).fill(false)
        };
        selected = state.puzzle.findIndex(value => !value);
        undoStack = [];
        redoStack = [];
        SudokuStorage.save(state);
        if (mobilePrototype) {
            screenController?.showGame?.();
        } else {
            document.body.classList.add("game-active");
            setupScreen.hidden = false;
            gameScreen.hidden = false;
        }
        render();
        focusBoard();
    }

    function newCustomPuzzle() {
        savedInSetup = false;
        lastImportedGridSource = null;
        lastImportQuality = null;
        showCustomEntryHint();
        state = {
            started: false,
            preview: false,
            level: "Rätsel-Sandkasten",
            mode: "custom",
            customPhase: "entry",
            puzzle: Array(81).fill(0),
            solution: null,
            values: Array(81).fill(0),
            notes: emptyNotes(),
            checked: false,
            completed: false,
            hintIndex: null,
            hintedEntries: Array(81).fill(false),
            revealedSolution: false
        };
        selected = 0;
        undoStack = [];
        redoStack = [];
        SudokuStorage.save(state);
        if (mobilePrototype) {
            screenController?.showGame?.();
        } else {
            document.body.classList.add("game-active");
            setupScreen.hidden = false;
            gameScreen.hidden = false;
        }
        render();
        focusBoard();
    }

    function startCurrentPuzzle() {
        if (!state?.preview || !state.puzzle?.some(Boolean) || !state.solution) return false;
        state.preview = false;
        state.started = true;
        if (state.mode === "custom") state.customPhase = "solving";
        savedInSetup = false;
        if (mobilePrototype) {
            screenController?.showGame?.();
        } else {
            document.body.classList.add("game-active");
            setupScreen.hidden = false;
            gameScreen.hidden = false;
        }
        SudokuStorage.save(state);
        render();
        focusBoard();
        return true;
    }

    function startNewPuzzleForCurrentMode() {
        if (state?.mode === "custom" || customMode) newCustomPuzzle();
        else newGame();
    }

    function isValidSavedState(saved) {
        return Boolean(saved && !saved.completed
            && Array.isArray(saved.puzzle) && saved.puzzle.length === 81
            && (saved.solution === null || (Array.isArray(saved.solution) && saved.solution.length === 81))
            && Array.isArray(saved.values) && saved.values.length === 81
            && Array.isArray(saved.notes) && saved.notes.length === 81
            && (!saved.mode || saved.mode === "generated" || saved.mode === "custom"));
    }

    function isResumableSavedState(saved) {
        if (!isValidSavedState(saved)) return false;
        if (saved.preview || saved.customPhase === "entry") return false;
        if (saved.started === true) return true;
        // Alte Spielstände ohne Startkennzeichen bleiben nur erhalten, wenn
        // tatsächlich schon eigene Eingaben oder Notizen vorhanden sind.
        return saved.values.some((value, index) => value !== saved.puzzle[index])
            || saved.notes.some(note => Array.isArray(note) && note.length > 0);
    }

    function updateResumeAction() {
        const saved = SudokuStorage.load();
        const available = mobilePrototype && isResumableSavedState(saved);
        resumeSavedButton.hidden = !available;
        updateSetup();
    }

    function loadSaved(saved) {
        if (!isValidSavedState(saved)) return false;
        savedInSetup = false;
        state = saved;
        state.mode = state.mode || "generated";
        if (state.mode === "custom") state.level = "Rätsel-Sandkasten";
        state.customPhase = state.mode === "custom" ? (state.customPhase || "entry") : null;
        state.hintedEntries = Array.isArray(state.hintedEntries) && state.hintedEntries.length === 81
            ? state.hintedEntries
            : Array(81).fill(false);
        state.notes = state.notes.map(note => Array.isArray(note) ? note : []);
        levelIndex = Math.max(0, levels.indexOf(saved.level));
        customMode = state.mode === "custom";
        updateSetup();
        selected = findFirstSelectableCell();
        undoStack = [];
        redoStack = [];
        if (mobilePrototype) {
            screenController?.showGame?.();
        } else {
            document.body.classList.add("game-active");
            setupScreen.hidden = false;
            gameScreen.hidden = false;
        }
        render();
        focusBoard();
        return true;
    }

    function isGiven(index) { return Boolean(state.puzzle[index]); }
    function isCustomEntry() {
        return state?.mode === "custom" && state.customPhase === "entry";
    }
    function isSelectableCell(index) {
        return index >= 0 && index < 81 && (isCustomEntry() || !isGiven(index));
    }
    function findFirstSelectableCell() {
        const index = Array.from({ length: 81 }, (_, cellIndex) => cellIndex)
            .find(cellIndex => isSelectableCell(cellIndex));
        return index ?? 0;
    }
    function isComplete() {
        return Boolean(state.solution)
            && state.values.every(Boolean)
            && state.values.every((v, i) => v === state.solution[i]);
    }
    function isWrong(index) { return Boolean(state.checked && state.values[index] && state.values[index] !== state.solution[index]); }
    function isCheckedCorrect(index) {
        return Boolean(state.checked && !isGiven(index) && state.values[index] && state.values[index] === state.solution[index]);
    }

    function focusBoard() {
        board.focus({ preventScroll: true });
    }

    function selectCell(index, keepFocus = true) {
        if (state?.preview || !isSelectableCell(index)) return;
        if (index !== selected) notesMode = false;
        dismissCustomEntryHint();
        selected = Math.max(0, Math.min(80, index));
        render();
        if (keepFocus) focusBoard();
    }

    function render() {
        if (!state) return;
        board.innerHTML = "";
        if (Number.isInteger(selected)) {
            board.setAttribute("aria-activedescendant", `sudoku-cell-${selected}`);
        } else {
            board.removeAttribute("aria-activedescendant");
        }
        for (let index = 0; index < 81; index++) {
            const cell = document.createElement("button");
            const value = state.values[index];
            const row = Math.floor(index / 9);
            const col = index % 9;
            cell.type = "button";
            cell.className = "sudoku-cell";
            cell.id = `sudoku-cell-${index}`;
            cell.tabIndex = -1;
            cell.dataset.index = String(index);
            cell.setAttribute("role", "gridcell");
            cell.setAttribute("aria-selected", String(index === selected));
            cell.disabled = Boolean(state.preview || savedInSetup || (!isCustomEntry() && isGiven(index)));
            cell.setAttribute("aria-label", `Zeile ${row + 1}, Spalte ${col + 1}${value ? `, ${value}` : ", leer"}`);
            if (isGiven(index)) cell.classList.add("given");
            else if (value) cell.classList.add("user-entry");
            if (state.revealedSolution && value && !isGiven(index)) cell.classList.add("solution-reveal");
            if (state.hintedEntries[index] && value) cell.classList.add("hint-entry");
            if (index === selected) cell.classList.add("selected");
            if (isWrong(index)) cell.classList.add("wrong");
            if (state.conflictIndexes?.includes(index)) cell.classList.add("ocr-conflict");
            if (isCheckedCorrect(index)) cell.classList.add("checked-correct");
            if (state.hintIndex === index) cell.classList.add("hint-cell");
            if (col === 2 || col === 5) cell.classList.add("box-right");
            if (row === 2 || row === 5) cell.classList.add("box-bottom");
            if (value) {
                cell.textContent = value;
            } else if (state.notes[index].length) {
                const notes = document.createElement("span");
                notes.className = "notes";
                notes.textContent = state.notes[index].join(" ");
                cell.appendChild(notes);
            }
            if (!cell.disabled) cell.addEventListener("click", () => selectCell(index));
            board.appendChild(cell);
        }
        board.classList.toggle("completed", state.completed);
        board.classList.toggle("board-disabled", Boolean(state.preview || savedInSetup));
        updateSetup();
        updateButtons();
    }

    function updateButtons() {
        const preview = Boolean(state.preview);
        const customEntry = state.mode === "custom" && state.customPhase === "entry";
        document.getElementById("undoButton").disabled = preview || !undoStack.length;
        document.getElementById("redoButton").disabled = preview || !redoStack.length;
        const notesButton = document.getElementById("notesButton");
        notesButton.classList.toggle("active", notesMode);
        notesButton.setAttribute("aria-pressed", String(notesMode));
        numberPad.querySelectorAll(".number-button[data-number]").forEach(button => {
            const number = Number(button.dataset.number);
            button.disabled = preview;
            const isHintNumber = state.hintIndex !== null
                && number === state.solution[state.hintIndex];
            button.classList.toggle("hint-number", isHintNumber);
        });
        const clearNumberButton = numberPad.querySelector(".clear-number");
        if (clearNumberButton) clearNumberButton.disabled = preview;
        const customCompleted = state.mode === "custom" && state.completed;
        const customSolving = state.mode === "custom" && state.customPhase === "solving";
        customPuzzleTools.hidden = !(customEntry || customCompleted);
        customPuzzleStatus.hidden = state.mode !== "custom";
        customImportButton.hidden = !customEntry;
        customValidateButton.hidden = !customEntry;
        customResetButton.hidden = !(customEntry || customCompleted);
        customSolveButton.hidden = !customSolving;
        document.getElementById("notesButton").hidden = customEntry;
        document.getElementById("undoButton").hidden = customEntry;
        document.getElementById("redoButton").hidden = customEntry;
        document.getElementById("checkButton").hidden = customEntry;
        document.getElementById("hintButton").hidden = customEntry;
        const generatedMode = state.mode === "generated" && !customMode;
        newPuzzleButton.hidden = !generatedMode;
        [notesButton, document.getElementById("checkButton"), document.getElementById("hintButton"),
            customImportButton, customValidateButton, customResetButton, customSolveButton]
            .forEach(button => { button.disabled = preview || button.hidden; });
        newPuzzleButton.disabled = !generatedMode || Boolean(
            state && !state.preview && !state.completed && !savedInSetup
        );
        newPuzzleButton.classList.toggle("ready-action", generatedMode && !newPuzzleButton.disabled);
    }

    function hasProgress() {
        if (state?.mode === "custom" && state.customPhase === "entry") {
            return state.values.some(Boolean);
        }
        return Boolean(state && state.values.some((value, index) =>
            !state.puzzle[index] && (value || state.notes[index].length)
        ));
    }

    function closeNewPuzzleConfirm() {
        newPuzzleConfirmBackdrop.hidden = true;
        newPuzzlePreviouslyFocused?.focus?.({ preventScroll: true });
        newPuzzlePreviouslyFocused = null;
    }

    function requestNewPuzzle() {
        const running = Boolean(state && !state.preview && !state.completed && !savedInSetup);
        if (running) return;
        if (!state || state.completed || !hasProgress()) {
            startNewPuzzleForCurrentMode();
            return;
        }
        newPuzzlePreviouslyFocused = document.activeElement;
        newPuzzleConfirmBackdrop.hidden = false;
        newPuzzleConfirm.focus();
    }

    function closeResumeConfirm() {
        resumeConfirmBackdrop.hidden = true;
        pendingSavedState = null;
        resumePreviouslyFocused?.focus?.({ preventScroll: true });
        resumePreviouslyFocused = null;
    }

    function requestResume(saved) {
        pendingSavedState = saved;
        resumePreviouslyFocused = document.activeElement;
        const editableFields = saved.puzzle.filter(value => !value).length;
        const enteredFields = saved.values.reduce((count, value, index) =>
            count + (!saved.puzzle[index] && value ? 1 : 0), 0);
        const savedLabel = saved.mode === "custom" ? "Rätsel-Sandkasten" : (saved.level || "Sudoku");
        resumeProgress.textContent = `${savedLabel} · ${enteredFields} von ${editableFields} eigenen Feldern ausgefüllt`;
        resumeConfirmBackdrop.hidden = false;
        resumeAccept.focus();
    }

    function snapshot() {
        return {
            puzzle: state.puzzle.slice(),
            values: state.values.slice(),
            notes: state.notes.map(note => note.slice()),
            hintedEntries: state.hintedEntries.slice(),
            revealedSolution: Boolean(state.revealedSolution)
        };
    }
    function restore(previous) {
        state.puzzle = previous.puzzle?.slice?.() ?? state.puzzle;
        state.values = previous.values.slice();
        state.notes = previous.notes.map(note => note.slice());
        state.hintedEntries = previous.hintedEntries?.slice?.() ?? Array(81).fill(false);
        state.revealedSolution = Boolean(previous.revealedSolution);
        state.checked = false;
        state.completed = false;
        state.hintIndex = null;
    }
    function enterNumber(number) {
        if (!state || state.preview || state.completed || !Number.isInteger(selected)) return;
        const customEntry = state.mode === "custom" && state.customPhase === "entry";
        if (!customEntry && isGiven(selected)) return;
        const before = snapshot();
        if (customEntry) {
            state.puzzle[selected] = state.puzzle[selected] === number ? 0 : number;
            state.values[selected] = state.puzzle[selected];
            state.notes[selected] = [];
            state.conflictIndexes = (state.conflictIndexes || []).filter(index => index !== selected);
        } else if (notesMode) {
            const set = new Set(state.notes[selected]);
            const existingValue = state.values[selected];
            const candidateValues = state.values.slice();
            candidateValues[selected] = 0;
            const allowed = new Set(window.SudokuSolver.candidates(candidateValues, selected));
            if (!set.has(number) && number !== existingValue && !allowed.has(number)) return;
            if (existingValue) {
                set.add(existingValue);
                state.values[selected] = 0;
                state.hintedEntries[selected] = false;
            }
            set.has(number) ? set.delete(number) : set.add(number);
            state.notes[selected] = [...set].sort();
        } else {
            state.values[selected] = state.values[selected] === number ? 0 : number;
            state.notes[selected] = [];
            state.hintedEntries[selected] = Boolean(state.hintIndex === selected && state.values[selected] === state.solution[selected]);
        }
        state.checked = false;
        state.hintIndex = null;
        if (!notesMode || customEntry) cleanInvalidNotes();
        undoStack.push(before);
        redoStack = [];
        state.completed = customEntry ? false : isComplete();
        SudokuStorage.save(state);
        click();
        render();
        focusBoard();
    }

    function clearSelected() {
        if (!state || state.preview || state.completed || !Number.isInteger(selected)) return;
        const customEntry = state.mode === "custom" && state.customPhase === "entry";
        if (!customEntry && isGiven(selected)) return;
        if (!state.values[selected] && !state.notes[selected].length) return;
        undoStack.push(snapshot());
        state.values[selected] = 0;
        state.notes[selected] = [];
        if (customEntry) state.puzzle[selected] = 0;
        if (customEntry) state.conflictIndexes = (state.conflictIndexes || []).filter(index => index !== selected);
        state.hintedEntries[selected] = false;
        state.checked = false;
        state.hintIndex = null;
        cleanInvalidNotes();
        redoStack = [];
        SudokuStorage.save(state);
        click();
        render();
        focusBoard();
    }

    function makeNumberPad() {
        const numberPad = document.getElementById("numberPad");
        for (let number = 1; number <= 9; number++) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "secondary-button number-button";
            button.dataset.number = String(number);
            button.textContent = number;
            button.addEventListener("click", () => {
                enterNumber(number);
                focusBoard();
            });
            numberPad.appendChild(button);
        }
        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.className = "secondary-button number-button clear-number";
        clearButton.textContent = "⌫";
        clearButton.setAttribute("aria-label", "Feld löschen");
        clearButton.addEventListener("click", () => {
            clearSelected();
            focusBoard();
        });
        numberPad.appendChild(clearButton);
    }

    function cleanInvalidNotes() {
        for (let index = 0; index < 81; index++) {
            if (state.values[index]) {
                state.notes[index] = [];
                continue;
            }
            const allowed = new Set(window.SudokuSolver.candidates(state.values, index));
            state.notes[index] = state.notes[index].filter(number => allowed.has(number));
        }
    }

    function findPuzzleConflictIndexes(puzzle) {
        const solvable = candidate => window.SudokuSolver.isValidGrid(candidate)
            && window.SudokuSolver.countSolutions(candidate.slice(), 1) > 0;
        if (solvable(puzzle)) return [];
        return puzzle.reduce((indexes, value, index) => {
            if (!value) return indexes;
            const candidate = puzzle.slice();
            candidate[index] = 0;
            if (solvable(candidate)) indexes.push(index);
            return indexes;
        }, []);
    }

    function createFallbackReviewGrid(puzzle) {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 900;
        const context = canvas.getContext("2d");
        context.fillStyle = "#171b2a";
        context.fillRect(0, 0, 900, 900);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "700 64px system-ui";
        puzzle.forEach((value, index) => {
            if (!value) return;
            context.fillStyle = "#f5f7ff";
            context.fillText(value, (index % 9) * 100 + 50, Math.floor(index / 9) * 100 + 52);
        });
        for (let index = 0; index <= 9; index++) {
            context.strokeStyle = index % 3 === 0 ? "#7b5cff" : "#38405a";
            context.lineWidth = index % 3 === 0 ? 5 : 2;
            context.beginPath();
            context.moveTo(index * 100, 0);
            context.lineTo(index * 100, 900);
            context.moveTo(0, index * 100);
            context.lineTo(900, index * 100);
            context.stroke();
        }
        return canvas;
    }

    function createFallbackCellPreview(value) {
        const canvas = document.createElement("canvas");
        canvas.width = 220;
        canvas.height = 220;
        const context = canvas.getContext("2d");
        context.fillStyle = "#171b2a";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#f5f7ff";
        context.font = "700 120px system-ui";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(value, 110, 116);
        return canvas;
    }

    function createConflictReviewItems(indexes) {
        const fallbackGrid = lastImportedGridSource ? null : createFallbackReviewGrid(state.puzzle);
        return indexes.map(index => ({
            row: Math.floor(index / 9),
            col: index % 9,
            candidates: [state.puzzle[index]],
            preview: lastImportedGridSource
                ? prepareReviewCell(lastImportedGridSource, Math.floor(index / 9), index % 9)
                : createFallbackCellPreview(state.puzzle[index]),
            gridPreview: lastImportedGridSource || fallbackGrid,
            reason: lastImportedGridSource
                ? "Diese Ziffer verhindert eine gültige Sudoku-Lösung"
                : "Diese Ziffer verhindert eine gültige Sudoku-Lösung. Das Originalfoto ist in dieser Sitzung nicht mehr verfügbar"
        }));
    }

    function showCustomPuzzleConflict(puzzle, message) {
        const indexes = findPuzzleConflictIndexes(puzzle);
        state.conflictIndexes = indexes;
        SudokuStorage.save(state);
        render();
        if (indexes.length) {
            customPuzzleStatus.textContent = lastImportedGridSource
                ? `${message} Die verdächtige Ziffer ist im Raster markiert und wird mit dem Originalausschnitt angezeigt.`
                : `${message} Die verdächtige Ziffer wird jetzt zur Korrektur angezeigt.`;
            startCustomReview(createConflictReviewItems(indexes));
            return;
        }
        customPuzzleStatus.textContent = indexes.length
            ? `${message} Die verdächtige Ziffer ist im Raster rot markiert.`
            : `${message} Bitte prüfe die Vorgaben manuell.`;
    }

    function validateCustomPuzzle() {
        if (!state || state.mode !== "custom" || state.customPhase !== "entry") return;
        const puzzle = state.puzzle.slice();
        if (!window.SudokuSolver.isValidGrid(puzzle)) {
            showCustomPuzzleConflict(puzzle, "Das Rätsel enthält widersprüchliche Zahlen.");
            return;
        }
        const solutionCount = window.SudokuSolver.countSolutions(puzzle.slice(), 2);
        if (solutionCount === 0) {
            showCustomPuzzleConflict(puzzle, "Für diese Eingabe gibt es keine Lösung.");
            return;
        }
        if (solutionCount > 1) {
            customPuzzleStatus.textContent = "Das Rätsel ist nicht eindeutig. Bitte prüfe die übertragenen Vorgaben.";
            return;
        }
        state.solution = window.SudokuSolver.solve(puzzle.slice());
        state.preview = true;
        state.started = false;
        state.customPhase = "ready";
        state.values = puzzle.slice();
        selected = findFirstSelectableCell();
        state.checked = false;
        state.revealedSolution = false;
        state.conflictIndexes = [];
        state.hintIndex = null;
        notesMode = false;
        undoStack = [];
        redoStack = [];
        customPuzzleStatus.textContent = "Rätsel gültig. Vorschau bereit – klicke „Jetzt spielen“.";
        finishOcrProgress("Rätsel gültig – jetzt spielen", 1800);
        SudokuStorage.save(state);
        render();
        focusBoard();
    }

    function resetCustomPuzzle() {
        if (!state || state.mode !== "custom"
            || (state.customPhase !== "entry" && !state.completed)) return;
        state.started = false;
        state.preview = false;
        state.customPhase = "entry";
        state.completed = false;
        state.puzzle.fill(0);
        state.values.fill(0);
        state.notes = emptyNotes();
        state.conflictIndexes = [];
        state.solution = null;
        state.checked = false;
        state.revealedSolution = false;
        customPuzzleStatus.textContent = "Übertragung zurückgesetzt.";
        showCustomEntryHint();
        undoStack = [];
        redoStack = [];
        SudokuStorage.save(state);
        render();
        focusBoard();
    }

    const OCR_VERSION = "5.1.1";
    const OCR_PATHS = Object.freeze({
        local: Object.freeze({
            workerPath: "../Shared/ocr/worker.min.js",
            corePath: "../Shared/ocr/core",
            langPath: "../Shared/ocr/lang"
        }),
        remote: Object.freeze({
            workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR_VERSION}/dist/worker.min.js`,
            corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${OCR_VERSION}`,
            langPath: "https://tessdata.projectnaptha.com/4.0.0"
        })
    });

    function loadOcrLibrary(source = "local") {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);
        const existing = document.querySelector(`script[data-sudoku-ocr="${source}"]`);
        if (existing) {
            return new Promise((resolve, reject) => {
                existing.addEventListener("load", () => resolve(window.Tesseract), { once: true });
                existing.addEventListener("error", () => reject(new Error("OCR-Bibliothek konnte nicht geladen werden.")), { once: true });
            });
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = source === "local"
                ? "../Shared/ocr/tesseract.min.js"
                : `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR_VERSION}/dist/tesseract.min.js`;
            script.async = true;
            script.dataset.sudokuOcr = source;
            script.addEventListener("load", () => window.Tesseract
                ? resolve(window.Tesseract)
                : reject(new Error("OCR-Bibliothek ist nicht verfügbar.")), { once: true });
            script.addEventListener("error", () => reject(new Error("OCR-Bibliothek konnte nicht geladen werden.")), { once: true });
            document.head.appendChild(script);
        });
    }

    async function loadOcrRuntime(statusElement) {
        try {
            statusElement.textContent = "Lokale OCR-Bibliothek wird geladen …";
            const tesseract = await loadOcrLibrary("local");
            return { tesseract, paths: OCR_PATHS.local, source: "lokal" };
        } catch (localError) {
            statusElement.textContent = "Lokale OCR nicht verfügbar – Online-Alternative wird geladen …";
            const tesseract = await loadOcrLibrary("remote");
            return { tesseract, paths: OCR_PATHS.remote, source: "online" };
        }
    }

    function createOcrWorker(runtime, statusElement) {
        return runtime.tesseract.createWorker("eng", 1, {
            ...runtime.paths,
            logger: progress => {
                if (progress.status === "recognizing text" && Number.isFinite(progress.progress)) {
                    statusElement.textContent = `${runtime.source === "lokal" ? "Lokale OCR" : "Online-OCR"}: Ziffern werden erkannt … ${Math.round(progress.progress * 100)} %`;
                }
            }
        });
    }

    function createApproximateGridCanvas(image) {
        const outputSize = 900;
        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext("2d");
        // Fallback für Fotos ohne sicher erkannten Rahmen: Überschrift,
        // Seitenrand und der schwarze Bereich unter dem Rätsel bleiben außen vor.
        const sourceX = image.naturalWidth * 0.135;
        const sourceY = image.naturalHeight * 0.13;
        const sourceWidth = image.naturalWidth * 0.79;
        const sourceHeight = image.naturalHeight * 0.67;
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputSize, outputSize);
        return canvas;
    }

    async function recognizeOcrVariant(worker, cell) {
        const recognition = await worker.recognize(cell);
        const rawText = recognition.data?.text || "";
        const text = rawText.replace(/\s/g, "");
        const confidence = Number(recognition.data?.confidence);
        const digits = text.match(/[1-9]/g) || [];
        if (digits.length !== 1 || !Number.isFinite(confidence)) return null;
        return {
            value: Number(digits[0]),
            confidence,
            preview: cell,
            normalized: text !== digits[0]
        };
    }

    function rankOcrCandidates(variants) {
        const grouped = new Map();
        variants.forEach(variant => {
            const entry = grouped.get(variant.value) || { value: variant.value, confidence: 0, votes: 0, preview: variant.preview };
            entry.confidence += variant.confidence;
            entry.votes++;
            if (variant.confidence > (entry.bestConfidence || 0)) {
                entry.bestConfidence = variant.confidence;
                entry.preview = variant.preview;
            }
            grouped.set(variant.value, entry);
        });
        return [...grouped.values()].sort((left, right) =>
            right.votes - left.votes || right.confidence - left.confidence || right.bestConfidence - left.bestConfidence
        );
    }

    function isClearOcrDecision(ranked) {
        const best = ranked[0];
        const second = ranked[1];
        if (!best) return false;
        const confidenceGap = !second
            ? Infinity
            : best.confidence - second.confidence;
        if (best.votes >= 2 && best.bestConfidence >= 42
            && confidenceGap >= 12) return true;
        return best.votes === 1
            && best.bestConfidence >= 82
            && confidenceGap >= 28;
    }

    async function recognizeSudokuCells(worker, source, statusElement) {
        const result = new Map();
        const uncertain = [];
        let processed = 0;
        await worker.setParameters({
            tessedit_pageseg_mode: "10",
            user_defined_dpi: "300"
        });
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const rawCell = prepareOcrCell(source, row, col, "raw");
                const reviewCell = prepareReviewCell(source, row, col);
                // Diese Analyse verwendet ausschließlich das unveränderte
                // entzerrte Originalbild und schützt vor Leerfeld-Fehlalarmen.
                const ink = analyzeCellInk(source, row, col);
                const variants = [];

                for (const variantName of ["raw", "otsu", "local", "adaptive"]) {
                    const candidate = await recognizeOcrVariant(
                        worker,
                        variantName === "raw"
                            ? rawCell
                            : prepareOcrCell(source, row, col, variantName)
                    );
                    if (candidate) variants.push(candidate);
                }

                let ranked = rankOcrCandidates(variants);
                if (!isClearOcrDecision(ranked)
                    && (ranked.length || ink.reviewable)) {
                    const candidate = await recognizeOcrVariant(
                        worker,
                        prepareOcrCell(source, row, col, "enhanced")
                    );
                    if (candidate) variants.push(candidate);
                    ranked = rankOcrCandidates(variants);
                }

                const best = ranked[0];
                if (best && isClearOcrDecision(ranked)) {
                    result.set(row * 9 + col, {
                        index: row * 9 + col,
                        value: best.value,
                        confidence: best.bestConfidence,
                        preview: reviewCell,
                        candidates: ranked.map(candidate => candidate.value),
                        inkScore: ink.score
                    });
                } else if (ink.reviewable || ranked.length) {
                    uncertain.push({
                        row,
                        col,
                        candidates: ranked.map(candidate => candidate.value),
                        preview: reviewCell,
                        gridPreview: source,
                        reason: ranked.length
                            ? "OCR-Ergebnis unsicher"
                            : "Ziffer möglicherweise übersehen",
                        inkScore: ink.score
                    });
                }
                processed++;
                statusElement.textContent = `Ziffern werden erkannt … ${Math.round((processed / 81) * 100)} %`;
            }
        }
        return { result, uncertain };
    }

    function findOcrConflicts(puzzle, recognition, source) {
        if (window.SudokuSolver.isValidGrid(puzzle)
            && window.SudokuSolver.countSolutions(puzzle.slice(), 1) > 0) return [];

        const suspicious = [];
        for (const entry of recognition.result.values()) {
            const solverAlternatives = [];
            for (const value of [0, ...(entry.candidates || []).filter(value => value !== entry.value)]) {
                const candidate = puzzle.slice();
                candidate[entry.index] = value;
                if (!window.SudokuSolver.isValidGrid(candidate)
                    || window.SudokuSolver.countSolutions(candidate, 1) === 0) continue;
                solverAlternatives.push(value);
            }
            if (!solverAlternatives.length) continue;
            suspicious.push({
                row: Math.floor(entry.index / 9),
                col: entry.index % 9,
                candidates: [...new Set([
                    ...solverAlternatives.filter(Boolean),
                    entry.value,
                    ...(entry.candidates || [])
                ])],
                preview: entry.preview,
                gridPreview: source,
                reason: "Widerspruch in der OCR-Übertragung"
            });
        }
        return suspicious;
    }

    function mergeReviewItems(items) {
        const unique = new Map();
        for (const item of items) unique.set(item.row * 9 + item.col, item);
        return [...unique.values()];
    }

    function finishCustomReview() {
        customImportReview.hidden = true;
        customReviewQueue = [];
        selected = null;
        state.preview = false;
        state.started = false;
        state.customPhase = "entry";
        SudokuStorage.save(state);
        customPuzzleStatus.textContent = "Korrekturprüfung abgeschlossen. Ergänze oder korrigiere das Raster und wähle danach „Rätsel prüfen“.";
        render();
        focusBoard();
    }

    function showDesktopPreview() {
        if (mobilePrototype) return;
        clearCustomEntryHint();
        state = {
            preview: customMode ? false : true,
            started: false,
            level: customMode ? "Rätsel-Sandkasten" : currentLevel(),
            mode: customMode ? "custom" : "generated",
            customPhase: customMode ? "entry" : null,
            puzzle: Array(81).fill(0),
            solution: null,
            values: Array(81).fill(0),
            notes: emptyNotes(),
            checked: false,
            completed: false,
            hintIndex: null,
            hintedEntries: Array(81).fill(false),
            revealedSolution: false
        };
        selected = 0;
        undoStack = [];
        redoStack = [];
        setupScreen.hidden = false;
        gameScreen.hidden = false;
        render();
    }

    function showNextCustomReview() {
        const review = customReviewQueue[0];
        if (!review) {
            finishCustomReview();
            return;
        }
        const index = review.row * 9 + review.col;
        customReviewQuestion.textContent = `Welche Ziffer steht in Zeile ${review.row + 1}, Spalte ${review.col + 1}?`;
        customReviewCandidates.textContent = review.candidates.length
            ? `${review.reason ? `${review.reason}. Bitte sieh im Originalausschnitt nach und korrigiere das Feld. ` : ""}Automatisch erkannt: ${review.candidates.join(" oder ")}.`
            : "Keine eindeutige Ziffer erkannt. Bitte prüfe den Ausschnitt.";
        const context = customReviewCanvas.getContext("2d");
        context.clearRect(0, 0, customReviewCanvas.width, customReviewCanvas.height);
        context.drawImage(review.preview, 0, 0, customReviewCanvas.width, customReviewCanvas.height);
        const gridContext = customReviewGridCanvas.getContext("2d");
        gridContext.clearRect(0, 0, customReviewGridCanvas.width, customReviewGridCanvas.height);
        gridContext.drawImage(review.gridPreview, 0, 0, customReviewGridCanvas.width, customReviewGridCanvas.height);
        const gridCellSize = customReviewGridCanvas.width / 9;
        gridContext.fillStyle = "rgba(240, 200, 111, .22)";
        gridContext.fillRect(review.col * gridCellSize, review.row * gridCellSize, gridCellSize, gridCellSize);
        gridContext.strokeStyle = "#f0c86f";
        gridContext.lineWidth = 3;
        gridContext.strokeRect(review.col * gridCellSize + 1, review.row * gridCellSize + 1, gridCellSize - 2, gridCellSize - 2);
        customReviewNumbers.replaceChildren();
        for (let value = 1; value <= 9; value++) {
            const button = document.createElement("button");
            button.className = "secondary-button tool-button";
            button.type = "button";
            button.textContent = value;
            button.dataset.reviewValue = String(value);
            button.addEventListener("click", () => {
                state.puzzle[index] = value;
                state.values[index] = value;
                state.conflictIndexes = (state.conflictIndexes || []).filter(conflictIndex => conflictIndex !== index);
                customReviewQueue.shift();
                SudokuStorage.save(state);
                render();
                showNextCustomReview();
            });
            customReviewNumbers.appendChild(button);
        }
        const emptyButton = document.createElement("button");
        emptyButton.className = "secondary-button tool-button";
        emptyButton.type = "button";
        emptyButton.textContent = "Leer";
        emptyButton.setAttribute("aria-label", "Feld leer lassen");
        emptyButton.dataset.reviewEmpty = "true";
        emptyButton.addEventListener("click", () => {
            state.puzzle[index] = 0;
            state.values[index] = 0;
            state.conflictIndexes = (state.conflictIndexes || []).filter(conflictIndex => conflictIndex !== index);
            customReviewQueue.shift();
            SudokuStorage.save(state);
            render();
            showNextCustomReview();
        });
        customReviewNumbers.appendChild(emptyButton);
        customImportReview.hidden = false;
    }

    function startCustomReview(items) {
        customReviewQueue = items.slice();
        if (customReviewQueue.length) showNextCustomReview();
        else finishCustomReview();
    }

    function prepareSudokuImage(image) {
        return {
            source: createApproximateGridCanvas(image),
            corrected: false,
            approximate: true
        };
    }

    async function importCustomPuzzleImage(file, providedSource = null) {
        if ((!file && !providedSource) || !state || state.mode !== "custom" || state.customPhase !== "entry") return;
        customImportButton.disabled = true;
        customValidateButton.disabled = true;
        customResetButton.disabled = true;
        automaticConflictReviewPass = 0;
        let worker = null;
        try {
            // Die OCR erhält den zugeschnittenen Foto-Fallback aus
            // prepareSudokuImage(); die manuelle Rasterkorrektur ist bereits
            // vorher im Importassistenten abgeschlossen.
            let ocrRuntime = await loadOcrRuntime(ocrProgressTarget);
            let prepared;
            if (providedSource) {
                prepared = { source: providedSource, corrected: true };
            } else {
                const imageUrl = URL.createObjectURL(file);
                const image = new Image();
                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden."));
                    image.src = imageUrl;
                });
                URL.revokeObjectURL(imageUrl);
                setOcrProgress("Foto wird vorbereitet …");
                prepared = prepareSudokuImage(image);
            }
            prepared.quality = assessSudokuImageQuality(prepared.source);
            lastImportQuality = prepared.quality;
            lastImportedGridSource = prepared.source;
            setOcrProgress(`${ocrRuntime.source === "lokal" ? "Lokale OCR" : "Online-OCR"}: Ziffern werden erkannt …`);
            try {
                worker = await createOcrWorker(ocrRuntime, ocrProgressTarget);
            } catch (localWorkerError) {
                if (ocrRuntime.source !== "lokal") throw localWorkerError;
                setOcrProgress("Lokale OCR konnte nicht gestartet werden – Online-Alternative wird geladen …");
                ocrRuntime = {
                    tesseract: await loadOcrLibrary("remote"),
                    paths: OCR_PATHS.remote,
                    source: "online"
                };
                worker = await createOcrWorker(ocrRuntime, ocrProgressTarget);
            }
            await worker.setParameters({
                tessedit_char_whitelist: "123456789",
                tessedit_pageseg_mode: "10"
            });
            const recognitionPromise = recognizeSudokuCells(worker, prepared.source, ocrProgressTarget);
            recognitionPromise.catch(() => {});
            let timeoutId;
            const timeout = new Promise((_, reject) => {
                timeoutId = window.setTimeout(() => reject(new Error("Die Fotoerkennung dauert zu lange. Bitte nutze ein zugeschnittenes, gut beleuchtetes Foto.")), 90000);
            });
            let recognition;
            try {
                recognition = await Promise.race([recognitionPromise, timeout]);
            } finally {
                window.clearTimeout(timeoutId);
            }
            const mapped = recognition.result;
            state.puzzle.fill(0);
            state.values.fill(0);
            state.notes = emptyNotes();
            state.solution = null;
            state.checked = false;
            state.completed = false;
            state.revealedSolution = false;
            state.hintIndex = null;
            state.conflictIndexes = [];
            state.hintedEntries.fill(false);
            mapped.forEach(({ index, value }) => {
                state.puzzle[index] = value;
                state.values[index] = value;
            });
            // Der OCR-Import soll keine Spielzelle vorselektieren. Die
            // nächste Eingabe darf erst nach einem bewussten Zellklick gelten.
            selected = null;
            undoStack = [];
            redoStack = [];
            const conflicts = findOcrConflicts(state.puzzle, recognition, prepared.source);
            // Die Solver-Prüfung ergänzt die OCR-Konflikte. Damit öffnet die
            // Korrekturansicht auch dann sofort, wenn zwar ein Widerspruch
            // feststeht, Tesseract aber keine passende Alternativziffer nennt.
            const solverConflictIndexes = findPuzzleConflictIndexes(state.puzzle);
            const solverConflictItems = createConflictReviewItems(solverConflictIndexes);
            const conflictIndexes = [...new Set([
                ...conflicts.map(item => item.row * 9 + item.col),
                ...solverConflictIndexes
            ])];
            state.conflictIndexes = conflictIndexes;
            // OCR-Unsicherheiten ohne Kandidaten bleiben im editierbaren Raster.
            // Nur Felder, für die OCR mindestens eine konkrete Ziffer anbietet,
            // werden in der schnellen Bild-Korrektur angezeigt.
            const reviewItems = mergeReviewItems([
                ...recognition.uncertain.filter(item =>
                    item.candidates.length && item.inkScore >= .045
                ),
                ...solverConflictItems,
                ...conflicts
            ]);
            SudokuStorage.save(state);
            finishOcrProgress("OCR-Import abgeschlossen");
            state.preview = false;
            state.started = false;
            state.customPhase = "entry";
            if (conflictIndexes.length) {
                customPuzzleStatus.textContent = `OCR übertragen. ${conflictIndexes.length} widersprüchliche Felder sind markiert.`;
            } else {
                customPuzzleStatus.textContent = mapped.size
                    ? `${mapped.size} Ziffern ${prepared.corrected ? "nach Rasterkorrektur" : "im Sudoku-Raster"} erkannt.`
                    : "Keine sicheren Ziffern erkannt.";
            }
            if (reviewItems.length) {
                customPuzzleStatus.textContent += ` ${reviewItems.length} unsichere Ziffer${reviewItems.length === 1 ? "" : "n"} werden jetzt zur schnellen Prüfung angezeigt.`;
            }
            customPuzzleStatus.textContent += " Ergänze oder korrigiere das Raster und wähle danach „Rätsel prüfen“.";
            if (prepared.quality && prepared.quality.score < 75) {
                customPuzzleStatus.textContent += " Fotoqualität " + prepared.quality.label.toLowerCase()
                    + " (" + prepared.quality.score + "/100) – bitte unsichere Leerfelder und Ziffern besonders prüfen.";
            }
            render();
            focusBoard();
            startCustomReview(reviewItems);
        } catch (error) {
            customPuzzleStatus.textContent = error.message || "Die Fotoerkennung ist fehlgeschlagen. Bitte übertrage das Rätsel manuell.";
            finishOcrProgress("OCR-Import fehlgeschlagen");
        } finally {
            if (worker) await worker.terminate().catch(() => {});
            customImportButton.disabled = false;
            customValidateButton.disabled = false;
            customResetButton.disabled = false;
            customImportInput.value = "";
        }
    }

    function revealCustomSolution() {
        if (!state || state.mode !== "custom" || state.customPhase !== "solving" || !state.solution) return;
        state.values = state.solution.slice();
        state.revealedSolution = true;
        state.completed = true;
        state.checked = false;
        SudokuStorage.save(state);
        customPuzzleStatus.textContent = "Die Lösung wurde eingeblendet.";
        render();
        focusBoard();
    }

    board.addEventListener("keydown", event => {
        if (!state || state.preview) return;
        const row = Math.floor(selected / 9);
        const col = selected % 9;
        let next = selected;
        if (event.key === "ArrowUp") next = Math.max(0, row - 1) * 9 + col;
        else if (event.key === "ArrowDown") next = Math.min(8, row + 1) * 9 + col;
        else if (event.key === "ArrowLeft") next = row * 9 + Math.max(0, col - 1);
        else if (event.key === "ArrowRight") next = row * 9 + Math.min(8, col + 1);
        else if (/^[1-9]$/.test(event.key)) {
            event.preventDefault();
            enterNumber(Number(event.key));
            return;
        }
        else if (event.key === "0" || event.key === "Backspace" || event.key === "Delete") {
            event.preventDefault();
            clearSelected();
            return;
        }
        else if (event.key.toLowerCase() === "n") {
            event.preventDefault();
            notesMode = !notesMode;
            render();
            focusBoard();
            return;
        }
        else return;
        event.preventDefault();
        if (next !== selected && !isSelectableCell(next)) {
            const step = event.key === "ArrowUp" ? -9
                : event.key === "ArrowDown" ? 9
                    : event.key === "ArrowLeft" ? -1 : 1;
            const sameRow = event.key === "ArrowLeft" || event.key === "ArrowRight";
            while (next !== selected && !isSelectableCell(next)) {
                const candidate = next + step;
                if (candidate < 0 || candidate > 80 || (sameRow && Math.floor(candidate / 9) !== row)) break;
                next = candidate;
            }
        }
        selectCell(next);
    });

    document.getElementById("notesButton").addEventListener("click", () => {
        notesMode = !notesMode;
        click();
        render();
        focusBoard();
    });
    document.getElementById("undoButton").addEventListener("click", () => {
        if (!undoStack.length) return;
        redoStack.push(snapshot());
        restore(undoStack.pop());
        SudokuStorage.save(state); click(); render(); focusBoard();
    });
    document.getElementById("redoButton").addEventListener("click", () => {
        if (!redoStack.length) return;
        undoStack.push(snapshot());
        restore(redoStack.pop());
        SudokuStorage.save(state); click(); render(); focusBoard();
    });
    document.getElementById("checkButton").addEventListener("click", () => {
        if (!state || state.completed) return;
        state.checked = true;
        state.hintIndex = null;
        SudokuStorage.save(state);
        click();
        render();
        focusBoard();
    });
    document.getElementById("hintButton").addEventListener("click", () => {
        if (!state || state.completed) return;
        const openCells = state.values
            .map((value, index) => (!value && !state.puzzle[index] ? index : -1))
            .filter(index => index >= 0);
        if (!openCells.length) return;
        const index = openCells[Math.floor(Math.random() * openCells.length)];
        selected = index;
        notesMode = false;
        state.hintIndex = index;
        render();
        focusBoard();
    });
    customValidateButton.addEventListener("click", () => {
        click();
        validateCustomPuzzle();
    });
    customResetButton.addEventListener("click", () => {
        click();
        resetCustomPuzzle();
    });
    customImportButton.addEventListener("click", () => {
        click();
        dismissCustomEntryHint();
        customImportInput.click();
    });
    customImportInput.addEventListener("change", () => {
        openImportAssistant(customImportInput.files?.[0]);
    });
    customImportCancel.addEventListener("click", () => {
        click();
        if (pendingImport?.rectified) {
            pendingImport.rectified = false;
            pendingImport.rectifiedCanvas = null;
            customImportCanvas.width = Math.max(1, Math.round(pendingImport.image.naturalWidth * Math.min(1, 1100 / Math.max(pendingImport.image.naturalWidth, pendingImport.image.naturalHeight))));
            customImportCanvas.height = Math.max(1, Math.round(pendingImport.image.naturalHeight * Math.min(1, 1100 / Math.max(pendingImport.image.naturalWidth, pendingImport.image.naturalHeight))));
            customImportCancel.textContent = "Abbrechen";
            customImportAccept.textContent = "Raster begradigen";
            customImportHint.textContent = "Ziehe die Eckpunkte bei Bedarf noch genauer auf den Sudoku-Rahmen.";
            if (customImportQuality) customImportQuality.textContent = "";
            drawImportAssistant();
        } else {
            closeImportAssistant();
        }
    });
    customImportAccept.addEventListener("click", () => {
        click();
        if (!pendingImport) return;
        if (!pendingImport.rectified) {
            try {
                const previewWidth = customImportCanvas.width;
                const previewHeight = customImportCanvas.height;
                const ocrSource = createOcrSourceCanvas(pendingImport.image);
                const ocrPoints = pendingImport.points.map(point => ({
                    x: point.x * ocrSource.width / previewWidth,
                    y: point.y * ocrSource.height / previewHeight
                }));
                pendingImport.rectifiedCanvas = rectifyImportCanvas(
                    ocrPoints,
                    ocrSource
                );
                pendingImport.quality = updateImportQuality(pendingImport.rectifiedCanvas);
                pendingImport.rectified = true;
                customImportCanvas.width = pendingImport.rectifiedCanvas.width;
                customImportCanvas.height = pendingImport.rectifiedCanvas.height;
                customImportCancel.textContent = "Punkte anpassen";
                customImportAccept.textContent = "Vorschau bestätigen";
                customImportHint.textContent = "Schritt 2: Prüfe, ob das begradigte Sudoku vollständig und ohne Schräglage sichtbar ist.";
                drawImportAssistant();
            } catch (error) {
                customImportHint.textContent = error.message || "Die Perspektive konnte nicht begradigt werden.";
            }
            return;
        }
        const rectifiedSource = pendingImport.rectifiedCanvas;
        closeImportAssistant();
        importCustomPuzzleImage(null, rectifiedSource);
    });
    customImportCanvas.addEventListener("pointerdown", event => {
        if (!pendingImport) return;
        const bounds = customImportCanvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * customImportCanvas.width / bounds.width;
        const y = (event.clientY - bounds.top) * customImportCanvas.height / bounds.height;
        const hitDistance = Math.max(28, customImportCanvas.width / 18);
        const handles = pendingImport.points;
        importHoverIndex = handles.findIndex(point => Math.hypot(point.x - x, point.y - y) <= hitDistance);
        importDragIndex = importHoverIndex;
        if (importDragIndex >= 0) {
            customImportCanvas.setPointerCapture(event.pointerId);
            drawImportAssistant();
        }
    });
    customImportCanvas.addEventListener("pointermove", event => {
        if (!pendingImport) return;
        const bounds = customImportCanvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * customImportCanvas.width / bounds.width;
        const y = (event.clientY - bounds.top) * customImportCanvas.height / bounds.height;
        const hitDistance = Math.max(28, customImportCanvas.width / 18);
        if (importDragIndex < 0) {
            const handles = pendingImport.points;
            importHoverIndex = handles.findIndex(point => Math.hypot(point.x - x, point.y - y) <= hitDistance);
            drawImportAssistant();
            return;
        }
        const handles = pendingImport.points;
        handles[importDragIndex] = {
            x: Math.max(0, Math.min(customImportCanvas.width, x)),
            y: Math.max(0, Math.min(customImportCanvas.height, y))
        };
        pendingImport.points[importDragIndex] = handles[importDragIndex];
        drawImportAssistant();
    });
    const releaseImportHandle = event => {
        if (importDragIndex >= 0 && customImportCanvas.hasPointerCapture?.(event.pointerId)) {
            customImportCanvas.releasePointerCapture(event.pointerId);
        }
        importDragIndex = -1;
        drawImportAssistant();
    };
    customImportCanvas.addEventListener("pointerup", releaseImportHandle);
    customImportCanvas.addEventListener("pointercancel", releaseImportHandle);
    customImportCanvas.addEventListener("pointerleave", () => {
        if (importDragIndex < 0) {
            importHoverIndex = -1;
            drawImportAssistant();
        }
    });
    customSolveButton.addEventListener("click", () => {
        click();
        revealCustomSolution();
    });
    newPuzzleButton.addEventListener("click", () => {
        click();
        requestNewPuzzle();
    });
    newPuzzleCancel.addEventListener("click", () => {
        click();
        closeNewPuzzleConfirm();
    });
    newPuzzleConfirm.addEventListener("click", () => {
        click();
        closeNewPuzzleConfirm();
        startNewPuzzleForCurrentMode();
    });
    resumeDecline.addEventListener("click", () => {
        click();
        closeResumeConfirm();
        SudokuStorage.clear();
        if (mobilePrototype) {
            state = null;
            updateResumeAction();
        } else {
            // Das Verwerfen beendet nur den alten Spielstand. Ein neues
            // Rätsel entsteht erst nach einem ausdrücklichen Start.
            showDesktopPreview();
        }
        difficultyButton.focus({ preventScroll: true });
    });
    resumeAccept.addEventListener("click", () => {
        click();
        const saved = pendingSavedState;
        closeResumeConfirm();
        loadSaved(saved);
    });
    newPuzzleConfirmBackdrop.addEventListener("click", event => {
        if (event.target === newPuzzleConfirmBackdrop) closeNewPuzzleConfirm();
    });
    resumeConfirmBackdrop.addEventListener("click", event => {
        if (event.target === resumeConfirmBackdrop) closeResumeConfirm();
    });
    document.addEventListener("keydown", event => {
        if (!customImportReview.hidden) {
            const digit = /^[1-9]$/.test(event.key)
                ? event.key
                : /^(?:Digit|Numpad)([1-9])$/.exec(event.code)?.[1];
            if (digit) {
                event.preventDefault();
                customReviewNumbers.querySelector(`[data-review-value="${digit}"]`)?.click();
                return;
            }
            if (event.key === " " || event.code === "Space") {
                event.preventDefault();
                customReviewNumbers.querySelector("[data-review-empty]")?.click();
                return;
            }
        }
        if (event.key === "Escape" && !newPuzzleConfirmBackdrop.hidden) {
            event.preventDefault();
            closeNewPuzzleConfirm();
        } else if (event.key === "Escape" && !resumeConfirmBackdrop.hidden) {
            event.preventDefault();
            closeResumeConfirm();
        } else if (event.key === "Tab" && !newPuzzleConfirmBackdrop.hidden) {
            const focusable = [newPuzzleCancel, newPuzzleConfirm];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        } else if (event.key === "Tab" && !resumeConfirmBackdrop.hidden) {
            const focusable = [resumeDecline, resumeAccept];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    function saveAndReturnToSetup() {
        if (returningToSetup) return;
        fullscreenController?.exit?.();
        if (!state || state.preview || state.completed) return abortToSetup();
        SudokuStorage.save(state);
        savedInSetup = true;
        returningToSetup = true;
        window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
            returningToSetup = false;
            if (mobilePrototype) {
                screenController?.showSetup?.();
            } else {
                document.body.classList.remove("game-active");
                setupScreen.hidden = false;
                gameScreen.hidden = false;
            }
            render();
            updateResumeAction();
        });
    }
    function abortToSetup() {
        returningToSetup = false;
        window.AndisSavedGameNotice?.hide?.();
        fullscreenController?.exit?.();
        SudokuStorage.clear();
        savedInSetup = false;
        state = null;
        if (mobilePrototype) {
            screenController?.showSetup?.();
        } else {
            document.body.classList.remove("game-active");
            setupScreen.hidden = false;
            gameScreen.hidden = false;
        }
        if (!mobilePrototype) showDesktopPreview();
        updateResumeAction();
    }
    startButton.addEventListener("click", () => {
        click();
        if (state && !state.preview && !state.completed && !savedInSetup
            && !(state.mode === "custom" && state.customPhase === "entry")) {
            abortToSetup();
            return;
        }
        if (state?.preview && state.puzzle?.some(Boolean) && state.solution) {
            startCurrentPuzzle();
            return;
        }
        customMode ? newCustomPuzzle() : newGame();
    });
    resumeSavedButton.addEventListener("click", () => {
        click();
        const saved = SudokuStorage.load();
        if (isResumableSavedState(saved)) loadSaved(saved);
    });
    document.getElementById("mobileGameAction").addEventListener("click", () => {
        if (state?.preview && state.puzzle?.some(Boolean) && state.solution) {
            startCurrentPuzzle();
            return;
        }
        // matchConfirm.js übernimmt den Bestätigungsdialog global für diesen
        // Button. Der Handler darf danach nur den bestätigten Abbruch ausführen;
        // ein zweiter request() würde die History-Marke erneut setzen und eine
        // Abbruchschleife erzeugen.
        abortToSetup();
    });
    window.AndisNavigation?.bindBackButton?.({
        button: document.getElementById("mobileSettingsBack"),
        isGameActive: () => !gameScreen.hidden,
        isMatchRunning: () => Boolean(state && !state.completed),
        onActiveBack: saveAndReturnToSetup,
        onMenuBack: saveAndReturnToSetup,
        onAbortConfirmed: abortToSetup
    });

    function leaveToMenu() {
        if (leavingToMenu) return;
        leavingToMenu = true;
        fullscreenController?.exit?.();
        if (!state || state.preview || (state.mode === "custom" && state.customPhase === "entry")) {
            SudokuStorage.clear();
            window.location.href = "../index.html?menu=1";
            return;
        }
        if (savedInSetup) {
            window.location.href = "../index.html?menu=1";
            return;
        }
        if (state && !state.completed) {
            SudokuStorage.save(state);
            window.AndisSavedGameNotice?.show?.("Spiel gespeichert", 1000, () => {
                window.location.href = "../index.html?menu=1";
            });
            return;
        }
        window.location.href = "../index.html?menu=1";
    }

    document.getElementById("backIcon").addEventListener("click", () => {
        click();
        leaveToMenu();
    });
    window.addEventListener("beforeunload", () => { if (state) SudokuStorage.save(state); });

    updateSetup();
    makeNumberPad();
    updateResumeAction();
    // Der Einstieg über die Startseite beginnt immer in den Einstellungen.
    // Ein gespeicherter Spielstand wird nicht ungefragt als laufendes Spiel
    // geöffnet. Desktop bleibt dabei die gemeinsame Ein-Seiten-Ansicht und
    // erhält weiterhin automatisch ein sichtbares Start-Rätsel.
    const saved = SudokuStorage.load();
    const returnedFromGuide = new URLSearchParams(window.location.search).get("guide") === "1";
    if (isResumableSavedState(saved)) {
        if (returnedFromGuide) loadSaved(saved);
        else requestResume(saved);
    } else if (saved) {
        // Ein alter, automatisch erzeugter Setup-Spielstand soll nicht als
        // laufendes Spiel erscheinen.
        SudokuStorage.clear();
        if (!mobilePrototype) showDesktopPreview();
    } else if (!mobilePrototype) {
        showDesktopPreview();
    }
})();
