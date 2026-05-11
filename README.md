# Baby StoneFruit

Quick-log feedings and diaper changes to [Huckleberry](https://huckleberrycare.com/) from a Pebble watch — via your own Home Assistant.

## Architecture

```
Pebble watch (embeddedjs/main.js, Moddable XS / Piu)
    │  fetch()   — bridged through @moddable/pebbleproxy
    ▼
Phone (pkjs/index.js)
    │  HTTPS POST  /api/services/huckleberry/<service>
    │  Authorization: Bearer <long-lived token>
    ▼
Home Assistant (with the Huckleberry HACS integration)
    │  huckleberry-api Python library
    ▼
Huckleberry / Firestore
```

No custom server, no AppMessage protocol — the watch calls Home Assistant
directly through the phone's network.

## UI

A single screen on the watch:

| Button | Action |
|---|---|
| **Up** | Previous action in the list |
| **Down** | Next action in the list |
| **Select** | Log the current action |
| **Back** | Exit the app |

Actions cycle through diaper changes (Wet / Dirty / Both / Dry), Bottle (120 ml
formula), Nurse Left / Right, and End Nursing. Each maps to one HA service
under the `huckleberry` integration.

## Layout

- `src/embeddedjs/main.js` — watch app (Piu UI, button input, HTTP)
- `src/embeddedjs/credentials.js` — **gitignored**, holds your HA URL/token/device ID
- `src/embeddedjs/credentials.js.example` — template for `credentials.js`
- `src/pkjs/index.js` — phone companion, just the pebbleproxy bridge

## Setup

1. Install the [Huckleberry HACS integration](https://github.com/Woyken/huckleberry-homeassistant) in Home Assistant and configure it with your Huckleberry account.
2. Create a long-lived access token in HA: *Profile → Security → Long-Lived Access Tokens*.
3. Find the child device ID: *Settings → Devices & Services → Huckleberry → click your child → copy device ID*.
4. In CloudPebble, open this project. Create a new file at `src/embeddedjs/credentials.js` (copy from `credentials.js.example`) and fill in your three values. **Never commit this file.**
5. Compile and install to your watch.

## Targets

`emery` (Pebble Time 2) and `gabbro` (Pebble 2 Duo).
