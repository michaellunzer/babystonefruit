// Baby StoneFruit — runs on the Pebble watch (Moddable XS / Piu).
//
// UI: a centered label showing the current action. Up/Down cycles actions,
// Select fires the current one, Back exits (Pebble system default).
//
// Networking: fetch() is bridged through @moddable/pebbleproxy on the phone
// companion, so the watch talks to Home Assistant via the phone's connection.

import {} from "piu/MC";
import Button from "pebble/button";
import { HA_URL, HA_TOKEN, DEVICE_ID } from "./credentials";

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

let selectedIndex = 0;
let busy = false;

// ----- UI -----------------------------------------------------------------

const screenSkin = new Skin({ fill: "white" });
const labelStyle = new Style({
  font: "bold 18px Gothic",
  color: "black",
  horizontal: "center",
  vertical: "middle",
});
const hintStyle = new Style({
  font: "12px Gothic",
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
      string: ACTIONS[0].label,
    }),
    Label($, {
      anchor: "hint",
      left: 0, right: 0, bottom: 20, height: 20,
      style: hintStyle,
      string: "Up/Down choose  Select log",
    }),
  ],
}));

const app = new App({ main: null, hint: null }, { displayListLength: 4608 });
const mainLabel = app.content("main");
const hintLabel = app.content("hint");

function showAction(index) {
  mainLabel.string = ACTIONS[index].label;
  hintLabel.string = "Up/Down choose  Select log";
}

function showStatus(text, hint) {
  mainLabel.string = text;
  hintLabel.string = hint || "";
}

// ----- Networking ---------------------------------------------------------

async function logAction(index) {
  const action = ACTIONS[index];
  const url = `${HA_URL.replace(/\/+$/, "")}/api/services/${action.path}`;
  const body = JSON.stringify(Object.assign({ device_id: DEVICE_ID }, action.body));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    });
    return res.ok;
  } catch (e) {
    console.log("logAction error:", e && e.message);
    return false;
  }
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
        showStatus(ok ? "Logged" : "Error", ok ? "Up/Down choose  Select log" : "press Select to retry");
        setTimeout(() => {
          busy = false;
          showAction(selectedIndex);
        }, 1200);
      });
    }
  },
});

export default app;
