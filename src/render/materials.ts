import * as THREE from "three";

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Fuzzy felt fibres: thousands of short random strokes, used as a bump map. */
export function feltBumpTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const a = Math.random() * Math.PI;
      const l = 1 + Math.random() * 4;
      const v = Math.floor(90 + Math.random() * 90);
      ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.lineWidth = 0.6 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  });
}

/** Soft round dot used for sparkles, dust and glows. */
export function softDotTexture() {
  const tex = canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Mottled meadow colour for the ground plane. */
export function meadowTexture() {
  const tex = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = "#6fae3f";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 2 + Math.random() * 14;
      const hue = 85 + Math.random() * 25;
      const light = 32 + Math.random() * 16;
      ctx.fillStyle = `hsla(${hue}, 50%, ${light}%, 0.22)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sandy pond bank the frog hops along; fades out at the near and far edges. */
export function bankTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d8c193";
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 128;
    const r = 0.6 + Math.random() * 2.2;
    const l = 48 + Math.random() * 30;
    ctx.fillStyle = `hsla(${30 + Math.random() * 15}, 35%, ${l}%, 0.5)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Feather the edges into the grass.
  ctx.globalCompositeOperation = "destination-in";
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.2, "rgba(0,0,0,1)");
  g.addColorStop(0.8, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Layered soil for the diorama-style cut-away under the playfield. */
export function soilTexture() {
  const tex = canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "#7a4f2c");
    g.addColorStop(1, "#4a2f1b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 1.5 + Math.random() * 5;
      ctx.fillStyle = `rgba(${40 + Math.random() * 60},${25 + Math.random() * 30},${15 + Math.random() * 15},0.6)`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const PALETTE = {
  felt: new THREE.Color("#5cc23a"),
  feltSheen: new THREE.Color("#d4ff96"),
  feltDark: new THREE.Color("#46a02c"),
  seam: new THREE.Color("#2a0a0e"),
  eyeWhite: new THREE.Color("#fbfaf2"),
  pupil: new THREE.Color("#121212"),
  mouth: new THREE.Color("#5a0f19"),
  tongue: new THREE.Color("#ff5f8f"),
};

let feltBump: THREE.Texture | null = null;

export function feltMaterial(color = PALETTE.felt) {
  feltBump ??= feltBumpTexture();
  feltBump.repeat.set(3, 3);
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    sheen: 1,
    sheenColor: PALETTE.feltSheen,
    sheenRoughness: 0.55,
    bumpMap: feltBump,
    bumpScale: 1.2,
  });
}
