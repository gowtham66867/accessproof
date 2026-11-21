# AccessProof — Global AI Hackathon

**Track:** Tavily  
**Problem statement:** Tavily Research Agent  
**Repository:** https://github.com/gowtham66867/accessproof  
**Hosted app:** https://accessproof-412542191970.asia-southeast1.run.app

## Problem
A venue’s star rating often leaves practical access questions unanswered: entrance, seating and toilets. Visitors risk wasted journeys; venues receive repeated enquiries and may lose visits when details are unclear. These commercial effects are hypotheses, not measured customer results.

## Solution and agent loop
SerpApi discovers real venues and explicit Maps attributes. The bounded research agent inspects an evidence gap, calls Tavily Search, filters for venue/locality and accessibility relevance, checks distinct source domains, and replans when its first check is insufficient. It creates a cited question draft and stops for human review. At most two basic search calls per run. It has no LLM planner and does not use Tavily's separately billed Research endpoint.

The reviewed question enters a private Nexconn room. An invited representative can answer available, unavailable, or unsure. Only a definite delivered report enters the evidence table; the update keeps author, time, previous state, and any contradiction. Representative ownership is not independently verified. Reports are claims, not certification.

## Demo sequence
1. Unlock the hosted app using the separately supplied private passphrase.
2. Use Live search for cafés in Indiranagar, Bengaluru.
3. Open a missing toilet/entrance/seating detail. Run the research agent.
4. Inspect the Tavily action trace, source excerpts/links, and stopping condition. A lack of matched sources stays unresolved.
5. Choose “Use agent draft for my question”, review, and ask the venue.
6. Open the side-by-side demo, use a fictional representative report, and send it.
7. Watch **Unknown → Reported available**, then inspect the attributed evidence.

The fictional demo mode uses clearly labelled fixtures and zero Tavily calls. It still uses real Nexconn delivery. No business is automatically contacted.

## Submission links
- Judge preview / video player: https://gowtham66867.github.io/accessproof/
- Deck: https://github.com/gowtham66867/accessproof/blob/main/submission/AccessProof-Global-AI.pdf
- Editable deck: https://github.com/gowtham66867/accessproof/blob/main/submission/AccessProof-Global-AI.pptx
- Video download: https://github.com/gowtham66867/accessproof/raw/refs/heads/main/submission/film/AccessProof-Global-AI-3min.mp4
- Captions: film/AccessProof-Global-AI.srt

The video is exactly three minutes, with Google Cloud Indian English neural narration, original graphics/music and animated product captures. The demo is a captured hosted test, not continuous live screen recording. Oriane caption/transcript research informed the original campaign hook; no creator footage or celebrity voice was reused.

## Validation
27 automated tests passed, with TypeScript and production build. The first real Tavily research run checked **tribal brew daily | Indiranagar**, used two searches, returned one accepted clue from pagenearby.com, preserved toilet status **Unknown**, and reused the cached result on repetition. This demonstrates API and workflow behavior, not independent accuracy of that source. The existing hosted Nexconn reply-to-table flow was tested previously; hosted Tavily extension verification is recorded separately when complete.

## Business hypothesis
Free discovery for visitors; paid enquiry management and profile maintenance for venues/hospitality groups. Staff response rates, usefulness to visitors and willingness to pay remain to be validated. Payment never improves an evidence status.

## Provenance and eligibility
The baseline AccessProof MVP was developed for Beyond 9TO5 on **21 November 2026**. This submission is an extension of that existing work with Tavily integration and revised materials. It does not claim that the baseline was developed during Global AI Hackathon’s original build window. Confirm acceptance of reused projects and any final-submission extension with the organizers before submitting. This repository and its documents are not a completed competition submission.

No Bifrost integration is claimed. AI coding assistance was used for implementation and presentation assets. Keys, passphrases, runtime data, transcripts and private invitation links are excluded from the repository.
