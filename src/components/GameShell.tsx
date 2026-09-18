import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Info, Maximize2, Minimize2, MonitorSmartphone, ShieldCheck } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

export default function GameShell({ title, subtitle, onBack, children }: Props) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreenSupported, setNativeFullscreenSupported] = useState(true);

  useEffect(() => {
    const supported = Boolean(
      typeof document !== "undefined" &&
      document.fullscreenEnabled &&
      typeof HTMLElement !== "undefined" &&
      HTMLElement.prototype.requestFullscreen,
    );
    setNativeFullscreenSupported(supported);

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === pageRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!pseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPseudoFullscreen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [pseudoFullscreen]);

  const fullscreenActive = isFullscreen || pseudoFullscreen;

  const toggleFullscreen = async () => {
    const page = pageRef.current;
    if (!page) return;

    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }

    if (!nativeFullscreenSupported) {
      setPseudoFullscreen(true);
      return;
    }

    try {
      if (document.fullscreenElement === page) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await page.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      setNativeFullscreenSupported(false);
      setPseudoFullscreen(true);
    }
  };

  return (
    <motion.main
      ref={pageRef}
      className={`game-page premium-page professional-page ${fullscreenActive ? "is-fullscreen" : ""} ${pseudoFullscreen ? "is-pseudo-fullscreen" : ""}`}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="premium-orb premium-orb-one" aria-hidden="true" />
      <header className="game-header premium-game-header">
        <motion.button
          className="back-button premium-back-button"
          onClick={onBack}
          aria-label="Back to all games"
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.97 }}
        >
          <ChevronLeft size={18} />
          <span>All games</span>
        </motion.button>
        <div className="game-title-block">
          <p className="eyebrow">Now playing</p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
          >
            {title}
          </motion.h1>
          <p className="game-subtitle">{subtitle}</p>
        </div>
        <div className="game-header-actions">
          <div className="game-header-meta" aria-label="Game availability">
            <span><MonitorSmartphone size={16} /> Touch ready</span>
            <span><ShieldCheck size={16} /> No sign-in</span>
          </div>
          <span className="fullscreen-tooltip-wrap">
            <motion.button
              type="button"
              className="game-fullscreen-button"
              onClick={toggleFullscreen}
              aria-label={fullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}
              aria-pressed={fullscreenActive}
              aria-describedby="fullscreen-button-tooltip"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              {fullscreenActive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              <span>{fullscreenActive ? "Exit fullscreen" : "Fullscreen"}</span>
            </motion.button>
            <span id="fullscreen-button-tooltip" className="fullscreen-button-tooltip" role="tooltip">
              {fullscreenActive ? "Return to the standard game view" : "Expand the game to fill your screen"}
            </span>
          </span>
        </div>
      </header>

      {!fullscreenActive && (
        <motion.div
          className="fullscreen-mobile-hint"
          role="note"
          aria-label="Mobile fullscreen tip"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.25 }}
        >
          <span className="fullscreen-mobile-hint-icon" aria-hidden="true"><Info size={15} /></span>
          <p>
            <strong>Mobile fullscreen</strong>
            <span>Tap the fullscreen button above to expand the game. Tap <b>Exit fullscreen</b> to return. Some browsers also show their own exit control or gesture.</span>
          </p>
        </motion.div>
      )}

      <motion.div
        className="game-content-enter"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.36 }}
      >
        {children}
      </motion.div>
    </motion.main>
  );
}
