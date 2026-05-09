# Baby StoneFruit

Quick-log feeding and diaper changes to [Huckleberry](https://huckleberrycare.com/) from a Pebble watch — by way of your own Home Assistant.

## Architecture

```
Pebble watch (embeddedjs/main.js)
    │  AppMessage {action, type}
    ▼
Phone companion (pkjs/index.js)
    │  HTTPS POST  /api/services/huckleberry/<service>
    │  Authorization: Bearer <long-lived token>
    ▼
Home Assistant (with the Huckleberry HACS integration)
    │  huckleberry-api Python library
    ▼
Huckleberry / Firestore
```

No custom server to deploy. The watch never holds credentials — your Home
Assistant token + child device ID live only in Clay settings on your phone.

## Layout

- `src/embeddedjs/main.js` — watch UI (two-level menu, runs on Moddable XS)
- `src/pkjs/index.js` — phone companion (translates AppMessage → HA REST call)
- `config/config.html` — settings page (HA URL, token, device ID)

## Setup

1. **Install the Huckleberry integration in Home Assistant** via [HACS](https://hacs.xyz/)
   ([Woyken/huckleberry-homeassistant](https://github.com/Woyken/huckleberry-homeassistant)).
   Add it under *Settings → Devices & Services* and sign in with your Huckleberry
   email / password (stored only in your HA instance).
2. **Create a long-lived access token** in HA under *Profile → Security → Long-Lived Access Tokens*.
3. **Find your child's device ID** under *Settings → Devices & Services → Huckleberry*.
4. **Build via CloudPebble** (this Moddable project) and sideload onto your watch.
5. In the Pebble phone app, open the gear icon for Baby StoneFruit and enter:
   - Home Assistant URL (e.g. `https://yourhome.ui.nabu.casa`)
   - Long-lived access token
   - Child device ID

## Watch UI

```
Main
├── Feeding
│   ├── Bottle (120ml)        → huckleberry.log_bottle
│   ├── Nurse Left            → huckleberry.start_nursing  side=left
│   ├── Nurse Right           → huckleberry.start_nursing  side=right
│   └── End Nursing           → huckleberry.complete_nursing
└── Diaper
    ├── Wet                   → huckleberry.log_diaper_pee
    ├── Dirty                 → huckleberry.log_diaper_poo
    ├── Both                  → huckleberry.log_diaper_both
    └── Dry                   → huckleberry.log_diaper_dry
```

## Targets

`emery` (Pebble Time 2) and `gabbro` (Pebble 2 Duo).
