// Lightweight synthesized sound effects via Web Audio API.
// No external audio files needed — everything is generated on the fly.

let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq = 440, duration = 0.1, type = "sine", gain = 0.15, endFreq = null, delay = 0 }) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = type;
  const startTime = audioCtx.currentTime + delay;
  osc.frequency.setValueAtTime(freq, startTime);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gainNode).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function unlockAudio() {
  getCtx();
}

export function playTick() {
  tone({ freq: 900, duration: 0.045, type: "square", gain: 0.06 });
}

export function playWhoosh() {
  tone({ freq: 180, endFreq: 60, duration: 0.5, type: "sawtooth", gain: 0.08 });
}

export function playLocked() {
  tone({ freq: 220, duration: 0.15, type: "square", gain: 0.08 });
}

export function playWin() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone({ freq: f, duration: 0.35, type: "triangle", gain: 0.12, delay: i * 0.09 });
  });
}

export function playCombine() {
  tone({ freq: 300, endFreq: 900, duration: 0.6, type: "sine", gain: 0.1 });
}
