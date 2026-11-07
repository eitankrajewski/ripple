import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { active?: boolean; alert?: boolean };

const Shadow = () => <ellipse cx="60" cy="88" rx="42" ry="5" fill="rgba(0,0,0,0.07)" />;

export function OrdersArt({ active, ...p }: P) {
  return (
    <svg viewBox="0 0 120 96" {...p}>
      <Shadow />
      <g className={active ? "bob" : undefined}>
        <rect x="44" y="6" width="32" height="30" rx="3" fill="#fff" stroke="#e1e4e8" strokeWidth="2" />
        <rect x="49" y="13" width="22" height="3" rx="1.5" fill="#ff3008" />
        <rect x="49" y="20" width="16" height="3" rx="1.5" fill="#c9ced6" />
        <rect x="49" y="26" width="19" height="3" rx="1.5" fill="#c9ced6" />
      </g>
      <rect x="22" y="30" width="76" height="54" rx="12" fill="#4b4b4b" />
      <rect x="27" y="35" width="66" height="44" rx="8" fill="#ddf4ff" />
      <rect x="33" y="41" width="30" height="6" rx="3" fill="#1cb0f6" />
      <rect x="33" y="52" width="54" height="5" rx="2.5" fill="#fff" />
      <rect x="33" y="61" width="44" height="5" rx="2.5" fill="#fff" />
      <rect x="33" y="70" width="24" height="5" rx="2.5" fill="#58cc02" />
      <circle cx="84" cy="44" r="5" fill="#ff4b4b" />
    </svg>
  );
}

export function PantryArt({ alert, ...p }: P) {
  const item = (c: string) => (alert ? "#d6d9de" : c);
  return (
    <svg viewBox="0 0 120 96" {...p}>
      <Shadow />
      <rect x="28" y="4" width="64" height="82" rx="10" fill="#e9eef3" stroke="#d3dae2" strokeWidth="2" />
      <rect x="33" y="10" width="54" height="70" rx="6" fill="#f8fbff" />
      <rect x="33" y="33" width="54" height="3" fill="#d3dae2" />
      <rect x="33" y="57" width="54" height="3" fill="#d3dae2" />
      <path d="M40 30c0-6 4-10 9-10s8 3 8 7c0 3-2 5-5 5h-9c-2 0-3-1-3-2z" fill={item("#f4a340")} />
      <rect x="54" y="25" width="7" height="4" rx="2" fill={item("#fff1db")} />
      <circle cx="71" cy="26" r="6" fill="#ff4b4b" />
      <circle cx="79" cy="27" r="5" fill="#ff6b6b" />
      <path d="M39 53c3-9 13-9 16 0z" fill="#58cc02" />
      <path d="M62 54l18-9v9z" fill="#ffc800" />
      <rect x="40" y="65" width="12" height="11" rx="3" fill="#c98a52" />
      <rect x="56" y="65" width="12" height="11" rx="3" fill="#c98a52" />
      <rect x="72" y="65" width="10" height="11" rx="3" fill="#f2e3c6" />
      <rect x="86" y="30" width="3" height="22" rx="1.5" fill="#b8c2cc" />
      {alert && (
        <g>
          <circle cx="92" cy="12" r="10" fill="#ff4b4b" />
          <rect x="91" y="6" width="2.4" height="8" rx="1.2" fill="#fff" />
          <circle cx="92.2" cy="17" r="1.5" fill="#fff" />
        </g>
      )}
    </svg>
  );
}

export function PrepArt({ active, ...p }: P) {
  return (
    <svg viewBox="0 0 120 96" {...p}>
      <Shadow />
      <rect x="14" y="48" width="84" height="34" rx="10" fill="#e5a46b" />
      <rect x="14" y="44" width="84" height="34" rx="10" fill="#f2bb82" />
      <circle cx="90" cy="61" r="4" fill="#e5a46b" />
      <g className={active ? "bob" : undefined}>
        <path d="M30 14l46 30-6 6-44-28z" fill="#dfe6ec" stroke="#c4ced8" strokeWidth="1.5" />
        <rect x="18" y="4" width="16" height="9" rx="4" transform="rotate(33 26 8)" fill="#4b4b4b" />
      </g>
      <circle cx="38" cy="60" r="8" fill="#ff4b4b" />
      <circle cx="38" cy="60" r="5" fill="#ff8a8a" />
      <circle cx="54" cy="64" r="8" fill="#ff4b4b" />
      <circle cx="54" cy="64" r="5" fill="#ff8a8a" />
      <path d="M64 56c6-8 18-8 22 2-4 6-16 8-22-2z" fill="#58cc02" />
      <path d="M66 57c6 1 12 1 18 1" stroke="#46a302" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function CookArt({ active, alert, ...p }: P) {
  return (
    <svg viewBox="0 0 120 96" {...p}>
      <Shadow />
      <rect x="16" y="56" width="88" height="28" rx="8" fill="#4b4b4b" />
      <circle cx="34" cy="70" r="4" fill="#777" />
      <circle cx="86" cy="70" r="4" fill="#777" />
      <rect x="16" y="50" width="88" height="10" rx="4" fill="#5e5e5e" />
      <g transform="translate(60 52)">
        {[-12, 0, 12].map((x, i) => (
          <path
            key={x}
            className={active ? "flicker" : undefined}
            style={{ animationDelay: `${i * 0.15}s` }}
            d={`M${x} 0c-5-4-3-10 0-14 3 4 5 10 0 14z`}
            fill={alert ? "#ff4b4b" : "#ff9600"}
          />
        ))}
        {[-8, 6].map((x) => (
          <path key={x} className={active ? "flicker" : undefined} d={`M${x} 0c-2-2-2-5 0-7 2 2 2 5 0 7z`} fill="#ffc800" />
        ))}
      </g>
      <rect x="26" y="30" width="60" height="12" rx="6" fill="#3c3c3c" />
      <rect x="84" y="33" width="26" height="6" rx="3" fill="#3c3c3c" />
      <ellipse cx="50" cy="31" rx="10" ry="4" fill="#9a5a2e" />
      <ellipse cx="66" cy="31" rx="9" ry="3.6" fill="#c47a3c" />
      {active && (
        <g stroke="#c4c8ce" strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path className="steam" d="M46 22c-3-4 3-6 0-10" />
          <path className="steam" style={{ animationDelay: "0.8s" }} d="M58 22c-3-4 3-6 0-10" />
          <path className="steam" style={{ animationDelay: "1.6s" }} d="M70 22c-3-4 3-6 0-10" />
        </g>
      )}
    </svg>
  );
}

export function PackArt({ active, ...p }: P) {
  return (
    <svg viewBox="0 0 120 96" {...p}>
      <Shadow />
      <g className={active ? "bob" : undefined}>
        <path d="M28 30h44l4 54H24z" fill="#d9a066" />
        <path d="M28 30h44l-4-10H32z" fill="#c48a52" />
        <path d="M28 30h44l4 54H50z" fill="#e6b47e" opacity="0.6" />
        <circle cx="50" cy="56" r="10" fill="#fff" opacity="0.9" />
        <path d="M45 56l4 4 7-8" stroke="#58cc02" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M80 44h20l-3 40H83z" fill="#1cb0f6" />
      <rect x="78" y="38" width="24" height="7" rx="3" fill="#1899d6" />
      <rect x="92" y="22" width="3" height="18" rx="1.5" transform="rotate(12 93 30)" fill="#ff4b4b" />
      <rect x="82" y="56" width="16" height="4" rx="2" fill="#fff" opacity="0.7" />
    </svg>
  );
}

export function PickupArt({ active, ...p }: P) {
  return (
    <svg viewBox="0 0 120 96" {...p}>
      <Shadow />
      <g className={active ? "bob" : undefined}>
        <rect x="18" y="28" width="30" height="26" rx="6" fill="#ff4b4b" />
        <rect x="18" y="28" width="30" height="7" rx="3" fill="#d93a3a" />
        <path d="M24 54h56l8-16h8l-10 22H30z" fill="#58cc02" />
        <path d="M84 38l6-14h8" stroke="#4b4b4b" strokeWidth="4" strokeLinecap="round" fill="none" />
        <rect x="58" y="44" width="18" height="8" rx="4" fill="#46a302" />
      </g>
      <circle cx="32" cy="74" r="10" fill="#4b4b4b" />
      <circle cx="32" cy="74" r="4" fill="#c4c8ce" />
      <circle cx="88" cy="74" r="10" fill="#4b4b4b" />
      <circle cx="88" cy="74" r="4" fill="#c4c8ce" />
    </svg>
  );
}
