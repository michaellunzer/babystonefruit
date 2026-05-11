// Phone-side companion for Baby StoneFruit.
//
// Credentials come from CloudPebble's PebbleKit JS environment variables —
// process.env.* references are substituted with string literals at build
// time. Required vars:
//   - Home_Assistant_URL   (e.g. "https://home.example.com")
//   - HA_long_token        (long-lived access token)
//   - HA_kid_device_id     (child device ID from the Huckleberry integration)
//
// Protocol with the watch:
//   Watch -> Phone: { ACTION: "diaper" | "bottle" | "nurse" | "nurse_end" }
//   Phone -> Watch: { RESULT: "ok" }
//                or { RESULT: "err", STATUS: 401, MESSAGE: "..." }
//
// Also keeps the @moddable/pebbleproxy bridge so the watch's general fetch()
// path (used by hellofetch and any future code) keeps working.

const moddableProxy = require("@moddable/pebbleproxy");

const HA_URL    = process.env.Home_Assistant_URL;
const HA_TOKEN  = process.env.HA_long_token;
const DEVICE_ID = process.env.HA_kid_device_id;

console.log("pkjs: HA_URL=" + (HA_URL ? "set" : "MISSING")
  + " HA_TOKEN=" + (HA_TOKEN ? "set(" + HA_TOKEN.length + ")" : "MISSING")
  + " DEVICE_ID=" + (DEVICE_ID ? "set" : "MISSING"));

// Map watch ACTION -> { service path, request body extras }
function buildCall(action) {
  switch (action) {
    case "diaper":
      return {
        path: "huckleberry/log_diaper_both",
        body: { pee_amount: "medium", poo_amount: "medium", color: "yellow", consistency: "solid" },
      };
    case "bottle":
      return {
        path: "huckleberry/log_bottle",
        body: { amount: 120.0, bottle_type: "formula", units: "ml" },
      };
    case "nurse":
      return { path: "huckleberry/start_nursing",    body: {} };
    case "nurse_end":
      return { path: "huckleberry/complete_nursing", body: {} };
    default:
      return null;
  }
}

function reply(payload) {
  Pebble.sendAppMessage(payload, function () {}, function () {});
}

function callHomeAssistant(action) {
  const call = buildCall(action);
  if (!call) {
    reply({ RESULT: "err", STATUS: 0, MESSAGE: "Unknown action" });
    return;
  }
  if (!HA_URL || !HA_TOKEN || !DEVICE_ID) {
    reply({ RESULT: "err", STATUS: 0, MESSAGE: "Missing env vars" });
    return;
  }

  const url = HA_URL.replace(/\/+$/, "") + "/api/services/" + call.path;
  const body = JSON.stringify(Object.assign({ device_id: DEVICE_ID }, call.body));

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Authorization", "Bearer " + HA_TOKEN);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 20000;
  xhr.onload = function () {
    const ok = xhr.status >= 200 && xhr.status < 300;
    if (ok) {
      reply({ RESULT: "ok" });
    } else {
      reply({ RESULT: "err", STATUS: xhr.status, MESSAGE: "HTTP " + xhr.status });
    }
  };
  xhr.onerror     = function () { reply({ RESULT: "err", STATUS: 0, MESSAGE: "network" }); };
  xhr.ontimeout   = function () { reply({ RESULT: "err", STATUS: 0, MESSAGE: "timeout" }); };
  xhr.send(body);
}

Pebble.addEventListener("ready", moddableProxy.readyReceived);

Pebble.addEventListener("appmessage", function (e) {
  const payload = e.payload || {};
  console.log("pkjs <- watch payload keys: " + Object.keys(payload).join(","));
  if (typeof payload.ACTION === "string") {
    console.log("pkjs handling ACTION=" + payload.ACTION);
    callHomeAssistant(payload.ACTION);
    return;
  }
  // Forward anything that isn't ours to the Moddable proxy.
  moddableProxy.appMessageReceived(e);
});
