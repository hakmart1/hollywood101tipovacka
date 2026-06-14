// Cron Worker: evaluate rounds whose scheduled time has arrived. Reuses the
// Pages app's evaluateRound (which re-checks all prerequisites, so a round that
// became non-evaluable since scheduling is safely skipped — race-condition guard).
import { evaluateRound } from "../../functions/_lib/evaluate";

interface ScheduledRoundRow {
  id: number;
}

export default {
  async scheduled(_event: unknown, env: { DB: D1Database }): Promise<void> {
    const now = new Date().toISOString();

    const due = await env.DB.prepare(
      `SELECT id FROM rounds
        WHERE evaluated_date IS NULL
          AND scheduled_evaluation_date IS NOT NULL
          AND scheduled_evaluation_date <= ?1`
    ).bind(now).all<ScheduledRoundRow>();

    for (const round of due.results) {
      try {
        const result = await evaluateRound(env, round.id);
        if (result.error) {
          // Not evaluable right now (e.g. a result was just removed). Leave the
          // schedule; if it's transient the next run succeeds, and removing a
          // result already clears the schedule via the admin API.
          console.warn(`Scheduled evaluation skipped for round ${round.id}: ${result.error}`);
        } else {
          console.log(`Scheduled evaluation done for round ${round.id}: ${result.message}`);
        }
      } catch (error) {
        console.error(`Scheduled evaluation failed for round ${round.id}`, error);
      }
    }
  }
};
