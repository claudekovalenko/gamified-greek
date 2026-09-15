/**
 * Turn the two source apps' data files into one bundle this app plays from.
 *
 *   concepts  — going-deeper-greek-concepts/data/concepts.json, parsed
 *   vocabSrc  — going-deeper-greek-vocab/js/data.js, as source text
 *
 * Runs in Node (tools/sync.mjs, which writes data/content.json) and in the
 * browser (the app refreshes straight from the source repos when it is
 * online), so it depends on nothing but the language.
 */

/** Pull VOCAB_SETS and SENTENCE_SETS out of the vocab app's data.js. */
export function parseVocabSource(src) {
  if (typeof src !== 'string' || !/const VOCAB_SETS\s*=/.test(src)) {
    throw new Error('vocab data.js does not declare VOCAB_SETS');
  }
  const body = `${src}\n;return { VOCAB_SETS, SENTENCE_SETS: typeof SENTENCE_SETS === 'undefined' ? [] : SENTENCE_SETS };`;
  // The file is the user's own data module — plain array literals — and it
  // is what the vocab app itself executes, so evaluating it is no wider a
  // trust than the source app already extends.
  const out = new Function(body)(); // eslint-disable-line no-new-func
  if (!Array.isArray(out.VOCAB_SETS)) throw new Error('VOCAB_SETS is not an array');
  return out;
}

const chapterOfCard = (card, set) => {
  const tag = (card.tags || []).find((t) => /^ch-\d+$/.test(t));
  if (tag) return Number(tag.slice(3));
  return set && set.chapter ? Number(set.chapter) : null;
};

/** A stable id for a word: the lemma, within its set. */
const wordId = (setId, w) => `w:${setId}:${w.g}`;

/** Small, fast, deterministic string hash — enough to tell two bundles apart. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Strip accents/breathings so a lemma can be matched loosely. */
export function bare(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ̓̔͂ͅ]/g, '')
    .toLowerCase();
}

export function normalize({ concepts, vocabSrc, fetchedAt = new Date().toISOString(), sources = {} }) {
  const vocab = parseVocabSource(vocabSrc);

  /* ---------- words & sentences ---------- */
  const words = [];
  const setsByChapter = new Map();
  for (const set of vocab.VOCAB_SETS) {
    const chapter = Number(set.chapter) || null;
    if (chapter && !setsByChapter.has(chapter)) setsByChapter.set(chapter, []);
    if (chapter) setsByChapter.get(chapter).push(set.id);
    for (const w of set.words || []) {
      words.push({
        id: wordId(set.id, w),
        g: w.g,
        gloss: w.gloss,
        freq: w.freq ?? null,
        tier: w.tier || 'memorize',
        icon: w.icon || '📖',
        mn: w.mn || '',
        chapter,
        setId: set.id,
        setTitle: set.title || set.id
      });
    }
  }
  const byLemma = new Map();
  for (const w of words) {
    const key = bare(w.g.split(',')[0].trim());
    if (!byLemma.has(key)) byLemma.set(key, w.id);
  }
  const sentences = [];
  (vocab.SENTENCE_SETS || []).forEach((ss, si) => {
    (ss.items || []).forEach((it, ii) => {
      const uses = (it.uses || []).map((u) => byLemma.get(bare(u))).filter(Boolean);
      sentences.push({ id: `s:${ss.chapter ?? si}:${ii}`, chapter: Number(ss.chapter) || null, g: it.g, e: it.e, uses });
    });
  });

  /* ---------- concept sets & cards ---------- */
  const cSets = (concepts.sets || []).map((s) => ({
    id: s.id,
    name: s.name,
    verb: s.verb || '',
    does: s.does || '',
    subtitle: s.subtitle || '',
    eli5: s.eli5 || '',
    color: s.color || '#7b8cff',
    classDate: s.classDate || null,
    bigIdea: s.bigIdea || '',
    masterMnemonic: s.masterMnemonic || '',
    masterMnemonicWhy: s.masterMnemonicWhy || '',
    place: s.place || '📍',
    placeName: s.placeName || s.name,
    scene: s.scene || '',
    groups: (s.groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      key: g.key || '',
      mnemonic: g.mnemonic || '',
      expand: g.expand || '',
      spot: g.spot || '',
      scene: g.scene || ''
    })),
    chapter: null
  }));
  const setById = new Map(cSets.map((s) => [s.id, s]));
  const cards = (concepts.cards || []).map((c) => {
    const set = setById.get(c.set);
    const chapter = chapterOfCard(c, set);
    if (set && chapter && !set.chapter) set.chapter = chapter;
    return {
      id: `c:${c.id}`,
      cid: c.id,
      set: c.set,
      group: c.group || null,
      name: c.name,
      short: c.short || c.name,
      tile: c.tile || '',
      pic: c.pic || '🧩',
      eli5: c.eli5 || '',
      gist: c.gist || '',
      formula: c.formula || null,
      oneLine: c.oneLine || '',
      mnemonic: c.mnemonic || '',
      mnemonicWhy: c.mnemonicWhy || '',
      spotIt: c.spotIt || '',
      bookDef: c.bookDef || '',
      watchOut: c.watchOut || '',
      type: c.type || 'use',
      examples: (c.examples || []).map((e) => ({
        ref: e.ref || '',
        greek: e.greek || null,
        english: e.english || '',
        note: e.note || ''
      })),
      tags: c.tags || [],
      chapter
    };
  });
  for (const s of cSets) {
    if (!s.chapter) {
      const first = cards.find((c) => c.set === s.id && c.chapter);
      s.chapter = first ? first.chapter : null;
    }
  }
  const cardIds = new Set(cards.map((c) => c.cid));
  const confusions = (concepts.confusions || [])
    .filter((x) => Array.isArray(x.pair) && x.pair.every((p) => cardIds.has(p)))
    .map((x) => ({
      id: x.id,
      pair: x.pair.map((p) => `c:${p}`),
      question: x.question || '',
      test: x.test || '',
      answer: x.answer || '',
      example: x.example || ''
    }));
  const extraQuiz = (concepts.extraQuiz || [])
    .filter((q) => cardIds.has(q.answer))
    .map((q, i) => ({
      id: `x:${i}`,
      prompt: q.prompt || '',
      greek: q.greek || null,
      english: q.english || '',
      ref: q.ref || '',
      target: q.target || '',
      answer: `c:${q.answer}`,
      why: q.why || '',
      unofficial: !!q.unofficial
    }));

  /* ---------- chapters ---------- */
  const chapterNums = new Set([
    ...words.map((w) => w.chapter),
    ...cards.map((c) => c.chapter)
  ].filter(Boolean));
  const chapters = [...chapterNums].sort((a, b) => a - b).map((n) => ({
    n,
    title: `Chapter ${n}`,
    vocabSets: setsByChapter.get(n) || [],
    vocabTitle: (vocab.VOCAB_SETS.find((s) => Number(s.chapter) === n) || {}).title || '',
    conceptSets: cSets.filter((s) => s.chapter === n).map((s) => s.id),
    words: words.filter((w) => w.chapter === n).length,
    cards: cards.filter((c) => c.chapter === n).length,
    classDate: cSets.filter((s) => s.chapter === n).map((s) => s.classDate).filter(Boolean).sort()[0] || null
  }));

  const bundle = {
    schema: 1,
    fetchedAt,
    sources: {
      concepts: {
        ...(sources.concepts || {}),
        book: concepts.book || '',
        generated: concepts.generated || null,
        sets: cSets.length,
        cards: cards.length
      },
      vocab: {
        ...(sources.vocab || {}),
        sets: vocab.VOCAB_SETS.length,
        words: words.length,
        sentences: sentences.length
      }
    },
    world: concepts.world || null,
    chapters,
    words,
    sentences,
    sets: cSets,
    cards,
    confusions,
    extraQuiz
  };
  bundle.hash = hashString(JSON.stringify({ ...bundle, fetchedAt: null, sources: null }));
  return bundle;
}
