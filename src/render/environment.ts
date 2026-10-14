import * as THREE from "three";
import { ARENA, POND } from "../game/config";
import type { Level, Span } from "../game/levels";
import { bankTexture, lilyPadTexture, meadowTexture, soilTexture, softDotTexture } from "./materials";

export const SKY_TOP = new THREE.Color("#4aa3e8");
export const SKY_HORIZON = new THREE.Color("#d9f1ff");
/** Mostly overhead so the frog's shadow lands on the path right under it: a free altitude cue. */
export const SUN_DIR = new THREE.Vector3(-0.4, 0.88, 0.26).normalize();

/** Front edge of the meadow; below it is the diorama soil cut-away. */
const FRONT_Z = 2.9;
/** Ponds in the playfield run from the front cut-away back to here. */
const POND_BACK = -1.25;
/** Drawn water surface, just under the banks and pad tops so they read as above it. */
const WATER_Y = -0.035;
/** Texture tile sizes in world units, so pieces cut around a pond still line up. */
const MEADOW_TILE = 13.5;
const SOIL_TILE = 6.7;
const BANK_TILE = 6.4;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP },
      horizon: { value: SKY_HORIZON },
      sunDir: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 2.2, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.7));
        float sun = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.92, 0.7) * (pow(sun, 600.0) * 1.5 + pow(sun, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
}

/** Instanced grass with a wind sway done in the vertex shader. */
function grassField(
  count: number,
  area: { x: [number, number]; z: [number, number] },
  height: [number, number],
  avoid: (x: number, z: number) => boolean = () => false,
) {
  const blade = new THREE.PlaneGeometry(0.06, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const pos = blade.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - y * 0.92));
  }
  blade.computeVertexNormals();

  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float h = position.y * position.y;
         float gust = sin(uTime * 0.7 + root.x * 0.08) * 0.5 + 0.5;
         transformed.x += (sin(uTime * 2.1 + root.x * 0.9 + root.z * 0.6) * 0.12 + gust * 0.18) * h;
         transformed.z += sin(uTime * 1.7 + root.x * 0.5) * 0.05 * h;`,
      );
  };

  const mesh = new THREE.InstancedMesh(blade, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let tries = 0;
    do p.set(rand(area.x[0], area.x[1]), 0, rand(area.z[0], area.z[1]));
    while (avoid(p.x, p.z) && ++tries < 12);
    q.setFromEuler(new THREE.Euler(rand(-0.15, 0.15), rand(0, Math.PI), rand(-0.2, 0.2)));
    const h = tries < 12 ? rand(height[0], height[1]) : 0;
    s.set(rand(0.8, 1.6), h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    c.setHSL(rand(0.22, 0.3), rand(0.45, 0.7), rand(0.28, 0.45));
    mesh.setColorAt(i, c);
  }
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}

function cattail(height: number) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: "#5d8a32", roughness: 0.8 });
  const headMat = new THREE.MeshStandardMaterial({ color: "#6b3f1f", roughness: 0.95 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, height, 6), stemMat);
  stem.position.y = height / 2;
  stem.castShadow = true;
  g.add(stem);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.36, 4, 10), headMat);
  head.position.y = height * 0.82;
  head.castShadow = true;
  g.add(head);
  // A couple of long leaves.
  for (let i = 0; i < 2; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.07, height * 0.75, 1, 4), stemMat);
    leaf.geometry.translate(0, height * 0.375, 0);
    leaf.rotation.set(0, rand(0, Math.PI), rand(-0.35, 0.35));
    (leaf.material as THREE.Material).side = THREE.DoubleSide;
    g.add(leaf);
  }
  return g;
}

function cloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#dfeefc", emissiveIntensity: 0.35, fog: false });
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const r = rand(1.6, 3.2);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    puff.position.set((i - n / 2) * 2.2 + rand(-0.6, 0.6), rand(-0.4, 1.2) - (Math.abs(i - n / 2) * 0.3), rand(-1, 1));
    puff.scale.y = 0.75;
    g.add(puff);
  }
  return g;
}

function tree(scale: number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 8), new THREE.MeshStandardMaterial({ color: "#6e4a2f", roughness: 0.9 }));
  trunk.position.y = 1.5;
  g.add(trunk);
  const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rand(0.24, 0.3), 0.45, rand(0.3, 0.38)), roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(rand(1.3, 1.9), 14, 10), leaf);
    blob.position.set(rand(-0.9, 0.9), 3.6 + rand(0, 1.4), rand(-0.6, 0.6));
    g.add(blob);
  }
  g.scale.setScalar(scale);
  return g;
}

function lilyPad(r: number) {
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(r, 28, 0.35, Math.PI * 2 - 0.7),
    new THREE.MeshStandardMaterial({ color: "#3e8c3a", roughness: 0.6, side: THREE.DoubleSide }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.rotation.z = rand(0, Math.PI * 2);
  pad.receiveShadow = true;
  return pad;
}

function lotus() {
  const g = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({ color: "#ffb3cf", roughness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), petalMat);
    petal.scale.set(0.45, 1, 0.3);
    const a = (i / 8) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1);
    petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(petal);
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: "#ffd84a" }));
  heart.position.y = 0.12;
  g.add(heart);
  return g;
}

function daisy() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.35, 5), new THREE.MeshStandardMaterial({ color: "#4f8a2c" }));
  stem.position.y = 0.175;
  g.add(stem);
  const petals = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshStandardMaterial({ color: "#ffffff", side: THREE.DoubleSide }));
  petals.position.y = 0.36;
  petals.rotation.x = -1.1;
  g.add(petals);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: "#f5c518" }));
  mid.position.set(0, 0.37, 0.01);
  g.add(mid);
  return g;
}

/**
 * Box (or plane, when one size is 0) spanning the given world ranges, with UVs taken from world
 * coordinates so neighbouring pieces tile seamlessly.
 */
function worldBox(x: Span, y: [number, number], z: [number, number], tile: number) {
  const w = x.x1 - x.x0;
  const h = y[1] - y[0];
  const d = z[1] - z[0];
  const geo = h === 0 ? new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2) : d === 0 ? new THREE.PlaneGeometry(w, h) : new THREE.BoxGeometry(w, h, d);
  geo.translate((x.x0 + x.x1) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const [px, py, pz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const [ax, ay] = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i))];
    if (ay > 0.5) uv.setXY(i, px / tile, -pz / tile);
    else if (ax > 0.5) uv.setXY(i, pz / tile, py / tile);
    else uv.setXY(i, px / tile, py / tile);
  }
  return geo;
}

/** The parts of [from, to] not covered by `holes` (sorted, non-overlapping). */
function complement(from: number, to: number, holes: Span[]): Span[] {
  const out: Span[] = [];
  let x = from;
  for (const h of holes) {
    if (h.x0 > x) out.push({ x0: x, x1: h.x0 });
    x = Math.max(x, h.x1);
  }
  if (x < to) out.push({ x0: x, x1: to });
  return out;
}

/** A big floating lily pad the frog can stand on, notch facing away from the camera. */
function bigLilyPad(r: number, mat: THREE.Material) {
  const notch = 0.32;
  const geo = new THREE.CylinderGeometry(r, r * 0.97, 0.05, 48, 1, false, Math.PI + notch, Math.PI * 2 - notch * 2);
  const pad = new THREE.Mesh(geo, mat);
  pad.receiveShadow = true;
  pad.castShadow = true;
  return pad;
}

export class Environment {
  readonly root = new THREE.Group();
  private grass: { uniforms: { uTime: { value: number } } }[] = [];
  /** Everything that depends on the level: banks, ponds, pads. Rebuilt by setLevel. */
  private levelRoot = new THREE.Group();
  private levelGrass: { uniforms: { uTime: { value: number } } }[] = [];
  private levelReeds: { obj: THREE.Object3D; phase: number }[] = [];
  private shared = new Set<THREE.Material>();
  private mats: {
    meadow: THREE.MeshStandardMaterial;
    soil: THREE.MeshStandardMaterial;
    lip: THREE.MeshStandardMaterial;
    bank: THREE.MeshStandardMaterial;
    pondFloor: THREE.MeshStandardMaterial;
    water: THREE.MeshPhysicalMaterial;
    waterSide: THREE.MeshPhysicalMaterial;
    pad: THREE.MeshStandardMaterial;
  };
  private reeds: { obj: THREE.Object3D; phase: number }[] = [];
  private clouds: { obj: THREE.Object3D; speed: number }[] = [];
  private water: THREE.Mesh;

  constructor() {
    this.root.add(skyDome());
    this.root.add(this.levelRoot);

    const bankTex = bankTexture();
    bankTex.wrapT = THREE.ClampToEdgeWrapping;
    this.mats = {
      meadow: new THREE.MeshStandardMaterial({ map: meadowTexture(), roughness: 1 }),
      soil: new THREE.MeshStandardMaterial({ map: soilTexture(), roughness: 1 }),
      lip: new THREE.MeshStandardMaterial({ color: "#4c8a2a", roughness: 1 }),
      // The frog lives on a sandy strip of pond bank, so green felt pops against it.
      bank: new THREE.MeshStandardMaterial({ map: bankTex, transparent: true, roughness: 1, depthWrite: false }),
      pondFloor: new THREE.MeshStandardMaterial({ color: "#7d6a45", roughness: 1 }),
      water: new THREE.MeshPhysicalMaterial({ color: "#3f8fc0", roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.72 }),
      waterSide: new THREE.MeshPhysicalMaterial({ color: "#2f86bd", roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false }),
      pad: new THREE.MeshStandardMaterial({ map: lilyPadTexture(), roughness: 0.55 }),
    };
    for (const m of Object.values(this.mats)) this.shared.add(m);

    // Meadow behind the playfield; the strip in front of it is cut around ponds in setLevel.
    const meadow = new THREE.Mesh(worldBox({ x0: -200, x1: 200 }, [0, 0], [-217, POND_BACK], MEADOW_TILE), this.mats.meadow);
    meadow.receiveShadow = true;
    this.root.add(meadow);

    // Pond behind the playfield, with lily pads and a lotus.
    const shore = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: "#8a7350", roughness: 1 }));
    shore.rotation.x = -Math.PI / 2;
    shore.scale.set(11.5, 4.6, 1);
    shore.position.set(-2, 0.005, -11);
    this.root.add(shore);
    this.water = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshPhysicalMaterial({ color: "#3f8fc0", roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.scale.set(10.8, 4.0, 1);
    this.water.position.set(-2, 0.012, -11);
    this.water.receiveShadow = true;
    this.root.add(this.water);
    for (const [x, z, r] of [
      [-7, -10, 0.8],
      [-4.5, -8.4, 0.6],
      [1.5, -9.2, 0.75],
      [4, -11.5, 0.9],
      [-1, -12.5, 0.7],
      [-9.5, -12, 0.6],
    ] as const) {
      const pad = lilyPad(r);
      pad.position.set(x, 0.02, z);
      this.root.add(pad);
    }
    const flower = lotus();
    flower.position.set(1.5, 0.02, -9.2);
    this.root.add(flower);

    // Tall grass behind the playfield (the short grass in front is laid out per level).
    const backGrass = grassField(5200, { x: [-34, 34], z: [-7, -1.3] }, [0.2, 0.55]);
    this.root.add(backGrass.mesh);
    this.grass.push(backGrass);

    for (let i = 0; i < 70; i++) {
      const d = daisy();
      d.position.set(rand(-30, 30), 0, rand(-30, -2));
      if (Math.abs(d.position.x + 2) < 12 && d.position.z < -6 && d.position.z > -16) continue;
      d.scale.setScalar(rand(0.8, 1.4));
      this.root.add(d);
    }

    // Cattails mark the edges of the arena, and ring the pond.
    const reedSpots: [number, number, number][] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) reedSpots.push([side * (ARENA.right + 0.35 + rand(0, 1.2)), rand(-0.9, 0.9), rand(2.2, 3.6)]);
    }
    for (let i = 0; i < 10; i++) {
      const a = rand(Math.PI * 0.95, Math.PI * 2.05);
      reedSpots.push([-2 + Math.cos(a) * 11.5, -11 + Math.sin(a) * 4.6, rand(1.8, 3.2)]);
    }
    for (const [x, z, h] of reedSpots) {
      const c = cattail(h);
      c.position.set(x, 0, z);
      this.root.add(c);
      this.reeds.push({ obj: c, phase: Math.random() * 10 });
    }

    // Distant hills, trees and clouds.
    const hillMats = ["#8cc46e", "#79b260", "#a3cf86"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    for (const [x, z, sx, sy, mi] of [
      [-60, -95, 55, 18, 0],
      [10, -120, 70, 26, 2],
      [70, -100, 50, 20, 1],
      [-20, -70, 40, 10, 1],
      [45, -65, 35, 9, 0],
    ] as const) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), hillMats[mi]);
      hill.scale.set(sx, sy, 20);
      hill.position.set(x, -2, z);
      this.root.add(hill);
    }
    for (let i = 0; i < 14; i++) {
      const t = tree(rand(0.9, 1.6));
      t.position.set(rand(-60, 60), 0, rand(-55, -32));
      this.root.add(t);
    }
    for (let i = 0; i < 9; i++) {
      const c = cloud();
      c.position.set(rand(-90, 90), rand(18, 40), rand(-110, -70));
      c.scale.setScalar(rand(0.9, 1.6));
      this.root.add(c);
      this.clouds.push({ obj: c, speed: rand(0.4, 1.1) });
    }

    // Soft sun glow sprite to sell the light direction.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: "#fff1c4", transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    glow.position.copy(SUN_DIR.clone().multiplyScalar(300));
    glow.scale.setScalar(70);
    this.root.add(glow);
  }

  /** Lays out the playfield for a level: sandy banks over soil, or open pond with a see-through front. */
  setLevel(level: Level) {
    this.levelRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) if (!this.shared.has(m)) m.dispose();
    });
    this.levelRoot.clear();
    this.levelGrass = [];
    this.levelReeds = [];
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, shadows = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = shadows;
      this.levelRoot.add(mesh);
      return mesh;
    };

    // Lily pads float, so everything between the banks is pond. Ponds that reach a wall carry on a
    // little past it, so the arena edge isn't a hard line.
    const banks = level.land.filter((l) => l.kind === "bank");
    const ponds = complement(ARENA.left, ARENA.right, banks).map((w) => ({
      x0: w.x0 <= ARENA.left ? ARENA.left - 0.6 : w.x0,
      x1: w.x1 >= ARENA.right ? ARENA.right + 0.6 : w.x1,
    }));
    const wet = (x: number, z: number) => z > POND_BACK - 0.08 && ponds.some((p) => x > p.x0 - 0.06 && x < p.x1 + 0.06);
    const dry = complement(-200, 200, ponds);
    const lane: [number, number] = [POND_BACK, FRONT_Z];

    for (const d of dry) {
      add(worldBox(d, [0, 0], lane, MEADOW_TILE), this.mats.meadow);
      const near = { x0: Math.max(d.x0, -80), x1: Math.min(d.x1, 80) };
      add(worldBox(near, [-30, -0.002], lane, SOIL_TILE), this.mats.soil, false);
      add(worldBox(near, [-0.21, 0.01], [FRONT_Z - 0.2, FRONT_Z + 0.1], 1), this.mats.lip, false);
      // Sandy bank strip: u tiles along x, v runs across the lane so its edges feather into the grass.
      const bankSpan = { x0: Math.max(d.x0, -45), x1: Math.min(d.x1, 45) };
      if (bankSpan.x1 > bankSpan.x0) {
        const geo = worldBox(bankSpan, [0.004, 0.004], [-1.45, 1.45], BANK_TILE);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getZ(i) + 1.45) / 2.9);
        add(geo, this.mats.bank);
      }
    }

    for (const p of ponds) {
      add(worldBox(p, [-30, -POND.depth - 0.002], lane, SOIL_TILE), this.mats.soil, false);
      add(worldBox(p, [-POND.depth, -POND.depth], lane, 1), this.mats.pondFloor);
      add(worldBox(p, [-POND.depth, 0], [POND_BACK, POND_BACK], SOIL_TILE), this.mats.soil);
      add(worldBox(p, [WATER_Y, WATER_Y], lane, 1), this.mats.water);
      // The diorama's front is glass here: you can watch a frog sink.
      add(worldBox(p, [-POND.depth, WATER_Y], [FRONT_Z + 0.002, FRONT_Z + 0.002], 1), this.mats.waterSide, false);
      for (const x of [p.x0, p.x1]) {
        if (Math.abs(x) > ARENA.right) continue;
        for (let i = 0; i < 2; i++) {
          const c = cattail(rand(1.4, 2.2));
          c.position.set(x + (x === p.x0 ? 1 : -1) * rand(0.05, 0.3), 0, POND_BACK + rand(0.05, 0.35));
          this.levelRoot.add(c);
          this.levelReeds.push({ obj: c, phase: Math.random() * 10 });
        }
      }
    }

    for (const l of level.land) {
      if (l.kind !== "pad") continue;
      const pad = bigLilyPad((l.x1 - l.x0) / 2, this.mats.pad);
      pad.position.set((l.x0 + l.x1) / 2, -0.015, 0);
      this.levelRoot.add(pad);
    }

    // Grass: short in front so it never hides the frog's feet, tufts along the bank, a fringe at the edge.
    for (const g of [
      grassField(2000, { x: [-26, 26], z: [1.3, FRONT_Z - 0.05] }, [0.07, 0.2], wet),
      grassField(700, { x: [-26, 26], z: [1.0, 1.45] }, [0.06, 0.16], wet),
      grassField(900, { x: [-26, 26], z: [-1.5, -1.0] }, [0.12, 0.35], wet),
      grassField(1500, { x: [-28, 28], z: [FRONT_Z - 0.15, FRONT_Z + 0.05] }, [0.22, 0.42], wet),
    ]) {
      this.levelRoot.add(g.mesh);
      this.levelGrass.push(g);
    }
  }

  update(time: number, dt: number) {
    for (const g of [...this.grass, ...this.levelGrass]) g.uniforms.uTime.value = time;
    for (const r of [...this.reeds, ...this.levelReeds]) r.obj.rotation.z = Math.sin(time * 1.1 + r.phase) * 0.04 + Math.sin(time * 0.43 + r.phase) * 0.03;
    for (const c of this.clouds) {
      c.obj.position.x += c.speed * dt;
      if (c.obj.position.x > 110) c.obj.position.x = -110;
    }
    (this.water.material as THREE.MeshPhysicalMaterial).clearcoatRoughness = 0.15 + Math.sin(time * 0.8) * 0.05;
    this.mats.water.clearcoatRoughness = 0.12 + Math.sin(time * 1.1) * 0.05;
  }
}
