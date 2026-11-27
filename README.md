# Skill-Atelier

PWA zum Schreiben, Prüfen und Exportieren von Skills (`SKILL.md`) direkt auf dem iPhone. Alles läuft im Browser, nichts wird gesendet.

- **Editor mit Live-Prüfung** nach unserem Standard: Frontmatter, Name (a-z, 0-9, Bindestrich), Beschreibung bis 1024 Zeichen mit „Nutzen bei“, höchstens 35 Zeilen, Warnung bei Gedankenstrichen und Platzhaltern.
- **Sicherheits-Scan** mit den Textregeln aus `scripts/vet-scan.sh` (HTML-Kommentare, unsichtbare Zeichen, Base64, Konfiguration mit Wirkung, Ausleitung, Telemetrie, Verschweigen). Eine Hilfe, kein Ersatz für Skript und Lesen.
- **Export** als ZIP je Skill (Ordner im Stamm, `SKILL.md` darin) oder als Bündel mit je einem ZIP pro Skill. Auf dem iPhone über das Teilen-Menü, sonst als Download.
- **Import** von Skill-ZIPs und Bündeln. Vorhandene Namen werden übersprungen, nicht überschrieben. Fremde Dateien werden gezählt und ignoriert, nie ausgeführt.

## Starten

```
python3 -m http.server 8765 --bind localhost
```

Dann `http://localhost:8765` öffnen. Auf dem iPhone braucht die PWA HTTPS: GitHub Pages (Settings, Pages, Branch `main`, Ordner `/ (root)`, bei kostenlosem Konto nur mit öffentlichem Repo), danach in Safari: Teilen, Zum Home-Bildschirm. Es gibt keinen Server-Teil, ein statischer Host genügt. Dieses Repo enthält nur die App, keine privaten Daten.

## Tests

```
npm test                                 # 43 Tests, keine Abhängigkeiten, nur Node
node tools/e2e.cjs <Ordner>              # Browsertest, braucht Playwright, Chromium und den Server oben
```

`npm test` deckt Prüfregeln, Scanner, ZIP (Schreiben, Lesen, Normkonformität mit `unzip` und Python, Grenzen, Pfad-Tricks, Prüfsumme), Vorlage, Export/Import und statische Sicherheit ab (CSP, keine externen Adressen, kein Inline-Code, Service-Worker-Dateiliste).

## Sicherheit und Datenschutz

- Strenge Content-Security-Policy: `default-src 'none'`, Skripte und Stile nur von der eigenen Herkunft, kein Inline-Code, keine externen Schriften oder Dienste.
- Fremdtext wird nur mit `textContent` angezeigt. Importierte ZIPs sind begrenzt (200 Dateien, 2 MB je Datei), Pfade mit `..`, absolute Pfade und Laufwerke werden abgelehnt, Prüfsummen werden kontrolliert.
- Daten liegen im `localStorage` des Browsers. Der Browser kann ihn löschen: regelmäßig als Bündel exportieren.

## Bekannte Grenzen

- Nicht in Safari oder auf dem iPhone getestet (hier nur Chromium). Teilen-Menü, Installation und Offline-Verhalten auf iOS sind ungeprüft.
- Ob der Claude-Chat die exportierten ZIPs akzeptiert, ist ungeprüft. Das Format folgt der Beschreibung „Ordner im Stamm, `SKILL.md` darin“.
- Der Scan ist eine Teilmenge von `vet-scan.sh` (keine Code-Regeln) und urteilt nicht.
- Neue Version ausliefern: `VERSION` in `sw.js` erhöhen, sonst bleibt der alte Cache aktiv.
