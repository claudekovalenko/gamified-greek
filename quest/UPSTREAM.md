# Upstream

`quest/` is a fork of Koine Quest (`claudekovalenko/gamefied-greek`), copied at
commit **9d5eb1f** ("Add a Low graphics setting and update the README").

To bring later Koine Quest improvements over, diff upstream from 9d5eb1f to its
new head and apply those changes here:

| Here | Upstream | Notes |
|---|---|---|
| `js/world.js`, `js/stage.js`, `js/app.js`, `js/engine.js`, `css/style.css` | same paths | forked, with small edits for this content |
| `js/content.js`, `js/boot.js` | — | new: build the game from `../data/content.json` |
| `js/vendor/` | same | unchanged |
| `js/fx.js`, `js/sidequests.js` | same paths | **identical copies**: sky, water, wind, sparkles; Rune Circle, Courier, Word Fishing. Copy them over as they are |
| — | `js/data/*`, `js/reader.js`, `data/nt/` | not used: the content comes from the two source apps |
