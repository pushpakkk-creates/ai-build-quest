# AI Build Quest

A game-style campaign page for NxtWave's free workshop, "Build Your First AI Project in 60 Minutes".
Campaign line: "Play. Learn. Build. with AI." Four short games (platformer, AI Word Catch, Prompt Lab, bug blaster) teach the build loop: idea, data, prompt, ship.
Every play is different: the platformer level is generated fresh, questions are drawn from a pool and shuffled, Prompt Lab picks 2 of 4 rounds, and the AI words and bug waves are random.
Works on phones: on-screen buttons for every game, and in AI Word Catch you can also drag a finger to move the bucket.
Registration is optional any time, required after Stage 2. Inviting 2 friends is required after Stage 3.

## Files
- `index.html`: the whole front end. One file, no build step, no frameworks.
- `apps-script/Code.gs`: the backend. Saves registrations to a Google Sheet and counts referrals.

## Go live in about 10 minutes
(Easiest host: Netlify Drop. Upload only `index.html`, not the `apps-script` folder. GitHub Pages also works: put `index.html` in a repo and turn on Pages.)
1. **Backend.** Create a Google Sheet. Extensions > Apps Script, paste `Code.gs`, run `setup` once.
   Deploy > New deployment > Web app. Execute as **Me**, access **Anyone**. Copy the `/exec` URL.
2. **Connect.** Open `index.html`, find `CONFIG` near the top of the script, paste the URL into `apiUrl`.
   Optional: `officialUrl` (NxtWave's own registration page) and `whatsappGroup` (group invite link).
3. **Host.** Drag the folder onto Netlify Drop, or push to GitHub Pages, or copy `index.html` into the
   `public/` folder of your Next.js app and open it at `/index.html`.

With `apiUrl` empty the page runs in demo mode: everything works, data stays in the browser, and friend
joins are simulated with a button.

## What gets saved (Sheet columns)
Timestamp, Code, Name, Email, WhatsApp, College, Branch, Year, ReferredBy, Source, MaxStage, Idea, Referrals.

- **Dedupe:** the same email or phone returns the existing seat and code. No duplicate rows.
- **Referrals:** a friend counts when they register through `?ref=CODE`. Self-referral can't count.
  The `Referrals` column is a live formula, so a pivot or a sort gives you the top referrers.
- **Channel tracking:** add `&src=` to the link you share in each place, for example
  `?src=wa-rcoem`, `?src=club-ieee`, `?src=email-1`. It lands in the `Source` column.
  Count rows per `Source` to see which channel brought the 500.
- **Drop-off:** `MaxStage` shows how far each student got, so you can see where the funnel leaks.
- The seat counter in the page header reads the live total from the Sheet.

## Tested
The real `Code.gs` was run against a fake sheet behind a mock web app while a headless browser played
the whole flow (a bot plays AI Word Catch to a clear on a phone-size and a desktop screen): gates, registration with validation, dedupe, referral counting, source tagging, the
stage unlocks, mobile layout. Not tested: a real Google deployment and real phones, so do one
registration yourself after step 2 and check the Sheet before you share the link.

## Finish screen
After Stage 4 the student sees a "You are registered for the workshop" pass with their code, plus an invite link and an optional box for the AI idea they want to build.
