const _ctx = new AudioContext();
const _buffers = new Map<string, AudioBuffer>();

const UI_SOUNDS = {
  menu_click: '/sound/menu_click.mp3',
  menu_hover: '/sound/menu_hover.mp3',
} as const;

type UiSoundKey = keyof typeof UI_SOUNDS;

export async function preloadUiSounds(): Promise<void> {
  await Promise.all(
    Object.entries(UI_SOUNDS).map(async ([key, url]) => {
      const resp = await fetch(url);
      const arr = await resp.arrayBuffer();
      const buf = await _ctx.decodeAudioData(arr);
      _buffers.set(key, buf);
    })
  );
}

export function playUiSound(key: UiSoundKey, volume: number): void {
  const buf = _buffers.get(key);
  if (!buf) return;
  if (_ctx.state === 'suspended') _ctx.resume();
  const src = _ctx.createBufferSource();
  src.buffer = buf;
  const gain = _ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(_ctx.destination);
  src.start();
}
