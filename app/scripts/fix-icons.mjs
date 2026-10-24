// After `npm run icons`: the generator insets the adaptive icon's background,
// which leaves a ring at the edge on some launchers. A plain colour fills it.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../android/app/src/main/res/', import.meta.url);
for (const f of ['mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml']) {
  const p = new URL(f, dir), s = readFileSync(p, 'utf8');
  writeFileSync(p, s.replace(/<background>[\s\S]*?<\/background>/, '<background android:drawable="@color/ic_launcher_background" />'));
}
const c = new URL('values/ic_launcher_background.xml', dir);
writeFileSync(c, readFileSync(c, 'utf8').replace(/#[0-9A-Fa-f]{6}/, '#1F3B5C'));
console.log('adaptive icon: solid background');
