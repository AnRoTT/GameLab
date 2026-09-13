# Andis Game Foundry

Eine browserbasierte Sammlung selbst entwickelter Spiele für Desktop und mobile Geräte.

## Live-Version

Die Spiele können direkt über GitHub Pages gespielt werden:

**[Andis Game Foundry öffnen](https://anrott.github.io/GameLab/)**

## Enthaltene Spiele

- **Tic-Tac-Toe** – Botgegner und adaptive Schwierigkeit
- **4 Gewinnt** – Botgegner und adaptive Schwierigkeit
- **Othello** – Botgegner und adaptive Schwierigkeit
- **Quarto** – Botgegner und adaptive Schwierigkeit
- **Mühle** – Botgegner und adaptive Schwierigkeit
- **Sudoku** – Generator, Solver, eigene Rätsel und Fotoimport per OCR

## Gemeinsame Funktionen

- Desktop- und mobile Darstellung
- Unterstützung für Hoch- und Querformat
- Responsive Spielfeld- und Buttongrößen
- Spielstände speichern und fortsetzen
- Lokale Speicherung im Browser
- Einheitliche Einstellungen und Bedienlogik
- Sicherheitsabfragen beim Abbrechen und Löschen
- Anleitungen für jedes Spiel

## Sudoku

Sudoku bietet zusätzlich:

- Mehrere Schwierigkeitsstufen
- Zufällige Rätselerzeugung
- Prüfung auf gültige und lösbare Rätsel
- Eigenes Rätsel manuell erstellen
- Sudoku-Rätsel aus einem Foto übernehmen
- OCR-Erkennung mit manueller Korrekturmöglichkeit
- Hinweisfunktion
- Notizenmodus
- Rückgängig- und Wiederholen-Funktion
- Lösung anzeigen

Die OCR-Bibliothek wird bevorzugt lokal aus dem Projekt geladen. Falls die lokale Version nicht verfügbar ist, steht eine fest versionierte Online-Reserve zur Verfügung.

## Adaptive Bots

Die Strategiespiele enthalten unterschiedlich starke Botgegner. Zusätzlich verfügen sie über adaptive Bots.

Ein adaptiver Bot passt seine Spielstärke schrittweise an das Spielniveau des Spielers an. Dabei werden unter anderem Spielergebnisse, Spielzüge und taktische Entscheidungen berücksichtigt.

Die adaptive Botlogik basiert auf einer gemeinsamen Difficulty-Core-Architektur. Die jeweiligen Spielregeln, Taktiken und Bewertungsfunktionen bleiben spielabhängig.

## Spielstände und Spielerwerte

Laufende Spiele können gespeichert und später fortgesetzt werden. Dabei werden beispielsweise Spielbrett, aktuelle Runde, Spielstand und relevante Einstellungen gespeichert.

Spielstände und adaptive Spielerwerte werden lokal im Browser gespeichert und nicht an einen Server übertragen.

Über das Einstellungsmenü können Spielstände und Spielerwerte getrennt voneinander gelöscht werden.

## Technik

- HTML5
- CSS3
- JavaScript
- Responsive Webdesign
- Minimax-Suche
- Eigene Bewertungs- und Botlogik
- Gemeinsame Shared-Komponenten
- LocalStorage
- Tesseract.js für den Sudoku-Fotoimport
- GitHub Pages

## Entwicklung

Andis Game Foundry befindet sich aktiv in Entwicklung. Die Spiele, Bots, Benutzeroberflächen und gemeinsamen Komponenten werden laufend getestet und verbessert.

## Nutzung des Quellcodes

Das Projekt wird öffentlich auf GitHub bereitgestellt, damit die Spiele angesehen und ausprobiert werden können.

Der Quellcode ist nicht zur freien Nutzung, Vervielfältigung, Veränderung oder Weitergabe freigegeben. Eine entsprechende Nutzung ist nur mit ausdrücklicher Zustimmung des Urhebers gestattet.

© 2026 Andreas Rollinger
