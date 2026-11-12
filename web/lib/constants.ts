/**
 * Named constants for the whole web app. No magic numbers or
 * storyline strings elsewhere.
 */
import type { Channel, Currency } from "./types";

/** Where the core API lives; override with NEXT_PUBLIC_API_URL. */
export const API_URL =
   process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** The fictional seller every screen speaks for. */
export const SELLER_NAME = "Rangrez Studio";
export const SELLER_CITY = "Jaipur";

/** Fixed conversation id of the owner's chat. */
export const OWNER_CONVERSATION_ID = "owner";

/** The "new buyer" the demo starts with (storyline step 1). */
export const NEW_CUSTOMER_ID = "c_emma";
export const NEW_CUSTOMER_NAME = "Emma";
export const NEW_CUSTOMER_COUNTRY = "GB";
export const NEW_CUSTOMER_CHANNEL: Channel = "dm";

/** Emma's storyline lines (SPEC v2 steps 1, 3, 4), one tap each. */
export const STORY_ASK_TEXT =
   "Hi! Do you ship to the UK? How much for 2 block-print " +
   "cushion covers and the brass diya set?";
export const STORY_DISCOUNT_TEXT =
   "Could you do a discount if I take 4 covers?";
export const STORY_GO_TEXT = "Great, go ahead.";

/** Seller-chat storyline lines (step 7); Hinglish is accepted. */
export const STORY_OWNER_TEXT = "kis kis ka payment pending hai?";
export const STORY_OWNER_REMIND_TEXT = "sabko reminder bhej do";

/** Polling and timing, in milliseconds. */
export const HEALTH_POLL_MS = 6000;
export const STAMP_SLAM_MS = 2800;
export const EVENT_RETRY_MS = 3000;

/** Money symbols per payable currency (PayPal-supported four). */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
   USD: "$", GBP: "£", EUR: "€", AUD: "A$",
};
export const RUPEE_SYMBOL = "₹";

/** Generic channel tags: never a real chat or social app name. */
export const CHANNEL_LABEL: Record<Channel, string> = {
   dm: "DM", email: "Email", chat: "Chat",
};

/** Display names for buyer countries (ISO-2 -> name). */
export const COUNTRY_NAME: Record<string, string> = {
   GB: "United Kingdom", US: "United States", DE: "Germany",
   AU: "Australia", FR: "France", CA: "Canada", AE: "UAE",
   NL: "Netherlands", IE: "Ireland",
};

/** Names of the SSE events the core emits. */
export const EVENT_ORDER_UPDATED = "order.updated";
export const EVENT_MESSAGE_CREATED = "message.created";

/** Time unit helpers for the "age" column. */
export const MS_PER_MINUTE = 60_000;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;

/** Grid sizing, in pixels. */
export const GRID_ROW_HEIGHT = 62;
export const GRID_HEADER_HEIGHT = 36;

/** Below this width the orders grid switches to compact columns. */
export const NARROW_GRID_PX = 760;
