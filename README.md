# Greek Quest — *Going Deeper with New Testament Greek*, as a game

An offline-first PWA that turns the two study apps into one game:

- every **word** (with its hook, icon and sentences) from [going-deeper-greek-vocab][vocab]
- every **concept** (the cases, the article, the adjective, the verb — with hooks, acrostics, examples and confusion pairs) from [going-deeper-greek-concepts][concepts]

Nothing is typed in here. The content is pulled from those two repos, so a chapter added to either app shows up here as new stops on the journey, new cards in the collection and new questions in every game.

[vocab]: https://github.com/claudekovalenko/going-deeper-greek-vocab
[concepts]: https://github.com/claudekovalenko/going-deeper-greek-concepts

## How it plays

**Journey** — one street per chapter. Word packs of ten, then the chapter's concept sets (the Spa, Swamp Road, the Harbour…), then a **boss**. Each stop is a ten-question lesson mixing Greek→English, English→Greek, hook hunts, sentence sleuthing, match-up boards, spot-it on real verses, acrostic ladders and confusion duels. Score 60 % for one star, 80 % for two, a clean run for three; a star opens the next stop. The boss is fifteen mixed questions on three hearts — beat it and the chapter is **crowned**.

**Play** — the arcade, no gates. Pick chapters and words / concepts / both, then:

| | |
|---|---|
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

## 3D Quest (`quest/`)

The [Koine Quest](https://github.com/claudekovalenko/gamefied-greek) 3D adventure, carrying only this content. Live at **https://claudekovalenko.github.io/gamified-greek/quest/**, and from the gold button on the Journey screen.

- **One world per chapter.** Each concept set is a region with a mentor and a guardian (Chapter 6: the Roll Call, the Recording Booth, the Weather Station, the Clock Tower), then the Quiz Hall: the mix-ups, and a 20-question chapter exam.
- **Lessons** are short and teach each word with its icon and hook, and each use with its hook, example and warnings, then test them: Greek→English, hook hunts, sentence sleuth, spot-it on real verses, confusion duels, acrostic ladders, match-ups.
- **Mini-games**: Word Rain (words), Sorting Spell (strike each Greek line with its use), Sentence Race (the vocab app's practice sentences, as scrolls).
- On a phone: drag on the right to walk, on the left to look around; talk and jump buttons sit bottom-left.
- **Hooks everywhere**: a 🪝 hint button on questions (a word's sound-alike, or the group's hook; half XP), each region's memory line on its banner and from its mentor and guardian, and a Hook book in the Codex with every hook in the chapter.
- **Skulch the Riddle-Creep**: fail a lesson or a guardian and he steals the questions you missed and hides in that region. A side quest: beat his riddles (3 hearts) to win them back.
- **One person per lesson**: every short lesson (5 words, or 2–3 uses) is taught by its own character along the road; finish it and walk on to the next. Riddle chests between them open with one right answer and refill daily.
- Glowing words to pick up along the road, Shades of Forgetting (spaced review of words and uses), spells, loot, daily quests, an arcade, and Review drills for weak words, weak concepts and a whole-chapter cram.

It reads the same `data/content.json`, so it stays in sync with the source apps. To open another chapter as a world, add its number to `KG.CHAPTERS` in `quest/js/content.js`.

```sh
node --test quest/tests/*.test.mjs   # builds the game from content.json and checks every lesson
```

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
js/normalize.js       source files → bundle (shared by the app and the sync script)
js/sources.js         where the two source files are
data/content.json     the bundled copy of the content
tools/sync.mjs        refresh data/content.json
sw.js                 offline copy
icons/                app icons (icon.svg is the source)
```
