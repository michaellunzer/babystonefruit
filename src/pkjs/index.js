// Phone-side companion for Baby StoneFruit.
//
// Credentials come from CloudPebble's PebbleKit JS environment variables —
// process.env.* references are substituted with string literals at build
// time. Required vars:
//   - Home_Assistant_URL   (e.g. "https://home.example.com")
//   - HA_long_token        (long-lived access token)
//   - HA_kid_device_id     (child device ID from the Huckleberry integration,
//                           same value used for service calls AND HA's
//                           device_entities() template lookup)
//
// Protocol with the watch:
//   Log event:
//     Watch -> Phone: { ACTION: "diaper" | "bottle" | "nurse" | "nurse_end"
//                              | "pause_nursing" | "resume_nursing" }
//     Phone -> Watch: { RESULT: "ok" } or
//                     { RESULT: "err", STATUS, MESSAGE }
//
//   State snapshot (used to render "X ago" labels and the nursing timer):
//     Watch -> Phone: { ACTION: "fetch_state" }
//     Phone -> Watch: { RESULT: "state",
//                       LAST_DIAPER:     <epoch seconds, 0 if unknown>,
//                       LAST_BOTTLE:     <epoch seconds, 0 if unknown>,
//                       NURSING_STATE:   "active" | "paused" | "none",
//                       NURSING_START:   <epoch secs of current session, 0 if none>,
//                       NURSING_LAST:    <epoch secs of previous session start, 0 if none>,
//                       NURSING_ELAPSED: <active feeding seconds, frozen value
//                                         from HA — sum of left+right durations> }

const moddableProxy = require("@moddable/pebbleproxy");

const HA_URL    = process.env.Home_Assistant_URL;
const HA_TOKEN  = process.env.HA_long_token;
const DEVICE_ID = process.env.HA_kid_device_id;

console.log("pkjs: HA_URL=" + (HA_URL ? "set" : "MISSING")
  + " HA_TOKEN=" + (HA_TOKEN ? "set(" + HA_TOKEN.length + ")" : "MISSING")
  + " DEVICE_ID=" + (DEVICE_ID ? "set" : "MISSING"));

// ----- Service call mapping ----------------------------------------------

function buildCall(action) {
  switch (action) {
    case "diaper":
      return {
        path: "huckleberry/log_diaper_both",
        body: { pee_amount: "medium", poo_amount: "medium", color: "yellow", consistency: "runny" },
      };
    case "bottle":
      return {
        path: "huckleberry/log_bottle",
        body: { amount: 120.0, bottle_type: "formula", units: "ml" },
      };
    case "nurse":          return { path: "huckleberry/start_nursing",    body: {} };
    case "nurse_end":      return { path: "huckleberry/complete_nursing", body: {} };
    case "pause_nursing":  return { path: "huckleberry/pause_nursing",    body: {} };
    case "resume_nursing": return { path: "huckleberry/resume_nursing",   body: {} };
    default:               return null;
  }
}

// ----- Helpers ------------------------------------------------------------

function reply(payload) {
  Pebble.sendAppMessage(payload, function () {}, function () {});
}

function isoToEpoch(s) {
  if (!s || typeof s !== "string") return 0;
  if (s === "unknown" || s === "unavailable" || s === "none" || s === "None") return 0;
  const ms = Date.parse(s);
  return isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

// Parse an ISO-8601 duration like "PT5M30S" or "PT1H2M3S" into seconds.
function isoDurationToSec(s) {
  if (!s || typeof s !== "string") return 0;
  if (s === "unknown" || s === "unavailable" || s === "none" || s === "None") return 0;
  const m = s.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const h   = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const sec = parseFloat(m[3] || "0");
  return h * 3600 + min * 60 + Math.floor(sec);
}

function envOk(replyOnFail) {
  if (HA_URL && HA_TOKEN && DEVICE_ID) return true;
  if (replyOnFail) reply({ RESULT: "err", STATUS: 0, MESSAGE: "Missing env vars" });
  return false;
}

// ----- Log an action ------------------------------------------------------

function callHomeAssistant(action) {
  const call = buildCall(action);
  if (!call) {
    reply({ RESULT: "err", STATUS: 0, MESSAGE: "Unknown action" });
    return;
  }
  if (!envOk(true)) return;

  const url = HA_URL.replace(/\/+$/, "") + "/api/services/" + call.path;
  const body = JSON.stringify(Object.assign({ device_id: DEVICE_ID }, call.body));

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Authorization", "Bearer " + HA_TOKEN);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 20000;
  xhr.onload = function () {
    const ok = xhr.status >= 200 && xhr.status < 300;
    if (ok) reply({ RESULT: "ok" });
    else    reply({ RESULT: "err", STATUS: xhr.status, MESSAGE: "HTTP " + xhr.status });
  };
  xhr.onerror   = function () { reply({ RESULT: "err", STATUS: 0, MESSAGE: "network" }); };
  xhr.ontimeout = function () { reply({ RESULT: "err", STATUS: 0, MESSAGE: "timeout" }); };
  xhr.send(body);
}

// ----- Fetch state (last times + nursing) --------------------------------

function fetchState() {
  if (!envOk(true)) return;

  // One Jinja2 template POST returns everything we need as a JSON string.
  // device_entities('<device_id>') is built into Home Assistant — gives us
  // the entity_ids attached to the configured child without needing extra
  // env vars or knowing the user's child-name slug.
  const tmpl =
    "{%- set d = '" + DEVICE_ID + "' -%}" +
    // Use negative lookbehind to skip vestigial *_last_diaper / *_last_bottle
    // entities left over from older versions of the Huckleberry HA integration.
    // The current integration exposes the canonical sensors as `<name>_diaper`,
    // `<name>_bottle`, `<name>_nursing`.
    "{%- set diaper  = device_entities(d) | select('search', '(?<!_last)_diaper$')  | first -%}" +
    "{%- set bottle  = device_entities(d) | select('search', '(?<!_last)_bottle$')  | first -%}" +
    "{%- set nursing = device_entities(d) | select('search', '(?<!_last)_nursing$') | first -%}" +
    "{" +
      "\"diaper_entity\": \"{{ diaper }}\"," +
      "\"diaper\":  \"{{ states(diaper) }}\"," +
      "\"bottle\":  \"{{ states(bottle) }}\"," +
      "\"nursing\": \"{{ states(nursing) }}\"," +
      "\"current_start\":  \"{{ state_attr(nursing, 'current_start') }}\"," +
      "\"previous_start\": \"{{ state_attr(nursing, 'previous_start') }}\"," +
      "\"left_duration\":  \"{{ state_attr(nursing, 'current_left_duration') }}\"," +
      "\"right_duration\": \"{{ state_attr(nursing, 'current_right_duration') }}\"" +
    "}";

  const url = HA_URL.replace(/\/+$/, "") + "/api/template";
  const body = JSON.stringify({ template: tmpl });
  console.log("pkjs fetchState: POST " + url);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Authorization", "Bearer " + HA_TOKEN);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.timeout = 20000;
  xhr.onload = function () {
    console.log("pkjs fetchState: status=" + xhr.status + " body=" + (xhr.responseText || "").substring(0, 400));
    if (xhr.status < 200 || xhr.status >= 300) {
      reply({ RESULT: "err", STATUS: xhr.status, MESSAGE: "state HTTP " + xhr.status });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(xhr.responseText);
    } catch (e) {
      console.log("pkjs fetchState: JSON parse error " + e);
      reply({ RESULT: "err", STATUS: 0, MESSAGE: "parse" });
      return;
    }
    const nursingState =
      parsed.nursing === "active" ? "active" :
      parsed.nursing === "paused" ? "paused" : "none";
    const elapsedSec =
      isoDurationToSec(parsed.left_duration) + isoDurationToSec(parsed.right_duration);
    const payload = {
      RESULT: "state",
      LAST_DIAPER:     isoToEpoch(parsed.diaper),
      LAST_BOTTLE:     isoToEpoch(parsed.bottle),
      NURSING_STATE:   nursingState,
      NURSING_START:   isoToEpoch(parsed.current_start),
      NURSING_LAST:    isoToEpoch(parsed.previous_start),
      NURSING_ELAPSED: elapsedSec,
    };
    console.log("pkjs fetchState: diaper_entity=" + parsed.diaper_entity
      + " diaper_raw=" + parsed.diaper
      + " -> LAST_DIAPER=" + payload.LAST_DIAPER
      + " NURSING_STATE=" + payload.NURSING_STATE
      + " NURSING_ELAPSED=" + payload.NURSING_ELAPSED);
    reply(payload);
  };
  xhr.onerror   = function () { console.log("pkjs fetchState: onerror");   reply({ RESULT: "err", STATUS: 0, MESSAGE: "network" }); };
  xhr.ontimeout = function () { console.log("pkjs fetchState: ontimeout"); reply({ RESULT: "err", STATUS: 0, MESSAGE: "timeout" }); };
  xhr.send(body);
}

// ----- AppMessage routing ------------------------------------------------

Pebble.addEventListener("ready", moddableProxy.readyReceived);

Pebble.addEventListener("appmessage", function (e) {
  const payload = e.payload || {};
  const action = payload.ACTION;
  if (typeof action !== "string") {
    moddableProxy.appMessageReceived(e);
    return;
  }

  console.log("pkjs handling ACTION=" + action);

  if (action === "fetch_state") {
    fetchState();
    return;
  }

  callHomeAssistant(action);
});
