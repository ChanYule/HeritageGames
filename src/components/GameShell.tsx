import { t, useLanguage } from "../i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameFullscreenContext } from "./GamePlayArea";
import LanguageSwitcher from "./LanguageSwitcher";
import { motion } from "framer-motion";
import { ChevronLeft, Info, Maximize2, Minimize2, MonitorSmartphone, ShieldCheck } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
};

export default function GameShell({ title, subtitle, onBack, backLabel = t("All games"), children }: Props) {
  useLanguage();
  const playAreaRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreenSupported, setNativeFullscreenSupported] = useState(true);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const supported = Boolean(
      typeof document !== "undefined" &&
      document.fullscreenEnabled &&
      typeof HTMLElement !== "undefined" &&
      HTMLElement.prototype.requestFullscreen,
    );
    setNativeFullscreenSupported(supported);

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playAreaRef.current);
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
    const playArea = playAreaRef.current;
    if (!playArea) return;

    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }

    if (!nativeFullscreenSupported) {
      setPseudoFullscreen(true);
      return;
    }

    try {
      if (document.fullscreenElement === playArea) {
        await document.exitFullscreen();
      } else {
        if (document.fullscreenElement) await document.exitFullscreen();
        await playArea.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      setNativeFullscreenSupported(false);
      setPseudoFullscreen(true);
    }
  };

  return (
    <motion.main
      className="game-page premium-page professional-page"
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
          aria-label={t("Back to {0}", backLabel.toLowerCase())}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.97 }}
        >
          <ChevronLeft size={18} />
          <span>{backLabel}</span>
        </motion.button>
        <div className="game-title-block">
          <p className="eyebrow">{t("Now playing")}</p>
          <motion.h1
            ref={titleRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
          >
            {t(title)}
          </motion.h1>
          <p className="game-subtitle">{t(subtitle)}</p>
        </div>
        <div className="game-header-actions">
          <LanguageSwitcher />
          <div className="game-header-meta" aria-label={t("Game availability")}>
            <span><MonitorSmartphone size={16} /> {t("Touch ready")}</span>
            <span><ShieldCheck size={16} /> {t("No sign-in")}</span>
          </div>
          <span className="fullscreen-tooltip-wrap">
            <motion.button
              type="button"
              className="game-fullscreen-button"
              onClick={toggleFullscreen}
              aria-label={fullscreenActive ? t("Exit fullscreen") : t("Enter fullscreen")}
              aria-pressed={fullscreenActive}
              aria-describedby="fullscreen-button-tooltip"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              {fullscreenActive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              <span>{fullscreenActive ? t("Exit fullscreen") : t("Fullscreen")}</span>
            </motion.button>
            <span id="fullscreen-button-tooltip" className="fullscreen-button-tooltip" role="tooltip">
              {fullscreenActive ? t("Return to the standard game view") : t("Expand the game to fill your screen")}
            </span>
          </span>
        </div>
      </header>

      {!fullscreenActive && (
        <motion.div
          className="fullscreen-mobile-hint"
          role="note"
          aria-label={t("Mobile fullscreen tip")}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.25 }}
        >
          <span className="fullscreen-mobile-hint-icon" aria-hidden="true"><Info size={15} /></span>
          <p>
            <strong>{t("Mobile fullscreen")}</strong>
            <span>{t("Tap the fullscreen button above to expand the game. Tap")} <b>{t("Exit fullscreen")}</b> {t("to return. Some browsers also show their own exit control or gesture.")}</span>
          </p>
        </motion.div>
      )}

      <motion.div
        className="game-content-enter"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.36 }}
      >
        <GameFullscreenContext.Provider value={{ playAreaRef, fullscreenActive, pseudoFullscreen, toggleFullscreen }}>
          {children}
        </GameFullscreenContext.Provider>
      </motion.div>
    </motion.main>
  );
}
