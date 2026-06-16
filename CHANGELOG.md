# Changelog

All notable changes to Strykd, most recent first.

## AI brainstorm panel

- **Unified task actions menu.** Replaced the row of icons (Ask AI, calendar,
  proof, delete) with a single understated kebab (three-dot) menu per task row.
  It's hidden until row hover on pointer devices and stays faintly visible/tappable
  on touch. The menu holds Ask AI, Add to calendar (Google/Apple), Upload proof,
  and Delete — one clean affordance instead of several competing icons.
- **Per-task "Ask AI" chat.** Each task row can open a right-side "AI Assistant"
  drawer (now via the actions menu) — a chat scoped to that task. User messages are red bubbles on the right, AI responses
  dark cards on the left; the header shows the task for context and the chat
  pre-loads an opening greeting.
- **Streaming responses (SSE).** New `POST /tasks/{task_id}/brainstorm` streams
  tokens back word by word via `stream_brainstorm`. The system prompt feeds the
  model the task, goal, day number, hours available, and past blockers. The
  conversation is kept in frontend state only — nothing is persisted.
- **Save as task / Clear chat.** Any AI response can be saved as a new quick task;
  a Clear chat button resets the conversation. The drawer is full-screen on mobile.
- **iMessage redesign + short replies.** The system prompt now enforces "smart
  friend texting advice" responses (3-4 short paragraphs, no markdown). Markdown
  (`#`, `*`, `|`, blank lines) is stripped server-side in a chunk-boundary-safe
  streaming filter (and again client-side). The drawer reads like iMessage: white
  AI bubbles left, red user bubbles right, 14px text, roomier spacing, an
  animated three-dot typing indicator, a fixed composer with an arrow send
  button, and an 85vh bottom-sheet with slide-up entrance on mobile.

## Email unsubscribe & preferences

- **One-click unsubscribe (CAN-SPAM).** Every Strykd email now carries an
  unsubscribe link in the footer pointing to `/unsubscribe?token={jwt}`. The token
  is a signed, non-expiring JWT carrying the user id — no login required. The page
  flips the master email switch off and confirms "You have been unsubscribed from
  Strykd emails."
- **Per-type email preferences.** New `email_preferences` JSONB column on `users`
  with toggles for welcome email, streak reminders, trial ending notice, weekly
  reflection, and goal-deadline emails. Every send checks the master switch
  (`email_reminders`) **and** the per-type preference. Settings gained an "Email
  notifications" section exposing all of them.
- Idempotent startup migration backfills the new columns on the existing DB.

## PWA & push notifications

- **Progressive Web App.** Added `manifest.json` (standalone display, brand
  icons, theme colors), a root-scope service worker (`sw.js`) handling push
  display + notification clicks, and the iOS/Android install meta tags. Strykd is
  now installable to the home screen.
- **OneSignal web push.** Integrated the OneSignal React SDK using its default
  **root-scope** worker, served at `/OneSignalSDKWorker.js` (a custom
  `/push/onesignal/` scope made OneSignal report "App not configured for web
  push"). Strykd no longer registers a competing root worker — the old `sw.js`
  is now a self-unregistering kill-switch. The app id is read from
  `/public-config` (with a baked-in fallback). Users are targeted by their
  Strykd user id (OneSignal external id). New `ONESIGNAL_APP_ID` /
  `ONESIGNAL_REST_API_KEY` config.
- **Push types:** daily check-in reminder (8pm if nothing completed), streak at
  risk (9pm), day-complete celebration (on finishing the day), and the weekly
  reflection (Sunday 9am). Email remains the fallback for users without push.
- **Permission prompt.** From trial day 2 the dashboard shows a subtle "Get streak
  reminders on your phone" prompt; on iPhone it shows add-to-home-screen
  instructions first. A "Push notifications" toggle was added to Settings.

## Billing & trial

- **30-day free trial.** App-side trial (`TRIAL_DAYS`) extended from 3 to 30 days:
  full access on days 1–30, an "ending soon" banner on days 29–30, and the
  dashboard locks on day 31 until the user subscribes. The dashboard trial badge
  now counts down from 30 ("Free trial · X days left").
- **Trial-ending email** moved to fire on day 25 ("ends in 5 days") instead of the
  old day-before warning.
- **Stripe checkout** now sets `trial_period_days: 30` on the subscription.
  ⚠️ Note: this stacks on top of the 30-day app-side trial — review whether both
  are intended (see launch notes).
- **Copy** updated everywhere to "30 days free": landing page, onboarding CTA
  subtext ("30 days free. No card needed."), and Terms of Service.
- **Refunds.** `POST /billing/refund` + a Settings button: full refund of the most
  recent payment within 7 days of subscribing; cancels the subscription immediately.
- **Subscriptions** via Stripe Checkout ($9/mo) with billing portal, cancel, and
  confirmation email. Fixed the checkout price-ID bug (was a product ID).

## Goals & planning

- **Goal types — sprint vs lifestyle.** Onboarding toggle for timed goals vs ongoing
  habits. Lifestyle goals hide the duration picker, store no end date, regenerate
  forever via the nightly cron, make the streak the primary metric, and show a
  rolling last-90-day grid (no completion screen).
- **Hours-aware task generation.** Tasks now carry a duration (15/30/45/60 min),
  the daily total respects the user's available hours, and the UI shows a "~20 min"
  label per task.
- **Goal feasibility check.** After the clarification chat, the AI flags unrealistic
  timelines and recommends a duration; the user can accept it or keep their own.
  Stored as `ai_recommended_days`.
- **Shorter, sharper tasks.** Hard limit of 2 sentences / 40 words per task
  (sentence one = the action, sentence two = why), applied to the main, nightly,
  and replan prompts.
- **Unlocked Journey.** Future days show the full planned tasks instead of a locked
  state. Users can manage and delete goals even after the trial ends.
- **Delete goal.** `DELETE /goals/{id}` (cascades signals + tasks) with a Journey
  delete button and confirmation.
- **Faster generation.** Parallel staged plan generation (~26s instead of 2–5 min)
  with cinematic SSE streaming during onboarding and when adding a goal.
- **Interactive goal-clarification chat** replaces the old static onboarding step 1.

## Collaboration & sharing

- **Shared collaborative lists.** Owner CRUD (authenticated) plus public view/add/
  edit/delete by link for guests (no account). Owners can delete any task; guests
  only their own (tracked by session). Per-task assignee field and AI-generated
  itineraries.
- **Add to Calendar** on every task — Google Calendar (URL) and Apple Calendar
  (.ics download), next to the proof-photo icon.
- **Instagram share card.** Single-goal 1080×1080 PNG (logo, goal, flame + streak,
  contribution grid, "Day X of Y", @username), plus X and LinkedIn sharing.
- **Public page** reframed around the projected outcome as the destination, with a
  GitHub-style contribution grid and visitor encouragements.

## Pages & content

- **Landing page** reframed from "todo app" marketing to accountability/retention:
  emphasizes the three differentiators (AI plans around blockers, public
  accountability page, collaborative shared lists).
- **Contact page** (`/contact`) — mailto hello@strykdapp.com, linked in the footer.
- **Privacy Policy** and **Terms of Service** pages.

## Email & notifications

- **Smart reminders** — inactivity nudge and goal-deadline emails.
- **Redesigned dark email templates** with shared shell + button components;
  domain strykdapp.com verified for sending.
- Welcome, password-reset, streak-reminder, and subscription-confirmation emails.

## Proof & verification

- **Daily visual proof uploads** to S3 with Claude vision verification.

## Accounts & sessions

- Profiles, settings, password reset, goal pause/resume, streak reminders.
- 30-day sessions with silent token refresh.
- Quick tasks and multiple simultaneous goals.

## Infrastructure

- Nightly plan + streak-reminder cron jobs via cron.d.
- Full Apple-style light visual redesign with framer-motion.
