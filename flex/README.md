# Bildeleringen Fleksibel

Nettleserutvidelse som finner *når* en delebil faktisk er ledig, ikke bare om den er "opptatt" akkurat nå. For medlemmer av [Bildeleringen / dele.no](https://dele.no).

> Ikke tilknyttet Bildeleringen / Dele AS. Laget av en bruker som var lei av at dele.no bare svarer "ingen bil ledig" uten å si når den faktisk er det.

## Hvorfor

dele.no sitt søk er binært: oppgi eksakt fra/til, og bilen er enten ledig eller opptatt. Har du litt slark i planene ("en bil et sted man–fre"), må du prøve deg fram tid for tid. Denne utvidelsen leser hele ledig/opptatt-mønsteret og regner ut hva som faktisk passer.

## Funksjoner

- **Ledig hele vinduet**: biler som er frie hele tidsrommet ditt.
- **Passer med justering**: nesten-treff som "skyv start til tirsdag" eller "lengste ledige blokk er ~53 t". Bittesmå blokker skjules bak «Vis alle».
- **Del opp på to biler**: når ingen enkeltbil dekker hele turen, foreslås et bytte underveis.
- **Ledig-tidslinje** per bil (grønn ledig / grå opptatt) med tidspunkt på hover.
- **Fleksibel varighet**: "hele vinduet" eller "N timer et sted i vinduet".
- **Filtre**: biltype og drivstoff som brikker, gangavstand. Kun Bildeleringen sine biler (ikke andre bilkollektiv på plattformen).
- **Åpne i dele.no**: hopper rett til bookingen med tiden forhåndsutfylt (justert til den luken som faktisk passer).

## Installasjon

**Firefox:**
1. Gå til `about:debugging#/runtime/this-firefox`
2. Klikk «Last inn midlertidig tillegg...» → velg `flex/manifest.json`

Du må være innlogget på [app.dele.no](https://app.dele.no) i en fane, utvidelsen bruker den innloggingen. Er du ikke det, åpner den fanen for deg og prøver på nytt.

## Personvern

Ingen egne servere, ingen sporing. Eneste nettverkstrafikk er dele.no sitt eget søke-API (`/api/search`) med din eksisterende innlogging.

## Begrensninger

- dele.no leser bare *tid* fra en delt lenke, ikke sted. Vi viser stedsnavnet så du velger stasjon med ett trykk.
- Utvidelsen booker ikke selv (ennå), den finner og sender deg videre til dele.no for å fullføre.

## Varemerke

Ikonet er avledet av Dele AS sitt logo. Greit for privat sideloading. For publisering: lag eget Dele-inspirert symbol (den lilla `#51289D` er fri).

## Utvikling

Konvensjoner, arbeidsflyt og API-fakta i [AGENTS.md](AGENTS.md). Tester: `node --test` (fra `flex/`).

## Lisens

[MIT](../LICENSE)
