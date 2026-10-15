import type { Kind } from '../game/types';
/** Hand-drawn silhouette vocabulary shared by every inventory and dialog. */
const silhouettes: Record<Kind, string> = {
  seal: 'M7 44c3-9 10-10 18-9 3-10 8-17 18-17 10 0 15 10 11 18-3 7-12 10-21 10l-8 8-6-3 3-7-11 3-8-5 4-6Z',
  penguin:
    'M23 22c-1-7 3-13 9-13s10 6 9 13c8 7 9 19 6 27l8 7-13 1-10-4-10 4-13-1 8-7c-3-8-2-20 6-27Zm-2 7-12 13 3 5 9-6m22-12 12 13-3 5-9-6',
  bear: 'M9 30c1-10 12-12 22-9l8-7 8 1 3 7 9 6-2 9-10 2-3 14-7 0-2-15-13 0-3 15-7 0 1-16-4-7Z',
  orca: 'M6 36c4-9 13-15 26-14l5-14 8 15c6 2 10 6 13 10l-2 12-9-2-9 9-7-3 5-8c-11 4-20 3-27 1l-6 9-2-12 5-3Z',
  walrus:
    'M8 35c0-13 9-22 24-22s24 9 24 22c0 9-5 15-14 17l-3-20-5 0-2 24-2-24-5 0-3 20C13 50 8 44 8 35Z',
};
export function AnimalIcon({
  kind,
  promoted = false,
  className = '',
}: {
  kind: Kind;
  promoted?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`animal-icon ${className}`}
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={silhouettes[kind]} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      {kind === 'seal' && <circle cx="45" cy="25" r="2" fill="var(--icon-cutout,#123346)" />}
      {kind === 'penguin' && (
        <ellipse cx="32" cy="36" rx="8" ry="12" fill="var(--icon-cutout,#123346)" />
      )}
      {kind === 'orca' && (
        <ellipse cx="17" cy="32" rx="5" ry="2.7" fill="var(--icon-cutout,#123346)" />
      )}
      {promoted && <path d="m50 5-7 12h7l-3 9L60 11h-8l3-6Z" fill="#f6bf6a" />}
    </svg>
  );
}
