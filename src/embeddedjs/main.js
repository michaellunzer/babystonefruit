// Baby StoneFruit — runs on the Pebble watch (Moddable XS / Piu).
//
// UI: a centered label + emoji icon over a category-colored background.
// Up/Down cycles items, Select sends the action to pkjs, which makes the
// actual HTTPS call to Home Assistant using credentials from CloudPebble
// environment variables. Back exits.

import {} from "piu/MC";
import Button  from "pebble/button";
import Message from "pebble/message";

// ----- Colors (Huckleberry palette) ---------------------------------------

const COLORS = {
  diaper:    "#F4C53D",  // yellow
  nurse:     "#F69EB1",  // soft pink — start action, distinct from End Nursing
  endNurse:  "#FF7A4F",  // red/coral — stop action, matches stop sign
  bottle:    "#A084E8",  // purple
};

// ----- Action catalog -----------------------------------------------------
//
// Each entry: label, action key (sent to pkjs), color, sprite-sheet x offset.
// Detailed variants commented out — uncomment when finer logging is wanted.

// All four emojis live in one sprite sheet (icons.png, 288x72, the only
// declared resource). We crop a different 72x72 region per action via the
// `iconX` offset. This avoids the unstable-per-resource-ID problem entirely:
// there's only ever one Texture(1), and the icon shown is determined by the
// x-offset in code, which we control directly.
//
// Sprite layout: [💩 poop | 🍼 bottle | 🤱 nursing | 🛑 stop]

const ICON_W = 72;
const ICON_H = 72;

const ACTIONS = [
  // { label: "Diaper: Wet",   action: "diaper_wet",   color: COLORS.diaper,   iconX: 0   },
  // { label: "Diaper: Dirty", action: "diaper_dirty", color: COLORS.diaper,   iconX: 0   },
  // { label: "Diaper: Dry",   action: "diaper_dry",   color: COLORS.diaper,   iconX: 0   },
  { label: "Diaper",      action: "diaper",    color: COLORS.diaper,   iconX: 0   },  // poop
  { label: "Bottle",      action: "bottle",    color: COLORS.bottle,   iconX: 72  },  // bottle
  // { label: "Nurse Left",  action: "nurse_left",  color: COLORS.nurse,    iconX: 144 },
  // { label: "Nurse Right", action: "nurse_right", color: COLORS.nurse,    iconX: 144 },
  { label: "Nurse",       action: "nurse",     color: COLORS.nurse,    iconX: 144 },  // nursing
  { label: "End Nursing", action: "nurse_end", color: COLORS.endNurse, iconX: 216 },  // stop
];

const HINT_DEFAULT    = "Up/Down  •  Select";
const STATUS_FLASH_MS = 700;

let selectedIndex = 0;
let busy = false;
let pendingResolve = null;   // promise resolver for the current AppMessage round-trip

// ----- UI -----------------------------------------------------------------

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

// Single sprite sheet — crop with x offset to pick which emoji we show.
const iconTexture = new Texture(1);
function makeIconSkin(x) {
  return new Skin({
    texture: iconTexture,
    x, y: 0, width: ICON_W, height: ICON_H,
  });
}
const iconSkins = {
  0:   makeIconSkin(0),
  72:  makeIconSkin(72),
  144: makeIconSkin(144),
  216: makeIconSkin(216),
};

const labelStyle = new Style({
  font: "bold 28px Gothic", color: "black", horizontal: "center", vertical: "middle",
});
const hintStyle = new Style({
  font: "14px Gothic", color: "black", horizontal: "center", vertical: "middle",
});

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
          left: 0, right: 0, top: 10, height: 36,
          style: labelStyle,
          string: ACTIONS[selectedIndex].label,
        }),
        Content($, {
          anchor: "icon",
          top: 50, bottom: 36, left: 0, right: 0,
          skin: iconSkins[ACTIONS[selectedIndex].iconX],
        }),
        Label($, {
          anchor: "hint",
          left: 0, right: 0, bottom: 8, height: 20,
          style: hintStyle,
          string: HINT_DEFAULT,
        }),
      ],
    }),
  ],
}));

const refs = { bg: null, main: null, icon: null, hint: null };
const app = new App(refs, { displayListLength: 4608 });

function render() {
  const a = ACTIONS[selectedIndex];
  refs.main.string = a.label;
  refs.hint.string = HINT_DEFAULT;
  refs.bg.skin     = skinForIndex(selectedIndex);
  refs.icon.skin   = iconSkins[a.iconX];
}

function showStatus(text, hint) {
  refs.main.string = text;
  refs.hint.string = hint || "";
  refs.bg.skin     = skins.status;
  refs.icon.skin   = null;
}

// ----- AppMessage --------------------------------------------------------
//
// pebble/message reads its callbacks from the constructor options, not
// from properties assigned after construction — so onWritable HAS to be
// declared inline. Track writability ourselves so a Select press that
// happens before the channel becomes writable still gets delivered.

let writable = false;
const outbox = [];

const message = new Message({
  keys: ["ACTION", "RESULT", "STATUS", "MESSAGE"],
  onReadable() {
    const msg = this.read();
    const result = msg.get("RESULT");
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
      console.log(`watch -> pkjs ACTION=${m.get("ACTION")}`);
      this.write(m);
    }
  },
});

function sendAction(action) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    const m = new Map();
    m.set("ACTION", action);
    if (writable) {
      console.log(`watch -> pkjs ACTION=${action}`);
      message.write(m);
    } else {
      outbox.push(m);
    }
  });
}

// ----- Buttons -----------------------------------------------------------

new Button({
  types: ["select", "up", "down"],
  onPush(down, type) {
    if (!down) return;
    if (busy) return;

    if (type === "up") {
      selectedIndex = (selectedIndex - 1 + ACTIONS.length) % ACTIONS.length;
      render();
      return;
    }
    if (type === "down") {
      selectedIndex = (selectedIndex + 1) % ACTIONS.length;
      render();
      return;
    }

    busy = true;
    showStatus("Logging...", "");
    sendAction(ACTIONS[selectedIndex].action).then(result => {
      if (result.ok) {
        showStatus("Logged", HINT_DEFAULT);
      } else if (result.status) {
        showStatus(`Error ${result.status}`, "Select to retry");
      } else {
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
