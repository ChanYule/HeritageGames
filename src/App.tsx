import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Accessibility,
  BookOpen,
  CircleDot,
  Gamepad2,
  Hand,
  MonitorSmartphone,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";
import type { GameDefinition, GameKey } from "./types";
import GameShell from "./components/GameShell";
import MarblesGame from "./games/MarblesGame";
import PickUpSticksGame from "./games/PickUpSticksGame";
import FiveStonesGame from "./games/FiveStonesGame";
import ChaptehGame from "./games/ChaptehGame";

const games: GameDefinition[] = [
  {
    key: "marbles",
    title: "Marbles",
    subtitle: "Aim, pull back and flick.",
    description:
      "Knock target marbles out of the ring with controlled shots, realistic momentum and friction.",
    difficulty: "Medium",
    players: "2 players · local",
    accent: "◎",
  },
  {
    key: "pick-up-sticks",
    title: "Pick-Up Sticks",
    subtitle: "Steady hands win.",
    description:
      "Remove sticks from a tangled pile without disturbing the others. Precision matters.",
    difficulty: "Medium",
    players: "2 players · local",
    accent: "╱",
  },
  {
    key: "five-stones",
    title: "Five Stones",
    subtitle: "Toss, collect and catch.",
    description:
      "Recreate the familiar hand-eye challenge by collecting the right stones before the toss falls.",
    difficulty: "Hard",
    players: "1 player",
    accent: "◆",
  },
  {
    key: "chapteh",
    title: "Chapteh",
    subtitle: "Kick it across. Keep it alive.",
    description:
      "Play a same-device rally. Player 1 owns the left side and Player 2 owns the right side.",
    difficulty: "Easy to learn",
    players: "2 players · local",
    accent: "✦",
  },
];

const gameIcons = [CircleDot, Hand, MousePointer2, Gamepad2];

const gameCardDetails: Record<GameKey, { skill: string; control: string; modeLabel: string }> = {
  marbles: { skill: "Precision", control: "Drag + release", modeLabel: "Local versus" },
  "pick-up-sticks": { skill: "Steady control", control: "Drag", modeLabel: "Local versus" },
  "five-stones": { skill: "Timing", control: "Tap + catch", modeLabel: "Solo challenge" },
  chapteh: { skill: "Reflexes", control: "Keys + touch", modeLabel: "Local versus" },
};

function Home({ onPlay }: { onPlay: (key: GameKey) => void }) {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [carouselDirection, setCarouselDirection] = useState(1);
  const carouselTouchStartX = useRef<number | null>(null);

  const changeFeatured = (direction: -1 | 1) => {
    setCarouselDirection(direction);
    setFeaturedIndex((current) => (current + direction + games.length) % games.length);
  };

  const selectFeatured = (index: number) => {
    if (index === featuredIndex) return;
    setCarouselDirection(index > featuredIndex ? 1 : -1);
    setFeaturedIndex(index);
  };

  const featuredGame = games[featuredIndex];
  const FeaturedIcon = gameIcons[featuredIndex];
  const featuredDetails = gameCardDetails[featuredGame.key];
  const featuredMultiplayer = featuredGame.players.includes("2 players");

  return (
    <motion.main
      key="home"
      id="main-content"
      className="home-page premium-page professional-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <a className="skip-link" href="#games">Skip to games</a>
      <div className="premium-orb premium-orb-one" aria-hidden="true" />
      <div className="premium-orb premium-orb-two" aria-hidden="true" />

      <motion.nav
        className="site-nav premium-nav"
        aria-label="Main navigation"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <a className="brand-mark" href="#top" aria-label="Singapore Heritage Games home">
          <span className="brand-symbol"><Sparkles size={18} strokeWidth={2.2} /></span>
          <span>
            <strong>Heritage Games</strong>
            <small>Void Deck Edition</small>
          </span>
        </a>
        <div className="nav-actions">
          <div className="nav-links">
            <a href="#games">Games</a>
            <a href="#how-it-works">How it works</a>
            <a href="#experience">Experience</a>
            <a href="#about">About</a>
          </div>
          <a className="nav-cta" href="#games">Play now <ArrowUpRight size={15} /></a>
        </div>
      </motion.nav>

      <section className="collection-hero" id="top" aria-labelledby="collection-title">
        <div className="collection-intro">
          <span className="collection-eyebrow"><span /> MADE OF SINGAPORE MEMORIES</span>
          <h1 id="collection-title">Old-school games.<br /><em>New ways to play.</em></h1>
          <p className="collection-description">A little nostalgia. A little friendly competition. Rediscover Singapore’s favourite childhood games, wherever you are.</p>
          <div className="collection-actions">
            <button className="collection-primary" onClick={() => onPlay("chapteh")}>
              Let’s play Chapteh <ArrowUpRight size={19} />
            </button>
            <a className="collection-browse" href="#games">Explore the games <ArrowDown size={17} /></a>
          </div>
          <p className="collection-reassurance"><ShieldCheck size={16} /> Free to play. No downloads or sign-ups.</p>
          <div className="collection-facts">
            <div><strong>04</strong><span>Classic games</span></div>
            <div><Users2 size={22} /><span>Solo or with a friend</span></div>
            <div><MonitorSmartphone size={22} /><span>Any screen, anytime</span></div>
          </div>
        </div>

        <div className="collection-feature">
          <div className="collection-feature-heading"><span>IN THE SPOTLIGHT</span><span className="collection-issue">01 / 04</span></div>
          <button className="collection-game" onClick={() => onPlay("chapteh")} aria-label="Play Chapteh Versus, 2 players on one device">
            <div className="collection-court" aria-hidden="true">
              <span className="collection-court-label">THE VOID DECK CLASSIC</span>
              <span className="collection-court-line" />
              <svg className="collection-shuttle" viewBox="0 0 280 270" fill="none">
                <ellipse cx="145" cy="244" rx="51" ry="9" fill="#122f30" opacity=".25" />
                <g transform="rotate(18 140 160)">
                  <path d="M140 205C106 166 52 110 66 58C109 66 138 140 140 205Z" fill="#E4A56B" />
                  <path d="M140 205C113 138 102 52 129 20C159 56 158 149 140 205Z" fill="#F9EDD0" />
                  <path d="M140 205C152 141 173 62 217 51C230 103 181 166 140 205Z" fill="#E9C974" />
                  <path d="M140 205L72 72M140 205L130 35M140 205L211 65" stroke="#315B57" strokeOpacity=".45" strokeWidth="2" />
                  <path d="M139 194L110 122M143 188L174 110" stroke="#FFF7E2" strokeWidth="3" />
                  <rect x="120" y="188" width="41" height="17" rx="5" fill="#C55C41" />
                  <ellipse cx="140" cy="209" rx="27" ry="12" fill="#EDB16C" />
                  <path d="M113 207V215C113 231 167 231 167 215V207C167 223 113 223 113 207Z" fill="#C55C41" />
                  <ellipse cx="140" cy="215" rx="27" ry="11" stroke="#F5CB91" strokeWidth="2" />
                </g>
                <path d="M52 196C22 160 23 125 38 104M226 172C247 147 251 127 244 109" stroke="#E6E9CD" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 8" />
                <path d="M228 35V49M221 42H235M49 143V153M44 148H54" stroke="#F2D697" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="collection-player collection-player-one">P1</span>
              <span className="collection-court-caption">Keep the good times up.</span>
              <span className="collection-player collection-player-two">P2</span>
            </div>
            <div className="collection-game-info">
              <span className="collection-game-mode"><Users2 size={14} /> 2 players · One device</span>
              <div className="collection-game-title"><h2>Chapteh Versus</h2><span className="collection-play-arrow"><ArrowUpRight size={23} /></span></div>
              <p>Trade kicks. Find your rhythm. Keep the rally alive.</p>
              <div className="collection-game-tags"><span>Easy to learn</span><span>Touch + keyboard</span></div>
            </div>
          </button>
          <div className="collection-more">
            <span>MORE TO PLAY</span>
            <button onClick={() => onPlay("marbles")}><CircleDot size={18} /> Marbles <ArrowUpRight size={15} /></button>
            <button onClick={() => onPlay("pick-up-sticks")}><Hand size={18} /> Pick-Up Sticks <ArrowUpRight size={15} /></button>
          </div>
        </div>
      </section>

      <motion.section
        className="heritage-note premium-note"
        aria-label="Collection principle"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
      >
        <span className="note-icon" aria-hidden="true"><MousePointer2 size={19} /></span>
        <p>
          Built around direct interaction, clear feedback, and low-friction access. Open the site, choose a game, and start playing.
        </p>
      </motion.section>

      <section
        className="featured-carousel-section section-block premium-section"
        aria-labelledby="featured-carousel-title"
      >
        <motion.div
          className="featured-carousel-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div>
            <p className="eyebrow">Featured games</p>
            <h2 id="featured-carousel-title">Pick a game and start instantly.</h2>
          </div>
          <div className="featured-carousel-keyboard-hint" aria-label="Keyboard controls">
            <kbd>←</kbd><kbd>→</kbd><span>Browse games</span>
          </div>
          <div className="featured-carousel-swipe-hint" aria-hidden="true">
            Swipe left or right to browse
          </div>
        </motion.div>

        <div
          className="featured-carousel-shell"
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured Heritage Games"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              changeFeatured(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              changeFeatured(1);
            }
          }}
          onTouchStart={(event) => {
            carouselTouchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = carouselTouchStartX.current;
            carouselTouchStartX.current = null;
            if (startX === null) return;
            const endX = event.changedTouches[0]?.clientX ?? startX;
            const delta = endX - startX;
            if (Math.abs(delta) < 48) return;
            changeFeatured(delta < 0 ? 1 : -1);
          }}
        >
          <button
            type="button"
            className="featured-carousel-nav featured-carousel-prev"
            onClick={() => changeFeatured(-1)}
            aria-label="Show previous featured game"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="featured-carousel-stage">
            <AnimatePresence mode="wait" initial={false} custom={carouselDirection}>
              <motion.article
                key={featuredGame.key}
                className={`featured-carousel-card featured-carousel-${featuredGame.key}`}
                custom={carouselDirection}
                initial={{ opacity: 0, x: carouselDirection > 0 ? 70 : -70, scale: 0.975 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: carouselDirection > 0 ? -70 : 70, scale: 0.975 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                aria-live="polite"
              >
                <div className={`featured-carousel-art art-${featuredIndex + 1}`}>
                  <div className="featured-carousel-art-grid" aria-hidden="true" />
                  <span className="featured-carousel-number">0{featuredIndex + 1}</span>
                  <motion.div
                    className="featured-carousel-icon"
                    animate={{ y: [0, -8, 0], rotate: [0, featuredIndex % 2 === 0 ? 3 : -3, 0] }}
                    transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  >
                    <FeaturedIcon size={76} strokeWidth={1.4} />
                  </motion.div>
                  <motion.span
                    className="featured-carousel-accent"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  >
                    {featuredGame.accent}
                  </motion.span>
                </div>

                <div className="featured-carousel-content">
                  <div className="featured-carousel-badges">
                    <span className={`game-mode-badge ${featuredMultiplayer ? "is-multiplayer" : "is-solo"}`}>
                      {featuredMultiplayer ? <Users2 size={14} /> : <Gamepad2 size={14} />}
                      {featuredDetails.modeLabel}
                    </span>
                    <span className="featured-carousel-difficulty">{featuredGame.difficulty}</span>
                  </div>

                  <div className="featured-carousel-copy">
                    <p className="featured-carousel-kicker">FEATURED 0{featuredIndex + 1} / 0{games.length}</p>
                    <h3>{featuredGame.title}</h3>
                    <strong>{featuredGame.subtitle}</strong>
                    <p>{featuredGame.description}</p>
                  </div>

                  <div className="featured-carousel-meta" aria-label={`${featuredGame.title} metadata`}>
                    <div><small>Skill</small><strong>{featuredDetails.skill}</strong></div>
                    <div><small>Controls</small><strong>{featuredDetails.control}</strong></div>
                    <div><small>Players</small><strong>{featuredMultiplayer ? "2 local" : "1 player"}</strong></div>
                  </div>

                  <div className="featured-carousel-actions">
                    <motion.button
                      type="button"
                      className="featured-carousel-play"
                      onClick={() => onPlay(featuredGame.key)}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>
                        <small>Ready to play</small>
                        <strong>Play {featuredGame.title} now</strong>
                      </span>
                      <ArrowUpRight size={20} />
                    </motion.button>
                    <span className="featured-carousel-counter">{featuredIndex + 1} of {games.length}</span>
                  </div>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>

          <button
            type="button"
            className="featured-carousel-nav featured-carousel-next"
            onClick={() => changeFeatured(1)}
            aria-label="Show next featured game"
          >
            <ChevronRight size={22} />
          </button>

          <div className="featured-carousel-dots" role="tablist" aria-label="Choose featured game">
            {games.map((game, index) => (
              <button
                type="button"
                key={game.key}
                className={index === featuredIndex ? "is-active" : ""}
                onClick={() => selectFeatured(index)}
                role="tab"
                aria-selected={index === featuredIndex}
                aria-label={`Show ${game.title}`}
              >
                <span />
                <small>{game.title}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="games" className="games-section section-block premium-section">
        <motion.div
          className="section-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div>
            <p className="eyebrow">Choose your game</p>
            <h2>A small collection, thoughtfully designed.</h2>
          </div>
          <p>Every game includes clear instructions, responsive controls, and layouts tuned for touch, mouse, and keyboard.</p>
        </motion.div>

        <motion.div
          className="game-grid premium-game-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ visible: { transition: { staggerChildren: 0.09 } } }}
        >
          {games.map((game, index) => {
            const Icon = gameIcons[index];
            const details = gameCardDetails[game.key];
            const isMultiplayer = game.players.includes("2 players");
            return (
              <motion.article
                className={`game-card premium-game-card game-card-${game.key}`}
                key={game.key}
                variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -10, scale: 1.012 }}
              >
                <div className={`game-art art-${index + 1} premium-game-art`}>
                  <span className="game-number">0{index + 1}</span>
                  <motion.span
                    className="premium-game-icon"
                    whileHover={{ rotate: index % 2 === 0 ? 7 : -7, scale: 1.1, y: -3 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  >
                    <Icon size={52} strokeWidth={1.55} />
                  </motion.span>
                  <motion.span
                    className="game-art-action"
                    aria-hidden="true"
                    animate={{ y: [0, -5, 0], rotate: [0, 3, 0] }}
                    transition={{ duration: 3.4 + index * 0.25, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {game.accent}
                  </motion.span>
                  <span className="game-art-play-label">PLAY</span>
                </div>

                <div className="game-card-body premium-game-card-body">
                  <div className="game-card-topline">
                    <span className={`game-mode-badge ${isMultiplayer ? "is-multiplayer" : "is-solo"}`}>
                      {isMultiplayer ? <Users2 size={14} /> : <Gamepad2 size={14} />}
                      {details.modeLabel}
                    </span>
                    <span className="game-difficulty-label">{game.difficulty}</span>
                  </div>

                  <div className="game-card-title-row">
                    <div>
                      <h3>{game.title}</h3>
                      <p className="card-subtitle">{game.subtitle}</p>
                    </div>
                    <span className="game-card-arrow" aria-hidden="true"><ArrowUpRight size={19} /></span>
                  </div>

                  <div className="game-detail-grid" aria-label={`${game.title} details`}>
                    <div>
                      <small>Skill</small>
                      <strong>{details.skill}</strong>
                    </div>
                    <div>
                      <small>Controls</small>
                      <strong>{details.control}</strong>
                    </div>
                    <div>
                      <small>Players</small>
                      <strong>{isMultiplayer ? "2 local" : "1 player"}</strong>
                    </div>
                  </div>

                  <p className="game-card-description">{game.description}</p>

                  <motion.button
                    className="primary-button card-play-button premium-play-button premium-play-now"
                    onClick={() => onPlay(game.key)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.975 }}
                  >
                    <span>
                      <small>Ready when you are</small>
                      <strong>Play now</strong>
                    </span>
                    <span className="play-now-icon"><ArrowUpRight size={19} /></span>
                  </motion.button>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </section>

      <section id="how-it-works" className="flow-section section-block premium-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Simple play flow</p>
            <h2>Simple from the first click.</h2>
          </div>
          <p>The interface keeps instructions, turn state and scoring visible while you play.</p>
        </div>
        <div className="flow-track premium-flow-track">
          {[
            ["01", "Choose", "Pick a game and difficulty.", CircleDot],
            ["02", "Learn", "Read the short numbered steps.", BookOpen],
            ["03", "Play", "Use direct touch, drag or keyboard controls.", Gamepad2],
            ["04", "Pass", "For local multiplayer, hand over on turn change.", Users2],
          ].map(([number, title, text, Icon], index) => {
            const FlowIcon = Icon as typeof CircleDot;
            return (
              <motion.article
                key={String(title)}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="premium-flow-card"
              >
                <div className="flow-icon"><FlowIcon size={21} /></div>
                <span>{String(number)}</span><strong>{String(title)}</strong><p>{String(text)}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section id="experience" className="experience-section section-block premium-section" aria-labelledby="experience-title">
        <motion.div
          className="section-heading compact-heading"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div>
            <p className="eyebrow">Built for everyone</p>
            <h2 id="experience-title">Easy to access. Clear to use.</h2>
          </div>
          <p>The interface is designed to work across ages, devices, and input methods without unnecessary setup.</p>
        </motion.div>
        <div className="experience-grid">
          <motion.article whileHover={{ y: -4 }}>
            <span className="experience-icon"><Accessibility size={22} /></span>
            <h3>Accessible by design</h3>
            <p>Readable contrast, visible focus states, large touch targets, reduced-motion support, and clear instructions.</p>
          </motion.article>
          <motion.article whileHover={{ y: -4 }}>
            <span className="experience-icon"><MonitorSmartphone size={22} /></span>
            <h3>Responsive everywhere</h3>
            <p>Phone, tablet, and desktop layouts adapt around the game board instead of simply shrinking the page.</p>
          </motion.article>
          <motion.article whileHover={{ y: -4 }}>
            <span className="experience-icon"><ShieldCheck size={22} /></span>
            <h3>Low-friction play</h3>
            <p>No account or online lobby is required. Local multiplayer starts immediately on the same device.</p>
          </motion.article>
        </div>
      </section>

      <section id="about" className="about-section section-block premium-section">
        <div>
          <p className="eyebrow">Design approach</p>
          <h2>Heritage play with modern product thinking.</h2>
        </div>
        <div className="about-grid premium-about-grid">
          <article><span>01</span><h3>Direct interaction</h3><p>Drag, flick, tap, and time actions in ways that stay close to the physical games.</p></article>
          <article><span>02</span><h3>Clear feedback</h3><p>Scores, turn states, timers, and motion explain what happened without interrupting play.</p></article>
          <article><span>03</span><h3>Respectful context</h3><p>The visual system references familiar neighbourhood play without relying on tourist imagery or stereotypes.</p></article>
        </div>
      </section>

      <footer className="site-footer premium-footer professional-footer">
        <div className="brand-mark footer-brand">
          <span className="brand-symbol"><Sparkles size={17} /></span>
          <span><strong>Heritage Games</strong><small>Digital heritage play for everyone</small></span>
        </div>
        <div className="footer-meta">
          <span>© {new Date().getFullYear()} Singapore Heritage Games</span>
          <span>Touch · Mouse · Keyboard</span>
          <span>Mobile · Tablet · Desktop</span>
        </div>
        <nav className="footer-quick-links" aria-label="Footer navigation">
          <a href="#games">Games</a>
          <a href="#how-it-works">How to play</a>
          <a href="#experience">Accessibility</a>
          <a href="#top">Back to top ↑</a>
        </nav>
      </footer>
    </motion.main>
  );
}

export default function App() {
  const [currentGame, setCurrentGame] = useState<GameKey | null>(null);

  const game = useMemo(
    () => games.find((item) => item.key === currentGame) ?? null,
    [currentGame]
  );

  const openGame = (key: GameKey) => {
    setCurrentGame(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeGame = () => {
    setCurrentGame(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!currentGame || !game ? (
        <Home key="home" onPlay={openGame} />
      ) : (
        <GameShell key={currentGame} title={game.title} subtitle={game.subtitle} onBack={closeGame}>
          {{
            marbles: <MarblesGame />,
            "pick-up-sticks": <PickUpSticksGame />,
            "five-stones": <FiveStonesGame />,
            chapteh: <ChaptehGame />,
          }[currentGame]}
        </GameShell>
      )}
    </AnimatePresence>
  );
}
