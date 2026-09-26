# Loop design notes

Loop uses **BenefitBridge's visual language**, the design Deepam built from a review of 50 professionally made sites (`legacy/benefitbridge-server/DESIGN_RESEARCH.md`, `legacy/benefitbridge-server/public/personality.css`). The goal is a friendly, hand-cut look that still reads cleanly.

## Layout

- **Computer:** a normal website. The header shows the brand, the current role's pages as links, the role switcher and the language button. Pages sit in a readable column, and the Live Loop panel (counters, map, feed) stays in a sticky column on the right. Get Help and Map use the full width.
- **Phone:** the same pages in one column, with a tab bar at the bottom for the role's pages.
- A rounded footer carries the 911 / 988 / 2-1-1 lines on every page.

## Color

| Token | Value | Use |
| --- | --- | --- |
| wash | `#FBF8EF` | page background, with soft peach and sage washes behind the home hero |
| ink | `#193E37` | text |
| primary (teal-dark) | `#155348` | secondary buttons, active tab, links |
| accent (terracotta) | `#A9533B` | the italic tail of big headlines |
| amber | `#F8C96E` | the one main action on a screen, with a peach `#E9A981` offset shadow |
| tiles | `#E5EFDE` `#F8DFCA` `#E6E3F6` `#F9EBBF` `#DCECE5` | pastel fills, rotated between neighbours |

## Type

- Headings: Georgia, tight tracking. Big headlines end with a terracotta italic phrase and a drawn amber underline.
- Body: Inter.
- Small uppercase pill labels ("eyebrows") sit above big headlines, tilted a few degrees.

## Shapes

- Need tiles use five different hand-cut silhouettes (soft pebble, notched ticket, scalloped cutout, torn scrap, and rounded stone). Their full rectangular hit targets and focus rings remain intact. The help form is a torn paper sheet, live counters are little cutouts, and resource matches read as paper slips with an ink margin.
- Smaller cards, chips and buttons use hand-cut corners (`.cut-1` … `.cut-5`, `.cut-btn`, `.cut-chip`, `.cut-input`). Neighbours use different cuts.
- Cards have a 2px soft border and a flat pastel offset shadow (`shadow-offset`). Amber buttons get `shadow-amber`, green buttons `shadow-mint`.
- Need tiles are numbered (01–10), tilted, and sit at slightly different heights.
- Sections are separated by a wavy rule, with a lavender "02 /" tag.

## Illustration

The green note on Get Help uses BenefitBridge's journey art: a drawn ribbon with two blob friends. It follows the pointer a little on desktop. **Loopy** is the peach blob from that art, used for loading, celebrations and "you're covered".

## Motion

- Headline phrases rise in.
- The underline and the journey ribbon draw themselves.
- Buttons lift and tilt on hover.
- Tiles hop.
- The tab pill slides.
- Counters bump when they grow.
- Hours-jar marbles drop in.
- The mission route inks in.

Everything respects `prefers-reduced-motion`. Nothing moves on crisis or safety screens.
