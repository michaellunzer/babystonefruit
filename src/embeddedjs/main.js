// Baby StoneFruit — runs on the Pebble watch (Moddable XS / Piu).
//
// UI: label + emoji icon over a category-colored background, with a
// "X ago" line beneath the icon (red when > 1 hour). When a nursing
// session is active, the time line becomes a live count-up timer and
// Select pauses / resumes via the Huckleberry HA services.
//
// Networking: AppMessage to pkjs, which makes HTTPS calls to Home
// Assistant using credentials from CloudPebble environment variables.

import {} from "piu/MC";
import Button  from "pebble/button";
import Message from "pebble/message";

// ----- Colors (Huckleberry palette) ---------------------------------------

const COLORS = {
  diaper:    "#F4C53D",
  nurse:     "#F69EB1",
  endNurse:  "#FF7A4F",
  bottle:    "#A084E8",
};

const TEXT_RED = "#B12525";

// ----- Image resource constants -------------------------------------------
//
// new Texture(N) on Pebble takes a numeric resource ID — names like
// "IMAGE_DIAPER" can't be passed to it directly. The named constants below
// map identifiers to their actual runtime IDs.

const IMAGE_DIAPER = 1;
const IMAGE_BOTTLE = 2;
const IMAGE_NURSE  = 3;
const IMAGE_STOP   = 4;

// ----- Action catalog -----------------------------------------------------

const ACTIONS = [
  { label: "Diaper",      action: "diaper",    color: COLORS.diaper,   image: IMAGE_DIAPER, kind: "diaper" },
  { label: "Bottle",      action: "bottle",    color: COLORS.bottle,   image: IMAGE_BOTTLE, kind: "bottle" },
  { label: "Nurse",       action: "nurse",     color: COLORS.nurse,    image: IMAGE_NURSE,  kind: "nurse"  },
  { label: "End Nursing", action: "nurse_end", color: COLORS.endNurse, image: IMAGE_STOP,   kind: "nurseEnd" },
];

const HINT_DEFAULT  = "Up/Down  •  Select";
const HINT_PAUSE    = "Select to pause";
const HINT_RESUME   = "Select to resume";
const STATUS_FLASH_MS = 700;
const RED_THRESHOLD_S = 3600;     // > 1 hour ago turns the line red

// ----- App state ----------------------------------------------------------

let selectedIndex = 0;
let busy = false;
let pendingResolve = null;
let lastStateReceivedAtSec = 0;   // epoch sec when the most recent state snapshot arrived

// Updated by pkjs fetch_state replies. 0 = unknown.
const state = {
  received:       false,    // has a state snapshot ever arrived?
  lastDiaper:     0,
  lastBottle:     0,
  lastNurse:      0,        // start time of the previous (completed) nursing session
  nursingState:   "none",   // "active" | "paused" | "none" | "unknown"
  nursingStart:   0,        // start time of the current active session
  nursingElapsed: 0,        // total active feeding seconds from HA (frozen value)
};

// ----- Time helpers -------------------------------------------------------

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function agoText(epoch) {
  if (!epoch) return "";
  const diff = nowSec() - epoch;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return h + (h === 1 ? " hour ago" : " hours ago");
  }
  const d = Math.floor(diff / 86400);
  return d + (d === 1 ? " day ago" : " days ago");
}

function formatTimer(sec) {
  sec = Math.max(0, sec | 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s < 10 ? "0" + s : "" + s;
  if (h > 0) {
    const mm = m < 10 ? "0" + m : "" + m;
    return h + ":" + mm + ":" + ss;
  }
  return m + ":" + ss;
}

function lastTimestampFor(kind) {
  if (kind === "diaper")    return state.lastDiaper;
  if (kind === "bottle")    return state.lastBottle;
  if (kind === "nurse")     return state.lastNurse;
  if (kind === "nurseEnd")  return state.lastNurse;
  return 0;
}

function isNurseSelected() {
  return ACTIONS[selectedIndex].kind === "nurse";
}

// ----- UI ----------------------------------------------------------------

const skins = {
  diaper:   new Skin({ fill: COLORS.diaper   }),
  nurse:    new Skin({ fill: COLORS.nurse    }),
  endNurse: new Skin({ fill: COLORS.endNurse }),
  bottle:   new Skin({ fill: COLORS.bottle   }),
  status:   new Skin({ fill: "white" }),
};
function skinForIndex(i) {
  const c = ACTIONS[i].color;
  if (c === COLORS.diaper)   return skins.diaper;
  if (c === COLORS.bottle)   return skins.bottle;
  if (c === COLORS.endNurse) return skins.endNurse;
  return skins.nurse;
}

function makeIconSkin(textureId) {
  const tex = new Texture(textureId);
  return new Skin({ texture: tex, width: tex.width, height: tex.height });
}
const iconSkins = [null, makeIconSkin(1), makeIconSkin(2), makeIconSkin(3), makeIconSkin(4)];

const labelStyle    = new Style({ font: "bold 24px Gothic", color: "black",  horizontal: "center", vertical: "middle" });
const timeStyleBk   = new Style({ font: "bold 18px Gothic", color: "black",  horizontal: "center", vertical: "middle" });
const timeStyleRed  = new Style({ font: "bold 18px Gothic", color: TEXT_RED, horizontal: "center", vertical: "middle" });
const hintStyle     = new Style({ font: "14px Gothic",      color: "black",  horizontal: "center", vertical: "middle" });

const App = Application.template($ => ({
  skin: skins.status,
  contents: [
    Container($, {
      anchor: "bg",
      left: 0, right: 0, top: 0, bottom: 0,
      skin: skinForIndex(selectedIndex),
      contents: [
        Label($, {
          anchor: "main",
          left: 0, right: 0, top: 6, height: 28,
          style: labelStyle,
          string: ACTIONS[selectedIndex].label,
        }),
        Content($, {
          anchor: "icon",
          left: 0, right: 0, top: 36, height: 72,
          skin: iconSkins[ACTIONS[selectedIndex].image],
        }),
        Label($, {
          anchor: "time",
          left: 0, right: 0, top: 110, height: 20,
          style: timeStyleBk,
          string: "",
        }),
        Label($, {
          anchor: "hint",
          left: 0, right: 0, bottom: 4, height: 16,
          style: hintStyle,
          string: HINT_DEFAULT,
        }),
      ],
    }),
  ],
}));

const refs = { bg: null, main: null, icon: null, time: null, hint: null };
const app = new App(refs, { displayListLength: 4608 });

// Update the time line + hint based on the currently selected action and
// the latest known state. Called on selection change, after fetch_state,
// and once a second by the ticker.
function updateTimeLine() {
  const a = ACTIONS[selectedIndex];

  // Active nursing session takes over the time line (and hint).
  if (a.kind === "nurse" && state.nursingState === "active") {
    // Live count-up: feeding seconds frozen from HA + time elapsed locally
    // since we received that snapshot.
    const live = state.nursingElapsed + Math.max(0, nowSec() - lastStateReceivedAtSec);
    refs.time.style  = timeStyleBk;
    refs.time.string = formatTimer(live);
    refs.hint.string = HINT_PAUSE;
    return;
  }
  if (a.kind === "nurse" && state.nursingState === "paused") {
    // Frozen: just show the last known active feeding total from HA.
    refs.time.style  = timeStyleBk;
    refs.time.string = "Paused " + formatTimer(state.nursingElapsed);
    refs.hint.string = HINT_RESUME;
    return;
  }

  // Default: "X ago" for the action's last occurrence. Red if > 1 hour.
  refs.hint.string = HINT_DEFAULT;

  if (!state.received) {
    // Distinguish "no snapshot yet" from "snapshot received, no data".
    refs.time.style  = timeStyleBk;
    refs.time.string = "...";
    return;
  }

  const ts = lastTimestampFor(a.kind);
  if (!ts) {
    // Snapshot arrived but no value for this kind — e.g. HA sensor unknown.
    refs.time.style  = timeStyleBk;
    refs.time.string = "no data";
    return;
  }
  const diff = nowSec() - ts;
  refs.time.style  = diff > RED_THRESHOLD_S ? timeStyleRed : timeStyleBk;
  refs.time.string = agoText(ts);
}

function renderAction() {
  const a = ACTIONS[selectedIndex];
  refs.main.string = a.label;
  refs.bg.skin     = skinForIndex(selectedIndex);
  refs.icon.skin   = iconSkins[a.image];
  updateTimeLine();
}

function showStatus(text, hint) {
  refs.main.string = text;
  refs.time.string = "";
  refs.hint.string = hint || "";
  refs.bg.skin     = skins.status;
  refs.icon.skin   = null;
}

// Tick the time line every second so "X ago" and the active timer stay
// current without re-fetching from HA.
let tickHandle = null;
function startTicker() {
  if (tickHandle !== null) return;
  tickHandle = setInterval(() => {
    if (!busy) updateTimeLine();
  }, 1000);
}

// ----- AppMessage --------------------------------------------------------

let writable = false;
const outbox = [];

const message = new Message({
  keys: ["ACTION", "RESULT", "STATUS", "MESSAGE",
         "LAST_DIAPER", "LAST_BOTTLE",
         "NURSING_STATE", "NURSING_START", "NURSING_LAST", "NURSING_ELAPSED"],
  onReadable() {
    const msg = this.read();
    const result = msg.get("RESULT");

    if (result === "state") {
      state.received       = true;
      state.lastDiaper     = msg.get("LAST_DIAPER")     || 0;
      state.lastBottle     = msg.get("LAST_BOTTLE")     || 0;
      state.lastNurse      = msg.get("NURSING_LAST")    || 0;
      state.nursingState   = msg.get("NURSING_STATE")   || "none";
      state.nursingStart   = msg.get("NURSING_START")   || 0;
      state.nursingElapsed = msg.get("NURSING_ELAPSED") || 0;
      lastStateReceivedAtSec = nowSec();
      console.log(`watch <- state diaper=${state.lastDiaper} bottle=${state.lastBottle} nursing=${state.nursingState} elapsed=${state.nursingElapsed}`);
      if (!busy) updateTimeLine();
      return;
    }

    // "ok" or "err" reply to a log action.
    const status = msg.get("STATUS");
    console.log(`watch <- pkjs RESULT=${result} STATUS=${status}`);
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve({ ok: result === "ok", status: status || 0 });
    }
  },
  onWritable() {
    writable = true;
    while (outbox.length) {
      const m = outbox.shift();
      this.write(m);
    }
  },
});

function send(action, awaitReply) {
  return new Promise((resolve) => {
    if (awaitReply) pendingResolve = resolve;
    else            resolve(null);   // fire-and-forget
    const m = new Map();
    m.set("ACTION", action);
    if (writable) message.write(m);
    else          outbox.push(m);
  });
}

function fetchState() {
  send("fetch_state", false);
}

// ----- Buttons -----------------------------------------------------------

function handleSelect() {
  const a = ACTIONS[selectedIndex];

  // Active nursing session on the Nurse screen -> pause/resume.
  if (a.kind === "nurse") {
    if (state.nursingState === "active") {
      busy = true;
      showStatus("Pausing...", "");
      // Freeze the live elapsed value locally so the paused display is
      // correct immediately, before pkjs gets back to us with HA's truth.
      state.nursingElapsed += Math.max(0, nowSec() - lastStateReceivedAtSec);
      lastStateReceivedAtSec = nowSec();
      send("pause_nursing", true).then(result => {
        if (result.ok) state.nursingState = "paused";
        finishStatus(result);
      });
      return;
    }
    if (state.nursingState === "paused") {
      busy = true;
      showStatus("Resuming...", "");
      // Restart the local count from the current frozen elapsed.
      lastStateReceivedAtSec = nowSec();
      send("resume_nursing", true).then(result => {
        if (result.ok) state.nursingState = "active";
        finishStatus(result);
      });
      return;
    }
  }

  // Default: log the action normally.
  busy = true;
  showStatus("Logging...", "");
  send(a.action, true).then(result => finishStatus(result));
}

function finishStatus(result) {
  if (result.ok) {
    showStatus("Logged", HINT_DEFAULT);
    fetchState();   // refresh "X ago" lines and nursing state after a write
  } else if (result.status) {
    showStatus(`Error ${result.status}`, "Select to retry");
  } else {
    showStatus("Network err", "Select to retry");
  }
  setTimeout(() => {
    busy = false;
    renderAction();
  }, STATUS_FLASH_MS);
}

new Button({
  types: ["select", "up", "down"],
  onPush(down, type) {
    if (!down) return;
    if (busy) return;

    if (type === "up") {
      selectedIndex = (selectedIndex - 1 + ACTIONS.length) % ACTIONS.length;
      renderAction();
      return;
    }
    if (type === "down") {
      selectedIndex = (selectedIndex + 1) % ACTIONS.length;
      renderAction();
      return;
    }

    handleSelect();
  },
});

// ----- Boot --------------------------------------------------------------

renderAction();
startTicker();
fetchState();

export default app;
