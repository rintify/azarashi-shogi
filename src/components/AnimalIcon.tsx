import type { Kind } from '../game/types';

/** Small, authored animal portraits remain legible in the compact stock bars. */
export function AnimalIcon({
  kind,
  promoted = false,
  className = '',
}: {
  kind: Kind;
  promoted?: boolean;
  className?: string;
}) {
  const dark = kind === 'orca' || kind === 'penguin' || (kind === 'seal' && promoted);
  const coat = dark ? '#30415a' : kind === 'walrus' ? '#d5a78c' : '#fffdf4';
  return (
    <svg
      className={`animal-icon ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      stroke="#30415a"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'bear' && (
        <g fill={coat}>
          <circle cx="16" cy="16" r="9" />
          <circle cx="48" cy="16" r="9" />
        </g>
      )}
      {kind === 'orca' && (
        <path d="M26 17 35 4 39 20M12 42 3 49 13 51M52 42 61 49 51 51" fill={coat} />
      )}
      {kind === 'seal' && <path d="m13 40-10 9 15 1m33-10 10 9-15 1" fill={coat} />}
      <path d="M9 35C9 18 18 12 32 12s23 6 23 23c0 14-10 21-23 21S9 49 9 35Z" fill={coat} />
      {kind === 'penguin' && (
        <path
          d="M18 39c0-12 6-15 14-15s14 3 14 15c0 10-6 15-14 15s-14-5-14-15Z"
          fill="#fffdf4"
          stroke="none"
        />
      )}
      {kind === 'orca' && (
        <g fill="#fffdf4" stroke="none">
          <ellipse cx="19" cy="32" rx="8" ry="6" transform="rotate(-20 19 32)" />
          <ellipse cx="45" cy="32" rx="8" ry="6" transform="rotate(20 45 32)" />
          <path d="M22 46q10-12 20 0-10 10-20 0" />
        </g>
      )}
      <g fill={dark && kind === 'seal' ? '#fffdf4' : '#30415a'} stroke="none">
        <ellipse cx="23" cy="32" rx="2.3" ry="3" />
        <ellipse cx="41" cy="32" rx="2.3" ry="3" />
      </g>
      <g fill="#f4a7ad" stroke="none" opacity=".65">
        <ellipse cx="17" cy="39" rx="4" ry="2.5" />
        <ellipse cx="47" cy="39" rx="4" ry="2.5" />
      </g>
      {kind === 'penguin' ? (
        <path d="m27 37 5 6 5-6Z" fill="#ffc765" stroke="#d99a45" />
      ) : (
        <>
          {kind === 'walrus' && (
            <g fill="#fff8e7" strokeWidth="1.8">
              <path d="M22 39q-1 16 4 18l3-18Z" />
              <path d="M35 39q1 16 4 18l3-18Z" />
            </g>
          )}
          <path d="m29 37 3 3 3-3Z" fill="#30415a" />
          <path
            d="M32 40v3m-5 0q5 5 10 0"
            fill="none"
            stroke={dark && kind === 'seal' ? '#fffdf4' : '#30415a'}
            strokeWidth="1.8"
          />
          {kind === 'seal' && (
            <path
              d="m13 39 9 1m-8 4 8-2m20-2 9-1m-9 3 8 2"
              stroke={dark ? '#fffdf4' : '#688198'}
              strokeWidth="1.3"
            />
          )}
        </>
      )}
      {kind === 'walrus' && (
        <path
          d="m22 13-2-10 10 5 6-6 6 7 5-4-2 10Z"
          fill="#ffdc72"
          stroke="#cb9544"
          strokeWidth="1.8"
        />
      )}
      {promoted && kind !== 'seal' && (
        <path
          d="m50 3-5 12h6l-3 10L61 10h-8l3-7Z"
          fill="#ffdc72"
          stroke="#cb9544"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}
