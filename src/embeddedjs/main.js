// Baby StoneFruit — runs on the Pebble watch (Moddable XS / Piu).
//
// UI: a centered label showing the current action (or "Child: <name>" when
// multiple children are configured). Up/Down cycles items, Select fires
// (or, for the child item, advances to the next child and persists it).
// Back exits (Pebble system default).
//
// Networking: device.network.https.io routes through @moddable/pebbleproxy
// on the phone, so the watch talks to Home Assistant via the phone's network.

import {} from "piu/MC";
import Button from "pebble/button";
import { HA_URL, HA_TOKEN, CHILDREN } from "credentials";

// Pebble doesn't ship the Moddable Preference module, so child selection
// is in-memory only — it resets to the first child each time the app
// launches. (Acceptable for now; we can add AppMessage-based persistence
// via pkjs later if it becomes annoying.)
let childIndex = 0;
const multipleChildren = CHILDREN.length > 1;

// ----- Action catalog -----------------------------------------------------

const ACTIONS = [
  { label: "Diaper: Wet",    path: "huckleberry/log_diaper_pee",   body: { pee_amount: "medium" } },
  { label: "Diaper: Dirty",  path: "huckleberry/log_diaper_poo",   body: { poo_amount: "medium", color: "yellow", consistency: "solid" } },
  { label: "Diaper: Both",   path: "huckleberry/log_diaper_both",  body: { pee_amount: "medium", poo_amount: "medium", color: "yellow", consistency: "solid" } },
  { label: "Diaper: Dry",    path: "huckleberry/log_diaper_dry",   body: {} },
  { label: "Bottle (120ml)", path: "huckleberry/log_bottle",       body: { amount: 120.0, bottle_type: "formula", units: "ml" } },
  { label: "Nurse Left",     path: "huckleberry/start_nursing",    body: { side: "left"  } },
  { label: "Nurse Right",    path: "huckleberry/start_nursing",    body: { side: "right" } },
  { label: "End Nursing",    path: "huckleberry/complete_nursing", body: {} },
];

// The "Switch child" slot is index 0 when multiple children exist; the
// action list follows. Single-child mode: just the action list.
const CHILD_ITEM_INDEX = multipleChildren ? 0 : -1;
const ITEM_COUNT       = ACTIONS.length + (multipleChildren ? 1 : 0);

const HINT_DEFAULT     = "Up/Down  •  Select";
const HINT_SWITCH      = "Select cycles child";
const STATUS_FLASH_MS  = 700;

let selectedIndex = multipleChildren ? 1 : 0;  // start on first action
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

// ----- UI -----------------------------------------------------------------

const screenSkin = new Skin({ fill: "white" });
const labelStyle = new Style({
  font: "bold 24px Gothic",
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

const App = Application.template($ => ({
  skin: screenSkin,
  contents: [
    Label($, {
      anchor: "main",
      left: 0, right: 0, top: 30, height: 60,
      style: labelStyle,
      string: labelFor(selectedIndex),
    }),
    Label($, {
      anchor: "hint",
      left: 0, right: 0, bottom: 20, height: 20,
      style: hintStyle,
      string: hintFor(selectedIndex),
    }),
  ],
}));

const refs = { main: null, hint: null };
const app = new App(refs, { displayListLength: 4608 });

function render() {
  refs.main.string = labelFor(selectedIndex);
  refs.hint.string = hintFor(selectedIndex);
}

function showStatus(text, hint) {
  refs.main.string = text;
  refs.hint.string = hint || "";
}

// ----- Networking ---------------------------------------------------------

const HOST = HA_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

function logAction(index) {
  return new Promise((resolve) => {
    const action   = actionAt(index);
    const child    = CHILDREN[childIndex];
    const path     = `api/services/${action.path}`;        // no leading /
    const body     = JSON.stringify(Object.assign({ device_id: child.deviceId }, action.body));

    const https = new device.network.https.io({
      ...device.network.https,
      host: HOST,
    });

    let status = 0;
    let lastError = null;
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
        lastError = error || null;
        const ok = !error && status >= 200 && status < 300;
        console.log(`HA ${action.path} -> ${status}${error ? " err:" + error : ""}`);
        resolve({ ok, status, error: lastError });
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
    showStatus("Logging...", "");
    logAction(selectedIndex).then(result => {
      if (result.ok) {
        showStatus("Logged", HINT_DEFAULT);
      } else if (result.status) {
        // Server responded with non-2xx; show the HTTP code.
        showStatus(`Error ${result.status}`, "Select to retry");
      } else {
        // No HTTP response (network / phone disconnected / TLS failure).
        showStatus("Network err", "Select to retry");
      }
      setTimeout(() => {
        busy = false;
        render();
      }, STATUS_FLASH_MS);
    });
  },
});

export default app;
