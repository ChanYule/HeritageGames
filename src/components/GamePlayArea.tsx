import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Minimize2 } from "lucide-react";

export const GameFullscreenContext = createContext<{
  playAreaRef: RefObject<HTMLDivElement>;
  fullscreenActive: boolean;
  pseudoFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
} | null>(null);

export default function GamePlayArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  const fullscreen = useContext(GameFullscreenContext);
  const exitRef = useRef<HTMLButtonElement>(null);
  const active = fullscreen?.fullscreenActive ?? false;
  const pseudo = fullscreen?.pseudoFullscreen ?? false;
  const playAreaRef = fullscreen?.playAreaRef;

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement;
    exitRef.current?.focus({ preventScroll: true });
    return () => {
      queueMicrotask(() => {
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
      });
    };
  }, [active]);

  useEffect(() => {
    const playArea = playAreaRef?.current;
    if (!pseudo || !playArea) return;
    // Keep the hidden page out of keyboard navigation in the CSS fallback.
    const hidden: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = playArea;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          hidden.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    return () => hidden.forEach(({ element, inert }) => { element.inert = inert; });
  }, [pseudo, playAreaRef]);

  return (
    <div ref={playAreaRef} className={`play-column game-play-area ${className}${active ? " is-fullscreen" : ""}${pseudo ? " is-pseudo-fullscreen" : ""}`.trim()}>
      {active && (
        <div className="game-fullscreen-toolbar">
          <button ref={exitRef} type="button" className="game-fullscreen-button" onClick={fullscreen?.toggleFullscreen}>
            <Minimize2 size={17} /> Exit fullscreen
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
