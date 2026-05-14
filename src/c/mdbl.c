#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  // Audio test (Step 1): play a short tone at startup to verify the Speaker
  // API works on this device and that adding C audio code doesn't disrupt
  // Moddable's window/VM setup. Only emery has PBL_SPEAKER; gabbro skips this.
#ifdef PBL_SPEAKER
  speaker_play_tone(880, 120, 60, SpeakerWaveformSine);
#endif

  moddable_createMachine(NULL);

  window_destroy(w);
}
