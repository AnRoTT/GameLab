# Lokale OCR-Basis

Diese Dateien gehören zusammen und werden von Sudoku lokal aus der Spielesammlung geladen.

- Tesseract.js: `5.1.1`
- Tesseract.js Core/WASM: `5.1.1`
- Sprachmodelle: `eng.traineddata.gz` und vorsorglich `deu.traineddata.gz` aus der für Tesseract.js v5 dokumentierten tessdata-Quelle

Sudoku verwendet aktuell weiterhin `eng` mit einer Ziffern-Whitelist. Für spätere deutschsprachige Rätsel kann der gemeinsame OCR-Loader auf `deu` umgestellt werden, ohne zusätzliche Dateien nachladen zu müssen.

Bei einem Update müssen Bibliothek, Worker, Core/WASM und Sprachmodell gemeinsam getestet und die Versionsangabe im Loader (`Sudoku/game.js`) angepasst werden. Die lokale Kopie ist die primäre Quelle; der fest versionierte CDN-Pfad ist nur die Reserve, falls die lokale Kopie beim Deployment fehlt.
