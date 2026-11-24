# Web Live Tracker für Firefox einrichten und ausprobieren

Web Live Tracker speichert Dateien, die Firefox beim Surfen im ausgewählten Tab sendet oder empfängt. Du startest die Aufzeichnung selbst und findest die Dateien anschließend unter einer Kennung, die du vorher eingibst.

[English Firefox guide](README.md)

## Erweiterung installieren

1. Speichere `web-live-tracker-firefox.zip` auf deinem Computer. Die Datei liegt im Projektordner `firefox`. Du kannst auch eine Kopie verwenden, die dir jemand geschickt hat.
2. Gib in der Firefox-Adressleiste `about:debugging#/runtime/this-firefox` ein und drücke die Eingabetaste.
3. Klicke auf **Temporäres Add-on laden…** (englisch **Load Temporary Add-on…**) und wähle die ZIP-Datei aus.

Nach einem Firefox-Neustart wiederholst du diese Schritte, um die Erweiterung erneut zu laden. [Firefox-Hilfe zur temporären Installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

## Eine erste Aufzeichnung machen

1. Öffne den Einmaleins-Schnelltest in einem Firefox-Tab. [Schnelltest öffnen](https://www.timestables.com/speed-test/)
2. Klicke mit der rechten Maustaste auf die Webseite und wähle **Untersuchen**. Öffne oben in den Entwicklerwerkzeugen einmal **Netzwerk** (englisch **Network**). Setze am besten das Häkchen bei **Cache deaktivieren**, damit Firefox beim Neuladen mehr Inhalte frisch abruft.
3. Wechsle zu **Web Live Tracker**. Falls du den Tab nicht siehst, schau im Menü **»** nach. Gib unter **Research ID** `einmaleins-test` ein und klicke auf **Start capture**.
4. Lade die Seite neu. Wähle zum Beispiel die **7**, klicke auf **Start** und löse ein paar Aufgaben. Die Zahl bei **Files saved** zeigt dir, wie viele Dateien Firefox gespeichert hat.
5. Klicke auf **Stop capture**. Warte, bis der Bericht fertig ist, und wähle **Open capture report**. Klicke im neuen Tab auf **Open downloaded report**. Falls sich der Bericht nicht öffnet, wähle **Show report in folder**.

## Dateien finden

Der Bericht gruppiert gespeicherte Dateien nach Typ und verlinkt sie direkt. Unter **What needs attention** steht, warum Dateien fehlen oder unvollständig sind. Du findest den Bericht auch unter `web-live-tracker/<research-id>/capture-*.html`. Lass ihn in diesem Ordner, damit die Links funktionieren.

Um eine frühere Aufzeichnung zu öffnen, gib ihre **Research ID** ein und wähle **Open capture report**, bevor du eine neue Aufzeichnung startest. Der Bericht verlinkt frühere Dateien automatisch, wenn sie im Download-Verlauf dieses Browsers unter `Downloads/web-live-tracker/<research-id>/` zu finden sind. Die Rohdaten enthalten die Details früherer Aufzeichnungen. Wenn der Download-Verlauf gelöscht wurde, findest du die Dateien weiterhin in diesem Ordner.

Öffne die Firefox-Downloadliste über den Download-Pfeil in der Symbolleiste oder suche im Download-Ordner nach `web-live-tracker/einmaleins-test`. Darunter findest du den Datumsordner und die Ordner für die aufgerufenen Webadressen.

`exchange.json` kannst du in einem Texteditor öffnen. Dort stehen die Webadresse und die Namen der gespeicherten Dateien. Bilder wie `response.png` öffnest du mit der Bildanzeige. Welche Dateien verfügbar sind, hängt davon ab, was Firefox für die Aufzeichnung bereitstellt.

## ZIP-Datei erstellen

Führe im Projektordner `sh scripts/package-extension.sh firefox` aus. Die Datei erscheint als `firefox/web-live-tracker-firefox.zip`.
