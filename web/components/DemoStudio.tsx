"use client";
/**
 * The /demo screen: buyer phone on the left, seller dashboard on
 * the right, glued together by live events. This component owns all
 * state (health, orders, both conversations) and every API action,
 * and passes plain props to the presentational pieces.
 */
import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
   NEW_CUSTOMER_ID, OWNER_CONVERSATION_ID, SELLER_CITY, SELLER_NAME,
} from "@/lib/constants";
import { quickLinesFor } from "@/lib/quickLines";
import { useConversation } from "@/hooks/useConversation";
import { useCustomers } from "@/hooks/useCustomers";
import { useEventStream } from "@/hooks/useEventStream";
import { useHealth } from "@/hooks/useHealth";
import { useOrders } from "@/hooks/useOrders";
import { ChatThread } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { CustomerSwitcher } from "@/components/chat/CustomerSwitcher";
import { PhoneFrame } from "@/components/chat/PhoneFrame";
import type { AttachmentContext } from "@/components/chat/attachmentContext";
import { Logo } from "@/components/common/Logo";
import { ModeBadges } from "@/components/common/ModeBadges";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { GridContext } from "@/components/dashboard/OrderActions";
import { PaidSlam } from "@/components/dashboard/PaidSlam";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";

/** Whole demo page body. */
export function DemoStudio() {
   const { health, online, checked } = useHealth();
   const orders = useOrders(online);
   const { customers, reload: reloadCustomers } = useCustomers(online);
   const [activeId, setActiveId] = useState(NEW_CUSTOMER_ID);
   const [busyId, setBusyId] = useState<string | null>(null);
   const [bulkBusy, setBulkBusy] = useState(false);
   const [notice, setNotice] = useState<string | null>(null);
   const [evidenceId, setEvidenceId] = useState<string | null>(null);

   const active = customers.find((c) => c.id === activeId)
      ?? customers[0];
   const customerChat = useConversation(
      active.id, "customer", active.name, online,
      { country: active.country, channel: active.channel });
   const ownerChat = useConversation(
      OWNER_CONVERSATION_ID, "owner", "Owner", online);

   // One live stream feeds orders and both chats.
   const streaming = useEventStream({
      onOrder: orders.applyOrder,
      onMessage: (m) => {
         customerChat.addLive(m);
         ownerChat.addLive(m);
      },
   });

   /** Runs an API action; any failure becomes a visible notice. */
   const guard = useCallback(async (fn: () => Promise<void>) => {
      try {
         setNotice(null);
         await fn();
      } catch {
         setNotice("That did not go through. Check the API and retry.");
      }
   }, []);

   /** Customer-side send, then refresh orders in case SSE is down. */
   const sendCustomer = useCallback(async (text: string) => {
      await customerChat.send(text);
      if (!streaming) await orders.reload();
   }, [customerChat, orders, streaming]);

   /** Simulates payment (mock PayPal only). */
   const simulate = useCallback(async (id: string) => {
      setBusyId(id);
      await guard(async () => orders.applyOrder(await api.simulate(id)));
      setBusyId(null);
   }, [guard, orders]);

   /** Re-checks one order with PayPal. */
   const refresh = useCallback(async (id: string) => {
      setBusyId(id);
      await guard(async () => orders.applyOrder(await api.refresh(id)));
      setBusyId(null);
   }, [guard, orders]);

   /** Sends one reminder; the nudge lands in that customer's chat. */
   const remind = useCallback(async (id: string) => {
      setBusyId(id);
      await guard(async () => {
         const res = await api.remind(id);
         orders.applyOrder(res.order);
         customerChat.addLive(res.message);
      });
      setBusyId(null);
   }, [guard, orders, customerChat]);

   /** Storyline step 7: remind every unpaid order. */
   const remindAll = useCallback(async () => {
      setBulkBusy(true);
      const unpaid = orders.orders.filter(
         (o) => o.status === "awaiting_payment");
      for (const o of unpaid) await remind(o.id);
      setBulkBusy(false);
   }, [orders.orders, remind]);

   /** Reseeds the demo data and reloads every panel. */
   const reset = useCallback(async () => {
      setBulkBusy(true);
      await guard(async () => {
         await api.reset();
         setActiveId(NEW_CUSTOMER_ID);
         await Promise.all([
            orders.reload(), reloadCustomers(),
            customerChat.reload(), ownerChat.reload(),
         ]);
      });
      setBulkBusy(false);
   }, [guard, orders, reloadCustomers, customerChat, ownerChat]);

   const mockPayPal = health?.paypal === "mock";
   const paidIds = useMemo(
      () => new Set(orders.orders.filter((o) => o.status === "paid")
         .map((o) => o.id)),
      [orders.orders]);
   const attachCtx: AttachmentContext = {
      paidOrderIds: paidIds, mockPayPal, onSimulate: simulate,
   };
   const gridCtx: GridContext = {
      mockPayPal, busyId, onEvidence: setEvidenceId,
      onRefresh: refresh, onRemind: remind, onSimulate: simulate,
   };

   return (
      <div className="stage">
         <header className="topbar">
            <Logo onDark />
            <span className="topbar__tag">LIVE DEMO</span>
            <span className="topbar__seller">
               {SELLER_NAME}, {SELLER_CITY}
            </span>
            <span className="topbar__spacer" />
            <ModeBadges health={health} />
         </header>
         {checked && !online ? <OfflineBanner /> : null}
         {notice ? <div className="notice" role="alert">{notice}</div> : null}
         <main className="split">
            <section className="split__phone" aria-label="Buyer chat">
               <CustomerSwitcher customers={customers}
                  activeId={active.id} onPick={setActiveId} />
               <PhoneFrame name={active.name} country={active.country}
                  channel={active.channel}>
                  <ChatThread messages={customerChat.messages}
                     viewer="customer" ctx={attachCtx}
                     sending={customerChat.sending}
                     emptyHint="A buyer abroad is about to write. Tap the line below." />
                  {customerChat.error ? (
                     <p className="inlineerr">{customerChat.error}</p>
                  ) : null}
                  <Composer onSend={sendCustomer}
                     disabled={customerChat.sending || !online}
                     placeholder="Type a message"
                     quickLines={quickLinesFor(customerChat.messages)} />
               </PhoneFrame>
            </section>
            <section className="split__dash" aria-label="Seller dashboard">
               <Dashboard orders={orders.orders} stats={orders.stats}
                  error={orders.error} gridContext={gridCtx}
                  ownerChat={ownerChat} busy={bulkBusy}
                  onRemindAll={remindAll} onReset={reset} />
            </section>
         </main>
         <PaidSlam order={orders.justPaid} />
         <EvidenceDrawer onClose={() => setEvidenceId(null)}
            order={orders.orders.find((o) => o.id === evidenceId) ?? null}
         />
      </div>
   );
}
