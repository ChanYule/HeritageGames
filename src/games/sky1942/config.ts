export const CONFIG = {
  width: 480, height: 720, step: 1 / 120,
  playerSpeed: 220, fireCooldown: .16, bulletSpeed: 640,
  hitRadius: 8, lives: 3, loops: 3, rollDuration: 1.1, invincible: 1.8,
  shieldDuration: 5, dropChance: .16, bossBonus: 3000, formationBonus: 200,
  pickupScore: 100, baseKills: 16, killsGrowth: 4,
  baseSpawnInterval: 2.2, minSpawnInterval: .8, speedGrowth: .09,
  maxEnemies: 36, maxBullets: 180, maxParticles: 100,
  enemySpeeds: { straight: 70, zigzag: 85, diver: 100 },
  enemyFireStage: 3, enemyBulletSpeed: 190, enemyFireInterval: 2.6,
  spawnIntervalReduction: .1,
  bossBaseHp: 40, bossHpGrowth: 18, bossEntranceSpeed: 65,
  bossBaseFireInterval: 1.5, bossMinFireInterval: .85, bossFireIntervalReduction: .05,
  bossBulletSpeed: 170, bossBulletSpeedGrowth: 6, stageTransition: 2.4,
};
export const enemyScores = { straight: 50, zigzag: 80, diver: 120 };
export const pickupLabels = { gun: "WEAPON UPGRADED", shield: "SHIELD ACTIVATED", life: "EXTRA LIFE", loop: "BARREL ROLL +1" };
