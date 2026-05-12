# Baby StoneFruit

A [Pebble](https://rebble.io/) watch app for one-tap logging of diaper changes and feedings to [Huckleberry](https://huckleberrycare.com/), routed through your own [Home Assistant](https://www.home-assistant.io/).

Built on the modern [Moddable Pebble JS SDK](https://developer.repebble.com/guides/alloy/) (Piu UI + Moddable XS). No custom backend — your Home Assistant *is* the backend.

## Features

- **Four one-tap actions:** Diaper, Bottle, Nurse, End Nursing
- **Color-coded screens** with emoji icons matching Huckleberry's mobile-app palette
- **Last-event time** below each icon (e.g. *5 min ago*) — turns red after 1 hour
- **Live nursing timer** that ticks while a session is active and *freezes* while paused
- **Pause / resume** the active nursing session directly from the watch (Select toggles)
- **Secrets stay encrypted in CloudPebble** — no tokens in source, no extra server to run

## Screenshots

Captured on a Pebble Time 2 (Emery, 200 × 228). The "X ago" line turns red once the last event is more than an hour old.

### Rectangular (Pebble Time 2, Emery)

| Diaper | Bottle | Nurse | End Nursing |
|---|---|---|---|
| ![Diaper screen](screenshots/Diaper.png) | ![Bottle screen](screenshots/Bottle.png) | ![Nurse screen](screenshots/Nurse.png) | ![End Nursing screen](screenshots/End%20Nursing.png) |

### Round (Pebble 2 Duo, Gabbro)

| Diaper | Bottle | Nurse | End Nursing |
|---|---|---|---|
| ![Diaper screen, round](screenshots/Diaper-Round.png) | ![Bottle screen, round](screenshots/Bottle-Round.png) | ![Nurse screen, round](screenshots/Nurse-Round.png) | ![End Nursing screen, round](screenshots/End%20Nursing-Round.png) |

## Requirements

- A **Pebble watch** running Rebble's modern firmware. Targets in `package.json`:
  - `emery` — Pebble Time 2
  - `gabbro` — Pebble 2 Duo
- A **Huckleberry** account with a child set up
- A **Home Assistant** instance reachable from your phone (local network or [Nabu Casa](https://www.nabucasa.com/))
- The **Huckleberry Home Assistant integration** by Woyken — [Woyken/huckleberry-homeassistant](https://github.com/Woyken/huckleberry-homeassistant) (install via [HACS](https://hacs.xyz/) or manually under `custom_components/`)
- A **[CloudPebble](https://cloudpebble.rebble.io/)** account to build & install (this project syncs from GitHub)

## Setup

### 1. Install and configure the Huckleberry HA integration

Follow the integration's [README](https://github.com/Woyken/huckleberry-homeassistant#readme). After signing in with your Huckleberry credentials, you should see one device per child and three sensors per device:

- `sensor.<child_name>_diaper` *(TIMESTAMP — last diaper change)*
- `sensor.<child_name>_bottle` *(TIMESTAMP — last bottle)*
- `sensor.<child_name>_nursing` *(ENUM: `active` / `paused` / `none`)*

Quick sanity check from a terminal once you have a long-lived access token:

```bash
HA_URL='https://your-ha.example.com'
HA_TOKEN='eyJhbG...'
DEVICE_ID='your_child_device_id'

# Should return HTTP 200 + JSON
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/"

# Should log a diaper change in the Huckleberry mobile app
curl -X POST "$HA_URL/api/services/huckleberry/log_diaper_both" \
  -H "Authorization: Bearer $HA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEVICE_ID\",\"pee_amount\":\"medium\",\"poo_amount\":\"medium\",\"color\":\"yellow\",\"consistency\":\"runny\"}"
```

### 2. Create a long-lived access token

In Home Assistant: **Profile → Security → Long-Lived Access Tokens → Create Token**. Save it somewhere safe — you'll paste it into CloudPebble's encrypted env vars.

### 3. Find your child's device ID

**Settings → Devices & Services → Huckleberry →** click your child → click the **device ID** value to copy. It'll look like `e754ec7bb8cdca212be0cd0897c83eaf`.

### 4. Configure the app — either way works

**The easy way (recommended for end users):** install the built `.pbw`, then open the **Pebble companion app on your phone → gear icon next to Baby StoneFruit**. The in-app settings page asks for your HA URL, access token, device ID, and (optionally) the child's name. Settings live only on your phone.

**The build-time way (for developers building from source):** open the project in CloudPebble, **Settings → PebbleKit JS Environment Variables**, and add:

| Variable name        | Value |
|----------------------|-------|
| `Home_Assistant_URL` | your HA base URL, no trailing slash, e.g. `https://home.example.com` |
| `HA_long_token`      | the long-lived access token from step 2 |
| `HA_kid_device_id`   | the device ID from step 3 |

CloudPebble stores these encrypted; they are inlined into `pkjs/index.js` at build time and act as defaults. Any value set via the in-app settings page overrides the env var.

### 5. Build and install

In CloudPebble, **Compile** the project, then install on your watch (real device or emulator). The Diaper screen should appear within a second, with a *X ago* timestamp below the icon if your child has any recent diaper events in Huckleberry.

## Usage

Single screen with four physical buttons:

| Button | Function |
|---|---|
| **Up** | Previous action |
| **Down** | Next action |
| **Select** | Log the current action *(or pause/resume during an active nursing session)* |
| **Back** | Exit the app |

### Actions

| Action | Color | Icon | Maps to |
|---|---|---|---|
| Diaper | 🟡 yellow | 💩 | `huckleberry.log_diaper_both` (medium pee + poo, yellow, runny) |
| Bottle | 🟣 purple | 🍼 | `huckleberry.log_bottle` (120 ml formula) |
| Nurse | 🩷 pink | 🤱 | `huckleberry.start_nursing` |
| End Nursing | 🟥 red | 🛑 | `huckleberry.complete_nursing` |

### Active-nursing flow

1. Cycle to **Nurse** and press **Select** — starts a session in Huckleberry.
2. The screen swaps the "X ago" line for a live `mm:ss` timer; the hint becomes *Select to pause*.
3. Press **Select** to call `huckleberry.pause_nursing`. The timer freezes at the current value; hint becomes *Select to resume*.
4. Press **Select** to resume; the timer continues from where it paused.
5. When you're done, cycle to **End Nursing** and press **Select** — calls `huckleberry.complete_nursing` and logs the session.

The on-watch timer mirrors HA's authoritative "current left + right duration" so it stays in sync with the Huckleberry mobile app even after pause/resume.

## How it works

```
Pebble watch (src/embeddedjs/main.js — Moddable XS / Piu)
    │  AppMessage  { ACTION: … }
    ▼
Phone (src/pkjs/index.js)  ←  CloudPebble env vars inlined at build time
    │  HTTPS calls to:
    │    POST /api/services/huckleberry/<service>   ← log actions / pause / resume
    │    POST /api/template                          ← fetch last-event timestamps
    ▼
Home Assistant + Woyken/huckleberry-homeassistant
    │  huckleberry-api (Python) over Firebase
    ▼
Huckleberry / Firestore
```

- **Watch ↔ phone** uses Pebble AppMessage (`pebble/message`) — small payloads, declared in `package.json`'s `messageKeys`.
- **Phone ↔ HA** uses regular `XMLHttpRequest` (the phone has real browser APIs; the watch does not).
- **Last-time discovery** uses HA's `device_entities()` template function to find the configured child's `*_diaper`, `*_bottle`, `*_nursing` sensors — no extra env vars needed, and stale `*_last_*` entities from older integration versions are skipped via a negative-lookbehind regex.

## Repository layout

```
.
├── package.json                # Pebble project + CloudPebble env-var refs + resources
├── config/
│   └── config.html             # Pebble in-app settings page (served via GitHub Pages)
├── resources/img/              # Twemoji PNGs (poop, bottle, nursing, stop)
└── src/
    ├── embeddedjs/             # Runs on the watch (Moddable XS)
    │   ├── main.js             # UI, button input, AppMessage to pkjs, time ticker
    │   └── manifest.json
    ├── pkjs/
    │   └── index.js            # Runs on the phone — HA fetch + state fetch + settings
    └── c/
        └── mdbl.c              # Moddable boilerplate (untouched)
```

The settings page is hosted via GitHub Pages at <https://babystonefruit.michaellunzer.com/config/config.html>. When the user opens the gear icon in the Pebble companion app, `showConfiguration` in `pkjs/index.js` opens that URL with the current settings encoded in the query string. The page redirects back with the new settings via the `pebblejs://close#…` scheme; pkjs persists them in `localStorage`.

## Customisation

### Re-enable detailed diaper / nursing variants

The original action list had four diaper variants (Wet / Dirty / Both / Dry) and split nursing into Left / Right. They're commented out in both `src/embeddedjs/main.js` (the `ACTIONS` array) and `src/pkjs/index.js` (the `buildCall` switch). Uncomment to bring them back.

### Change defaults

Edit the bodies in `src/pkjs/index.js`'s `buildCall()` — e.g. bottle amount or default diaper consistency.

### Swap icons

Drop new 72×72 PNGs into `resources/img/`, update the `media` entries in `package.json`, and re-verify the runtime Texture ID mapping in `main.js`'s `IMAGE_*` constants. CloudPebble assigns numeric IDs to resources in an order that doesn't always match `package.json` — if icons come out wrong after a re-import, swap the integer values next to the `IMAGE_*` names at the top of `main.js`.

### Recolour

The four category colors live in the `COLORS` object at the top of `src/embeddedjs/main.js`.

## Limitations & known gaps

- **Bottle has no "session" concept.** Huckleberry models a bottle feeding as a one-shot event with `amount_ml`. The watch logs 120 ml of formula instantly when you press Select. There's no live bottle timer because there's no server-side equivalent of `pause_nursing`.
- **Single-child only for now.** The integration supports multiple children; the watch app currently uses one configured `HA_kid_device_id`. An in-app child picker is a reasonable future addition.
- **Pebble app size is small.** All four emojis are bundled as 72×72 PNGs — total app size is well under the watch's storage budget, but adding much more (sound, additional icons) requires care.
- **Polling cadence.** The watch refreshes state on startup and after each successful log. Externally-triggered changes (e.g. logging from the Huckleberry mobile app) won't show up until the next watch action.

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md). Current version: **1.0.0**.

## Credits

- **[Huckleberry](https://huckleberrycare.com/)** — the baby tracking app this hooks into.
- **[Woyken/huckleberry-homeassistant](https://github.com/Woyken/huckleberry-homeassistant)** — the unofficial HA integration that bridges Huckleberry's Firestore to HA entities and services. None of this would exist without it.
- **[Moddable](https://www.moddable.com/)** — the JS runtime used by the modern Pebble SDK.
- **[Rebble](https://rebble.io/)** — keeping Pebble alive years after the original company shut down.
- **[CloudPebble](https://cloudpebble.rebble.io/)** — the web IDE used to build and install this.
- **[Twemoji](https://github.com/jdecked/twemoji)** (MIT) — the emoji bitmaps in `resources/img/`.
- **Home Assistant** — the glue layer that makes calling Huckleberry from a watch a sane thing to do at all.
