// Baby StoneFruit — runs on the Pebble watch (Moddable XS / Piu).
//
// UI: a centered label showing the current action. Up/Down cycles actions,
// Select fires the current one, Back exits (Pebble system default).
//
// Networking: fetch() is bridged through @moddable/pebbleproxy on the phone
// companion, so the watch talks to Home Assistant via the phone's connection.

import {} from "piu/MC";
import Button from "pebble/button";
import { HA_URL, HA_TOKEN, DEVICE_ID } from "credentials";

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

const HINT_DEFAULT = "Up/Down  •  Select";

let selectedIndex = 0;
let busy = false;

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

// Anchor stores the component instance into the data object passed to the
// Application constructor. After `new App(data)`, data.main / data.hint hold
// the Label references and we can mutate label.string directly.
const App = Application.template($ => ({
  skin: screenSkin,
  contents: [
    Label($, {
      anchor: "main",
      left: 0, right: 0, top: 30, height: 60,
      style: labelStyle,
      string: ACTIONS[0].label,
    }),
    Label($, {
      anchor: "hint",
      left: 0, right: 0, bottom: 20, height: 20,
      style: hintStyle,
      string: HINT_DEFAULT,
    }),
  ],
}));

const refs = { main: null, hint: null };
const app = new App(refs, { displayListLength: 4608 });

function showAction(index) {
  refs.main.string = ACTIONS[index].label;
  refs.hint.string = HINT_DEFAULT;
}

function showStatus(text, hint) {
  refs.main.string = text;
  refs.hint.string = hint || "";
}

// ----- Networking ---------------------------------------------------------

// Strip the https:// prefix from HA_URL to get just the host for
// device.network.https.io. The Pebble HTTP client takes host + path
// separately, not a full URL string.
const HOST = HA_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

function logAction(index) {
  return new Promise((resolve) => {
    const action = ACTIONS[index];
    const path = `/api/services/${action.path}`;
    const body = JSON.stringify(Object.assign({ device_id: DEVICE_ID }, action.body));

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
      onHeaders(s) {
        status = s;
      },
      onWritable(count) {
        const remaining = body.length - bodyPosition;
        const use = Math.min(count, remaining);
        if (use > 0) {
          this.write(ArrayBuffer.fromString(body.slice(bodyPosition, bodyPosition + use)));
          bodyPosition += use;
        }
      },
      onReadable(count) {
        // Drain the response body (we don't use it; HA returns [] on success).
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
        resolve(ok);
      },
    });
  });
}

// ----- Buttons ------------------------------------------------------------

new Button({
  types: ["select", "up", "down"],
  onPush(down, type) {
    if (!down) return;          // react on press, not release
    if (busy) return;

    if (type === "up") {
      selectedIndex = (selectedIndex - 1 + ACTIONS.length) % ACTIONS.length;
      showAction(selectedIndex);
    } else if (type === "down") {
      selectedIndex = (selectedIndex + 1) % ACTIONS.length;
      showAction(selectedIndex);
    } else if (type === "select") {
      busy = true;
      showStatus("Logging...", "");
      logAction(selectedIndex).then(ok => {
        showStatus(ok ? "Logged" : "Error", ok ? HINT_DEFAULT : "Select to retry");
        setTimeout(() => {
          busy = false;
          showAction(selectedIndex);
        }, 1200);
      });
    }
  },
});

export default app;
