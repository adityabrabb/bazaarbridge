/**
 * What attachment cards need to know about the outside world:
 * which orders are already paid, whether PayPal is in mock mode
 * (only then is the "simulate payment" control shown), and the
 * callback that simulates a payment.
 */
export type AttachmentContext = {
   paidOrderIds: Set<string>;
   mockPayPal: boolean;
   onSimulate: (orderId: string) => Promise<void>;
};

/** Context used when a thread has no payment features (owner chat). */
export const NO_PAYMENT_CONTEXT: AttachmentContext = {
   paidOrderIds: new Set(),
   mockPayPal: false,
   onSimulate: async () => undefined,
};
