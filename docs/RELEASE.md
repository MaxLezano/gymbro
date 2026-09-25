# Releasing GymBro to Google Play

Steps that need the owner's accounts. Code-side setup (`eas.json`, privacy page, in-app account deletion) is already in the repo.

## 1. Blocker: exercise media license

The exercise GIFs/images come from [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). Its code and instruction text are MIT, but the media is **© Gym Visual** and needs a [Gym Visual license](https://gymvisual.com/content/3-terms-and-conditions-of-use) for any public app, free or paid. Resolve this before a public release: buy the license, or switch to an openly licensed media set.

## 2. Privacy page (GitHub Pages)

1. Contact address in `docs/privacy.html`: david.lezano@gmail.com (update it if support moves).
2. GitHub repo → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/docs`.
3. Check `https://maxlezano.github.io/gymbro/privacy.html` loads (the app links to it from Profile → Privacidad).

GitHub Pages on a free plan needs a public repo. If the repo goes private, host the page elsewhere and update `PRIVACY_URL` in `src/features/profile/ProfileScreen.tsx`.

## 3. EAS build environment

`.env.local` is not uploaded to EAS. Create the public variables once per environment:

```sh
bunx eas-cli env:set --environment production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <web-client-id> --visibility plaintext
bunx eas-cli env:set --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <url> --visibility plaintext
bunx eas-cli env:set --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <key> --visibility plaintext
bunx eas-cli env:set --environment production --name EXPO_PUBLIC_COACH_KEY --value <same as the Worker APP_KEY> --visibility sensitive
bunx eas-cli env:set --environment production --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --visibility plaintext
bunx eas-cli env:set --environment production --name SENTRY_AUTH_TOKEN --value <token> --visibility secret   # source maps upload
```

Repeat with `--environment preview` for test APKs. (`npx eas-cli@latest` works the same.)

## 4. Build

```sh
npx eas-cli@latest init                               # first time: links the project
npx eas-cli@latest build -p android --profile preview      # APK to test on a phone
npx eas-cli@latest build -p android --profile production   # AAB for Play
```

EAS generates and keeps the upload keystore.

## 5. Google Sign-In for release builds

Release builds are signed with different keys than the local debug build, so Google Sign-In fails until their SHA-1s are registered:

1. EAS upload key: `npx eas-cli@latest credentials -p android` → copy the SHA-1.
2. Play App Signing key: Play Console → your app → Test and release → App integrity → copy the SHA-1.
3. Google Cloud → Google Auth Platform → Clients → create one **Android** client per SHA-1 (package `com.gymbro.fitnessapp`).

## 6. Google Cloud: leave testing mode

Google Auth Platform → Audience → **Publish app**. With only the basic scopes (email, profile, openid) no verification is required. Avoid uploading a logo in Branding: that triggers brand verification.

## 7. Play Integrity for the coach Worker

The Worker only accepts requests carrying the app key (`X-App-Key`). The key ships inside the app, so it stops casual use of the URL, not a determined attacker. Once the app is on Play, add a Play Integrity token check to the Worker (Google Cloud project linked in Play Console → App integrity).

## 8. Play Console

1. Developer account (one-time USD 25).
2. Create the app, then complete *App content*: privacy policy URL, Data safety (answers below), account deletion URL (`.../privacy.html#eliminar-cuenta`), health apps declaration, content rating, target audience (13+).
3. New personal accounts must run a **closed test with at least 12 testers for 14 days** before applying for production.
4. Upload the AAB (first upload is manual; later `npx eas-cli@latest submit -p android`).

## 9. Data safety answers

Kept in sync with `docs/privacy.html`. General answers: data is **encrypted in transit** (HTTPS everywhere); users **can request deletion** (in-app + email); no data is sold or used for ads.

| Data type (Play category) | Collected | Shared | Why | Optional |
|---|---|---|---|---|
| Personal info → Name, Email address | Yes (Google sign-in, cloud backup in Supabase) | No | Account management | Yes (the app works without an account) |
| Photos → profile photo URL from Google | Yes | No | Account management | Yes |
| Health and fitness → Fitness info (workouts, weight, height, body measurements) | Yes (cloud backup) | No* | App functionality | Yes (backup only with Google) |
| Health and fitness → Health info (dietary conditions: celiac, diabetes, hypertension...) | Yes | No* | App functionality | Yes |
| Audio → Voice or sound recordings | Yes, **processed ephemerally** (speech recognition for dictation and voice commands; audio is never stored) | No | App functionality | Yes |
| Messages → Other in-app messages (coach chat) | Yes, processed ephemerally | No* | App functionality | Yes |
| App info and performance → Crash logs, Diagnostics (Sentry) | Yes | No | Analytics (fixing crashes) | No |

* Sent to service providers acting on our behalf (Supabase, Cloudflare, Google Gemini API), which Play does not count as "sharing". Not sent: location, contacts, name/email to the AI, IP addresses to Sentry.

In the Sentry project settings, turn on **Prevent storing of IP addresses** so the dashboard matches this declaration.

## Sideloaded APK updates (current setup)

Release APKs are signed with GymBro's own key (`plugins/withReleaseSigning.js`), so a newer APK installs over the old one and keeps the app data.

- Keystore: `~/.gymbro/gymbro-release.jks` (alias `gymbro`). Credentials: `GYMBRO_RELEASE_*` in `~/.gradle/gradle.properties`. Neither is in the repo. **Back up both**: without them no future APK can update installed copies.
- Its SHA-1 must be registered as an Android OAuth client in Google Cloud (package `com.gymbro.fitnessapp`), or Google Sign-In fails in release builds.
- Every release: bump `expo.version` and `expo.android.versionCode` in `app.json` (Android refuses to install a lower or equal versionCode), then:

```sh
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# -> android/app/build/outputs/apk/release/app-release.apk
```
