# AccessProof — Global AI Hackathon

**Track:** Tavily  
**Problem statement:** Tavily Research Agent  
**Repository:** https://github.com/gowtham66867/accessproof  
**Hosted app:** https://accessproof-412542191970.asia-southeast1.run.app

## Problem
A venue’s star rating often leaves practical access questions unanswered: entrance, seating and toilets. Visitors risk wasted journeys; venues receive repeated enquiries and may lose visits when details are unclear. These commercial effects are hypotheses, not measured customer results.

## Solution and agent loop
SerpApi discovers real venues and explicit Maps attributes. The bounded research agent inspects an evidence gap, calls Tavily Search, filters for venue/locality and accessibility relevance, checks distinct source domains, and replans when its first check is insufficient. It creates an extractive cited research brief: quoted source excerpts, numbered links, existing reports, unanswered questions and disagreement. A reviewed question carries a signed receipt into room creation; the privately saved brief survives refresh. At most two basic search calls per run. It has no LLM planner and does not use Tavily's separately billed Research endpoint.

The reviewed question enters a private Nexconn room. An invited representative can answer available, unavailable, or unsure. Only a definite delivered report enters the evidence table; the update keeps author, time, previous state, and any contradiction. Representative ownership is not independently verified. Reports are claims, not certification.

## Demo sequence
1. Unlock the hosted app using the separately supplied private passphrase.
2. Use Live search for cafés in Indiranagar, Bengaluru.
3. Open a missing toilet/entrance/seating detail. Run the research agent.
4. Inspect the Tavily action trace, source excerpts/links, and stopping condition. A lack of matched sources stays unresolved.
5. Choose “Use agent draft for my question”, review, and ask the venue.
6. Open the side-by-side demo, use a fictional representative report, and send it.
7. Watch the timeline gain **Representative replied** and **Cell updated** as the cell changes **Unknown → Reported available**. Inspect the report and saved citations; refresh to restore the same timeline.

The fictional demo mode uses clearly labelled fixtures and zero Tavily calls. It still uses real Nexconn delivery. No business is automatically contacted.

## Submission links
- Judge preview / video player: https://gowtham66867.github.io/accessproof/
- Deck: https://github.com/gowtham66867/accessproof/blob/main/submission/AccessProof-Global-AI.pdf
- Editable deck: https://github.com/gowtham66867/accessproof/blob/main/submission/AccessProof-Global-AI.pptx
- Video download: https://github.com/gowtham66867/accessproof/raw/refs/heads/main/submission/film/AccessProof-Global-AI-3min.mp4
- Captions: film/AccessProof-Global-AI.srt

The video is exactly three minutes, with Google Cloud Indian English neural narration, original graphics/music and animated product captures. The demo is a captured hosted test, not continuous live screen recording. Oriane caption/transcript research informed the original campaign hook; no creator footage or celebrity voice was reused.

## Validation
34 automated tests passed, with TypeScript and production build. The first real Tavily research run checked **tribal brew daily | Indiranagar**, used two searches, returned one accepted clue from pagenearby.com, preserved toilet status **Unknown**, and reused the cached result on repetition. This demonstrates API and workflow behavior, not independent accuracy of that source. The same Tavily research and cache check passed on hosted revision accessproof-00005-smc. Hosted Nexconn integration checks also passed: two provider tokens, private group creation, delivered report, unknown-to-available transition, retained author/time/provider ID, rejected invalid roles, idempotent retries, unsure answers and persistent conflicts. GitHub CI and Pages deployment passed for the initial published commit.

## Business hypothesis
Free discovery for visitors; paid enquiry management and profile maintenance for venues/hospitality groups. Staff response rates, usefulness to visitors and willingness to pay remain to be validated. Payment never improves an evidence status.

## Provenance and eligibility
The baseline AccessProof MVP was developed for Beyond 9TO5 on **21 November 2026**. This submission is an extension of that existing work with Tavily integration and revised materials. It does not claim that the baseline was developed during Global AI Hackathon’s original build window. Confirm acceptance of reused projects and any final-submission extension with the organizers before submitting. Publishing this repository alone does not complete the competition submission.

No Bifrost integration is claimed. AI coding assistance was used for implementation and presentation assets. Keys, passphrases, runtime data, transcripts and private invitation links are excluded from the repository.

## Final submission checklist

Use the public judge preview URL for the video field and the PDF link above for the PPT field. The source repository is public. Hosted Tavily source research was additionally exercised in the browser and returned the same one-clue result with the table unchanged.

The final Google Form requires the participant’s team details and a recorded submission confirmation. It requests GitHub usernames and confirmation of the sponsor repository star; the Google Form receipt, rather than this guide, confirms completion. Do not publish demo passphrases in public descriptions or repository files.

## Brief and timeline extension validation

34 automated checks cover exact citation-to-excerpt mapping, empty research, signed-receipt tampering/expiry/venue-feature-mode binding, durable review-to-delivery steps, unsure/failed/pending replies, conflicts and duplicate reports. Full local and hosted Nexconn journeys were exercised: cited fixtures → human-reviewed question → delivered representative report → table milestone → refresh reconstruction. The real Tavily brief was also checked for an Indiranagar café; one matched contextual source clue did not resolve its toilet question. No false positive accessibility claim was created.

Hosted desktop demo captured on revision accessproof-00010-w6v; final production status-color polish is deployed as accessproof-00011-flf. The desktop demo shows the compact timeline, attributed before/after banner and changed comparison cell together. Hosted signed-brief integration also verified an unsure reply, opposing reports, retry deduplication and conflict recovery after refresh.

## Submission status

The final Google Form confirmed **Your response has been recorded.** on 21 November 2026. See [STATUS.md](STATUS.md) for the public verification record. No private contact details or editable form-response links are published.

## Demo tool provenance

- Oriane: searched video examples and inspected selected captions, spoken transcripts and on-screen text for campaign research. The film shows an actual crop of its content-analysis controls at 0:45. We did not analyse the whole result corpus or reuse creator footage.
- Google Gemini: critiqued a public project fact packet and recommended clearer agent decisions, evidence boundaries, impact hypotheses and visible Oriane provenance. Editorial use only.
- Google Cloud Text-to-Speech: en-IN-Neural2-D narration with speech-timed captions.
- Production agent: implemented adaptive policy, at most two Tavily calls, source variety check, replan and human review. No LLM planner.
- Impact: pilot hypotheses measured through answer completeness, response time and visitor decision usefulness. No revenue/adoption claim.
