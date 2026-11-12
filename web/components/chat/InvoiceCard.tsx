/**
 * Invoice attachment: a export-invoice style row with a link that opens
 * the invoice in a new tab.
 */
import { billNo } from "@/lib/format";
import type { Attachment } from "@/lib/types";

type Invoice = Extract<Attachment, { type: "invoice" }>;

/** Renders the invoice as a small ruled invoice with an open link. */
export function InvoiceCard({ invoice }: { invoice: Invoice }) {
   return (
      <a className="invoice" href={invoice.url} target="_blank"
         rel="noopener noreferrer">
         <span className="invoice__tag">INVOICE</span>
         <span className="invoice__no">{billNo(invoice.orderId)}</span>
         <span className="invoice__open">Open invoice &rarr;</span>
      </a>
   );
}
