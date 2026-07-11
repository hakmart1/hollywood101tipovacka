import { useState } from "react";
import { accuracyRewardBreakdown, guessError } from "../functions/_lib/scoring";

const GUESS_COST = 100_000;

function formatCoins(amount: number): string {
  return `${amount < 0 ? "−" : ""}${Math.abs(amount).toLocaleString("cs-CZ")}`;
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

function RewardCalculator() {
  const [guess, setGuess] = useState("");
  const [actual, setActual] = useState("");

  const guessM = parseMillions(guess);
  const actualM = parseMillions(actual);
  const guessR = guessM === null ? null : roundToStep(guessM);
  const actualR = actualM === null ? null : roundToStep(actualM);
  const ready = guessR !== null && actualR !== null && actualR > 0;

  const error = ready ? guessError(guessR, actualR) : 0;
  const { linear, flat } = ready ? accuracyRewardBreakdown(error) : { linear: 0, flat: 0 };
  const reward = linear + flat;
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
          <label htmlFor="calc-actual">Tržby (v milionech)</label>
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
          <div className="reward-calc-row">
            <span>Odchylka</span>
            <strong>{(error * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %</strong>
          </div>
          <div className="reward-calc-row">
            <span>Lineární odměna</span>
            <strong className={linear > 0 ? "amount-plus" : undefined}>
              {linear > 0 ? "+" : ""}
              {formatCoins(linear)}
            </strong>
          </div>
          <div className="reward-calc-row">
            <span>Pevný bonus</span>
            <strong className={flat > 0 ? "amount-plus" : undefined}>
              {flat > 0 ? "+" : ""}
              {formatCoins(flat)}
            </strong>
          </div>
          <div className="reward-calc-row">
            <span>Odměna za přesnost celkem</span>
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
      <p>Skládá se ze dvou částí, které se sčítají:</p>
      <ul>
        <li>
          <strong>Lineární část</strong> — čím přesnější tip, tím vyšší: <strong>0–200 000</strong>{" "}
          Imfcoinů. Dokonalý tip má plných 200 000 a s rostoucí odchylkou rovnoměrně klesá až na
          nulu na <strong>±40 %</strong>.
        </li>
        <li>
          <strong>Pevný bonus</strong> podle pásma odchylky: do <strong>±20 %</strong> navíc{" "}
          <strong>+100 000</strong>, v pásmu <strong>20–40 %</strong> navíc <strong>+50 000</strong>.
          Nad ±40 % nezískáte nic.
        </li>
      </ul>
      <p className="rules-note">
        Dohromady tak dokonalý tip vynese <strong>300 000</strong>, tip na ±20 %{" "}
        <strong>200 000</strong> a na ±40 % <strong>50 000</strong>. Tip stojí 100 000 Imfcoinů, takže
        se vyplatí zhruba do ±30 % odchylky — konkrétní výpočet máš v kalkulačce níže.
      </p>

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
        Na bonusy za umístění mají nárok jen tipy do ±40 % — i pro umístění tedy záleží na
        přesnosti.
      </p>

      <h3>Bonusy za tipovačku (celkově)</h3>
      <p>
        Abyste měli nárok, musíte tipnout <strong>každý film</strong> v tipovačce. Způsobilí hráči se
        pak seřadí podle <strong>celkové odchylky v dolarech</strong> přes všechny filmy (jak dobře
        jste celkově hospodařili) — vyhrává nejnižší souhrnná odchylka:
      </p>
      <ul>
        <li>Nejlepší celkově: <strong>+200 000</strong></li>
        <li>2. celkově: <strong>+150 000</strong></li>
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
