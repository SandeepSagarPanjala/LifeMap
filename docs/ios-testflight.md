# iOS QA builds — TestFlight + Fastlane

Use this for **real QA** (no Metro, Release JS bundle, background location like production).

Debug builds from `pnpm ios` are for **development only**.

## What you need first

1. **Apple Developer Program** ($99/year) — [developer.apple.com](https://developer.apple.com)
2. **App in App Store Connect** with bundle ID `com.sunrio.lifemap`
   - App Store Connect → Apps → **+** → New App → iOS → LifeMap
3. **Xcode signing** with **your personal** Apple Developer team (not a company org like Gynius AB)
   - Xcode → **Settings → Accounts** → your Apple ID → team **Uday Sagar** / `SRTH66N3SH`
   - Open `ios/LifeMap.xcworkspace` → LifeMap target → **Signing & Capabilities** → **Automatically manage signing** ✓
   - First TestFlight build needs an **Apple Distribution** certificate; `pnpm ios:beta` requests one via `-allowProvisioningUpdates` if you are signed into Xcode
4. **TransistorSoft license** for **Release** background GPS (Debug works without it)
   - Copy `ios/Config/Secrets.xcconfig.example` → `ios/Config/Secrets.xcconfig` and paste your iOS JWT
   - Copy `android/transistor-license.properties.example` → `android/transistor-license.properties` for Android
   - Trial expires **2026-07-13** — both files are gitignored

## One-time Fastlane setup (your Mac)

Fastlane needs **Ruby 3.2+** (macOS system Ruby 2.6 is too old):

```bash
brew install ruby@3.2
# Interactive shells (add to ~/.zshrc):
export PATH="/opt/homebrew/opt/ruby@3.2/bin:/opt/homebrew/lib/ruby/gems/3.2.0/bin:$PATH"

cd LifeMap
source scripts/ruby-env.sh   # pnpm scripts do this automatically
bundle install
cp ios/fastlane/.env.example ios/fastlane/.env
```

### App Store Connect API key (recommended)

1. [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Integrations** → **App Store Connect API** → **+**
2. Role: **App Manager** or **Developer**
3. Download the `.p8` file once (you cannot download it again)
4. Fill `ios/fastlane/.env`:
   - `APP_STORE_CONNECT_API_KEY_ID` — Key ID (e.g. `ABCD1234`)
   - `APP_STORE_CONNECT_ISSUER_ID` — Issuer ID (top of Keys page)
   - `APP_STORE_CONNECT_API_KEY_PATH` — absolute path to `AuthKey_XXXX.p8`

Add to `.gitignore` (already covered): `ios/fastlane/.env`, `*.p8`

## Upload a build to TestFlight

```bash
pnpm ios:beta
```

This lane:

1. `pnpm install` + `pod install`
2. Bumps **build number** (`CURRENT_PROJECT_VERSION`)
3. Builds **Release** IPA
4. Uploads to **TestFlight**

First upload may take 5–15 minutes to process in App Store Connect.

If `xcodebuild -showBuildSettings timed out` after `pod install`, retry `pnpm ios:beta`
(scripts set `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=120` automatically). Quit Xcode if it
is open and indexing the project, then run again.

### Build IPA only (no upload)

```bash
pnpm ios:release
```

Output: `ios/fastlane/build/LifeMap.ipa`

## Add QA testers

1. App Store Connect → your app → **TestFlight**
2. Wait until build status is **Ready to Test**
3. **Internal Testing** → **+** group → add Apple IDs (up to 100, same org)
4. Testers install **TestFlight** from the App Store → accept invite → install LifeMap

No public App Store listing required.

## Local Release on your phone (no TestFlight)

1. Open `ios/LifeMap.xcworkspace` in Xcode
2. Select your iPhone
3. **Product → Scheme → Edit Scheme → Run → Release**
4. **Product → Run**

No Metro banner. Good for solo checks; TestFlight is better for ongoing QA.

## GitHub Actions (optional)

Workflow: **iOS TestFlight (manual)** — Actions → run when API key secrets are configured.

Required repository secrets:

| Secret                             | Value                       |
| ---------------------------------- | --------------------------- |
| `APP_STORE_CONNECT_API_KEY_ID`     | Key ID                      |
| `APP_STORE_CONNECT_ISSUER_ID`      | Issuer ID                   |
| `APP_STORE_CONNECT_API_KEY_BASE64` | `base64 -i AuthKey_XXXX.p8` |

Also needs distribution certificate + provisioning profile in CI (see workflow comments) or run `pnpm ios:beta` locally until certs are wired in CI.

## Dev vs QA vs production

|                        | Dev (`pnpm ios`) | QA (TestFlight) |
| ---------------------- | ---------------- | --------------- |
| Metro                  | Required         | No              |
| JS bundle              | From Mac         | Embedded        |
| `__DEV__`              | true             | false           |
| Background GPS license | Not required     | **Required**    |
| Who tests              | Developers       | You + QA        |

## Android (later)

Same idea: **Play Internal testing** or **Firebase App Distribution**. Fastlane `supply` lane can be added in `android/fastlane/` when you are ready.
