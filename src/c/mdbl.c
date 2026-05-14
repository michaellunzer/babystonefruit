#include <pebble.h>

#ifdef PBL_SPEAKER
//
// UI tone library — short procedural tones for action feedback.
// Each helper is a single non-blocking speaker_play_tone() call (the
// system mixes/queues the actual playback).  Frequencies, durations,
// and waveforms are chosen so each event is distinguishable by ear.
//
// Wiring to specific JS-side events (Up/Down → hover, Select → confirm,
// pause/resume/end-nursing tones) is the next step — Moddable owns the
// AppMessage inbox, so the trigger plumbing isn't trivial.  For now
// only confirm_tone() fires at startup as a smoke test.
//

static void tone_hover(void) {
  // Up / Down — light, quick scroll click
  speaker_play_tone(600, 40, 50, SpeakerWaveformSine);
}

static void tone_confirm(void) {
  // Select — higher, slightly longer affirmative chirp
  speaker_play_tone(1000, 80, 60, SpeakerWaveformSine);
}

static void tone_pause(void) {
  // Nursing paused — two-note descending (800 → 500 Hz)
  speaker_play_tone(800, 60, 60, SpeakerWaveformSine);
  psleep(60);
  speaker_play_tone(500, 60, 60, SpeakerWaveformSine);
}

static void tone_resume(void) {
  // Nursing resumed — two-note ascending (500 → 800 Hz)
  speaker_play_tone(500, 60, 60, SpeakerWaveformSine);
  psleep(60);
  speaker_play_tone(800, 60, 60, SpeakerWaveformSine);
}

static void tone_completed(void) {
  // End Nursing — three-note rising flourish
  speaker_play_tone(600, 70, 65, SpeakerWaveformSine);
  psleep(70);
  speaker_play_tone(800, 70, 65, SpeakerWaveformSine);
  psleep(70);
  speaker_play_tone(1200, 90, 65, SpeakerWaveformSine);
}
#endif

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

#ifdef PBL_SPEAKER
  // Smoke test: play the confirm tone at startup so we can hear that the
  // tone library is wired up before we wrestle with JS-side triggers.
  tone_confirm();
#endif

  moddable_createMachine(NULL);

  window_destroy(w);
}
