// -----------------------------------------------------------------------
// hinglish-parser.test.ts
// Purpose: the mock brain's item and intent parsing on the v2 storyline
//          messages (English buyer, Hinglish seller).
// -----------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
   customerIntent,
   discountAsked,
   mentionsWeek,
   ownerIntent,
   parseItems,
} from "../src/agent/mock/hinglish-parser.ts";
import { SEED_CATALOG } from "../src/store/seed-data.ts";

// -----------------------------------------------------------------------
// lines
// Purpose: "SKU:qty" strings for compact assertions.
// -----------------------------------------------------------------------
function lines(text: string): string[] {
   return parseItems(text, SEED_CATALOG).map((l) => `${l.sku}:${l.qty}`);
}

const intent = (t: string) => customerIntent(t, SEED_CATALOG);

describe("parseItems", () => {
   it("handles storyline message 1", () => {
      assert.deepEqual(
         lines(
            "Hi! Do you ship to the UK? How much for 2 block-print " +
               "cushion covers and the brass diya set?",
         ),
         ["CUSHION-BP:2", "DIYA-BRASS:1"],
      );
   });

   it("handles storyline message 3 and number words", () => {
      assert.deepEqual(
         lines("Could you do a discount if I take 4 covers?"),
         ["CUSHION-BP:4"],
      );
      assert.deepEqual(lines("two scarves and a quilt"), [
         "SCARF-BP:2",
         "QUILT-HQ:1",
      ]);
   });

   it("does not read Hindi 'do' as 2, and finds no items in chatter", () => {
      assert.deepEqual(lines("scarf bhej do"), ["SCARF-BP:1"]);
      assert.deepEqual(lines("Great, go ahead."), []);
   });

   it("understands dozen and plural names", () => {
      assert.deepEqual(lines("1 dozen tote bags"), ["TOTE-BP:12"]);
      assert.deepEqual(lines("3 pairs of jhumka earrings"), [
         "EARRING-JHUMKA:3",
      ]);
   });
});

describe("customerIntent", () => {
   it("classifies the storyline messages", () => {
      assert.equal(intent("Do you ship to the UK? 2 cushion covers"), "items");
      assert.equal(intent("Any discount?"), "discount");
      assert.equal(intent("Great, go ahead."), "confirm");
      assert.equal(intent("I have paid"), "paid");
      assert.equal(intent("payment done"), "paid");
      assert.equal(intent("can I get the invoice"), "invoice");
      assert.equal(intent("no, cancel it"), "cancel");
      assert.equal(intent("hello there"), "other");
   });
});

describe("discountAsked", () => {
   it("reads a named percentage or a bare request", () => {
      assert.deepEqual(discountAsked("can you do 20% off?"), {
         asked: true,
         pct: 20,
      });
      assert.deepEqual(discountAsked("any discount for me?"), {
         asked: true,
         pct: 0,
      });
      assert.deepEqual(discountAsked("2 scarves"), { asked: false, pct: 0 });
   });
});

describe("ownerIntent", () => {
   it("understands the seller's Hinglish", () => {
      assert.equal(ownerIntent("kis kis ka payment pending hai?"), "unpaid");
      assert.equal(ownerIntent("who hasn't paid this week?"), "unpaid");
      assert.equal(ownerIntent("haan, sabko reminder bhej do"), "remind");
      assert.equal(ownerIntent("kitna collect hua?"), "stats");
      assert.equal(ownerIntent("hello"), "other");
   });

   it("detects 'this week'", () => {
      assert.equal(mentionsWeek("is hafte kaun pending hai"), true);
      assert.equal(mentionsWeek("kaun pending hai"), false);
   });
});
