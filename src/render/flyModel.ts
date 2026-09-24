import * as THREE from "three";
import type { Fly } from "../game/fly";

const SCALE = 1.6;

export class FlyModel {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private wings: THREE.Mesh[] = [];
  private reticle: THREE.Mesh;
  private reticleMat: THREE.MeshBasicMaterial;
  private facing = 1;
  private lock = 0;

  constructor() {
    const shell = new THREE.MeshPhysicalMaterial({ color: "#2c3340", roughness: 0.35, metalness: 0.4, clearcoat: 0.8, iridescence: 0.6 });
    const abdomenMat = new THREE.MeshPhysicalMaterial({ color: "#2f5b4a", roughness: 0.25, metalness: 0.6, clearcoat: 1, iridescence: 1 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#b3261e", roughness: 0.3 });
    const legMat = new THREE.MeshBasicMaterial({ color: "#1a1a1a" });
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: "#e8f4ff",
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      iridescence: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const blob = (mat: THREE.Material, r: [number, number, number], p: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mat);
      m.scale.set(...r);
      m.position.set(...p);
      m.castShadow = true;
      this.body.add(m);
      return m;
    };
    blob(shell, [0.06, 0.05, 0.05], [0.0, 0.0, 0]);
    blob(abdomenMat, [0.075, 0.048, 0.052], [-0.09, -0.01, 0]);
    blob(shell, [0.04, 0.04, 0.045], [0.07, 0.005, 0]);
    blob(eyeMat, [0.026, 0.032, 0.026], [0.085, 0.015, 0.028]);
    blob(eyeMat, [0.026, 0.032, 0.026], [0.085, 0.015, -0.028]);

    for (let i = 0; i < 3; i++) {
      for (const side of [1, -1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07), legMat);
        leg.position.set(0.03 - i * 0.035, -0.06, side * 0.03);
        leg.rotation.z = (i - 1) * 0.5;
        leg.rotation.x = side * 0.4;
        this.body.add(leg);
      }
    }

    const wingGeo = new THREE.CircleGeometry(1, 20);
    wingGeo.scale(0.11, 0.045, 1);
    wingGeo.translate(-0.08, 0, 0);
    for (const side of [1, -1]) {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0.0, 0.045, side * 0.02);
      this.wings.push(wing);
      this.body.add(wing);
    }

    this.body.scale.setScalar(SCALE);
    this.root.add(this.body);

    // Target ring, shown when the fly is inside the tongue's aim cone.
    this.reticleMat = new THREE.MeshBasicMaterial({ color: "#fff6a8", transparent: true, opacity: 0, depthWrite: false });
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 40), this.reticleMat);
    this.root.add(this.reticle);
  }

  update(fly: Fly | null, inSights: boolean, time: number, dt: number) {
    this.root.visible = !!fly;
    if (!fly) return;
    const caught = fly.state === "caught";
    // Buzzy jitter on top of the steering path (visual only).
    const j = caught ? 0 : 0.035;
    this.root.position.set(
      fly.x + Math.sin(time * 37.1) * j,
      fly.y + Math.sin(time * 43.7 + 1) * j,
      Math.sin(time * 5.3) * 0.15,
    );
    if (Math.abs(fly.vx) > 0.3) this.facing = fly.vx > 0 ? 1 : -1;
    this.body.scale.x = SCALE * this.facing;
    this.body.rotation.z = THREE.MathUtils.clamp(fly.vy * 0.08, -0.4, 0.4) * this.facing;

    const flap = Math.sin(time * (caught ? 260 : 170));
    this.wings[0]!.rotation.x = -0.4 - flap * 0.9;
    this.wings[1]!.rotation.x = 0.4 + flap * 0.9;

    this.lock += ((inSights && !caught ? 1 : 0) - this.lock) * Math.min(1, dt * 12);
    this.reticleMat.opacity = this.lock * 0.9;
    this.reticle.visible = this.lock > 0.01;
    this.reticle.scale.setScalar(1.25 - this.lock * 0.25 + Math.sin(time * 9) * 0.04);
    this.reticle.rotation.z = time * 1.5;
  }
}
