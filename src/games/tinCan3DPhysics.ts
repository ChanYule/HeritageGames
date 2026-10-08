import { Body, Box, Cylinder, Sphere, Vec3, World, Material, ContactMaterial, GSSolver } from "cannon-es";

export const CAN_RADIUS = .24, CAN_HEIGHT = .6, TABLE_Y = 1;
export const LAUNCH = { x: 0, y: .9, z: 4.3 };
export type Can3D = { id: number; body: Body; fallen: boolean; start: Vec3 };
export type TinWorld = { physics: World; cans: Can3D[]; ball: Body | null; elapsed: number; quiet: number; impacts: number; falls: number; ballAge: number; ballMaterial: Material };

export function createTinWorld(): TinWorld {
  const physics = new World({ gravity: new Vec3(0, -9.81, 0), allowSleep: true });
  (physics.solver as GSSolver).iterations = 20;
  const metal = new Material("tin"), wood = new Material("wood"), ballMaterial = new Material("ball");
  physics.addContactMaterial(new ContactMaterial(metal, wood, { friction: .45, restitution: .12 }));
  physics.addContactMaterial(new ContactMaterial(metal, metal, { friction: .35, restitution: .08 }));
  physics.addContactMaterial(new ContactMaterial(ballMaterial, metal, { friction: .3, restitution: .38 }));
  physics.addContactMaterial(new ContactMaterial(ballMaterial, wood, { friction: .55, restitution: .35 }));
  const ground = new Body({ mass: 0, material: wood, shape: new Box(new Vec3(15, .1, 15)), position: new Vec3(0, -.1, 0) });
  const table = new Body({ mass: 0, material: wood, shape: new Box(new Vec3(2, .12, 1.1)), position: new Vec3(0, TABLE_Y - .12, -1.2) });
  physics.addBody(ground); physics.addBody(table);
  const cans = [[-.51, 1.3], [0, 1.3], [.51, 1.3], [-.255, 1.902], [.255, 1.902], [0, 2.504]].map(([x, y], i) => {
    const start = new Vec3(x, y, -1.2);
    const body = new Body({ mass: .12, material: metal, shape: new Cylinder(CAN_RADIUS, CAN_RADIUS, CAN_HEIGHT, 16), position: start.clone(), linearDamping: .18, angularDamping: .28, sleepSpeedLimit: .09, sleepTimeLimit: .6 });
    physics.addBody(body);
    return { id: i + 1, body, fallen: false, start };
  });
  const world: TinWorld = { physics, cans, ball: null, elapsed: 0, quiet: 0, impacts: 0, falls: 0, ballAge: 0, ballMaterial };
  for (const can of cans) can.body.addEventListener("collide", (event: { contact: { getImpactVelocityAlongNormal(): number } }) => {
    if (Math.abs(event.contact.getImpactVelocityAlongNormal()) > .7) world.impacts++;
  });
  // Let contact supports settle before the first shot; a miss must never score stack jitter.
  for (let i = 0; i < 240; i++) physics.step(1 / 240);
  cans.forEach(can => { can.body.velocity.setZero(); can.body.angularVelocity.setZero(); can.body.sleep(); });
  world.impacts = 0;
  return world;
}

export function launchVelocity(x: number, y: number, power: number) {
  const duration = .85 - Math.max(.1, Math.min(1, power)) * .4;
  return { x: (x - LAUNCH.x) / duration, y: (y - LAUNCH.y + .5 * 9.81 * duration * duration) / duration, z: (-1.2 - LAUNCH.z) / duration };
}
export function throwTinBall(world: TinWorld, x: number, y: number, power: number): boolean {
  if (world.ball || !Number.isFinite(x + y + power)) return false;
  const velocity = launchVelocity(Math.max(-3, Math.min(3, x)), Math.max(.5, Math.min(3.5, y)), power);
  world.ball = new Body({ mass: .45, material: world.ballMaterial, shape: new Sphere(.17), position: new Vec3(LAUNCH.x, LAUNCH.y, LAUNCH.z), velocity: new Vec3(velocity.x, velocity.y, velocity.z), linearDamping: .025, angularDamping: .2, sleepSpeedLimit: .15, sleepTimeLimit: .5 });
  world.physics.addBody(world.ball);
  world.cans.forEach(can => can.body.wakeUp());
  world.elapsed = 0; world.ballAge = 0; world.quiet = 0; world.impacts = 0; world.falls = 0;
  return true;
}
export function stepTinWorld(world: TinWorld, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const duration = Math.min(dt, 1 / 30);
  // Small fixed substeps prevent the fast ball crossing a thin can between contacts.
  const steps = Math.ceil(duration / (1 / 240));
  for (let i = 0; i < steps; i++) world.physics.step(duration / steps);
  world.elapsed += duration; world.ballAge += duration;
  for (const can of world.cans) {
    const up = can.body.quaternion.vmult(new Vec3(0, 1, 0));
    const moved = Math.hypot(can.body.position.x - can.start.x, can.body.position.z - can.start.z);
    if (!can.fallen && (up.y < .65 || moved > .55 || can.body.position.y < TABLE_Y - .15)) { can.fallen = true; world.falls++; }
  }
  if (world.ball && (world.ball.sleepState === Body.SLEEPING || world.ball.position.z < -5 || Math.abs(world.ball.position.x) > 8 || world.ball.position.y < -2 || world.ballAge > 5)) {
    world.physics.removeBody(world.ball); world.ball = null;
  }
  const quiet = !world.ball && world.cans.every(can => can.body.velocity.length() < .09 && can.body.angularVelocity.length() < .09);
  world.quiet = quiet ? world.quiet + duration : 0;
}
export const tinWorldSettled = (world: TinWorld) => !world.ball && world.elapsed > .8 && world.quiet >= .4;
