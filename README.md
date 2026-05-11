# Baby StoneFruit

Quick-log feedings and diaper changes to [Huckleberry](https://huckleberrycare.com/) from a Pebble watch — via your own Home Assistant.

## Architecture

```
Pebble watch (embeddedjs/main.js, Moddable XS / Piu)
    │  AppMessage { ACTION }
    ▼
Phone (pkjs/index.js)  ←  CloudPebble env vars at build time
    │  HTTPS POST  /api/services/huckleberry/<service>
    │  Authorization: Bearer <HA_long_token>
    ▼
Home Assistant (with the Huckleberry HACS integration)
    │  huckleberry-api Python library
    ▼
Huckleberry / Firestore
```

No custom server, no secrets in source. Credentials live as CloudPebble
PebbleKit JS environment variables (encrypted at rest) and are inlined
into `pkjs/index.js` at build time.

## UI

| Button | Action |
|---|---|
| **Up** | Previous action |
| **Down** | Next action |
| **Select** | Log the current action |
| **Back** | Exit the app |

Actions and their icons:

| Action | Icon | HA service |
|---|---|---|
| 🟡 Diaper | 💩 | `huckleberry.log_diaper_both` |
| 🟣 Bottle | 🍼 | `huckleberry.log_bottle` (120 ml formula) |
| 🟠 Nurse | 🤱 | `huckleberry.start_nursing` |
| 🟠 End Nursing | 🛑 | `huckleberry.complete_nursing` |

Background color shifts per category as you cycle. After Select the screen
briefly shows "Logged" or `Error <status>` against a white background.

The Wet / Dirty / Dry diaper variants and Nurse Left / Right are kept as
commented-out lines in `embeddedjs/main.js` and the switch in
`pkjs/index.js` so they can be re-enabled later without rebuilding from
scratch.

## Setup

1. Install the [Huckleberry HACS integration](https://github.com/Woyken/huckleberry-homeassistant) in Home Assistant and configure it with your Huckleberry account.
2. Create a long-lived access token in HA: *Profile → Security → Long-Lived Access Tokens*.
3. Find your child's device ID: *Settings → Devices & Services → Huckleberry → click the child → copy device ID*.
4. In CloudPebble open this project → **Settings → PebbleKit JS Environment Variables** and add three encrypted vars:

   | Variable name | Value |
   |---|---|
   | `Home_Assistant_URL` | your HA URL, e.g. `https://home.example.com` |
   | `HA_long_token`      | the long-lived access token |
   | `HA_kid_device_id`   | the child device ID |

5. Compile and install on your watch.

## Layout

- `src/embeddedjs/main.js` — watch app (Piu UI, button input, AppMessage)
- `src/pkjs/index.js`       — phone companion (HTTPS POST to HA using env vars)
- `resources/img/*.png`     — Twemoji icons (poop / bottle / nursing / stop)

## Targets

`emery` (Pebble Time 2) and `gabbro` (Pebble 2 Duo).
