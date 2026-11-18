# track-your-monster
Just keep in mind what flavors of monster energy you have already tried :)

[OPEN APP](https://kingmezzo.github.io/track-your-monster/)

Die App läuft ohne Build-Schritt als statische Website. Für den Kamerascanner ist HTTPS oder localhost nötig. Sammlung, Bewertungen, Notizen, Koffeinverlauf und Barcode-Zuordnungen bleiben im LocalStorage des jeweiligen Browsers.

## Lokale Dosenbilder

Alle 32 Bilder aus `monster_pictures/` sind in `catalog.js` erfasst. Der Tab **Alle Sorten** zeigt den gesamten lokalen Katalog mit Suche, Produktlinien und Probierstatus. Die Bilder werden auch für Scan-Ergebnisse und bestehende Sammlungseinträge verwendet. Alte OpenFoodFacts-Bildlinks werden ignoriert; der alte Bildcache wird entfernt.

Die Zuordnung funktioniert so:

1. Bekannte Barcodes werden über `BARCODE_MAP` in `database.js` direkt einer Katalog-ID zugeordnet. Mehrere Barcodes können dieselbe Sorte verwenden; führende Nullen bei UPC-A/EAN-13/GTIN-14 werden normalisiert.
2. Bei unbekannten Barcodes fragt die App ausschließlich Produktdaten von OpenFoodFacts ab. Passt der Produktname eindeutig zu einer Sorte, wird die Bildzuordnung im Browser gespeichert.
3. Ohne eindeutigen Treffer lässt sich die Sorte manuell auswählen. Diese Auswahl hat Vorrang und lässt sich im Scan-Ergebnis oder in den Sammlungsdetails korrigieren. Ohne passendes lokales Foto erscheint eine neutrale Dosen-Grafik.

Die mitgelieferte `sorten.csv` enthält überwiegend leere EAN-Felder. Deshalb werden keine Barcodes geraten. Neue bestätigte Zuordnungen können in `BARCODE_MAP` ergänzt werden, zum Beispiel:

```js
const BARCODE_MAP = {
  "5060337500401": "original"
  // "BESTÄTIGTE_EAN": "mango-loco"
};
```

Für neue Sorten ein WebP-Bild ablegen und in `catalog.js` Name, Linie, Farbe und bei Bedarf alternative Produktnamen ergänzen. Der JavaScript-Katalog ist die Datenquelle der App; die CSV ist eine ursprüngliche Referenzliste.

Die Koffeinwerte im Katalog sind Richtwerte für 500 ml und können vor dem Eintragen an die Dose angepasst werden. OpenFoodFacts-Werte berücksichtigen die dort hinterlegte Füllmenge. Die Sortenauswahl deckt die vorhandenen Bilder ab, keinen vollständigen weltweiten Produktkatalog.

## Prüfen

```sh
node --test tests/database.test.cjs
node tests/browser.cjs
```

Der Browser-Test benötigt Node 22+ und einen installierten Chromium-/Edge-Browser. Bei Bedarf dessen Pfad über `MONSTER_TEST_BROWSER` angeben. Er startet einen temporären lokalen Server und einen unsichtbaren Browser mit separatem Testprofil, prüft die Abläufe und speichert Vorschauen im temporären Ordner. Externe Dienste werden im Test blockiert; der echte Kamerazugriff muss auf dem Gerät geprüft werden.
