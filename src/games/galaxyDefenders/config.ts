export const CONFIG = {
  width: 480, height: 720, step: 1 / 120,
  columns: 9, rows: 5, columnGap: 40, rowGap: 44, top: 88,
  alienHalfWidth: 13, alienHalfHeight: 11, margin: 20,
  playerY: 650, playerSpeed: 290, playerHalfWidth: 18,
  fireCooldown: .22, playerLaserSpeed: 600, lives: 3,
  descent: 18, descentSpeed: 70, defenceLine: 604,
  invincibility: 1.8, waveTransition: 2, waveBonus: 100,
  maxBullets: 40, maxParticles: 72,
  points: { red: 30, green: 20, purple: 10 },
};
export const MODES = {
  beginner: { speed: 12, speedGrowth: 3, lastAlienBoost: 48, maxSpeed: 96, bulletSpeed: 135, bulletGrowth: 7, maxBulletSpeed: 210, shotInterval: 2.8, intervalReduction: .13, minInterval: 1.1, maxEnemyBullets: 4, hitRadius: 6, autoFire: true },
  classic: { speed: 22, speedGrowth: 4, lastAlienBoost: 68, maxSpeed: 145, bulletSpeed: 185, bulletGrowth: 8, maxBulletSpeed: 280, shotInterval: 1.9, intervalReduction: .12, minInterval: .65, maxEnemyBullets: 7, hitRadius: 10, autoFire: false },
};
export const modeLabel = { beginner: "Beginner Mode", classic: "Classic Mode" };
