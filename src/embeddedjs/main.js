// Baby StoneFruit — runs on the Pebble watch (Moddable XS / Piu).
//
// UI: a centered label showing the current action over a category-colored
// background (matching Huckleberry's color palette). Up/Down cycles items,
// Select fires (or, for the Child item, advances to the next child).
// Back exits (Pebble system default).
//
// Networking: device.network.https.io routes through @moddable/pebbleproxy
// on the phone, so the watch talks to Home Assistant via the phone's network.

import {} from "piu/MC";
import Button from "pebble/button";
import { HA_URL, HA_TOKEN, CHILDREN } from "credentials";

// Pebble doesn't ship the Moddable Preference module, so child selection
// is in-memory only — it resets to the first child each time the app
// launches.
let childIndex = 0;
const multipleChildren = CHILDREN.length > 1;

// ----- Colors (Huckleberry palette) ---------------------------------------

const COLORS = {
  diaper: "#F4C53D",  // yellow
  nurse:  "#FF7A4F",  // orange
  bottle: "#A084E8",  // purple
  child:  "#5BC8DD",  // cyan
};

// ----- Action catalog -----------------------------------------------------
//
// Detailed variants are commented out for now — we collapse diaper changes
// to a single "Both" log and nursing to a no-side start. Uncomment to bring
// the finer-grained options back into the menu.

// Textures are numbered in the order they appear in package.json's media[]:
//   1 = IMAGE_DIAPER (poop.png)
//   2 = IMAGE_BOTTLE
//   3 = IMAGE_NURSE
//   4 = IMAGE_STOP

const ACTIONS = [
  // { label: "Diaper: Wet",   path: "huckleberry/log_diaper_pee",   body: { pee_amount: "medium" }, color: COLORS.diaper, image: 1 },
  // { label: "Diaper: Dirty", path: "huckleberry/log_diaper_poo",   body: { poo_amount: "medium", color: "yellow", consistency: "solid" }, color: COLORS.diaper, image: 1 },
  // { label: "Diaper: Dry",   path: "huckleberry/log_diaper_dry",   body: {}, color: COLORS.diaper, image: 1 },
  { label: "Diaper",      path: "huckleberry/log_diaper_both",  body: { pee_amount: "medium", poo_amount: "medium", color: "yellow", consistency: "solid" }, color: COLORS.diaper, image: 1 },
  { label: "Bottle",      path: "huckleberry/log_bottle",       body: { amount: 120.0, bottle_type: "formula", units: "ml" }, color: COLORS.bottle, image: 2 },
  // { label: "Nurse Left",  path: "huckleberry/start_nursing",    body: { side: "left"  }, color: COLORS.nurse, image: 3 },
  // { label: "Nurse Right", path: "huckleberry/start_nursing",    body: { side: "right" }, color: COLORS.nurse, image: 3 },
  { label: "Nurse",       path: "huckleberry/start_nursing",    body: {}, color: COLORS.nurse, image: 3 },
  { label: "End Nursing", path: "huckleberry/complete_nursing", body: {}, color: COLORS.nurse, image: 4 },
];

const CHILD_ITEM_INDEX = multipleChildren ? 0 : -1;
const ITEM_COUNT       = ACTIONS.length + (multipleChildren ? 1 : 0);

const HINT_DEFAULT     = "Up/Down  •  Select";
const HINT_SWITCH      = "Select cycles child";
const STATUS_FLASH_MS  = 700;

let selectedIndex = multipleChildren ? 1 : 0;
let busy = false;

function isChildSlot(i) { return i === CHILD_ITEM_INDEX; }
function actionAt(i)    { return ACTIONS[multipleChildren ? i - 1 : i]; }
function labelFor(i) {
  if (isChildSlot(i)) return `Child: ${CHILDREN[childIndex].name}`;
  return actionAt(i).label;
}
function hintFor(i) {
  return isChildSlot(i) ? HINT_SWITCH : HINT_DEFAULT;
}
function colorFor(i) {
  return isChildSlot(i) ? COLORS.child : actionAt(i).color;
}
function imageIdFor(i) {
  return isChildSlot(i) ? 0 : actionAt(i).image;  // 0 = hide
}

// ----- UI -----------------------------------------------------------------

// One Skin per category, swapped on the background container as the user
// cycles through items. Cheaper than rebuilding the Skin every render.
const skins = {};
for (const key in COLORS) {
  skins[key] = new Skin({ fill: COLORS[key] });
}
const statusSkin = new Skin({ fill: "white" });

function skinForIndex(i) {
  if (isChildSlot(i)) return skins.child;
  const action = actionAt(i);
  if (action.color === COLORS.diaper) return skins.diaper;
  if (action.color === COLORS.bottle) return skins.bottle;
  return skins.nurse;
}

const labelStyle = new Style({
  font: "bold 28px Gothic",
  color: "black",
  horizontal: "center",
  vertical: "middle",
});
const hintStyle = new Style({
  font: "14px Gothic",
  color: "black",
  horizontal: "center",
  vertical: "middle",
});

// One Skin per Texture so we can swap the icon by reassigning the Content's
// skin on each render. Texture(0) is invalid, so index 0 maps to a hidden
// state (no skin assigned for the Child slot etc.).
function makeIconSkin(textureId) {
  if (!textureId) return null;
  const tex = new Texture(textureId);
  return new Skin({
    texture: tex,
    width: tex.width,
    height: tex.height,
  });
}
const iconSkins = [null, makeIconSkin(1), makeIconSkin(2), makeIconSkin(3), makeIconSkin(4)];

const App = Application.template($ => ({
  skin: statusSkin,
  contents: [
    Container($, {
      anchor: "bg",
      left: 0, right: 0, top: 0, bottom: 0,
      skin: skinForIndex(selectedIndex),
      contents: [
        Label($, {
          anchor: "main",
          left: 0, right: 0, top: 10, height: 36,
          style: labelStyle,
          string: labelFor(selectedIndex),
        }),
        Content($, {
          anchor: "icon",
          top: 50, bottom: 36, left: 0, right: 0,
          skin: iconSkins[imageIdFor(selectedIndex)],
        }),
        Label($, {
          anchor: "hint",
          left: 0, right: 0, bottom: 8, height: 20,
          style: hintStyle,
          string: hintFor(selectedIndex),
        }),
      ],
    }),
  ],
}));

const refs = { bg: null, main: null, icon: null, hint: null };
const app = new App(refs, { displayListLength: 4608 });

function render() {
  refs.main.string = labelFor(selectedIndex);
  refs.hint.string = hintFor(selectedIndex);
  refs.bg.skin     = skinForIndex(selectedIndex);
  refs.icon.skin   = iconSkins[imageIdFor(selectedIndex)];
}

function showStatus(text, hint, useStatusBg) {
  refs.main.string = text;
  refs.hint.string = hint || "";
  if (useStatusBg) {
    refs.bg.skin   = statusSkin;
    refs.icon.skin = null;   // hide the action icon while status is showing
  }
}

// ----- Networking ---------------------------------------------------------

const HOST = HA_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

function logAction(index) {
  return new Promise((resolve) => {
    const action = actionAt(index);
    const child  = CHILDREN[childIndex];
    const path   = `api/services/${action.path}`;        // no leading /
    const body   = JSON.stringify(Object.assign({ device_id: child.deviceId }, action.body));

    const https = new device.network.https.io({
      ...device.network.https,
      host: HOST,
    });

    let status = 0;
    let bodyPosition = 0;

    https.request({
      method: "POST",
      path,
      headers: new Map([
        ["Authorization",  `Bearer ${HA_TOKEN}`],
        ["Content-Type",   "application/json"],
        ["Content-Length", body.length],
      ]),
      onHeaders(s) { status = s; },
      onWritable(count) {
        const remaining = body.length - bodyPosition;
        const use = Math.min(count, remaining);
        if (use > 0) {
          this.write(ArrayBuffer.fromString(body.slice(bodyPosition, bodyPosition + use)));
          bodyPosition += use;
        }
      },
      onReadable(count) {
        let offset = 0;
        while (offset < count) {
          const step = Math.min(128, count - offset);
          this.read(step);
          offset += step;
        }
      },
      onDone(error) {
        const ok = !error && status >= 200 && status < 300;
        console.log(`HA ${action.path} -> ${status}${error ? " err:" + error : ""}`);
        resolve({ ok, status, error: error || null });
      },
    });
  });
}

// ----- Buttons ------------------------------------------------------------

new Button({
  types: ["select", "up", "down"],
  onPush(down, type) {
    if (!down) return;
    if (busy) return;

    if (type === "up") {
      selectedIndex = (selectedIndex - 1 + ITEM_COUNT) % ITEM_COUNT;
      render();
      return;
    }

    if (type === "down") {
      selectedIndex = (selectedIndex + 1) % ITEM_COUNT;
      render();
      return;
    }

    // Select
    if (isChildSlot(selectedIndex)) {
      childIndex = (childIndex + 1) % CHILDREN.length;
      render();
      return;
    }

    busy = true;
    showStatus("Logging...", "", true);
    logAction(selectedIndex).then(result => {
      if (result.ok) {
        showStatus("Logged", HINT_DEFAULT, true);
      } else if (result.status) {
        showStatus(`Error ${result.status}`, "Select to retry", true);
      } else {
        showStatus("Network err", "Select to retry", true);
      }
      setTimeout(() => {
        busy = false;
        render();
      }, STATUS_FLASH_MS);
    });
  },
});

export default app;
