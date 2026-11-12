# BazaarBridge

**The export sales desk for a small Indian craft seller.** A buyer abroad asks for a price in chat. An AI agent quotes in the buyer's currency with shipping, negotiates inside the seller's limits, sends a PayPal pay link and invoice, confirms the payment, keeps an evidence pack for every order, and chases unpaid invoices. The seller sees everything in rupees.

Built for the PayPal AI Hackathon.

**Live demo:** https://bazaarbridge.vercel.app/demo (demo mode: rule-based agent and a labelled mock PayPal with a "Simulate payment" button; no keys needed) · **Video:** https://youtu.be/IrV6PjmurOk (the same flow on the real PayPal sandbox with Gemini)

## The problem

A two-person block-print studio in Jaipur gets enquiries from London, Berlin and New York. Each one needs a quote in a foreign currency, a shipping estimate, an invoice and a follow-up. Large exporters have a sales desk for this. Small sellers answer late, guess at exchange rates, and lose track of who has paid.

## What it does

| Step | What happens | PayPal + AI |
|---|---|---|
| 1 | Buyer asks for a price in plain English | Agent reads the message and finds the catalog items |
| 2 | Agent replies with a quote in GBP, USD, EUR or AUD, with shipping and delivery time | Prices are computed in code from the seller's rupee price list; the model never sets a price |
| 3 | Buyer asks for a discount | Agent offers the seller's bulk discount and politely refuses to go below the seller's floor |
| 4 | Buyer confirms | Agent creates a **PayPal order** (Orders v2) in the buyer's currency and posts the pay link |
| 5 | Buyer pays | Payment is captured through PayPal; the dashboard flips to PAID live and an invoice is issued: a **PayPal invoice** (Invoicing v2) when Invoicing is enabled on the account, otherwise the app's own invoice page tied to the PayPal capture ID |
| 6 | Seller opens the evidence pack | Chat transcript, quote, invoice and PayPal payment record in one document, ready if the buyer disputes |
| 7 | Seller asks "kis kis ka payment pending hai?" | Agent lists unpaid invoices across currencies and sends reminders with pay links |

## Run it (3 commands)

Needs Node 22.18 or newer (built on Node 24).

```bash
npm run setup
cp .env.example .env    # optional; see below
npm run dev
```

Open http://localhost:3000 for the landing page and http://localhost:3000/demo for the live demo.

**It runs with no keys at all.** Without a `.env`, the AI falls back to a rule-based parser and PayPal falls back to a labelled mock with a "simulate payment" button. The badges in the top right of the demo show which mode is active.

### With the real PayPal sandbox and a real model

1. Create a sandbox app at developer.paypal.com → Apps & Credentials (Sandbox). Copy the Client ID and Secret.
2. Fill in `.env`:

   ```
   PAYPAL_ENV=sandbox
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   LLM_PROVIDER=gemini        # or anthropic
   LLM_API_KEY=...
   ```
3. `npm run dev`, open `/demo`, tap Emma's first message and follow the chat.
4. Click the pay button and log in with your sandbox **personal** test account (developer.paypal.com → Testing Tools → Sandbox Accounts) to pay.
5. Back in the demo the order turns PAID.

For invoices, tick **Invoicing** under the sandbox app's features. If it is off, the pay link and capture still work and the app issues its own invoice page that shows the PayPal capture ID.

### Tests

```bash
npm test
```

59 tests: the quote engine, the full demo storyline over HTTP, and every PayPal and model request shape against a stubbed network.

## How it is built

```
/core   Node + TypeScript API on port 8787 (no build step)
   src/agent/     tool-calling loop; Gemini, Anthropic and mock providers
   src/quote/     currency, shipping zones, bulk discount (pure code)
   src/paypal/    OAuth, Orders v2, Invoicing v2, webhook signature check
   src/orders/    order lifecycle, evidence pack
   src/http/      REST endpoints + server-sent events
/web    Next.js app on port 3000: landing page, buyer chat, seller dashboard
/data   JSON file store (created on first run)
```

The agent has eight tools: `search_catalog`, `get_quote`, `confirm_order`, `check_payment`, `send_invoice`, `list_unpaid`, `send_reminder`, `get_stats`. Money decisions stay in code: the model chooses which tool to call, and the quote engine and PayPal decide the numbers and the payment state. A paid status is only ever set from PayPal's own API response.

## AI tools used

| Tool | Used for |
|---|---|
| Google Gemini (`gemini-3.8-flash`, falling back to lighter flash models when overloaded) | The sales agent at runtime: understanding buyer and seller messages and choosing tools |
| Anthropic Claude (optional runtime provider, `LLM_PROVIDER=anthropic`) | Same agent role, alternative provider |
| Claude Code (Claude models) | Writing and reviewing the code, tests and this documentation |

## PayPal products used

| Product | Used for |
|---|---|
| Orders v2 | Create an order in the buyer's currency, approval link, capture |
| Invoicing v2 | Create and send the invoice, record the payment (needs Invoicing enabled on the app; the demo video uses the in-app invoice fallback) |
| Webhooks | Signature verification; a webhook only triggers a re-check against the API |
| Sandbox | All of the above; no real money moves |

Sponsor tool: the seller's orders table uses **AG Grid** Community.

## Limits

- One fictional seller (Rangrez Studio, Jaipur) and a fixed catalog.
- Exchange rates are a fixed table with a date, not a live feed.
- Shipping is a flat rate per zone.
- The buyer chat is a web chat that stands in for a seller's inbox; it is not connected to any messaging service.

## Licence

MIT. See `LICENSE`.
