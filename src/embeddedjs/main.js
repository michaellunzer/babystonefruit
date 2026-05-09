// Baby StoneFruit watch app.
// Two-level menu (Feeding / Diaper) -> on select, AppMessage to pkjs ->
// pkjs hits the proxy with stored credentials -> we show success/failure.

import { Window, MenuLayer, TextLayer } from "pebble";
import { sendAppMessage, addAppMessageListener } from "@moddable/pebbleproxy";

const TOP_MENU = [
  { title: "Feeding", action: "feeding" },
  { title: "Diaper",  action: "diaper"  },
];

const FEEDING_ITEMS = [
  { title: "Breast (Left)",  type: "breast_left"  },
  { title: "Breast (Right)", type: "breast_right" },
  { title: "Bottle",         type: "bottle"       },
];

const DIAPER_ITEMS = [
  { title: "Wet",   type: "wet"   },
  { title: "Dirty", type: "dirty" },
  { title: "Both",  type: "both"  },
];

let currentResultLayer = null;

function showResult(text) {
  const win = new Window();
  const layer = new TextLayer({
    text,
    font: "GOTHIC_28_BOLD",
    alignment: "center",
  });
  win.add(layer);
  win.show();
  currentResultLayer = { win, layer };
}

function updateResult(text) {
  if (!currentResultLayer) return showResult(text);
  currentResultLayer.layer.text = text;
}

function sendAction(action, type) {
  showResult("Logging...");
  sendAppMessage({ action, type });
}

function buildSubMenu(title, items) {
  const win = new Window({ title });
  const menu = new MenuLayer({
    sections: [{ title, items: items.map(i => ({ title: i.title })) }],
    onSelect: (sectionIndex, itemIndex) => {
      const item = items[itemIndex];
      sendAction(title.toLowerCase(), item.type);
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
        ? buildSubMenu("Feeding", FEEDING_ITEMS)
        : buildSubMenu("Diaper",  DIAPER_ITEMS);
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
