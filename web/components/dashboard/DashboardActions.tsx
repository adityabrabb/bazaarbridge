"use client";
/**
 * Two dashboard-wide actions: "Send reminders" (nudges every unpaid
 * customer, storyline step 7) and "Reset demo" (reseeds /data).
 */

type Props = {
   unpaidCount: number;
   busy: boolean;
   onRemindAll: () => void;
   onReset: () => void;
};

/** Renders the big red reminder button and a quiet reset button. */
export function DashboardActions(
   { unpaidCount, busy, onRemindAll, onReset }: Props,
) {
   return (
      <div className="dashactions">
         <button className="btn btn--red" onClick={onRemindAll}
            disabled={busy || unpaidCount === 0}>
            Send reminders ({unpaidCount})
         </button>
         <button className="btn btn--small" onClick={onReset}
            disabled={busy}>
            Reset demo
         </button>
      </div>
   );
}
