# Changelog

All notable changes to Baby StoneFruit. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] — 2026-05-16

UI polish for legibility on both screen shapes.

### Changed
- **Taller clock banner** (22 → 30 px) with a larger bold font
  (14 → 18 px). The current time is now easy to read at a glance
  without leaning close to the watch.
- **"Up/Down • Select" hint repositioned per device shape** — on the
  round Pebble 2 Duo (Gabbro) the hint moves up from the very edge of
  the screen into the safe zone so it no longer clips against the
  circular bezel. The rectangular Pebble Time 2 (Emery) gets a small
  bump too for better spacing.
- **Black outline ring on all four emoji icons** (diaper, bottle,
  nursing, end-nursing). Twemoji's stock icons washed out against the
  bright background colors; the outline gives them clear edges on the
  yellow / purple / pink / orange action screens. Icons stay 72×72
  palette-mode PNGs so runtime texture memory is unchanged.

### Repository
- New `experiment/audio-tones` branch holds an exploratory tone library
  for the Pebble Time 2 speaker (startup confirm chirp + helpers for
  hover / confirm / pause / resume / completed events). Not merged to
  main — Moddable's Pebble SDK doesn't currently expose a JS speaker
  module and there's no clean way to trigger C-side tones from JS-side
  button events without conflicting with Moddable's AppMessage handlers.
  Picked back up if/when Moddable ships JS speaker bindings.
- New `docs/sound-effects-attribution` (merged via PR #55) credits
  MATUSTRM's CC0 UI sound effects as "planned" — intended for use if
  audio integration becomes feasible.

### Known limitations carried over from 1.0.1
- **Nursing timer can drift from the Huckleberry mobile app** over a
  long active session, because the watch shows a snapshot of HA's
  authoritative duration plus a locally-counted offset. A periodic
  re-sync was prototyped (see #60 / #61) but adding even 20 lines of
  JS to `main.js` exceeds the device's XS chunk-memory budget. The
  next iteration will move the re-sync logic to `pkjs/index.js` (phone
  side, where memory is plentiful) so the watch keeps its current
  zero-footprint JS layout.

## [1.0.1] — 2026-05-11

Re-published binary + documentation. No code changes.

### Documentation
- Add a **"Why does this need Home Assistant?"** README section explaining
  that Pebble JS can't speak gRPC (Firestore-only) on either the watch or
  the phone, so HA acts as the Python/Firebase-SDK bridge.
- Add a **"Built with Claude"** section noting the project was vibe-coded
  via Anthropic's Claude.
- Add real Pebble Time 2 (Emery) and Pebble 2 Duo (Gabbro) screenshots to
  the README.
- Add a **publishing-security warning** in the README and a full writeup
  in `docs/APP_STORE.md`: CloudPebble's PebbleKit JS environment variables
  are substituted as string literals at build time and end up embedded in
  the compiled `.pbw`. Clear them before doing a publish build, or
  anyone who downloads the binary from the Rebble app store can `unzip`
  it and read your HA URL / long-lived token / device ID.

### Re-published binary
- The 1.0.1 `.pbw` is a clean rebuild with empty CloudPebble env vars,
  replacing the 1.0.0 binary that had the developer's credentials baked
  in. End users continue to configure via the in-app settings page.
- 1.0.0 token has been rotated in Home Assistant.

## [1.0.0] — 2026-05-11

First public release.

### Added
- One-tap logging from the Pebble watch:
  - **Diaper** → `huckleberry.log_diaper_both` (medium pee + poo, yellow, runny)
  - **Bottle** → `huckleberry.log_bottle` (120 ml formula)
  - **Nurse** → `huckleberry.start_nursing`
  - **End Nursing** → `huckleberry.complete_nursing`
- Color-coded screens with Twemoji icons matching Huckleberry's palette.
- "X ago" indicator below each action's icon, fetched from Home Assistant
  via the `device_entities()` template function. Turns red after one hour.
- Live nursing timer with pause / resume. Selecting on the Nurse screen
  during an active session calls `huckleberry.pause_nursing`; selecting
  again calls `huckleberry.resume_nursing`. The timer mirrors HA's
  authoritative `current_left_duration` + `current_right_duration`
  so it stays in sync with the Huckleberry mobile app, including across
  pauses.
- Initial-load fallback: if the integration's realtime listener hasn't
  populated session durations yet when the watch app opens, use
  `current_start` to derive a sensible elapsed lower bound.
- Always-on black clock banner across the top of every screen, updated
  every second.
- In-app settings page (gear icon in the Pebble companion) for entering
  Home Assistant URL, long-lived access token, child device ID, and an
  optional kid name. Values stored in pkjs `localStorage`. CloudPebble
  PebbleKit JS env vars (`Home_Assistant_URL`, `HA_long_token`,
  `HA_kid_device_id`) still work as build-time defaults for developers.
- Diagnostic `pkjs fetchState:` logs to aid future debugging.

### Repository
- MIT license.
- Publish-ready README with architecture diagram, setup walkthrough,
  usage guide, customisation tips, and credits.
- GitHub Pages-hosted settings page at
  `https://babystonefruit.michaellunzer.com/config/config.html`.
