import { t, useLanguage } from "../i18n";
import { Children, cloneElement, isValidElement, createContext, useCallback, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Minimize2 } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

export const ChallengeFullscreenContext = createContext<ReactNode>(null);

export const GameFullscreenContext = createContext<{
  playAreaRef: RefObject<HTMLDivElement>;
  fullscreenActive: boolean;
  pseudoFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  setPlayAreaReady?: (ready:boolean) => void;
  paused: boolean;
  setPaused: (paused:boolean) => void;
} | null>(null);

export default function GamePlayArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  useLanguage();
  const challengeProgress = useContext(ChallengeFullscreenContext);
  const fullscreen = useContext(GameFullscreenContext);
  const localRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const surfaceClasses = /(?:^| )(canvas-frame|sticks-board|carom-board|can-scene|sling-scene|sky-cabinet|galaxy-cabinet)(?: |$)/;
  const items = Children.toArray(children);
  const surfaces = items.filter(child => isValidElement<{className?:string}>(child) && surfaceClasses.test(child.props.className ?? ''));
  const controls = items.filter(child => !surfaces.includes(child)).map(child => {
    if (!className.includes('arcade-play-area') || !isValidElement<{className?:string;children?:ReactNode}>(child) || child.props.className !== 'arcade-controls') return child;
    return cloneElement(child, {}, child.props.children, <button key="shared-pause" className="secondary-button" onClick={() => fullscreen?.setPaused(!fullscreen.paused)}>{t(fullscreen?.paused ? 'Resume' : 'Pause')}</button>);
  });
  const exitRef = useRef<HTMLButtonElement>(null);
  const active = fullscreen?.fullscreenActive ?? false;
  const pseudo = fullscreen?.pseudoFullscreen ?? false;
  const playAreaRef = fullscreen?.playAreaRef;
  const setPlayAreaReady = fullscreen?.setPlayAreaReady;
  const registerPlayArea = useCallback((node:HTMLDivElement|null) => {
    localRef.current=node;
    if(playAreaRef) (playAreaRef as {current:HTMLDivElement|null}).current=node;
    setPlayAreaReady?.(Boolean(node));
  }, [playAreaRef,setPlayAreaReady]);

  useEffect(() => {
    if (challengeProgress && !active) localRef.current?.scrollIntoView({block:'start',behavior:'instant'});
  }, [playAreaRef]);

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

  useEffect(() => {
    const slot = slotRef.current, root = localRef.current;
    if (!slot || !root) return;
    const measure = () => {
      const board = slot.firstElementChild as HTMLElement | null;
      if (!board) return;
      const shooter = root.matches('.sky-play-area,.galaxy-play-area');
      const screen = shooter ? board.querySelector<HTMLElement>('.sky-screen,.galaxy-screen') : board;
      if (!screen) return;
      const landscape = root.clientWidth > root.clientHeight * 1.15;
      root.dataset.wide = String(landscape);
      const rect = slot.getBoundingClientRect();
      let width = rect.width, height = rect.height;
      if (shooter) {
        const controls = board.querySelector<HTMLElement>('.sky-controls,.galaxy-controls');
        if (landscape) width -= (controls?.offsetWidth ?? 130) + 12;
        else height -= (controls?.offsetHeight ?? 110) + 8;
      }
      const ratio = shooter ? 2/3 : root.matches('.marbles-play-area') ? 900/700 : root.matches('.sticks-play-area') ? 900/560 : root.matches('.sling-play-area') ? 1200/620 : 1;
      const fittedWidth = Math.max(1, Math.min(width, height * ratio));
      screen.style.setProperty('--fit-width', `${fittedWidth}px`);
      screen.style.setProperty('--fit-height', `${fittedWidth / ratio}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root); observer.observe(slot);
    for (const child of Array.from(root.querySelectorAll('.game-essential-controls,.sky-controls,.galaxy-controls'))) observer.observe(child);
    const viewport = () => { root.style.setProperty('--viewport-height', `${window.visualViewport?.height ?? window.innerHeight}px`); measure(); };
    window.visualViewport?.addEventListener('resize', viewport);
    window.addEventListener('resize', viewport); viewport();
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener('resize',viewport); window.removeEventListener('resize',viewport); };
  }, [className, active]);

  return (
    <div onClickCapture={event => {
      if (!active && event.target instanceof Element && event.target.closest('button,summary')) {
        const root=localRef.current, rect=root?.getBoundingClientRect();
        if (rect && (rect.top>1 || rect.bottom>window.innerHeight)) root?.scrollIntoView({block:'start',behavior:'instant'});
      }
    }} ref={registerPlayArea} className={`play-column game-play-area measured-game-layout ${className}${active ? " is-fullscreen" : ""}${pseudo ? " is-pseudo-fullscreen" : ""}`.trim()}>
      {active && (
        <div className="game-fullscreen-toolbar">
          <LanguageSwitcher />
          {challengeProgress}
          <button ref={exitRef} type="button" className="game-fullscreen-button" aria-label={t(pseudo ? "Exit immersive view" : "Exit fullscreen")} title={pseudo ? t("Immersive view uses the browser window.") : undefined} onClick={fullscreen?.toggleFullscreen}>
            <Minimize2 size={17} aria-hidden="true" /> <span className="fullscreen-exit-label">{t(pseudo ? "Exit immersive view" : "Exit fullscreen")}</span><span className="fullscreen-exit-short">{t("Exit")}</span></button>
        </div>
      )}
      <div className="game-board-slot" ref={slotRef}>{surfaces}</div>
      <div className="game-essential-controls">{controls}</div>
    </div>
  );
}
