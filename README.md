# AccessProof

**Global AI Hackathon · Tavily Research Agent extension**

Research practical venue accessibility questions with Tavily, inspect cited source clues, review a specific question, and watch an attributed representative reply update the comparison through Nexconn.

The baseline MVP was built for Beyond 9TO5 on 21 November 2026. This repository extends that existing project with Tavily for the Global AI Hackathon; it does not claim all work was created within that event’s original build window. Eligibility for reused work and a later final-submission window must be confirmed with the organizers.

A Next.js + TypeScript MVP for finding venues and comparing explicit accessibility evidence.

**[Watch the 3-minute film and open the deck](https://gowtham66867.github.io/accessproof/)**

Hosted preview: https://accessproof-412542191970.asia-southeast1.run.app

The hosted preview requires a demo passphrase. The passphrase is saved privately in `.data/cloud-run-passphrase.txt`; do not commit or publish it. The application and URL use AccessProof branding.

## Run locally

Requires Node.js 24 or newer (confirmation rooms use Node’s built-in SQLite).

```sh
npm install
npm run dev
```

Open http://localhost:3000. The initial view uses **fictional demo data**, without an API key. All demo venues, addresses, ratings, and reports are illustrative. Demo search is a fixed Indiranagar example; switch to Live search to enter a different location or venue type.

## Enable real venue search

Copy `.env.example` to `.env.local`, set `SERPAPI_API_KEY` to your own SerpApi key, and restart the server. Select **Live search**, enter a venue type and location, and click **Find places**. Keep the key server-side; never use a `NEXT_PUBLIC_` variable for it.

Live search retrieves up to five venues and up to five detail responses: **at most six SerpApi requests per search**. Place IDs or CIDs identify detail requests. Partial detail failures retain the venue with an explicit warning. A failed live search preserves previous results and never silently substitutes demo data.

After setting your key, run `npm run test:live` to retrieve real cafés in Indiranagar, Bengaluru. This uses up to six API requests and prints venue addresses, evidence statuses, exact listing attributes, and source links without printing the key. Check returned addresses yourself: a locality search can include nearby results. Unknown attributes are expected when listing information is missing.

## Included

- Venue search route: `GET /api/venues?mode=live&q=cafes&location=Indiranagar%2C%20Bengaluru`.
- Fixed demo route: `GET /api/venues?mode=demo`.
- Requirement toggles, comparison table, sorting, and an all-selected-features filter.
- Supporting, unavailable, conflicting, and unknown evidence states.
- Keyboard-accessible native evidence dialogs with exact attributes, listing links, and retrieval timestamps.
- Session preferences and shortlist survive refresh in the current tab; new searches clear the shortlist. Specific needs remain explicitly unconfirmed until addressed.
- Venues in columns and features in rows, with sticky headers, inspectable sources, editable questions, and a private visit-summary download.
- A live evidence moment shows previous/new status, representative attribution, report time, retained contradictions, and a conversation link.
- Responsive layout, loading, error, empty, and partial-result states.
- Nexconn confirmation rooms with separate visitor and representative invite links, live table updates, delivery retries, and persistent transcripts.

## Evidence rules

The live provider reads exact wheelchair-accessibility attributes from Google Maps `extensions` and `unsupported_extensions`. It does not infer accessibility from star ratings, general amenities, photos, or the absence of an attribute. Missing evidence stays unknown; contradictory attributes remain conflicting. Listing contributor identity and publication dates are unavailable and are not invented. Retrieval time is not verification time.

The current three requirements are wheelchair-accessible entrance, seating, and toilet. **Wheelchair-accessible seating does not establish ground-floor seating.** No venue is labeled independently verified. An invited representative can add an attributed, dated feature report; their identity and venue ownership are not verified by this MVP. Only definite reports with acknowledged delivery enter the comparison table. “I need to check” stays in the conversation and does not resolve an unknown. Existing negative reports remain, so a new positive answer can produce a conflict. Live review parsing and You.com enrichment are not implemented yet.

The hosted search endpoint requires the demo session. Identical searches are reused for 10 minutes, in-flight requests are coalesced, and fresh searches are capped at 10/hour per running instance. These in-process limits reset on restarts. Before a public launch, add individual authentication and a durable per-user request quota. This MVP is intended for local development and a controlled buildathon demo.

## Nexconn setup

In the Nexconn console, create/select a Chat application and use credentials from the same app environment. Set these **server-only** fields in `.env.local` and restart the server:

```dotenv
NEXCONN_APP_KEY=your-app-key
NEXCONN_APP_SECRET=your-app-secret
NEXCONN_REGION=SG
```

Supported regions are `SG`, `NA`, and `SA`; API domains are selected from Nexconn’s documented regional domains. An optional `NEXCONN_API_BASE_URL` override must also use a documented Nexconn HTTPS domain. The App Secret signs server-to-server API calls and never reaches the browser. Each room provisions two synthetic user identities and a private group. The browser loads `@nexconn/chat` only on the client and subscribes to group events. AccessProof saves and authorizes messages on the server, publishes them through Nexconn, and re-fetches the evidence snapshot when the SDK receives an event. Directly forging a provider message cannot forge table evidence.

Rooms expire after 24 hours. Separate 256-bit invite capabilities grant visitor or representative access; only hashes are stored in SQLite. Invite keys enter via URL fragments, are moved into tab-scoped session storage, and are sent to the server in Authorization headers. Do not share the representative invite publicly. The creator retains it so they can invite their chosen participant. No email or SMS invitation is sent automatically.

Locally, SQLite stores room snapshots, Nexconn user tokens, and transcripts in ignored `.data/confirmations.sqlite`. Use a private persistent directory (`ACCESSPROOF_DATA_DIR`) if running outside this checkout. With `ACCESSPROOF_STORAGE=firestore`, rooms use the private `accessproof_rooms` Firestore collection instead. Firestore transactions preserve message IDs and evidence across Cloud Run restarts. Creation is bounded to 30 rooms/hour. The hosted build requires a signed, HTTP-only demo session before live searches or room creation; invite holders can access only their own room via its capability. A public product still needs individual sign-in, representative onboarding, and per-user quotas.

### Side-by-side view

After creating a room, choose **Open side-by-side demo**. `/demo` embeds the visitor’s comparison table on the left and the representative’s reply form on the right. Each iframe has its own Nexconn SDK context and identity. The private room context is kept in the current browser tab’s session; opening `/demo` in a fresh tab offers a one-click fictional scenario using a real Nexconn room. **Start a fresh demo** creates a clean scenario without changing prior reports. The representative must submit the reply themselves to trigger the live update.

## Cloud Run hosting

The deployment uses request-based billing, 0 minimum / 1 maximum instance, 1 vCPU, 512 MiB memory, concurrency 40, and no startup CPU boost. It uses an existing free-tier-enabled Firestore database. No load balancer, Cloud SQL instance, custom-domain mapping, DNS change, paid subscription, or always-on instance was created. Free allowances are shared with other usage on the billing account; usage beyond them can be billed.

The multi-stage `Dockerfile` uses Node 24 and Next.js standalone output. `.dockerignore` and `.gcloudignore` exclude `.env*`, `.data`, screenshots, and local build output. Runtime provider credentials are supplied through the private `.data/cloud-run-env.json` file at deployment, never baked into the container. Only cloud administrators can inspect the service’s runtime configuration. Cloud Run is publicly reachable at the infrastructure layer; AccessProof’s own passphrase session protects its main page and credit-consuming endpoints. Unauthorized live search returns 401. Private room links remain independently capability-protected.

Firestore settings: `ACCESSPROOF_STORAGE=firestore`, `FIRESTORE_DATABASE_ID=(default)`, and `GOOGLE_CLOUD_PROJECT` set to the deployment project. The runtime service account needs the Datastore User role. Logical 24-hour room expiry is handled by the app; paid managed TTL, backups, and PITR were not enabled.

For hosted integration checks, set `ACCESSPROOF_TEST_ORIGIN` and `ACCESSPROOF_DEMO_PASSWORD` before running `npm run test:chat`. The test logs in without printing the passphrase, then verifies real Nexconn delivery, Firestore-backed room reads, role authorization, and idempotent replies using a fictional venue.

### Standout demo: unknown → representative report

1. Use **Demo data** (fictional venues, real Nexconn transport).
2. Choose **Start the live evidence demo**, or inspect an unknown cell and review/edit the question before choosing **Ask the venue · Nexconn**.
3. The visitor’s question is saved and delivered to a new private group.
4. The side-by-side page shows the visitor and representative in separate SDK contexts. Both should show **Nexconn connected**.
5. Choose **Prepare the fictional demo reply**. Review the answer and explanation; nothing is submitted automatically. Ordinary representative forms default to **Unsure**.
6. Click **Send report & update table**. In the visitor tab, the toilet changes to **Reported available**, the card highlights **Previously unknown**, and the main comparison updates without refresh. Open the cell to inspect its author, timestamp, and retained evidence.
7. Send **Unsure · I need to check** for another unknown to show that uncertainty is preserved. A contradictory report should produce **Conflicting reports**, never overwrite earlier evidence.

The representative page survives refresh using its tab session. The main page restores the active search/room within the current tab session. Starting a new search clears that active room from the main page; the original private room links remain valid until expiry. Transcripts and evidence survive server restarts on the same disk.

**Local rehearsal** is a separate explicit option. It syncs via one-second HTTP reads from the local server, not Nexconn, and shows a persistent rehearsal banner. It never silently replaces failed Nexconn delivery. It is available in development; production requires `ACCESSPROOF_ENABLE_REHEARSAL=true`.

With the app running, `npm run test:chat` exercises the real Nexconn API using a fictional venue: token issuance, group creation, delivery acknowledgement, authorization, and idempotent retries. It creates two test users and a group and sends synthetic demo messages. Browser QA additionally verifies SDK connections and real-time cross-tab updates.

## Validate

```sh
npm test
npm run typecheck
npm run build
```

Tests cover evidence semantics, contradictory attributes, missing data, bounded provider calls, partial failures, and safe error handling using mocked HTTP responses. A real SerpApi search requires your key and is not covered by these checks.

## Demo walkthrough

1. Start in **Demo data** and inspect The Open Table’s supporting reports.
2. Inspect Little Courtyard’s entrance to see contradictory reports.
3. Inspect Juniper Coffee House’s unknown toilet and its suggested follow-up question.
4. Toggle a requirement; filter to venues with all selected features reported.
5. Save a venue and open **Session shortlist**.
6. Configure SerpApi and run **Live search** to demonstrate real source-backed attributes.

## Main files

- `components/access-proof.tsx`: interactive search, comparison table, and evidence dialogs.
- `lib/evidence.ts`: shared types, attribute extraction, and evidence status rules.
- `lib/serpapi.ts`: server-side search and bounded place enrichment.
- `lib/demo.ts`: clearly fictional sample dataset.
- `app/api/venues/route.ts`: validated server endpoint and safe error responses.
- `components/confirmation-room.tsx`: visitor/representative chat, source cards, and update feedback.
- `lib/nexconn-server.ts` / `lib/nexconn-client.ts`: signed API calls and real SDK event subscriptions.
- `lib/room-store.ts`: private SQLite transcripts, role authorization, and snapshot generation.
- `lib/confirmation.ts`: delivered messages to attributed evidence; contradictions are retained.

## API references

- [SerpApi Google Maps API](https://serpapi.com/google-maps-api)
- [Place results and accessibility extensions](https://serpapi.com/maps-place-results)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Nexconn request signing](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth)
- [Nexconn group messages](https://docs.nexconn.ai/platform-chat-api/message/send-group)
- [Nexconn SDK message listeners](https://docs.nexconn.ai/chatsdk-web/message/receive)

## Visit planning and trust

Optional session preferences support entrance, seating, and toilet details, such as an 85 cm doorway or transfer-side space. AccessProof does not infer those measurements from general listing attributes. Questions are editable before room creation; only the reviewed question and venue snapshot enter the room. There is no automatic email, SMS, or real-business outreach.

Shortlist a venue and download a plain-text visit summary with address, feature states, sources, dates, and unanswered details. Private room capabilities and transcript history are excluded. This is a local download, not public sharing.

The live transition is announced through an ARIA status region, highlights its table cell briefly, and never replays a new-answer celebration after reload. Reports themselves survive reload and persist in Firestore on the hosted service. Keyboard focus, native dialogs, a skip link, reduced-motion handling, horizontal table navigation, and mobile page-width checks are included.

The current scope excludes ownership verification, independent inspections, photo uploads, automatic measurement interpretation, public sharing, and You.com enrichment. These are not represented as implemented features.

## Bounded research agent

An evidence dialog now offers **Run research agent**. A deterministic policy inspects existing reports, uses up to two Tavily basic web searches, checks venue/locality relevance and source-domain variety, replans if the first check is insufficient, and drafts a question for human approval. There is no LLM planner. Search snippets remain unverified research clues and never become positive accessibility evidence automatically. The approved question and reference links are saved in the Nexconn room conversation. Definite, delivered representative reports still enter the table through the existing reconciliation rules.

Fictional mode uses labelled fixtures and zero provider calls. Live research is session-protected, checks same-origin requests, caches matching runs for 10 minutes, coalesces in-flight work, and allows four fresh runs per hour per running instance. These in-memory limits reset on restart. Written visitor details are added locally to the reviewed draft, not sent to the search provider.

`node --import tsx scripts/test-agent-live.ts` verifies fixture replanning, same-origin rejection, real venue research, unchanged evidence status and cached-run reuse. Hosted checks use `ACCESSPROOF_TEST_ORIGIN` and the private `ACCESSPROOF_DEMO_PASSWORD`. Tests use provider credits only for uncached live searches.

## Tavily setup and submission materials

Set `TAVILY_API_KEY` in `.env.local`. Venue discovery still uses SerpApi; public-source research uses Tavily exclusively. Missing or rejected Tavily credentials produce an explicit error/unresolved research state, without silently substituting SerpApi or fictional data. The API key is server-only. The agent uses `POST https://api.tavily.com/search`, basic depth, at most eight results per call, no auto parameters, no generated provider answer, and no raw-content fetch. At most two calls/run and four fresh runs/hour/instance; repeated identical requests reuse a 10-minute cache. These instance-local limits reset on cold starts and are not a billing guarantee.

`npm test` runs mocked contract and evidence checks. `node --env-file=.env.local --import tsx scripts/test-agent-live.ts` performs a real Tavily research run after real venue discovery, verifies provider success, unchanged evidence, and cache reuse. It consumes provider credits.

The [`submission/`](submission/SUBMISSION.md) folder contains the Global AI deck, 3-minute narrated video, captions, and submission guide. No keys, passphrases, transcripts, private room links, or runtime database are included. The hosted app requires a private demo passphrase, supplied separately to judges.

### Sponsor roles

- **Tavily:** live public-source research for the adaptive research agent.
- **SerpApi:** real Google Maps venue discovery and explicit attributes.
- **Nexconn:** private visitor/representative messaging and delivered-report updates.
- **Oriane:** campaign research informing the original hook; not production evidence.
- **Google Cloud Text-to-Speech:** Indian English synthetic narration in the submission film.

No Bifrost or LLM planner is integrated. Source snippets are unverified clues; representative reports are attributed claims, not independent inspections or accessibility certification.
