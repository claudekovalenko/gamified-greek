# Greek Quest — *Going Deeper with New Testament Greek*, as a game

An offline-first PWA that turns the two study apps into one game:

- every **word** (with its hook, icon and sentences) from [going-deeper-greek-vocab][vocab]
- every **concept** (the cases, the article, the adjective, the verb — with hooks, acrostics, examples and confusion pairs) from [going-deeper-greek-concepts][concepts]

Nothing is typed in here. The content is pulled from those two repos, so a chapter added to either app shows up here as new stops on the journey, new cards in the collection and new questions in every game.

[vocab]: https://github.com/claudekovalenko/going-deeper-greek-vocab
[concepts]: https://github.com/claudekovalenko/going-deeper-greek-concepts

## How it plays

**Journey** — one street per chapter. Word packs of ten, then the chapter's concept sets (the Spa, Swamp Road, the Harbour…), then a **boss**. Each stop is a **run**: you sprint down a temple corridor with three lanes, and every gate across it is a question — Greek→English, English→Greek, hook hunts, sentence sleuthing, spot-it on real verses, confusion duels. The answers hang over the lanes; swipe, tap or press 1 · 2 · 3 to be in the right one before the gate arrives. Right lane and you run on, faster. Wrong lane and you crash, lose a heart, see what it was, and that gate comes back later in the run — you have to answer to get through. Stops run on five hearts, bosses on three. Score 60 % of gates first time for one star, 80 % for two, a clean run for three; a star opens the next stop. Beat the boss and the chapter is **crowned**.

Prefer the old ten-question lesson with match-up boards and acrostic ladders? Flip *Stops play as* to **Quiz** on the Journey page.

**Play** — the arcade, no gates. Pick chapters and words / concepts / both, then:

| | |
|---|---|
| 🏃 Temple Dash | the corridor, endless, three hearts — how many gates? |
| ⚡ Quick Fire | sixty seconds, combos multiply XP |
| 🧩 Match-Up | four boards of five pairs against the clock |
| 🔍 Spot It | the verse first, in Greek — which use is it? |
| 🪝 Hook Hunt | the mnemonic is the clue |
| 🕵️ Sentence Sleuth | which word is hiding in this sentence, or what does it say? |
| ⚔️ Confusion Duel | the pairs that get mixed up, head to head |
| 🪜 Acrostic Ladder | SWAMP RD, PACTS, MAMA, CADETS… tap the cards in order |
| 🛡️ Boss Rush | everything, endless, three hearts |

**Collection** — every word and concept as a card to collect: grey until met, bronze, silver, then **gold** once mastered. Tap one for its full card (hook, pattern, examples, sentences, what the book says). Searchable.

**Me** — level (Α to Ω, twenty-four of them), XP, day streak with a calendar, badges, numbers, people, settings, and where the content came from.

Every day brings three **quests** (earn 150 XP, climb three ladders, spot ten uses…) worth bonus XP. A right answer raises an item's mastery and schedules it further out; a wrong one drops it and brings it straight back. Weak and due items are asked first.

## Keeping up with the source apps

Three layers, so it is never stale:

1. **In the browser.** On every launch, on coming back online and on returning to the tab, the app fetches both source files straight from GitHub (the repos' default branches), rebuilds the bundle and swaps it in if anything changed. Progress survives, because it is keyed by lemma and card id.
2. **`tools/sync.mjs`** writes the same bundle to `data/content.json` — the copy that ships with the app and works offline — and bumps the service-worker cache name so installed phones pick it up.
3. **`.github/workflows/sync.yml`** runs that script every six hours, on a manual run, and the moment either source repo pushes (they send a `repository_dispatch`), and commits the result. Pages publishes the branch, so the commit is the deploy.

For step 3's instant pings, each source repo carries `.github/workflows/notify-gamified-greek.yml`. It needs one secret, **`GAMIFIED_GREEK_TOKEN`**: a fine-grained personal access token with *Contents: read and write* on `gamified-greek`, added under each source repo's Settings → Secrets → Actions. Without it the workflow skips quietly and the six-hour schedule does the job instead.

```sh
node tools/sync.mjs                                   # fetch from GitHub
node tools/sync.mjs --local ../going-deeper-greek-concepts ../going-deeper-greek-vocab
```

## Running it

Static files, no build, no dependencies. Serve the folder (a `file://` URL will not do):

```sh
python3 -m http.server 8000
```

It is live at **https://claudekovalenko.github.io/gamified-greek/** — GitHub Pages publishes the branch on every push. It is a full PWA: install it from the browser's share / install menu and it runs offline.

Everything is stored in `localStorage` on the device, one entry per person (`gq.v1:<id>`, roster in `gq.people`, the latest content bundle in `gq.content`). Nothing is uploaded.

## Bumping versions

Code change: bump `BUILD` in `js/app.js`, the `?v=` in `index.html`, and the `v1` part of `CACHE` in `sw.js`. Content change: `tools/sync.mjs` handles the hash part of `CACHE` itself.

## Where things live

```
index.html            shell
js/app.js             the game — one module, nothing chapter-specific
js/dash.js            Temple Dash: the corridor, the gates and the runner (canvas)
js/normalize.js       source files → bundle (shared by the app and the sync script)
js/sources.js         where the two source files are
data/content.json     the bundled copy of the content
tools/sync.mjs        refresh data/content.json
sw.js                 offline copy
icons/                app icons (icon.svg is the source)
```
