/**
 * Which storyline lines Emma's phone offers as one-tap chips,
 * decided from the thread itself so the demo can never be tapped
 * out of order: ask, then discount or go-ahead, then nothing.
 */
import {
   STORY_ASK_TEXT, STORY_DISCOUNT_TEXT, STORY_GO_TEXT,
} from "./constants";
import type { Message } from "./types";

/** True when any message in the thread carries this card type. */
function hasCard(messages: Message[], type: string): boolean {
   return messages.some((m) => m.attachments?.some((a) => a.type === type));
}

/** Returns the chips to show for the current state of the chat. */
export function quickLinesFor(messages: Message[]): string[] {
   if (hasCard(messages, "pay_link")) return [];
   if (hasCard(messages, "quote")) {
      const asked = messages.some((m) => m.text === STORY_DISCOUNT_TEXT);
      return asked ? [STORY_GO_TEXT] : [STORY_DISCOUNT_TEXT, STORY_GO_TEXT];
   }
   return messages.length === 0 ? [STORY_ASK_TEXT] : [];
}
