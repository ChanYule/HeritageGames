import { Body, Box, Sphere, Vec3, World, GSSolver } from "cannon-es";

export const SLING = { x: 2.1, y: 1.7 }, MAX_PULL = 1.15, BALL_RADIUS = .18;
export const TIN_LEVELS = [
  { name: "First Throw", objective: "Drag back and topple the six tins.", kind: 0 },
  { name: "Wooden Defence", objective: "Break the crates or shoot over them.", kind: 1 },
  { name: "Over the Wall", objective: "Lob the ball over the stone wall.", kind: 2 },
  { name: "Falling Structures", objective: "Break the wooden supports to bring the tins down.", kind: 3 },
  { name: "Master Challenge", objective: "Choose an arc or rebound to reach both stacks.", kind: 4 },
] as const;
export type SlingObject = { id: number; body: Body; width: number; height: number; kind: "tin" | "wood" | "stone" | "platform" | "ramp"; start: { x: number; y: number }; fallen: boolean; health: number; broken: boolean };
export type SlingWorld = { physics: World; objects: SlingObject[]; ball: Body | null; balls: number; shots: number; quiet: number; elapsed: number; impacts: number; breaks: number; settled: boolean; resolved: boolean; score: number; breakdown: { tins: number; clear: number; unused: number }; level: number; effects: { x: number; y: number; kind: "wood" | "tin"; age: number }[] };
export function slingVelocity(dx: number, dy: number) {
  if (!Number.isFinite(dx + dy)) return null;
  const distance = Math.hypot(dx, dy);
  if (distance < .12) return null;
  const scale = Math.min(distance, MAX_PULL) / distance * 13;
  return { x: -dx * scale, y: -dy * scale };
}
function addObject(world: SlingWorld, kind: SlingObject["kind"], x: number, y: number, width: number, height: number, mass = 0, angle = 0) {
  const body = new Body({ mass, shape: new Box(new Vec3(width / 2, height / 2, .3)), position: new Vec3(x, y, 0), linearDamping: .25, angularDamping: .5, sleepSpeedLimit: .08, sleepTimeLimit: .5 });
  body.linearFactor.set(1, 1, 0); body.angularFactor.set(0, 0, 1);
  body.quaternion.setFromAxisAngle(new Vec3(0, 0, 1), angle);
  world.physics.addBody(body);
  const object: SlingObject = { id: world.objects.length, body, width, height, kind, start: { x, y }, fallen: false, health: kind === "wood" ? 2.8 : Infinity, broken: false };
  world.objects.push(object);
  body.addEventListener("collide", (e: { contact: { getImpactVelocityAlongNormal(): number } }) => {
    const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (speed > .9) world.impacts++;
    if (world.ball && speed > 2 && world.effects.length < 12 && (kind === "tin" || kind === "wood")) world.effects.push({ x: body.position.x, y: body.position.y, kind, age: 0 });
    if (world.ball && kind === "wood" && speed > 2) object.health -= speed - 2;
  });
  return object;
}
function pyramid(world: SlingWorld, x: number, base: number, rows = 3) {
  for (let row = 0; row < rows; row++) for (let col = 0; col < rows - row; col++)
    addObject(world, "tin", x + (col - (rows - row - 1) / 2) * .52, base + .35 + row * .701, .5, .7, .19);
}
export function createSlingWorld(level = 0, balls = 3): SlingWorld {
  const physics = new World({ gravity: new Vec3(0, -9.81, 0), allowSleep: true });
  (physics.solver as GSSolver).iterations = 25;
  physics.defaultContactMaterial.friction = .48; physics.defaultContactMaterial.restitution = .18;
  const w: SlingWorld = { physics, objects: [], ball: null, balls, shots: 0, quiet: 0, elapsed: 0, impacts: 0, breaks: 0, settled: true, resolved: false, score: 0, breakdown: { tins: 0, clear: 0, unused: 0 }, level, effects: [] };
  addObject(w, "platform", 6, .2, 24, .4);
  if (level === 3) {
    addObject(w, "wood", 8.5, .95, .4, 1.1, .3); addObject(w, "wood", 10, .95, .4, 1.1, .3);
    addObject(w, "platform", 9.25, 1.6, 2.7, .2, .45); pyramid(w, 9.25, 1.71);
  } else if (level === 4) {
    pyramid(w, 8.4, .4, 2); pyramid(w, 10.5, .4, 2);
    addObject(w, "stone", 6.1, .95, .45, 1.1);
    addObject(w, "wood", 9.4, 1.05, .42, 1.3, .35);
    addObject(w, "ramp", 7.2, .6, 1.3, .18, 0, .32);
  } else {
    pyramid(w, 9.4, .4);
    if (level === 1) { addObject(w, "wood", 8, .9, .55, 1, .35); addObject(w, "wood", 8, 1.9, .55, 1, .35); }
    if (level === 2) addObject(w, "stone", 6.5, 1, .45, 1.2);
  }
  // Resolve support contacts before scoring is enabled. Identical warm-up for every player.
  for (let i = 0; i < 240; i++) physics.step(1 / 240);
  w.objects.forEach(o => { o.start = { x: o.body.position.x, y: o.body.position.y }; o.body.velocity.setZero(); o.body.angularVelocity.setZero(); if (o.body.mass) o.body.sleep(); });
  w.impacts = 0; return w;
}
export function launchSling(w: SlingWorld, dx: number, dy: number) {
  const v = slingVelocity(dx, dy);
  if (!v || !w.settled || w.resolved || w.balls <= 0) return false;
  if (w.ball) w.physics.removeBody(w.ball);
  w.ball = new Body({ mass: .8, shape: new Sphere(BALL_RADIUS), position: new Vec3(SLING.x, SLING.y, 0), velocity: new Vec3(v.x, v.y, 0), linearDamping: .08, angularDamping: .6, sleepSpeedLimit: .09, sleepTimeLimit: .5 });
  w.ball.linearFactor.set(1, 1, 0); w.ball.angularFactor.set(0, 0, 1);
  w.physics.addBody(w.ball); w.balls--; w.shots++; w.elapsed = 0; w.quiet = 0; w.settled = false;
  w.objects.forEach(o => { if (o.body.mass) o.body.wakeUp(); }); return true;
}
export function stepSling(w: SlingWorld, dt: number) {
  if (w.settled || !Number.isFinite(dt) || dt <= 0) return;
  const duration = Math.min(dt, 1 / 30);
  // Travel stays below half a ball radius, including unusually fast rebounds.
  const speed = Math.max(20, ...w.physics.bodies.map(b => b.velocity.length()));
  const steps = Math.max(2, Math.ceil(speed * duration / (BALL_RADIUS * .45)));
  for (let i = 0; i < steps; i++) {
    w.physics.step(duration / steps);
    for (const o of w.objects) if (!o.broken && o.kind === "wood" && o.health <= 0) { o.broken = true; w.physics.removeBody(o.body); w.breaks++; }
  }
  w.elapsed += duration;
  w.effects = w.effects.filter(e => (e.age += duration) < .4);
  for (const o of w.objects) if (o.kind === "tin" && !o.fallen) {
    const up = o.body.quaternion.vmult(new Vec3(0, 1, 0));
    if (up.y < .65 || o.body.position.y < o.start.y - .4 || Math.abs(o.body.position.x - o.start.x) > .65) o.fallen = true;
  }
  for (const o of w.objects) if (o.body.mass && !o.broken && (o.body.position.y < -2 || o.body.position.x < -3 || o.body.position.x > 14)) { o.fallen = o.kind === "tin" || o.fallen; o.broken = true; w.physics.removeBody(o.body); }
  const ball = w.ball;
  if (ball && (Math.abs(ball.position.x) > 15 || ball.position.y < -2 || ball.sleepState === Body.SLEEPING)) { w.physics.removeBody(ball); w.ball = null; }
  const quiet = w.physics.bodies.every(b => !b.mass || (b.velocity.length() < .1 && b.angularVelocity.length() < .1));
  w.quiet = quiet ? w.quiet + duration : 0;
  if (w.elapsed > .5 && w.quiet > .45) {
    w.settled = true;
    const tins = w.objects.filter(o => o.kind === "tin"), clear = tins.every(o => o.fallen);
    w.breakdown = { tins: tins.filter(o => o.fallen).length * 100, clear: clear ? 200 : 0, unused: clear ? w.balls * 50 : 0 };
    w.score = w.breakdown.tins + w.breakdown.clear + w.breakdown.unused;
    w.resolved = clear || w.balls === 0;
  }
}
/** Simulate a cloned rigid-body world, stopping at the actual first contact. */
export function slingTrajectory(w: SlingWorld, dx: number, dy: number) {
  const v = slingVelocity(dx, dy); if (!v) return [];
  const preview = new World({ gravity: new Vec3(0, -9.81, 0) });
  for (const o of w.objects.filter(o => !o.broken)) {
    const copy = new Body({ mass: 0, shape: o.body.shapes[0], position: o.body.position.clone(), quaternion: o.body.quaternion.clone() }); preview.addBody(copy);
  }
  const ball = new Body({ mass: 1, shape: new Sphere(BALL_RADIUS), position: new Vec3(SLING.x, SLING.y, 0), velocity: new Vec3(v.x, v.y, 0), linearDamping: .08 }); preview.addBody(ball);
  let hit = false; ball.addEventListener("collide", () => { hit = true; });
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 480 && !hit; i++) { preview.step(1 / 240); if (i % 12 === 0) points.push({ x: ball.position.x, y: ball.position.y }); }
  return points;
}
