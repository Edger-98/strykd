# Changelog

All notable changes to Strykd, most recent first.

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
- **OneSignal web push.** Integrated the OneSignal React SDK (worker scoped under
  `/push/onesignal/`). The app id is fetched at runtime from `/public-config` so
  it isn't baked into the build. Users are targeted by their Strykd user id
  (OneSignal external id). New `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY`
  config. ⚠️ Push is inert until those secrets are set in the server `.env`.
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
