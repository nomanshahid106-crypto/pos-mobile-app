import { Audio } from 'expo-av';

const beepSource = require('../../assets/scan-beep.wav') as number;

let sound: Audio.Sound | null = null;
let loading: Promise<void> | null = null;

/**
 * Scanner beep: a short 2500 Hz burst like a physical barcode scanner.
 * The sound asset is preloaded when the Sell screen mounts so the beep
 * fires instantly on a successful scan. All failures are swallowed —
 * a missing/failed sound must never block a sale.
 */
export function preloadScanBeep(): void {
  if (sound || loading) return;
  loading = (async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: created } = await Audio.Sound.createAsync(beepSource, { shouldPlay: false, volume: 1 });
      sound = created;
    } catch { /* sound is a nicety, never a blocker */ }
  })();
}

export async function playScanBeep(): Promise<void> {
  try {
    if (!sound) { preloadScanBeep(); await loading; }
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch { /* ignore */ }
}
