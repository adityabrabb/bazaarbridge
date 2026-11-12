"use client";
/**
 * Full-stage PAID moment. When an order flips to paid, a huge
 * stamp slams over the demo for a couple of seconds so it reads
 * on a compressed video. Clicking it dismisses it early.
 */
import { useEffect, useState } from "react";
import { PaidStamp } from "@/components/common/PaidStamp";
import { STAMP_SLAM_MS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { Order } from "@/lib/types";

/** Shows for STAMP_SLAM_MS each time `order` changes. */
export function PaidSlam({ order }: { order: Order | null }) {
   const [visible, setVisible] = useState(false);

   useEffect(() => {
      if (!order) return;
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), STAMP_SLAM_MS);
      return () => clearTimeout(timer);
   }, [order]);

   if (!order || !visible) return null;
   return (
      <div className="slam" onClick={() => setVisible(false)}
         role="status">
         <div className="slam__shade" />
         <div className="slam__body">
            <PaidStamp slam size="xl"
               caption={`${order.customerName} / ${money(order.total, order.currency)}`} />
         </div>
      </div>
   );
}
