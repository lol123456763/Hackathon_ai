# Loop design notes

Loop is a phone app first. It should feel like a friendly paper notebook that a neighbor made. It should not look like a template.

## What we changed and why

Our first "personality pass" gave every card the same wobbly blob outline, put drifting gradient blobs behind the app, and faded in every list. Once every surface wobbled, the wobble stopped meaning anything and the app looked machine-made again. We also looked at how professional product teams make apps feel handmade:

- **Duolingo** uses chunky buttons that press down onto a darker edge of their own color.
- **Gumroad** and **Figma's FigJam** use flat color, hard edges and a few loud moments.
- **Mailchimp's** old voice guide says to be helpful first, and to be funny only when it fits.
- **Headspace** and **Monzo** give their mascot and illustrations one job each. They are not wallpaper.
- Deepam's BenefitBridge review of 50 Siteinspire sites (`legacy/benefitbridge-server/DESIGN_RESEARCH.md`) found the same thing: a few strong type and shape choices, then restraint.

The rule we use now: **different kinds of content are different paper objects**. Screens should never repeat one shape.

| Content | Object | Class / prop |
| --- | --- | --- |
| Regular content | Soft card, 22px corners, soft shadow | `<Card>` |
| The one thing that matters on a screen | Ink outline with a hard offset shadow | `<Card kind="ink">` (max one per screen) |
| Tips and "what to bring" | Yellow sticky note with tape | `<Card kind="note">` |
| Surplus food | Paper tag with a punched hole, plus a slapped rubber stamp | `<Card kind="tag">`, `.stamp.slap` |
| Missions | Ticket with side notches | `.ticket` |
| A finished handoff | Thermal receipt that prints down | `HandoffReceipt` in `MissionDetail.jsx` |
| Lists (plan steps, hours log, live feed) | One sheet with dotted dividers, not a stack of cards | `divide-y-2 divide-dotted` |

## Color

Warm paper `#FFF8EE`, ink `#1B1A17`, teal `#0E7C74` (white text), tomato `#E8503A` (ink text only), and sun `#FFC53D` for highlights and marbles. There are no gradients, purple, or rainbow category colors. Categories use three tints: teal, tomato and sun.

## Type

- Bricolage Grotesque 800 for headings.
- Rethink Sans for body text.
- Gochi Hand for one handwritten note per screen, used for encouragement and never for instructions.
- Space Mono for codes and receipts.

## Icons

Use `src/components/icons.jsx`: a hand-drawn ink line over a flat color fill printed 2px out of register, like a risograph. Use them for categories, tabs, section headings and travel modes. Small utility glyphs (chevrons, close, phone) can stay `lucide-react`.

## Loopy

Loopy is a teal bean with a coral scarf, drawn with an ink line over an offset fill. Moods are `wave`, `happy`, `think`, `cheer`, `sleep` and `carry`. Loopy blinks, squashes when tapped, and waves once. Loopy never appears on crisis, error or "I feel unsafe" screens.

## Motion

Motion is allowed for:

- button press (70ms)
- the tab pill sliding
- the bottom sheet springing up
- counters hopping when they grow
- stamps slapping
- the receipt printing
- marbles dropping into the hours jar
- the route line inking in
- the EN/ES card flipping

Motion is not allowed for:

- body text
- drifting backgrounds
- loops longer than 2s (Loopy's blink is the one exception)
- anything on a screen where someone is asking for help

Everything respects `prefers-reduced-motion`.

## Voice

Write like a helpful older sibling. Keep sentences short and use specific nouns ("40 lbs of bolillos", not "items"). Use at most one joke per screen, and never on need, crisis or error screens.
