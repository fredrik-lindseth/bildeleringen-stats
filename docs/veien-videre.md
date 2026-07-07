# Veien videre

Ideer og forbedringer for Bildeleringen Stats. Se også [issues](https://github.com/fredrik-lindseth/bildeleringen-stats/issues) for konkrete oppgaver.

## Neste steg

- **Ordentlige ikoner**: erstatte placeholder "B"-ikonene med et gjenkjennelig design
- **Publisering**: Firefox Add-ons og Chrome Web Store (krever signering og review)
- **Delbar årsoppsummering**: generere et faktisk PNG/bilde fra årsoppsummeringen for deling i sosiale medier
- **Automatisk transport-data**: integrere med Skyss, bankdata, eller andre kilder for å slippe manuell input i transportkalkulatoren
- **Booking-mønster**: analyse av forhåndsbestillingstid, foretrukne stasjoner og biler (dataen finnes allerede)
- **Multibrukerstøtte**: støtte for flere medlemskap / husholdninger

## Fleksibel booking (flex/)

Neste større funksjon:

- **Overvåkning av booking**: varsel når en bil blir ledig i mer enn X timer, avgrenset til "mine biler i nærheten". Fellesferie-caset. Trenger bakgrunns-polling (alarms), notifications-tillatelse og lagret watch-config. Egen brainstorm/spec.
- **Faktisk booking i utvidelsen**: legge inn reservasjonen direkte via API, i stedet for å deep-linke til dele.no. Krever kartlegging av skrive-endepunktet, og feil koster penger.
- **Pakking**: egen `flex/scripts/package.sh` når flex skal signeres og distribueres.

Mindre løse tråder:

- `splitPairs` rangerer på tidligste gyldige byttetid per par, ikke den midtpunkt-nærmeste innen parets vindu. Gir gyldige splitter, kun rangerings-upresisjon.
- `splitPairs` `opts.sameLocationOnly` mangler testdekning.
- `rankFits`/samme-sted-rangering mangler null-guard hvis to biler begge mangler `location.id` eller `distance` (ekte data har alltid begge).
- `parseLocalISO` validerer sifferform, ikke kalendergyldighet (mates kun av kalender-input og API-strenger).
- `errorText` sin fallback kan vise en engelsk `Error.message` i ellers norsk UI (sjelden sti).
- Deep-link til dele.no tar kun tid, ikke sted (dele.no-begrensning). Vi viser stedsnavnet i stedet.
