/**
 * Tabs for choosing which buyer's phone to look at. The seed
 * buyers have unpaid invoices, which makes the reminder step
 * (storyline 7) visible in their chat.
 */
import type { Customer } from "@/hooks/useCustomers";

type Props = {
   customers: Customer[];
   activeId: string;
   onPick: (id: string) => void;
};

/** Renders one pill per customer. */
export function CustomerSwitcher({ customers, activeId, onPick }: Props) {
   return (
      <div className="switcher" role="tablist" aria-label="Customer">
         <span className="switcher__label">Buyer's phone</span>
         {customers.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === activeId}
               className={`pill ${c.id === activeId ? "pill--on" : ""}`}
               onClick={() => onPick(c.id)}>
               {c.name}
            </button>
         ))}
      </div>
   );
}
