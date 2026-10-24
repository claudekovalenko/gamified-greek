# Going Deeper Quest — the phone app

The 3D game in `../quest`, wrapped with [Capacitor](https://capacitorjs.com) so it installs as a real app on Android and iPhone. The game is never edited here: `scripts/build-www.mjs` copies `../quest`, `../data/content.json` and `../icons` into `www/` and patches the three things that must differ inside an app:

1. the game knows it is an app (`window.QUEST_NATIVE`);
2. words and concepts load fresh from the website when online, and from the copy built in when not;
3. "Send the link" (cloud save) points at the website, not the app's private address.

It also bundles the fonts, so Greek looks right with no signal. If the game changes so a patch no longer matches, the build stops with a message saying which.

## Automatic builds

`.github/workflows/app.yml` runs on every change to `quest/`, `app/` or `icons/`:

- **Android**: builds `going-deeper-quest.apk` and publishes it as the **app-latest** release. The website's download button always points there:
  `https://github.com/claudekovalenko/gamified-greek/releases/download/app-latest/going-deeper-quest.apk`
  It is signed with the fixed key in `android/app/sideload.keystore`, so each new download installs over the old one and keeps your progress. That key is public on purpose, and is only for installing from the website. Google Play uses its own key (below).
- **iOS**: checks the iPhone project still compiles.

## Google Play (when you're ready)

1. Make a Google Play developer account (one-off $25).
2. Make an upload key: `keytool -genkeypair -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
3. In the repo's **Settings → Secrets and variables → Actions**, add `ANDROID_KEYSTORE_BASE64` (`base64 -w0 upload.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`) and `ANDROID_KEY_PASSWORD`.
4. The next build also makes `going-deeper-quest.aab` (under the run's artifacts). Upload that in the Play Console. Use the store text and the privacy page from `../site/`.

## App Store (when you're ready)

Needs a Mac with Xcode and an Apple Developer account ($99/year).

```sh
cd app && npm ci && npm run ios      # builds, syncs, opens Xcode
```

In Xcode: pick your team under *Signing & Capabilities*, then *Product → Archive → Distribute App*.

## Working on it locally

```sh
cd app
npm ci
npm run build         # make www/ from ../quest
npm run android       # + open in Android Studio (needs the Android SDK)
npm run icons         # redo icons and splash screens from assets/ (sources in design/)
```

App id: `io.github.claudekovalenko.goingdeeperquest`. Name, colours and icon: `capacitor.config.json` and `design/`.
