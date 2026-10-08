import * as THREE from "three";
import { CAN_HEIGHT, CAN_RADIUS, LAUNCH, TABLE_Y, launchVelocity, type TinWorld } from "./tinCan3DPhysics";
export type TinAim = { x: number; y: number; power: number };

export function createTinScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#c8d9cf"); scene.fog = new THREE.Fog("#c8d9cf", 13, 28);
  const camera = new THREE.PerspectiveCamera(43, 600 / 620, .1, 40);
  camera.position.set(0, 3.15, 8.4); camera.lookAt(0, 1.55, -.8); camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xfff4d9, 0x677365, 2.4));
  const sun = new THREE.DirectionalLight(0xfff0ce, 3); sun.position.set(-3, 7, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -4; sun.shadow.normalBias = .025;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc5e7ef, 1.5); fill.position.set(4, 3, -3); scene.add(fill);
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; scene.add(object); return object;
  };
  const wood = new THREE.MeshStandardMaterial({ color: "#9a6a3e", roughness: .85 });
  mesh(new THREE.BoxGeometry(4, .24, 2.2), wood, 0, TABLE_Y - .12, -1.2);
  for (const x of [-1.75, 1.75]) for (const z of [-2, -.4]) mesh(new THREE.BoxGeometry(.16, .8, .16), wood, x, .4, z);
  const floor = mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#c2b69a", roughness: 1 }), 0, -.005, 0); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  // Planks and the fairground booth give the table a readable depth and scale.
  const seam = new THREE.MeshStandardMaterial({ color: "#785330", roughness: 1 });
  for (let z = -2.2; z < -.1; z += .25) mesh(new THREE.BoxGeometry(4, .002, .009), seam, 0, 1.002, z);
  const green = new THREE.MeshStandardMaterial({ color: "#326052", roughness: .9 });
  for (const x of [-2.7, 2.7]) mesh(new THREE.BoxGeometry(.13, 3.5, .13), wood, x, 1.75, -3.2);
  mesh(new THREE.BoxGeometry(5.6, .35, .12), green, 0, 3.3, -3.2);
  mesh(new THREE.BoxGeometry(5.6, .18, 1), green, 0, 3.55, -2.9);
  const metal = new THREE.MeshStandardMaterial({ color: "#bac7c6", metalness: .72, roughness: .32 });
  const canGeometry = new THREE.CylinderGeometry(CAN_RADIUS, CAN_RADIUS, CAN_HEIGHT, 32);
  const ringGeometry = new THREE.TorusGeometry(CAN_RADIUS + .003, .012, 6, 32);
  const lidGeometry = new THREE.CylinderGeometry(CAN_RADIUS - .025, CAN_RADIUS - .025, .009, 32);
  const canMeshes = Array.from({ length: 6 }, (_, index) => {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(canGeometry, metal); shell.castShadow = true; shell.receiveShadow = true; group.add(shell);
    for (const y of [-.28, -.19, .19, .28]) {
      const ring = new THREE.Mesh(ringGeometry, metal); ring.rotation.x = Math.PI / 2; ring.position.y = y; ring.castShadow = true; group.add(ring);
    }
    for (const y of [-.298, .298]) { const lid = new THREE.Mesh(lidGeometry, metal); lid.position.y = y; group.add(lid); }
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 256; labelCanvas.height = 128;
    const ctx = labelCanvas.getContext("2d")!;
    ctx.fillStyle = ["#d7b35b", "#b86845", "#3f7363"][index % 3]; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#fff6dc"; ctx.font = "bold 82px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const x of [64, 192]) ctx.fillText(String(index + 1), x, 68);
    const texture = new THREE.CanvasTexture(labelCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(CAN_RADIUS + .003, CAN_RADIUS + .003, .32, 32, 1, true), new THREE.MeshStandardMaterial({ map: texture, roughness: .8 })); group.add(label);
    scene.add(group); return group;
  });
  const ball = mesh(new THREE.SphereGeometry(.17, 24, 16), new THREE.MeshStandardMaterial({ color: "#b5683e", roughness: .85 }), LAUNCH.x, LAUNCH.y, LAUNCH.z);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(.167, .008, 6, 32), new THREE.MeshStandardMaterial({ color: "#f0c78c", roughness: .9 })); ball.add(stripe);
  const trajectoryGeometry = new THREE.BufferGeometry();
  const trajectory = new THREE.Line(trajectoryGeometry, new THREE.LineDashedMaterial({ color: "#285d47", dashSize: .09, gapSize: .07 })); scene.add(trajectory);
  const target = new THREE.Mesh(new THREE.TorusGeometry(.12, .012, 6, 24), new THREE.MeshBasicMaterial({ color: "#f9edb5", depthTest: false })); target.renderOrder = 5; scene.add(target);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1.2);
  return {
    aimFromScreen(x: number, y: number) {
      ray.setFromCamera(new THREE.Vector2(x / 600 * 2 - 1, 1 - y / 620 * 2), camera);
      const point = ray.ray.intersectPlane(plane, new THREE.Vector3());
      return point ? { x: Math.max(-3, Math.min(3, point.x)), y: Math.max(.5, Math.min(3.5, point.y)) } : { x: 0, y: 1.9 };
    },
    launchOnScreen() {
      const p = new THREE.Vector3(LAUNCH.x, LAUNCH.y, LAUNCH.z).project(camera);
      return { x: (p.x + 1) * 300, y: (1 - p.y) * 310 };
    },
    render(world: TinWorld, aim: TinAim | null, ready: boolean) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
      world.cans.forEach((can, index) => { canMeshes[index].position.copy(can.body.position); canMeshes[index].quaternion.copy(can.body.quaternion); });
      ball.visible = Boolean(world.ball) || ready;
      if (world.ball) { ball.position.copy(world.ball.position); ball.quaternion.copy(world.ball.quaternion); }
      else { ball.position.set(LAUNCH.x, LAUNCH.y, LAUNCH.z); ball.quaternion.identity(); }
      trajectory.visible = target.visible = ready && Boolean(aim);
      if (aim && ready) {
        const velocity = launchVelocity(aim.x, aim.y, aim.power);
        const points = Array.from({ length: 33 }, (_, i) => {
          const time = i / 32 * ((-1.2 - LAUNCH.z) / velocity.z);
          return new THREE.Vector3(LAUNCH.x + velocity.x * time, LAUNCH.y + velocity.y * time - 4.905 * time * time, LAUNCH.z + velocity.z * time);
        });
        trajectoryGeometry.setFromPoints(points); trajectory.computeLineDistances(); target.position.set(aim.x, aim.y, -1.15);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => { if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose(); m.dispose(); }); sun.shadow.dispose(); renderer.dispose();
    },
  };
}
export type TinScene = ReturnType<typeof createTinScene>;
