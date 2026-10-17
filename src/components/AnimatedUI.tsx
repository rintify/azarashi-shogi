import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DialogHTMLAttributes,
  type ReactNode,
} from 'react';

const EXIT_MS = 180;
const timing = { '--ui-exit-duration': `${EXIT_MS}ms` } as CSSProperties;
const ExitContext = createContext(false);

/** Retain the last visible content while it exits; obsolete controls become inert immediately. */
export function AnimatedPresence({
  show,
  children,
  className = '',
  exitDurationMs = EXIT_MS,
  onPresenceChange,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  exitDurationMs?: number;
  onPresenceChange?: (present: boolean) => void;
}) {
  const [retained, setRetained] = useState(show);
  const [lastChildren, setLastChildren] = useState(children);
  useLayoutEffect(() => {
    if (show) {
      setRetained(true);
      setLastChildren(children);
    }
  }, [show, children]);
  useEffect(() => {
    if (show) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setRetained(false), reduced ? 0 : exitDurationMs);
    return () => window.clearTimeout(timer);
  }, [show, exitDurationMs]);
  useEffect(() => onPresenceChange?.(show || retained), [show, retained, onPresenceChange]);
  if (!show && !retained) return null;
  return (
    <ExitContext.Provider value={!show}>
      <div
        className={`ui-presence ${className}`}
        style={{ '--ui-exit-duration': `${exitDurationMs}ms` } as CSSProperties}
        data-state={show ? 'enter' : 'exit'}
        inert={!show}
        aria-hidden={!show || undefined}
      >
        {show ? children : lastChildren}
      </div>
    </ExitContext.Provider>
  );
}

/** Shared native modality, dismissal and focus behavior for every game popup. */
export function GameDialog({
  onDismiss,
  dismissOnBackdrop = true,
  children,
  ...props
}: Omit<DialogHTMLAttributes<HTMLDialogElement>, 'onCancel' | 'onClick'> & {
  onDismiss: () => void;
  dismissOnBackdrop?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const exiting = useContext(ExitContext);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      {...props}
      ref={ref}
      inert={exiting}
      onCancel={(event) => {
        event.preventDefault();
        if (!exiting) onDismiss();
      }}
      onClick={(event) => {
        if (dismissOnBackdrop && !exiting && event.target === event.currentTarget) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}

/** Crossfade changing copy/icons without changing their layout or announcing outgoing text. */
export function AnimatedValue({
  valueKey,
  children,
}: {
  valueKey: string | number;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState({ key: valueKey, children });
  const [previous, setPrevious] = useState<typeof current | null>(null);
  if (current.key !== valueKey) {
    setPrevious(current);
    setCurrent({ key: valueKey, children });
  }
  useEffect(() => {
    const timer = window.setTimeout(() => setPrevious(null), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [valueKey]);
  return (
    <span className="ui-swap" style={timing}>
      {previous && (
        <span className="ui-swap-old" key={`old-${previous.key}`} aria-hidden="true">
          {previous.children}
        </span>
      )}
      <span className="ui-swap-current" key={valueKey}>
        {children}
      </span>
    </span>
  );
}

/** Animate content height, including settings modes whose fields have different heights. */
export function AnimatedSize({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setHeight(element.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="ui-size" style={{ height }}>
      <div ref={ref}>{children}</div>
    </div>
  );
}
