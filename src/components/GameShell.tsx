import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, MonitorSmartphone, ShieldCheck } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

export default function GameShell({ title, subtitle, onBack, children }: Props) {
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
        <div className="game-header-meta" aria-label="Game availability">
          <span><MonitorSmartphone size={16} /> Touch ready</span>
          <span><ShieldCheck size={16} /> No sign-in</span>
        </div>
      </header>
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
