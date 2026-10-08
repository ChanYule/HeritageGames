// Original pixel maps made for Galaxy Defenders; two silhouettes per alien family.
export const SHIP = [
  "......C......", ".....CCC.....", ".....CWC.....", "....CCWCC....",
  "....CBBBC....", "..CCCCBCCCC..", ".CCCCCBCCCCC.", "CCC.CCCCC.CCC",
  "CC..CCCCC..CC", "....C...C....", "....O...O....",
];
export const ALIENS = {
  red: [
    ["..R.....R..", "...R...R...", "..RRRRRRR..", ".RRWRRRWRR.", "RRRRRRRRRRR", "R.RRRRRRR.R", "..RR...RR..", ".RR.....RR."],
    ["..R.....R..", ".R.......R.", "..RRRRRRR..", ".RRWRRRWRR.", "RRRRRRRRRRR", "..RRRRRRR..", ".RR.....RR.", "..RR...RR.."],
  ],
  green: [
    ["....GGG....", "..GGGGGGG..", ".GGWGGGWGG.", "GGGGGGGGGGG", ".GG.GGG.GG.", "..GGGGGGG..", ".G.G...G.G.", "G..G...G..G"],
    ["....GGG....", "..GGGGGGG..", ".GGWGGGWGG.", "GGGGGGGGGGG", ".GG.GGG.GG.", "..GGGGGGG..", "G..G...G..G", ".G.G...G.G."],
  ],
  purple: [
    ["...PPPPP...", "..PPPPPPP..", ".PWPPPPPWP.", "PPPPPPPPPPP", "PP.PPPPP.PP", "P..P.P.P..P", "..P.....P..", ".P.......P."],
    ["...PPPPP...", "..PPPPPPP..", ".PWPPPPPWP.", "PPPPPPPPPPP", "PP.PPPPP.PP", "..P.P.P.P..", ".P.......P.", "..P.....P.."],
  ],
};
export const PALETTE: Record<string, string> = { C: "#54e7ef", W: "#edffff", B: "#184650", O: "#ffb55c", R: "#ff625f", G: "#86ed87", P: "#cd8cfa" };
