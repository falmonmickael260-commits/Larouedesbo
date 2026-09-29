import { playTick } from "./sound.js";

// Generic spinning wheel: renders `segments` (array of {label}) as colored
// wedges inside `container`, and animates a CSS rotation to land on a chosen
// index under the fixed pointer at the top (12 o'clock).
export class Wheel {
  constructor({ container, pointerEl, segments, colorsEven, colorsOdd, textColor }) {
    this.container = container;
    this.pointerEl = pointerEl;
    this.segments = segments;
    this.colorsEven = colorsEven;
    this.colorsOdd = colorsOdd;
    this.textColor = textColor;
    this.currentRotation = 0;
    this.isSpinning = false;
    this.render();
  }

  get segmentAngle() {
    return 360 / this.segments.length;
  }

  render() {
    const n = this.segments.length;
    const seg = this.segmentAngle;

    // Conic gradient background made of alternating colors per segment.
    const stops = [];
    for (let i = 0; i < n; i++) {
      const color = i % 2 === 0 ? this.colorsEven : this.colorsOdd;
      const from = (i * seg).toFixed(3);
      const to = ((i + 1) * seg).toFixed(3);
      stops.push(`${color} ${from}deg ${to}deg`);
    }
    this.container.style.background = `conic-gradient(from 0deg, ${stops.join(", ")})`;

    // Labels
    this.container.querySelectorAll(".wheel-segment-label").forEach((el) => el.remove());
    this.segments.forEach((s, i) => {
      const mid = i * seg + seg / 2;
      const wrap = document.createElement("div");
      wrap.className = "wheel-segment-label";
      wrap.style.transform = `rotate(${mid}deg)`;
      const span = document.createElement("span");
      span.textContent = s.label;
      if (this.textColor) span.style.color = this.textColor;
      wrap.appendChild(span);
      this.container.appendChild(wrap);
    });
  }

  // Spins the wheel to land on `targetIndex`, calling onTick per segment
  // crossing and onDone(targetIndex) once the animation settles.
  spin(targetIndex, { onDone, onTick, duration = 4600, extraTurns = 7 } = {}) {
    if (this.isSpinning) return;
    this.isSpinning = true;
    this.container.classList.add("is-spinning");

    const seg = this.segmentAngle;
    const targetMid = targetIndex * seg + seg / 2;
    // jitter within the middle 60% of the segment so it doesn't always land dead-center
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const normalizedCurrent = ((this.currentRotation % 360) + 360) % 360;
    // rotation needed so that targetMid ends up at angle 0 (under pointer)
    let delta = (360 - targetMid - jitter - normalizedCurrent) % 360;
    if (delta < 0) delta += 360;
    const totalRotation = this.currentRotation + extraTurns * 360 + delta;

    this.container.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.14, 1)`;
    this.container.style.transform = `rotate(${totalRotation}deg)`;

    // Schedule tick sounds + pointer bump, decelerating over the spin duration.
    const totalSegmentsCrossed = Math.round((totalRotation - this.currentRotation) / seg);
    this._scheduleTicks(totalSegmentsCrossed, duration, onTick);

    const startRotation = this.currentRotation;
    this.currentRotation = totalRotation;

    const handleEnd = () => {
      this.container.removeEventListener("transitionend", handleEnd);
      this.isSpinning = false;
      this.container.classList.remove("is-spinning");
      if (onDone) onDone(targetIndex);
    };
    this.container.addEventListener("transitionend", handleEnd, { once: true });

    // Safety fallback in case transitionend doesn't fire (e.g. tab backgrounded)
    this._fallbackTimer = setTimeout(() => {
      if (this.isSpinning) handleEnd();
    }, duration + 400);

    return startRotation;
  }

  _scheduleTicks(count, duration, onTick) {
    if (count <= 0) return;
    // ease-out timing: ticks slow down towards the end, mimicking deceleration
    let elapsed = 0;
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      // slower increments later: derivative of an ease-out curve
      const step = (duration / count) * (0.4 + 1.6 * progress);
      elapsed += step;
      setTimeout(() => {
        playTick();
        if (this.pointerEl) {
          this.pointerEl.classList.remove("is-bump");
          // force reflow to restart animation
          void this.pointerEl.offsetWidth;
          this.pointerEl.classList.add("is-bump");
        }
        if (onTick) onTick(i, count);
      }, Math.min(elapsed, duration - 30));
    }
  }
}
