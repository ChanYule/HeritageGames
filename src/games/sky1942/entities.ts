// Original pixel maps preserved from the supplied SKY 1942 source.
export const PALETTE: Record<string, string | null> = {
  '.': null,           // transparent
  'R': '#d43b2f',      // player red
  'r': '#8f1e16',      // player red shadow
  'W': '#f2f2f2',      // white
  'B': '#3a4a5a',      // canopy blue-gray
  'Y': '#ffd400',      // yellow accent / muzzle
  'G': '#4a5d3a',      // enemy green
  'g': '#2e3d22',      // enemy green shadow
  'K': '#1c1e24',      // near-black outline
  'C': '#3ce7ff',      // cyan
  'O': '#ff8a1e',      // orange (fire/exhaust)
  'P': '#b23cff',      // purple (power-up)
  'S': '#8f97a8',      // steel gray
  'D': '#c94a2b',      // dark orange/red (boss)
  'X': '#ffffff',
};

// Player fighter -- nose pointing up (11x12)
export const SPR_PLAYER = [
 '.....K.....',
 '....KRK....',
 '....KRK....',
 '...KRRRK...',
 '..KRRWRRK..',
 'SSKRBBBRKSS',
 'SSKRRRRRKSS',
 '..KRrYrRK..',
 '..K.r.r.K..',
 '....O.O....',
 '....O.O....',
 '.....O.....',
];

// Enemy fighter -- nose pointing down (11x12)
export const SPR_ENEMY_STRAIGHT = [
 '....K.....',
 '....O.....',
 '...KOK....',
 '..KGGGK...',
 '.KGGWGGK..',
 'SSKGBGKSS.',
 'SSKGGGKSS.',
 '..KGgGgK..',
 '..KG.GK...',
 '...K.K....',
 '..........',
 '..........',
].map(r=>r.padEnd(11,'.'));

export const SPR_ENEMY_ZIGZAG = [
 '....K.....',
 '...KYK....',
 '..KGGGK...',
 '.KGGWGGK..',
 'SKGGBGGKS.',
 'SKGgGgGKS.',
 '.KG.G.GK..',
 '..K.G.K...',
 '...K.K....',
 '..........',
 '..........',
 '..........',
].map(r=>r.padEnd(11,'.'));

export const SPR_ENEMY_DIVER = [
 '....KK....',
 '...KOOK...',
 '..KGGGGK..',
 '.KGGWWGGK.',
 'KGGGBBGGGK',
 'SKGgGGgGKS',
 '.KG.GG.GK.',
 '..K.GG.K..',
 '...K..K...',
 '..........',
 '..........',
 '..........',
].map(r=>r.padEnd(11,'.'));

// Boss -- big bomber (19x14)
export const SPR_BOSS = [
 '.......KKKKK.......',
 '......KDDDDDK......',
 '.....KDDOOODDK.....',
 '....KDDDOOODDDK....',
 '...KDDDDWWWDDDDK...',
 'SSKDDDDDBBBDDDDDKSS',
 'SSSKDDDDBBBDDDDKSSS',
 'SSSSKDDDGGGDDDKSSSS',
 '...KDD.DDDDD.DDK...',
 '..KDD..DgggD..DDK..',
 '..KD...D...D...DK..',
 '.......O...O.......',
 '.......O...O.......',
 '........O.O........',
];

export const SPR_POWERUP = {
  gun:   ['.PPP.','PPPPP','PYPYP','PPPPP','.PPP.'],
  shield:['.CCC.','CWCWC','CWWWC','.CWC.','..C..'],
  life:  ['.RRR.','RWRWR','RRRRR','.RRR.','..R..'],
  loop:  ['.YYY.','YWYWY','YWWWY','.YWY.','..Y..'],
};

