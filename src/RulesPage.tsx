export default function RulesPage() {
  return (
    <section className="rules-page">
      <h2>Jak fungují tipovačky a odměny</h2>

      <h3>Jak hrát tipovačku</h3>
      <ul>
        <li>Když je tipovačka otevřená, tipujete celkové tržby každého filmu.</li>
        <li>Tipy se zadávají v milionech na 2 desetinná místa (např. 123,45 = 123 450 000 $).</li>
        <li>Každý tip stojí <strong>100 000</strong> IMF coinů a je konečný.</li>
        <li>
          Po skončení tipovačky a zadání skutečných tržeb se tipovačka vyhodnotí a vyplatí se
          odměny.
        </li>
      </ul>

      <h3>Odměna za přesnost (za tip)</h3>
      <ul>
        <li>
          Pokud je váš tip do <strong>±25 %</strong> od skutečného výsledku, získáte zpět váš vklad{" "}
          <strong>100 000</strong> IMF coinů.
        </li>
        <li>
          Navíc bonus za přesnost až <strong>100 000</strong> IMF coinů podle toho, jak blízko jste
          byli: dokonalý tip získá plnou částku a na hranici 25 % klesá k nule.
        </li>
        <li>
          Tip v rozmezí tedy vynese <strong>100 000</strong> až <strong>200 000</strong> IMF coinů. Tipy
          mimo ±25 % nezískají nic.
        </li>
      </ul>

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

      <h3>IMF coiny a záchranné balíčky</h3>
      <ul>
        <li>Nově aktivované účty začínají s <strong>2 000 000</strong> IMF coiny.</li>
        <li>
          Pokud váš zůstatek klesne na <strong>200 000</strong> nebo níže, můžete požádat o záchranný
          balíček IMF ve výši <strong>500 000</strong> mincí — jednou za 14 dní.
        </li>
      </ul>
    </section>
  );
}
