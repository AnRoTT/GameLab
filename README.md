# Andis Game Foundry

Eine selbst entwickelte Sammlung browserbasierter Spiele mit eigenen Bots und adaptiver Schwierigkeitssteuerung.

## Live-Version

Die Spiele können direkt über GitHub Pages gespielt werden:

**[Andis Game Foundry öffnen](https://anrott.github.io/GameLab/)**

## Enthaltene Spiele

- Tic-Tac-Toe
- 4 Gewinnt
- Othello
- Quarto
- Mühle

Weitere Spiele können später ergänzt werden.

## Adaptive Bots

Die Spiele enthalten unterschiedlich starke Bots sowie adaptive Bots.

Ein adaptiver Bot passt seine Spielstärke während des Spiels an das Spielniveau des Spielers an. Nach Siegen und Niederlagen wird die Stärke schrittweise angepasst, damit der Bot weder dauerhaft zu leicht noch zu schwer ist.

Die adaptiven Bots beobachten außerdem das Spielverhalten des Spielers und bauen daraus ein individuelles Spielerprofil auf. Sie erkennen unter anderem bevorzugte Spielzüge, taktische Muster sowie sichere und riskante Entscheidungen.

Auf dieser Grundlage passen sie ihre eigene Spielweise an, lernen den Spieler kennen und entwickeln im Verlauf eine individuellere Gegenstrategie.

Die Spiele verwenden eine gemeinsame Difficulty-Core-Architektur. Die jeweiligen Spielregeln, Taktiken und Bewertungsfunktionen bleiben dabei spielabhängig.

## Technik

- HTML
- CSS
- JavaScript
- Minimax-Suche
- eigene Bewertungs- und Botlogik
- responsive Darstellung für Desktop und mobile Geräte

## Entwicklung

Andis Game Foundry befindet sich aktiv in Entwicklung. Die Spiele, Bots und Benutzeroberflächen werden laufend getestet und verbessert.

## Nutzung des Quellcodes

Das Projekt wird öffentlich auf GitHub bereitgestellt, damit die Spiele angesehen und ausprobiert werden können.

Der Quellcode ist nicht zur freien Nutzung, Vervielfältigung, Veränderung oder Weitergabe freigegeben. Eine entsprechende Nutzung ist nur mit ausdrücklicher Zustimmung des Urhebers gestattet.

© 2026 Andreas Rollinger
