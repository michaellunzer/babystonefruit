# Changelog

All notable changes to Baby StoneFruit. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
