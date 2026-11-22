# Web Live Tracker einrichten und ausprobieren

Web Live Tracker speichert beim Surfen Dateien auf deinem Computer. Du startest die Aufzeichnung selbst und siehst anschließend, welche Inhalte Chrome für die geöffnete Webseite geladen hat. In dieser Anleitung probierst du das mit einem Einmaleins-Spiel aus. Du brauchst Google Chrome und musst keine Befehle eingeben.

## 1. Erweiterung herunterladen und installieren

1. Wenn du `web-live-tracker.zip` bekommen hast, speichere die Datei auf deinem Computer. Wenn du das Projekt auf GitHub geöffnet hast, klicke oben auf **Code** und dann auf **Download ZIP**.
2. Öffne den Ordner, in dem die ZIP-Datei liegt. Klicke mit der rechten Maustaste auf die Datei und wähle **Entpacken** oder **Alle extrahieren**. Die genaue Bezeichnung hängt von deinem Computer ab.
3. Öffne Google Chrome. Gib oben in der Adressleiste `chrome://extensions` ein und drücke die Eingabetaste.
4. Schalte oben rechts den **Entwicklermodus** ein. Klicke auf **Entpackte Erweiterung laden**. Bei englischer Oberfläche heißt die Schaltfläche **Load unpacked**.
5. Öffne im Auswahlfenster den entpackten Projektordner, zum Beispiel `web-live-tracker` oder `web-live-tracker-main`. Wähle darin den Unterordner `extension` aus und bestätige die Auswahl. In diesem Unterordner liegt die Datei `manifest.json`.
6. Prüfe, ob in Chrome eine Karte mit dem Namen **Web Live Tracker** erscheint und der Schalter darauf eingeschaltet ist. Lass den entpackten Ordner auf deinem Computer liegen. Chrome verwendet die Dateien aus diesem Ordner.

## 2. Eine erste Aufzeichnung machen

1. Öffne den Einmaleins-Schnelltest in einem neuen Chrome-Tab. Du kannst die Übung ohne Anmeldung ausprobieren. [Einmaleins-Schnelltest öffnen](https://www.timestables.com/speed-test/)
2. Klicke mit der rechten Maustaste auf eine freie Stelle der Webseite und wähle **Untersuchen**. Chrome öffnet die Entwicklerwerkzeuge, meist seitlich oder unten im Fenster.
3. Deaktiviere am besten vor der Aufzeichnung den Browser-Cache. Öffne dazu in den Entwicklerwerkzeugen **Netzwerk** (englisch **Network**) und setze oben das Häkchen bei **Cache deaktivieren** (englisch **Disable cache**). So ruft Chrome beim Neuladen mehr Inhalte frisch ab. Die Einstellung wirkt, solange die Entwicklerwerkzeuge geöffnet sind. [Chrome-Hilfe zum Browser-Cache](https://developer.chrome.com/docs/devtools/network/reference?hl=de#disable-cache)
4. Wechsle zurück zu **Web Live Tracker**. Wenn der Name fehlt, klicke in der Leiste auf **»** und suche ihn dort.
5. Tippe `einmaleins-test` in **Research ID** ein. Das ist der Name, unter dem du die Dateien später wiederfindest.
6. Klicke im Tracker auf **Start capture**. Sobald **Capturing.** erscheint, lade die Webseite mit dem runden Pfeil neben der Adressleiste neu. So zeichnet der Tracker auch auf, was Chrome beim Laden der Seite abruft.
7. Wähle auf der Webseite zum Beispiel die **7** und klicke dort auf **Start**. Löse ein paar Aufgaben. Mit **Answer** bestätigst du deine Eingabe. Im Tracker zeigt **Files saved**, wie viele Dateien Chrome bereits gespeichert hat.
8. Klicke im Tracker auf **Stop capture**. Warte, bis **Pending exchanges 0** angezeigt wird. Jetzt kannst du die Entwicklerwerkzeuge schließen.

Falls Chrome beim Speichern nach einem Ablageort fragt, findest du die Einstellung dafür unter `chrome://settings/downloads`. Wenn du die Nachfrage ausschaltest, verwendet Chrome den dort eingestellten Download-Ordner automatisch.

## 3. Gespeicherte Dateien finden und öffnen

1. Öffne in einem neuen Chrome-Tab `chrome://downloads`.
2. Klicke bei einer Datei aus dieser Aufzeichnung auf das Ordnersymbol. So springst du direkt zum Speicherort. Du kannst auch deinen üblichen Downloads-Ordner öffnen und dort nach `web-live-tracker` suchen.
3. Öffne unter `web-live-tracker` zuerst `einmaleins-test`, dann den Ordner mit dem Datum deiner Aufzeichnung. Danach folgen Ordner für die Webseiten-Adressen und die einzelnen Abrufe. Neben `www.timestables.com` können dort weitere Adressen stehen, von denen die Seite Inhalte geladen hat.

In den Ordnern findest du je nach Abruf verschiedene Dateien.

| Datei | Was darin steht und wie du sie öffnest |
| --- | --- |
| `exchange.json` | Hier stehen die Webadresse, die Uhrzeit und die Namen der zugehörigen Dateien. Öffne sie per Rechtsklick über **Öffnen mit** in einem Texteditor. |
| `response.png` oder `response.jpg` | Das ist ein Bild, das Chrome von der Webseite geladen hat. Öffne es per Doppelklick mit deiner Bildanzeige. |
| `response.json` oder `response.txt` | Das sind Daten oder Text, die Chrome von der Webseite erhalten hat. Öffne sie in einem Texteditor. |
| Eine Datei mit `request` am Anfang | Darin stehen Daten, die Chrome bei diesem Abruf gesendet hat, sofern Chrome sie bereitstellt. Bei vielen Abrufen gibt es keine solche Datei. |

Die genauen Dateien hängen davon ab, was die Seite bei deinem Besuch lädt. Manchmal gibt es nur `exchange.json`. Dort steht auch, ob Chrome die weiteren Inhalte bereitstellen konnte.

## Wenn etwas hakt

- **Der Tracker fehlt.** Prüfe unter `chrome://extensions`, ob **Web Live Tracker** eingeschaltet ist. Schließe die Entwicklerwerkzeuge und öffne sie erneut im Tab mit dem Spiel. Schau auch im Menü **»** nach.
- **Es wird nichts gespeichert.** Prüfe, ob **Capturing.** angezeigt wird, und lade die Webseite neu. Schau bei einer Fehlermeldung auch unter `chrome://downloads` nach.
- **Du möchtest eine zweite Aufzeichnung getrennt ablegen.** Warte nach dem Stoppen, bis **Pending exchanges 0** angezeigt wird. Gib dann vor dem nächsten Start eine neue Kennung ein, etwa `einmaleins-test-2`.

Benutze für die erste Übung eine öffentliche Seite ohne Anmeldung. In einer Aufzeichnung können auch private Inhalte stehen, wenn du währenddessen Formulare ausfüllst oder angemeldet surfst. Sieh dir die Dateien an, bevor du sie weitergibst.

[Zur englischen Projektübersicht](README.md)

## ZIP-Datei zum Weitergeben erstellen

Wenn du eine Git-Kopie des Projekts hast, öffne im Projektordner ein Terminal. Unter Windows kannst du dafür Git Bash verwenden. Führe diesen Befehl aus.

```sh
sh scripts/package-extension.sh
```

Danach liegt `web-live-tracker.zip` direkt im Projektordner. Die ZIP enthält die Erweiterung und beide Anleitungen aus dem aktuellen Git-Stand. Für die Installation reicht es, die ZIP-Datei weiterzugeben.
