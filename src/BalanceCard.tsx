import type { ReactNode } from "react";
import imfCoinImage from "./imf.webp";

function CoinIcon() {
  return (
    <svg
      className="balance-coin"
      width="56"
      height="56"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <defs>
        {/* portrait fills most of the coin; only a slim ring carries the legend */}
        <clipPath id="imfcoin-face">
          <circle cx="32" cy="32" r="24" />
        </clipPath>
        {/* desaturate, then brighten + raise contrast so the face reads as bright engraving */}
        <filter id="imfcoin-engrave">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.7" intercept="-0.1" />
            <feFuncG type="linear" slope="1.7" intercept="-0.1" />
            <feFuncB type="linear" slope="1.7" intercept="-0.1" />
          </feComponentTransfer>
        </filter>
        {/* top legend sits just outside the portrait; bottom a touch further out so
            neither row crosses the rim edge */}
        <path id="imfcoin-top" d="M 7.2 32 A 24.8 24.8 0 0 1 56.8 32" fill="none" />
        <path id="imfcoin-bottom" d="M 5.5 32 A 26.5 26.5 0 0 0 58.5 32" fill="none" />
      </defs>

      {/* coin body + rim */}
      <circle cx="32" cy="32" r="30" fill="#e8b923" stroke="#b8860b" strokeWidth="2.5" />

      {/* portrait fills the inner circle, stamped into gold */}
      <g clipPath="url(#imfcoin-face)">
        <circle cx="32" cy="32" r="24.5" fill="#dba916" />
        <image
          href={imfCoinImage}
          x="7.5"
          y="6.5"
          width="49"
          height="49"
          preserveAspectRatio="xMidYMid slice"
          filter="url(#imfcoin-engrave)"
          style={{ mixBlendMode: "multiply" }}
        />
      </g>
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#b8860b" strokeWidth="0.8" />
    </svg>
  );
}

// The gold "Imfcoiny" balance card (coin + big number), shared by Můj účet and
// the public player profile. `aside` is shown on the right (e.g. the rank).
export default function BalanceCard({ balance, aside }: { balance: number; aside?: ReactNode }) {
  return (
    <div className="balance-card">
      <CoinIcon />
      <div className="balance-body">
        <span className="balance-label">Imfcoiny</span>
        <span className="balance-value">{balance.toLocaleString("en-US")}</span>
      </div>
      {aside ? <div className="balance-aside">{aside}</div> : null}
    </div>
  );
}
