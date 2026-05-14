#include <pebble.h>

#ifdef PBL_SPEAKER
// Stream a "raw" resource (mono signed 8-bit PCM @ 8 kHz) to the speaker.
// Reads in 512-byte chunks, writes to the speaker buffer, briefly sleeps
// if the buffer is full. Returns once all data has been queued; the speaker
// continues playing buffered audio after close.
static void play_pcm_resource(uint32_t resource_id) {
  ResHandle handle = resource_get_handle(resource_id);
  size_t total = resource_size(handle);
  if (total == 0) return;

  if (!speaker_stream_open(SpeakerPcmFormat_8kHz_8bit, 80)) return;

  uint8_t buffer[512];
  size_t offset = 0;
  while (offset < total) {
    size_t to_read = total - offset;
    if (to_read > sizeof(buffer)) to_read = sizeof(buffer);

    size_t got = resource_load_byte_range(handle, offset, buffer, to_read);
    if (got == 0) break;

    size_t written = 0;
    while (written < got) {
      uint32_t n = speaker_stream_write(buffer + written, got - written);
      if (n == 0) {
        psleep(20);          // buffer full — let it drain
      } else {
        written += n;
      }
    }
    offset += got;
  }

  speaker_stream_close();
}
#endif

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

#ifdef PBL_SPEAKER
  // Audio test (Step 2): play the actual UI_Confirm sound from a resource,
  // streamed via speaker_stream_*. Validates that raw PCM resources work
  // and that the streaming API doesn't conflict with Moddable startup.
  play_pcm_resource(RESOURCE_ID_SOUND_UI_CONFIRM);
#endif

  moddable_createMachine(NULL);

  window_destroy(w);
}
