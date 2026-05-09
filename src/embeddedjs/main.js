// Baby StoneFruit watch app.
// Two-level menu (Feeding / Diaper) -> on select, AppMessage to pkjs ->
// pkjs hits Home Assistant /api/services/huckleberry/* with a bearer token.

import { Window, MenuLayer, TextLayer } from "pebble";
import { sendAppMessage, addAppMessageListener } from "@moddable/pebbleproxy";

const TOP_MENU = [
  { title: "Feeding", action: "feeding" },
  { title: "Diaper",  action: "diaper"  },
];

const FEEDING_ITEMS = [
  { title: "Bottle (120ml)",   type: "bottle"         },
  { title: "Nurse Left",       type: "nurse_left"     },
  { title: "Nurse Right",      type: "nurse_right"    },
  { title: "End Nursing",      type: "nurse_complete" },
];

const DIAPER_ITEMS = [
  { title: "Wet",   type: "wet"   },
  { title: "Dirty", type: "dirty" },
  { title: "Both",  type: "both"  },
  { title: "Dry",   type: "dry"   },
];

let resultLayer = null;

function showResult(text) {
  const win = new Window();
  const layer = new TextLayer({
    text,
    font: "GOTHIC_28_BOLD",
    alignment: "center",
  });
  win.add(layer);
  win.show();
  resultLayer = { win, layer };
}

function updateResult(text) {
  if (!resultLayer) return showResult(text);
  resultLayer.layer.text = text;
}

function sendAction(action, type) {
  showResult("Logging...");
  sendAppMessage({ action, type });
}

function buildSubMenu(title, action, items) {
  const win = new Window({ title });
  const menu = new MenuLayer({
    sections: [{ title, items: items.map(i => ({ title: i.title })) }],
    onSelect: (sectionIndex, itemIndex) => {
      sendAction(action, items[itemIndex].type);
    },
  });
  win.add(menu);
  return win;
}

function buildTopMenu() {
  const win = new Window({ title: "Baby StoneFruit" });
  const menu = new MenuLayer({
    sections: [{ items: TOP_MENU.map(i => ({ title: i.title })) }],
    onSelect: (sectionIndex, itemIndex) => {
      const choice = TOP_MENU[itemIndex];
      const sub = choice.action === "feeding"
        ? buildSubMenu("Feeding", "feeding", FEEDING_ITEMS)
        : buildSubMenu("Diaper",  "diaper",  DIAPER_ITEMS);
      sub.show();
    },
  });
  win.add(menu);
  return win;
}

addAppMessageListener((payload) => {
  if (!payload) return;
  if (payload.result === "ok") {
    updateResult("Logged ✓");
  } else if (payload.result === "err") {
    updateResult("Error:\n" + (payload.message || "unknown"));
  }
});

buildTopMenu().show();

export {};
