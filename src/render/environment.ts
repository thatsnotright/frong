import * as THREE from "three";
import { ARENA } from "../game/config";
import { bankTexture, meadowTexture, soilTexture, softDotTexture } from "./materials";

export const SKY_TOP = new THREE.Color("#4aa3e8");
export const SKY_HORIZON = new THREE.Color("#d9f1ff");
/** Mostly overhead so the frog's shadow lands on the path right under it: a free altitude cue. */
export const SUN_DIR = new THREE.Vector3(-0.4, 0.88, 0.26).normalize();

/** Front edge of the meadow; below it is the diorama soil cut-away. */
const FRONT_Z = 2.9;

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
function grassField(count: number, area: { x: [number, number]; z: [number, number] }, height: [number, number]) {
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
    p.set(rand(area.x[0], area.x[1]), 0, rand(area.z[0], area.z[1]));
    q.setFromEuler(new THREE.Euler(rand(-0.15, 0.15), rand(0, Math.PI), rand(-0.2, 0.2)));
    const h = rand(height[0], height[1]);
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

export class Environment {
  readonly root = new THREE.Group();
  private grass: { uniforms: { uTime: { value: number } } }[] = [];
  private reeds: { obj: THREE.Object3D; phase: number }[] = [];
  private clouds: { obj: THREE.Object3D; speed: number }[] = [];
  private water: THREE.Mesh;

  constructor() {
    this.root.add(skyDome());

    // Meadow plane and the soil cut-away below the playfield.
    const meadowTex = meadowTexture();
    meadowTex.repeat.set(30, 16);
    const meadow = new THREE.Mesh(new THREE.PlaneGeometry(400, 220), new THREE.MeshStandardMaterial({ map: meadowTex, roughness: 1 }));
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.z = FRONT_Z - 110;
    meadow.receiveShadow = true;
    this.root.add(meadow);

    const soilTex = soilTexture();
    soilTex.repeat.set(24, 4);
    const soil = new THREE.Mesh(new THREE.BoxGeometry(160, 30, 1), new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1 }));
    soil.position.set(0, -15.002, FRONT_Z - 0.5);
    this.root.add(soil);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(160, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: "#4c8a2a", roughness: 1 }));
    lip.position.set(0, -0.1, FRONT_Z - 0.05);
    this.root.add(lip);

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

    // The frog lives on a sandy strip of pond bank, so green felt pops against it.
    const bankTex = bankTexture();
    bankTex.repeat.set(14, 1);
    const bank = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 2.9),
      new THREE.MeshStandardMaterial({ map: bankTex, transparent: true, roughness: 1, depthWrite: false }),
    );
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(0, 0.004, 0);
    bank.receiveShadow = true;
    this.root.add(bank);

    // Grass: short in front so it never hides the frog's feet, taller behind, tufts along the bank.
    for (const g of [
      grassField(2000, { x: [-26, 26], z: [1.3, FRONT_Z - 0.05] }, [0.07, 0.2]),
      grassField(5200, { x: [-34, 34], z: [-7, -1.3] }, [0.2, 0.55]),
      grassField(700, { x: [-26, 26], z: [1.0, 1.45] }, [0.06, 0.16]),
      grassField(900, { x: [-26, 26], z: [-1.5, -1.0] }, [0.12, 0.35]),
      grassField(1500, { x: [-28, 28], z: [FRONT_Z - 0.15, FRONT_Z + 0.05] }, [0.22, 0.42]),
    ]) {
      this.root.add(g.mesh);
      this.grass.push(g);
    }

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

  update(time: number, dt: number) {
    for (const g of this.grass) g.uniforms.uTime.value = time;
    for (const r of this.reeds) r.obj.rotation.z = Math.sin(time * 1.1 + r.phase) * 0.04 + Math.sin(time * 0.43 + r.phase) * 0.03;
    for (const c of this.clouds) {
      c.obj.position.x += c.speed * dt;
      if (c.obj.position.x > 110) c.obj.position.x = -110;
    }
    (this.water.material as THREE.MeshPhysicalMaterial).clearcoatRoughness = 0.15 + Math.sin(time * 0.8) * 0.05;
  }
}
