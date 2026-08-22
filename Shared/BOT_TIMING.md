# Spieleübergreifende Bot-Zeitregel

## Grundsatz

Jedes Spiel liefert weiterhin die individuelle Denkzeit des gewählten manuellen
oder adaptiven Bots. Die gemeinsame Timing-Hilfe ersetzt diese Werte nicht.

Beim ersten Bot-Zug einer neuen Runde gilt zusätzlich eine Mindestwartezeit von
800 Millisekunden. Die 800 Millisekunden werden nicht auf die Denkzeit
aufgeschlagen:

```text
endgültige Zeit = max(individuelle Bot-Zeit, 800 ms) beim Eröffnungszug
endgültige Zeit = individuelle Bot-Zeit bei Folgezügen
```

## Umsetzungsregeln

- Die gemeinsame Funktion liegt in `botTiming.js`.
- Ein Spiel muss seine eigene Bot-Denkzeit an die Funktion übergeben.
- Nur der erste Bot-Zug einer Runde wird als Eröffnungszug markiert.
- Mehrteilige Spielzüge, insbesondere bei Quarto, dürfen die Eröffnungszeit
  nicht mehrfach anwenden.
- Bot-Timer müssen bei Abbruch, Neustart und Rundenwechsel gelöscht werden.
- Die individuelle Denkzeit und Schwierigkeit des Bots bleiben erhalten.

## Lessons Learned

Eine feste Verzögerung direkt im Spielcode, wie ursprünglich bei TicTacToe mit
300 ms, kann die Zeitvorgaben des manuellen und adaptiven Bots umgehen. Deshalb
wird die Eröffnungsregel zentral angewendet, während die Denkzeit weiterhin aus
dem jeweiligen Bot stammt.
