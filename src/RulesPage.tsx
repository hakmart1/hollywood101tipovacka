import { useState } from "react";
import { BASE_REWARD, PRECISION_REWARD, QUALIFY_MARGIN, guessError } from "../functions/_lib/scoring";

const GUESS_COST = 100_000;

function formatCoins(amount: number): string {
  return `${amount < 0 ? "−" : ""}${Math.abs(amount).toLocaleString("cs-CZ")}`;
}

function formatMillions1(millions: number): string {
  return millions.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Guesses and actual results are stored to 1 decimal place in millions (step
// 0.1 M = 100,000 $) — see functions/api/contests/guess.ts. Round inputs the
// same way so the calculator can't show a payout the real game never produces.
function roundToStep(millions: number): number {
  return Math.round(millions * 10) / 10;
}

function parseMillions(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Accuracy reward for a single guess vs. the actual result — the self-contained
// part of the payout. Mirrors the formula in functions/_lib/scoring.ts.
function accuracyReward(error: number): number {
  if (error > QUALIFY_MARGIN) {
    return 0;
  }
  const scale = Math.max(0, Math.min(1, (QUALIFY_MARGIN - error) / QUALIFY_MARGIN));
  return BASE_REWARD + Math.round(PRECISION_REWARD * scale);
}

function RewardCalculator() {
  const [guess, setGuess] = useState("");
  const [actual, setActual] = useState("");

  const guessM = parseMillions(guess);
  const actualM = parseMillions(actual);
  const guessR = guessM === null ? null : roundToStep(guessM);
  const actualR = actualM === null ? null : roundToStep(actualM);
  const ready = guessR !== null && actualR !== null && actualR > 0;

  const error = ready ? guessError(guessR, actualR) : 0;
  const qualifies = ready && error <= QUALIFY_MARGIN;
  const reward = ready ? accuracyReward(error) : 0;
  const net = reward - GUESS_COST;

  return (
    <div className="reward-calc">
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="calc-guess">Tvůj tip (v milionech)</label>
          <input
            id="calc-guess"
            type="text"
            inputMode="decimal"
            placeholder="např. 55"
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="calc-actual">Skutečný výsledek (v milionech)</label>
          <input
            id="calc-actual"
            type="text"
            inputMode="decimal"
            placeholder="např. 50"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
          />
        </div>
      </div>

      {ready ? (
        <div className="reward-calc-result">
          <p className="reward-calc-effective">
            Počítáno s tipem <strong>{formatMillions1(guessR!)} M</strong> a výsledkem{" "}
            <strong>{formatMillions1(actualR!)} M</strong> (zaokrouhleno na 0,1 M, jako v tipovačce).
          </p>
          <div className="reward-calc-row">
            <span>Odchylka</span>
            <strong>
              {(error * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %{" "}
              <span className={qualifies ? "calc-ok" : "calc-bad"}>
                ({qualifies ? "v rozmezí ±25 %" : "mimo ±25 %"})
              </span>
            </strong>
          </div>
          <div className="reward-calc-row">
            <span>Odměna za přesnost</span>
            <strong className={reward > 0 ? "amount-plus" : undefined}>
              {reward > 0 ? "+" : ""}
              {formatCoins(reward)} Imfcoinů
            </strong>
          </div>
          <div className="reward-calc-row reward-calc-net">
            <span>Čistý výsledek (po odečtení vkladu {formatCoins(GUESS_COST)})</span>
            <strong className={net > 0 ? "amount-plus" : net < 0 ? "calc-bad" : undefined}>
              {net > 0 ? "+" : ""}
              {formatCoins(net)} Imfcoinů
            </strong>
          </div>
          <p className="rules-note">
            Toto je jen odměna za přesnost. K ní se ještě mohou přičíst bonusy za umístění (za film
            i za celou tipovačku), které závisí na tom, jak si vedou ostatní hráči.
          </p>
        </div>
      ) : (
        <p className="guess-hint">Zadej svůj tip a skutečný výsledek a uvidíš orientační odměnu.</p>
      )}
    </div>
  );
}

export default function RulesPage() {
  return (
    <section className="rules-page">
      <h2>Jak fungují tipovačky a odměny</h2>

      <h3>Jak hrát tipovačku</h3>
      <ul>
        <li>Když je tipovačka otevřená, tipujete celkové tržby každého filmu.</li>
        <li>Tipy se zadávají v milionech na 1 desetinné místo (např. 123,4 = 123 400 000 $).</li>
        <li>Každý tip stojí <strong>100 000</strong> Imfcoinů a je konečný.</li>
        <li>
          Po skončení tipovačky a zadání skutečných tržeb se tipovačka vyhodnotí a vyplatí se
          odměny.
        </li>
      </ul>

      <h3>Odměna za přesnost (za tip)</h3>
      <ul>
        <li>
          Pokud je váš tip do <strong>±25 %</strong> od skutečného výsledku, získáte zpět váš vklad{" "}
          <strong>100 000</strong> Imfcoinů.
        </li>
        <li>
          Navíc bonus za přesnost až <strong>100 000</strong> Imfcoinů podle toho, jak blízko jste
          byli: dokonalý tip získá plnou částku a na hranici 25 % klesá k nule.
        </li>
        <li>
          Tip v rozmezí tedy vynese <strong>100 000</strong> až <strong>200 000</strong> Imfcoinů. Tipy
          mimo ±25 % nezískají nic.
        </li>
      </ul>

      <h3>Vyzkoušej si odměnu</h3>
      <p>Spočítej si, kolik by vynesl konkrétní tip oproti skutečnému výsledku:</p>
      <RewardCalculator />

      <h3>Bonusy za umístění (za film)</h3>
      <p>Nad rámec odměny za přesnost získají nejbližší tipy u každého filmu navíc:</p>
      <ul>
        <li>Nejlepší tip: <strong>+50 000</strong></li>
        <li>2. nejlepší: <strong>+35 000</strong></li>
        <li>3. nejlepší: <strong>+20 000</strong></li>
        <li>Ostatní v nejlepších 20 % tipů: <strong>+10 000</strong></li>
      </ul>
      <p className="rules-note">
        Na bonusy za umístění mají nárok jen tipy do ±25 % — i pro umístění tedy záleží na
        přesnosti.
      </p>

      <h3>Bonusy za tipovačku (celkově)</h3>
      <p>
        Abyste měli nárok, musíte tipnout <strong>každý film</strong> v tipovačce. Způsobilí hráči se
        pak seřadí podle <strong>celkové odchylky v dolarech</strong> přes všechny filmy (jak dobře
        jste celkově hospodařili) — vyhrává nejnižší souhrnná odchylka:
      </p>
      <ul>
        <li>Nejlepší celkově: <strong>+175 000</strong></li>
        <li>2. celkově: <strong>+135 000</strong></li>
        <li>3. celkově: <strong>+100 000</strong></li>
        <li>Ostatní v nejlepších 20 % způsobilých hráčů: <strong>+50 000</strong></li>
      </ul>

      <h3>Imfcoiny a záchranné balíčky</h3>
      <ul>
        <li>Nově aktivované účty začínají s <strong>2 000 000</strong> Imfcoiny.</li>
        <li>
          Pokud váš zůstatek klesne na <strong>200 000</strong> nebo níže, můžete požádat o záchranný
          balíček ve výši <strong>500 000</strong> Imfcoinů — jednou za 14 dní.
        </li>
      </ul>
    </section>
  );
}
