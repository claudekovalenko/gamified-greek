/**
 * Where the content comes from. Both the sync script and the running app read
 * this, so there is one list to change if a repo moves.
 *
 * `raw` is the file on the repo's default branch, whatever that branch is
 * called (raw.githubusercontent.com resolves HEAD), and it updates the moment
 * a change is pushed — no Pages deploy in between.
 */
export const SOURCES = {
  concepts: {
    name: 'Greek Cases (concepts)',
    repo: 'claudekovalenko/going-deeper-greek-concepts',
    path: 'data/concepts.json',
    raw: 'https://raw.githubusercontent.com/claudekovalenko/going-deeper-greek-concepts/HEAD/data/concepts.json',
    site: 'https://claudekovalenko.github.io/going-deeper-greek-concepts/'
  },
  vocab: {
    name: 'Greek Vocab',
    repo: 'claudekovalenko/going-deeper-greek-vocab',
    path: 'js/data.js',
    raw: 'https://raw.githubusercontent.com/claudekovalenko/going-deeper-greek-vocab/HEAD/js/data.js',
    site: 'https://claudekovalenko.github.io/going-deeper-greek-vocab/'
  }
};
