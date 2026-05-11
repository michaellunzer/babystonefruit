# Baby StoneFruit

Quick-log feedings and diaper changes to [Huckleberry](https://huckleberrycare.com/) from a Pebble watch — via your own Home Assistant.

## Architecture

```
Pebble watch (embeddedjs/main.js, Moddable XS / Piu)
    │  device.network.https.io  — bridged through @moddable/pebbleproxy
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
| **Up** | Previous item |
| **Down** | Next item |
| **Select** | Log the current action (or, for the "Child" item, cycle to next child) |
| **Back** | Exit the app |

Actions cycle through diaper changes (Wet / Dirty / Both / Dry), Bottle
(120 ml formula), Nurse Left / Right, and End Nursing. Each maps to one
HA service under the `huckleberry` integration. When two or more children
are configured, the first item becomes "Child: \<name\>" — Select cycles
to the next child and the choice is persisted across launches.

When a call fails, the watch briefly shows `Error <status>` (e.g. `Error 401`
for a bad token, `Error 404` for a wrong path) or `Network err` if the
request didn't make it off the phone.

## Layout

- `src/embeddedjs/main.js` — watch app (Piu UI, button input, HTTPS)
- `src/embeddedjs/credentials.js` — **gitignored**, holds your HA URL/token/children
- `src/embeddedjs/credentials.js.example` — template for `credentials.js`
- `src/pkjs/index.js` — phone companion, just the pebbleproxy bridge

## Setup

1. Install the [Huckleberry HACS integration](https://github.com/Woyken/huckleberry-homeassistant) in Home Assistant and configure it with your Huckleberry account.
2. Create a long-lived access token in HA: *Profile → Security → Long-Lived Access Tokens*.
3. Find each child's device ID: *Settings → Devices & Services → Huckleberry → click the child → copy device ID*.
4. In CloudPebble, create `src/embeddedjs/credentials.js` (copy from `credentials.js.example`) and fill in:
   ```js
   export const HA_URL   = "https://your-ha.example.com";
   export const HA_TOKEN = "eyJhbG...";
   export const CHILDREN = [
     { name: "Stone Fruit", deviceId: "abc..." },
     // add more children here as needed
   ];
   ```
   Never commit this file.
5. Compile and install to your watch.

## Targets

`emery` (Pebble Time 2) and `gabbro` (Pebble 2 Duo).
