# Produktprüfung

Geprüft am 18. November 2026.

## Barcode-Korrektur

Der zuvor als Original hinterlegte Barcode **5060337500401** gehört zu **Ultra White**.

Die fest hinterlegten Dosen-Barcodes wurden gegen die [MCS-Sortimentsliste](https://www.mcs.eu/Quick-Check/Quick-Check_Energy%20Drinks_H2024.pdf) geprüft:

| Dosen-EAN | Sorte |
| --- | --- |
| 5060337500401 | Ultra White |
| 5060335635228 | Original |
| 5060517888510 | Mango Loco |

Die [Produktspezifikation von Geho](https://www.geho-straelen.de/media/pdf/831Z.pdf) bestätigt für White den Unterschied zwischen Dosen-EAN 5060337500401 und Verkaufsgebinde-EAN 5060337500432. Gebinde-Barcodes werden nicht als einzelne Dose hinterlegt.

Die übrigen CSV-EAN-Felder sind leer. Weitere konkrete Barcodes sind damit nicht nachprüfbar und wurden nicht erfunden. Unbekannte Codes werden über Produktdaten aufgelöst; bei unklarem Ergebnis ist eine manuelle Sortenauswahl erforderlich.

## Bilder

Alle 32 WebP-Bilder wurden in einer beschrifteten Gesamtübersicht visuell mit den Katalogeinträgen verglichen. Die sichtbaren Sortennamen stimmen überein, einschließlich White/Original, beider Zero-Sugar-Farben, der drei Rehab-Sorten und beider VR46-Varianten. Keine Bilddatei musste umbenannt werden.

Zwei veraltete Dateinamen in der Referenz-CSV für Zero Sugar wurden an die tatsächlichen Dateinamen angepasst. Die App verwendet den JavaScript-Katalog mit den tatsächlich vorhandenen Dateien.

## Schutz gegen Wiederholungen

- Allgemeine Namen wie „Monster Energy“ ergeben keine Original-Zuordnung.
- Generisches „Ultra Zero Sugar“ bestimmt keine konkrete Ultra-Sorte.
- Widersprüchliche Sortennamen führen zu keiner automatischen Bildwahl.
- „Absolutely Zero“ wird nicht allein aufgrund des Namens dem blauen Zero-Sugar-Bild zugeordnet.
- Alte automatisch gespeicherte Zuordnungen werden nicht übernommen. Neue manuelle und automatische Zuordnungen sind getrennt gekennzeichnet.
- White-Alteinträge mit der falschen Original-Zuordnung werden repariert. Bewertungen, Notizen und Zähler bleiben erhalten. Der alte Standardwert 160 mg wird für diese Einträge auf den White-Katalogrichtwert korrigiert; abweichende Verlaufswerte bleiben erhalten.
- Unbestätigte andere Alteinträge behalten ihre gespeicherten Daten, zeigen aber bis zur erneuten Zuordnung kein behauptetes Sortenbild.
- Der Offline-Cache erhält eine neue Versionsnummer, damit die korrigierte App beim nächsten regulären Update geladen wird.
