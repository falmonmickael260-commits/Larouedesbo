const COLORS = ["#ffcc4d", "#ec4899", "#8b5cf6", "#22d3ee", "#10d9a0"];

export function burst(container, { count = 36, originX = "50%", originY = "50%" } = {}) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 160;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const size = 4 + Math.random() * 7;
    el.style.left = originX;
    el.style.top = originY;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    el.style.setProperty("--pfly", `translate(${x}px, ${y}px)`);
    el.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
    el.style.boxShadow = `0 0 8px ${el.style.background}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}
