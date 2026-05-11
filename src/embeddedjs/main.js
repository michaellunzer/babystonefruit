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
  diaper: "#F4C53D",
  nurse:  "#FF7A4F",
  bottle: "#A084E8",
};

// ----- Action catalog -----------------------------------------------------
//
// Each entry: label, action key (sent to pkjs), color, image id.
// Detailed variants commented out — uncomment when finer logging is wanted.

const ACTIONS = [
  // { label: "Diaper: Wet",   action: "diaper_wet",   color: COLORS.diaper, image: 1 },
  // { label: "Diaper: Dirty", action: "diaper_dirty", color: COLORS.diaper, image: 1 },
  // { label: "Diaper: Dry",   action: "diaper_dry",   color: COLORS.diaper, image: 1 },
  { label: "Diaper",      action: "diaper",    color: COLORS.diaper, image: 1 },
  { label: "Bottle",      action: "bottle",    color: COLORS.bottle, image: 2 },
  // { label: "Nurse Left",  action: "nurse_left",  color: COLORS.nurse, image: 3 },
  // { label: "Nurse Right", action: "nurse_right", color: COLORS.nurse, image: 3 },
  { label: "Nurse",       action: "nurse",     color: COLORS.nurse,  image: 3 },
  { label: "End Nursing", action: "nurse_end", color: COLORS.nurse,  image: 4 },
];

const HINT_DEFAULT    = "Up/Down  •  Select";
const STATUS_FLASH_MS = 700;

let selectedIndex = 0;
let busy = false;
let pendingResolve = null;   // promise resolver for the current AppMessage round-trip

// ----- UI -----------------------------------------------------------------

const skins = {
  diaper: new Skin({ fill: COLORS.diaper }),
  nurse:  new Skin({ fill: COLORS.nurse  }),
  bottle: new Skin({ fill: COLORS.bottle }),
  status: new Skin({ fill: "white" }),
};
function skinForIndex(i) {
  const c = ACTIONS[i].color;
  if (c === COLORS.diaper) return skins.diaper;
  if (c === COLORS.bottle) return skins.bottle;
  return skins.nurse;
}

function makeIconSkin(textureId) {
  const tex = new Texture(textureId);
  return new Skin({ texture: tex, width: tex.width, height: tex.height });
}
const iconSkins = [null, makeIconSkin(1), makeIconSkin(2), makeIconSkin(3), makeIconSkin(4)];

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
          skin: iconSkins[ACTIONS[selectedIndex].image],
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
  refs.icon.skin   = iconSkins[a.image];
}

function showStatus(text, hint) {
  refs.main.string = text;
  refs.hint.string = hint || "";
  refs.bg.skin     = skins.status;
  refs.icon.skin   = null;
}

// ----- AppMessage --------------------------------------------------------

const message = new Message({
  keys: ["ACTION", "RESULT", "STATUS", "MESSAGE"],
  onReadable() {
    const msg = this.read();
    const result = msg.get("RESULT");
    const status = msg.get("STATUS");
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve({ ok: result === "ok", status: status || 0 });
    }
  },
});

// Queue of outgoing messages waiting for the channel to become writable.
let pendingSend = null;
const messageReady = (() => {
  let ready = false;
  let queue = [];
  message.onWritable = function () {
    ready = true;
    while (queue.length) {
      const m = queue.shift();
      this.write(m);
    }
  };
  return {
    send(map) {
      if (ready) message.write(map);
      else queue.push(map);
    },
  };
})();

function sendAction(action) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    const m = new Map();
    m.set("ACTION", action);
    messageReady.send(m);
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
