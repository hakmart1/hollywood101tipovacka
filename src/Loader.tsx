// A film-themed pending loader: an old hand-crank movie camera whose two reels
// and side crank spin together. SMIL <animateTransform> keeps rotation reliable
// across browsers without extra CSS.
export default function Loader({ label = "Načítání…" }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <svg
        className="loader-cam"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        {/* camera body + lens */}
        <rect x="6" y="30" width="38" height="22" rx="3" fill="#374151" />
        <rect x="43" y="36" width="7" height="10" rx="1.5" fill="#374151" />
        <circle cx="52" cy="41" r="4.6" fill="#4b5563" stroke="#374151" strokeWidth="1.5" />
        <circle cx="52" cy="41" r="1.7" fill="#e6b800" />

        {/* side crank (spins) */}
        <g>
          <rect x="2.4" y="43" width="7" height="2.6" rx="1.3" fill="#6b7280" />
          <circle cx="3" cy="44.3" r="2.7" fill="#e6b800" />
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 9 44.3"
            to="360 9 44.3"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </g>
        <circle cx="9" cy="44.3" r="2" fill="#374151" />

        {/* big reel (spins) */}
        <g>
          <circle cx="19" cy="19" r="10.5" fill="#374151" stroke="#6b7280" strokeWidth="1.5" />
          <circle cx="19" cy="12.6" r="1.9" fill="#eef0f3" />
          <circle cx="24.6" cy="16.3" r="1.9" fill="#eef0f3" />
          <circle cx="24.6" cy="21.7" r="1.9" fill="#eef0f3" />
          <circle cx="19" cy="25.4" r="1.9" fill="#eef0f3" />
          <circle cx="13.4" cy="21.7" r="1.9" fill="#eef0f3" />
          <circle cx="13.4" cy="16.3" r="1.9" fill="#eef0f3" />
          <circle cx="19" cy="19" r="2.7" fill="#e6b800" />
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 19 19"
            to="360 19 19"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </g>

        {/* small reel (spins) */}
        <g>
          <circle cx="36" cy="22" r="7" fill="#374151" stroke="#6b7280" strokeWidth="1.3" />
          <circle cx="36" cy="17.5" r="1.4" fill="#eef0f3" />
          <circle cx="40" cy="20.4" r="1.4" fill="#eef0f3" />
          <circle cx="38.5" cy="25.3" r="1.4" fill="#eef0f3" />
          <circle cx="33.5" cy="25.3" r="1.4" fill="#eef0f3" />
          <circle cx="32" cy="20.4" r="1.4" fill="#eef0f3" />
          <circle cx="36" cy="22" r="1.9" fill="#e6b800" />
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 36 22"
            to="360 36 22"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </g>
      </svg>
      {label ? <span className="loader-label">{label}</span> : null}
    </div>
  );
}
