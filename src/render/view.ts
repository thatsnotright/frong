import * as THREE from "three";
import { ARENA, TONGUE } from "../game/config";
import type { Game, GameEvent } from "../game/game";
import { Tongue } from "../game/tongue";
import { Environment, SKY_HORIZON, SUN_DIR } from "./environment";
import { FlyModel } from "./flyModel";
import { FrogModel } from "./frogModel";
import { softDotTexture } from "./materials";

const FOV = 30;
/** World-space box the camera must always show. */
const FRAME = { left: ARENA.left - 0.3, right: ARENA.right + 0.3, bottom: -1.05, top: ARENA.top + 0.2 };
const MAX_PARTICLES = 160;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
}

/** Owns the three.js scene and draws whatever state the Game is in. */
export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 900);
  private env = new Environment();
  private frog = new FrogModel();
  private fly = new FlyModel();
  private aimLine: THREE.Line;
  private aimMat: THREE.LineDashedMaterial;
  private particles: Particle[] = [];
  private points: THREE.Points;
  private shake = 0;
  private camBase = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private popups: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private unsub: () => void;

  constructor(
    private container: HTMLElement,
    private game: Game,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = "block size-full";
    container.appendChild(this.renderer.domElement);

    this.popups = document.createElement("div");
    this.popups.className = "pointer-events-none absolute inset-0 overflow-hidden";
    container.appendChild(this.popups);

    const s = this.scene;
    s.fog = new THREE.Fog(SKY_HORIZON, 60, 260);
    s.add(this.env.root, this.frog.root, this.fly.root);

    // Reflections come from the sky itself, so wet/glossy bits pick up blue from above.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const skyOnly = new THREE.Scene();
    skyOnly.add(this.env.root.children[0]!.clone());
    s.environment = pmrem.fromScene(skyOnly, 0.02).texture;
    s.environmentIntensity = 0.55;
    pmrem.dispose();

    s.add(new THREE.HemisphereLight("#cfe8ff", "#557a2c", 1.1));
    const sun = new THREE.DirectionalLight("#fff2d8", 2.6);
    sun.position.copy(SUN_DIR).multiplyScalar(30).add(new THREE.Vector3(0, 2, 0));
    sun.target.position.set(0, 2, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 14;
    sc.bottom = -10;
    sc.near = 1;
    sc.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
    s.add(sun, sun.target);

    this.aimMat = new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.12, gapSize: 0.12, transparent: true, opacity: 0.4, depthWrite: false });
    this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), this.aimMat);
    this.aimLine.frustumCulled = false;
    s.add(this.aimLine);

    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4));
    pg.setAttribute("size", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    this.points = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { map: { value: softDotTexture() }, scale: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute vec4 color;
          attribute float size;
          uniform float scale;
          varying vec4 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * scale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D map;
          varying vec4 vColor;
          void main() {
            vec4 t = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.points.frustumCulled = false;
    s.add(this.points);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.unsub = game.onEvent((e) => this.onEvent(e));
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfH = (FRAME.top - FRAME.bottom) / 2;
    const halfW = (FRAME.right - FRAME.left) / 2;
    const dist = Math.max(halfH / tanV, halfW / (tanV * aspect)) * 1.03;
    // On tall screens there's more height than the arena needs; spend most of it on sky.
    const spare = Math.max(0, dist * tanV - halfH);
    const cy = (FRAME.top + FRAME.bottom) / 2 + spare * 0.55;
    this.camBase.set(0, cy + 1.1, dist);
    this.camTarget.set(0, cy, 0);
    this.camera.updateProjectionMatrix();
    // gl_PointSize is in device pixels, so fold the pixel ratio in.
    (this.points.material as THREE.ShaderMaterial).uniforms.scale!.value = h * this.renderer.getPixelRatio() * 0.9;
  }

  private onEvent(e: GameEvent) {
    const g = this.game;
    switch (e.type) {
      case "swallow": {
        this.frog.swallowed();
        const m = g.frog.mouth();
        this.burst(m.x, m.y, 26, ["#fff38a", "#ffffff", "#9cff6b", "#ff8fb3"], 4.5, 0.7, 0.16);
        this.popup(e.x, e.y + 0.7, `+${e.points}`, `${e.seconds.toFixed(1)}s`);
        break;
      }
      case "hit":
        this.burst(g.tongue.tipX, g.tongue.tipY, 10, ["#ffd0e0", "#ffffff"], 2.5, 0.35, 0.1);
        break;
      case "land": {
        const f = g.frog.pose("foot");
        this.burst(f.x + 0.2, 0.05, Math.round(6 + e.impact * 14), ["#cdb48a", "#b89c6e", "#e8dcc0"], 1.6 + e.impact * 2, 0.6, 0.22, 2);
        this.shake = Math.max(this.shake, e.impact * 0.12);
        break;
      }
      case "over":
        this.shake = 0.2;
        break;
    }
  }

  private burst(x: number, y: number, n: number, colors: string[], speed: number, life: number, size: number, gravity = -3) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        z: (Math.random() - 0.5) * 0.4,
        vx: Math.cos(a) * v,
        vy: Math.abs(Math.sin(a)) * v * (gravity > 0 ? 0.4 : 1),
        vz: (Math.random() - 0.5) * v * 0.6,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: new THREE.Color(colors[i % colors.length]!),
        gravity,
      });
    }
  }

  private popup(x: number, y: number, text: string, sub: string) {
    const p = new THREE.Vector3(x, y, 0).project(this.camera);
    const el = document.createElement("div");
    el.className = "frong-popup absolute text-center font-display leading-none";
    el.style.left = `${((p.x + 1) / 2) * 100}%`;
    el.style.top = `${((1 - p.y) / 2) * 100}%`;
    const big = document.createElement("div");
    big.className = "text-3xl text-yellow-200 [text-shadow:0_2px_0_#2d6a12,0_0_12px_rgba(0,0,0,0.35)]";
    big.textContent = text;
    const small = document.createElement("div");
    small.className = "mt-1 text-sm font-sans font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]";
    small.textContent = sub;
    el.append(big, small);
    this.popups.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  render(dt: number) {
    const g = this.game;
    const t = g.time;
    this.env.update(t, dt);

    const fly = g.fly;
    const mouth = g.frog.mouth();
    const inSights = g.phase === "playing" && g.tongue.state === "idle" && Tongue.inSights(mouth, fly);
    this.frog.update(g.frog, g.tongue, fly ? new THREE.Vector3(fly.x, fly.y, 0) : null, t, dt);
    this.fly.update(fly, inSights, t, dt);

    // Dashed sight line showing where a lick would go.
    const showAim = g.phase === "playing" && g.tongue.state === "idle";
    this.aimLine.visible = showAim;
    if (showAim) {
      const pos = this.aimLine.geometry.attributes.position as THREE.BufferAttribute;
      const ex = mouth.x + Math.cos(mouth.angle) * TONGUE.reach;
      const ey = mouth.y + Math.sin(mouth.angle) * TONGUE.reach;
      pos.setXYZ(0, mouth.x + Math.cos(mouth.angle) * 0.25, mouth.y + Math.sin(mouth.angle) * 0.25, 0.01);
      pos.setXYZ(1, ex, ey, 0.01);
      pos.needsUpdate = true;
      this.aimLine.computeLineDistances();
      this.aimMat.opacity = inSights ? 0.75 : 0.32;
      this.aimMat.color.set(inSights ? "#fff6a8" : "#ffffff");
    }

    this.updateParticles(dt);

    this.shake = Math.max(0, this.shake - dt * 0.6);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.camBase.x + sx, this.camBase.y + sy, this.camBase.z);
    this.camera.lookAt(this.camTarget.x + sx * 0.5, this.camTarget.y + sy * 0.5, 0);

    this.renderer.render(this.scene, this.camera);
  }

  private updateParticles(dt: number) {
    const geo = this.points.geometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const size = geo.attributes.size as THREE.BufferAttribute;
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p) {
        size.setX(i, 0);
        continue;
      }
      p.vy += (p.gravity > 0 ? -0.5 : p.gravity) * dt;
      p.vx *= 1 - dt * 2;
      p.vz *= 1 - dt * 2;
      p.x += p.vx * dt;
      p.y = Math.max(0.02, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const k = p.life / p.maxLife;
      pos.setXYZ(i, p.x, p.y, p.z);
      col.setXYZW(i, p.color.r, p.color.g, p.color.b, Math.min(1, k * 1.6));
      size.setX(i, p.size * (p.gravity > 0 ? 1.6 - k * 0.6 : 0.5 + k * 0.5));
    }
    pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
  }

  dispose() {
    this.unsub();
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) m.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.popups.remove();
  }
}
