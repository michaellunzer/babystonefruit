# App store listing — Baby StoneFruit 1.0.0

Copy this into the **Publish** tab in CloudPebble (or the equivalent
form on the Rebble app store dashboard) when submitting the app.

## Required fields

| Field | Value |
|---|---|
| **Name** | Baby StoneFruit |
| **Category** | Tools & Utilities *(or "Health" if the store has it)* |
| **Type** | Watchapp |
| **Compatible platforms** | emery, gabbro |
| **License** | MIT |
| **Source code** | https://github.com/michaellunzer/babystonefruit |

## Tagline (under ~80 chars)

> Log diapers and feedings to Huckleberry from your wrist, via Home Assistant.

## Short description (under ~250 chars)

> One-tap baby-tracking on your Pebble. Logs diaper changes, bottles, and nursing sessions (with live timer + pause/resume) to Huckleberry through your own Home Assistant. Your credentials never leave your phone.

## Long description

Baby StoneFruit puts diaper, bottle, and nursing logging on your wrist — one button press and Huckleberry has it. No third-party servers; everything routes through your own Home Assistant.

**What you can do**
- Log a diaper change (defaults: medium pee + poo, yellow, runny) with one tap.
- Log a 120 ml formula bottle with one tap.
- Start, pause, resume, and end a nursing session — the watch's live timer stays in sync with the Huckleberry mobile app, including across pauses.
- See "X minutes ago" below each action so you know at a glance when the last event was. After an hour the line turns red.
- Always-on clock banner at the top of every screen.

**Setup (one-time)**
1. Install the open-source Huckleberry integration in your Home Assistant: https://github.com/Woyken/huckleberry-homeassistant
2. Create a long-lived access token in HA (Profile → Security → Long-Lived Access Tokens).
3. Copy your child's device ID from HA's Huckleberry device page.
4. Install Baby StoneFruit on your watch.
5. Open the Pebble companion app on your phone, tap the gear icon next to Baby StoneFruit, and enter your HA URL, the access token, and the device ID. (Optional: enter the child's name.)

That's it.

**Privacy**
Credentials are stored only on your phone. The watch app talks to your Home Assistant directly through the companion app — no Baby StoneFruit servers, no analytics, nothing in between.

**Open source (MIT)**
Source, issues, and contributions: https://github.com/michaellunzer/babystonefruit

Built on the modern Moddable Pebble JS SDK with Twemoji icons (MIT).

## Suggested screenshots

Aim for four; the Pebble app store typically shows two at the top of a listing.

1. **Diaper screen** with "X min ago" recent — communicates the core use case.
2. **Nurse screen with the live timer running** (e.g. "14:32" with "Select to pause") — shows the most novel feature.
3. **Nurse paused** ("Paused 28:06" with "Select to resume") — shows pause/resume works.
4. **Bottle** or **End Nursing** screen — shows the action variety + color coding.

Take screenshots from a real watch when possible (CloudPebble emulator works too). Pebble Time 2 (emery) at 200×228 is ideal.

## Suggested keywords / tags

`baby`, `parenting`, `huckleberry`, `home assistant`, `sleep tracker`, `diaper`, `feeding`, `nursing`, `health`, `utility`

## Optional: marketing GIF

The Pebble app store accepts an animated GIF showing the app in action. Suggested capture:
1. Launch the app on the Diaper screen.
2. Press Down to cycle through Bottle → Nurse → End Nursing.
3. Press Select on Nurse to start a session; watch the timer tick.
4. Press Select to pause; press again to resume.
5. Cycle to End Nursing and press Select to complete.

Trim to 15–20 seconds, loopable.

## Pre-submission checklist

- [ ] Version in `package.json` is `1.0.0`
- [ ] App compiles cleanly in CloudPebble for both `emery` and `gabbro`
- [ ] In-app settings page opens via the gear icon and saves correctly
- [ ] Diaper screen shows a real "X ago" within seconds of launch (HA reachable)
- [ ] Nurse start → live timer → pause (freezes) → resume (continues) → End Nursing all work
- [ ] LICENSE present at repo root
- [ ] README is up to date
- [ ] Screenshots captured and ready to upload
- [ ] **PebbleKit JS env vars cleared in CloudPebble** *(see warning below)*

## ⚠️ Important: clear your CloudPebble env vars before building the publish build

The `Home_Assistant_URL`, `HA_long_token`, and `HA_kid_device_id` env vars in CloudPebble are **substituted as string literals at build time** into `pkjs/index.js`. They end up embedded inside the compiled `.pbw` binary.

That's fine for your private dev installs, where you're the only person who runs the binary. But **anyone who downloads a published `.pbw` from the Rebble app store can `unzip` it and read those values.** That includes your Home Assistant URL, your long-lived access token, and your child's device ID — anyone with the token can read and write to your HA.

Before you click **Publish**:

1. CloudPebble → **Settings → PebbleKit JS Environment Variables**
2. **Delete** the three values (or replace them with empty strings / dummy placeholders).
3. **Save** → re-**Compile**.
4. Verify the compiled `pkjs/index.js` no longer contains your secrets: download the build, `unzip` the `.pbw`, look inside `pebble-js-app.js`. You should see `var HA_URL = "";` (or similar) instead of your real values.
5. Then publish.

End users still get a working app — the in-app settings page (gear icon in the Pebble companion) is the supported path for them to enter their own values.

### If you've already published with credentials baked in

The token is now in a public binary. Rotate it:

1. In HA: **Profile → Security → Long-Lived Access Tokens** — find the published one and **revoke** it.
2. **Create a fresh token** for your personal use.
3. Update the Pebble companion app's gear-icon settings on your phone with the new token.
4. Clear the CloudPebble env vars (as above) so the next publish build is clean.
5. Optional but recommended: re-build the publish build with no env vars, and push a 1.0.1 release that replaces the leaky binary on the store.

The device ID and HA URL are also exposed by the leaked binary. The URL only matters if your HA isn't already public; the device ID can't be used without a valid token to talk to HA, so revoking the token neutralises the practical risk.
