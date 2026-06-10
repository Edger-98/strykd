import asyncio
import base64
import json

import anthropic

from config import settings

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


# ── Shared coaching philosophy — reused across plan, nightly, and replan prompts ──
_COACH_IDENTITY = """\
You are a world-class accountability coach, part drill sergeant, part therapist, part strategist. \
You know that generic advice kills momentum. Every task you write must be:
- specific enough that the user knows exactly what to do with zero ambiguity,
- connected to a reason that makes skipping it feel like a real loss,
- calibrated to the user's available hours and their stated blockers,
- progressive: day 1 tasks build the foundation that later tasks rely on,
- written in the voice style attached to it (direct = commanding and no-nonsense, motivational = \
charged and belief-building, reflective = introspective and awareness-focused)."""

_TASK_RULES = """\
TASK GENERATION RULES:
- HARD LENGTH LIMIT (most important rule): each task is AT MOST 40 words and exactly 2 short sentences. \
Sentence one (aim for 20 words or fewer): the exact action to take. Sentence two (aim for 15 words or fewer): \
why it matters today. Count your words and cut anything over 40. Short and sharp always beats thorough. No walls of text.
- Never write a task that could apply to anyone. Every task must reference the user's specific goal, \
their blockers, their life area, or their why.
- Every task has a clear completion condition stated briefly. Do not over-specify reps, times, or steps.
- Tasks build on each other across days. On day 3 and later, reference what was built or done before, in a few words.
- Day 1 to 3: Foundation tasks. Establish baselines, create systems, remove friction.
- Day 4 to 10: Momentum tasks. Build the core habit, increase intensity.
- Day 11 to 20: Depth tasks. Go deeper, address the exact blockers they named, push the comfort zone.
- Day 21 and beyond: Mastery tasks. Consolidate, reflect, prepare for life after the plan.
- Never use generic filler phrases like "this is important" or "don't forget to".
- Never use em dashes or en dashes anywhere. Use periods or commas only."""


# ── Staged plan generation ───────────────────────────────────────────────────
# The plan is built in named stages so the onboarding screen can stream real
# progress (one SSE event per completed stage). generate_plan() orchestrates the
# same stages for the non-streaming path (adding another goal).

def plan_inputs(
    goals: str,
    duration_days: int,
    aesthetic: str,
    life_area: str | None = None,
    why_now: str | None = None,
    past_blockers: str | None = None,
    hours_per_day: int | None = None,
    daily_rhythm: str | None = None,
) -> dict:
    """Bundle the onboarding answers (shared by every generation stage)."""
    return {
        "goals": goals,
        "duration_days": duration_days,
        "aesthetic": aesthetic,
        "life_area": life_area,
        "why_now": why_now,
        "past_blockers": past_blockers,
        "hours_per_day": hours_per_day,
        "daily_rhythm": daily_rhythm,
        "num_weeks": (duration_days + 6) // 7,
    }


def _ctx_block(ctx: dict) -> str:
    return "\n".join([
        f"Life area: {ctx['life_area'] or 'unspecified'}",
        f"The goal: {ctx['goals']}",
        f"Why now (their urgency): {ctx['why_now'] or 'unspecified'}",
        f"What has blocked them before: {ctx['past_blockers'] or 'unspecified'}",
        f"Focused hours available per day: {ctx['hours_per_day'] if ctx['hours_per_day'] is not None else 'unspecified'}",
        f"Daily rhythm: {ctx['daily_rhythm'] or 'unspecified'} person",
        f"Aesthetic preference: {ctx['aesthetic']}",
        f"Duration: {ctx['duration_days']} days ({ctx['num_weeks']} weeks)",
    ])


async def _json_call(system: str, user: str, max_tokens: int, timeout: float = 60.0) -> dict:
    # max_retries=0 so the timeout is a real hard ceiling. The SDK otherwise
    # retries timeouts up to twice, tripling the effective wait.
    client = _get_client().with_options(max_retries=0, timeout=timeout)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = next(b.text for b in response.content if b.type == "text").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return _strip_dashes_deep(json.loads(raw))


_CLARIFY_SYSTEM = (
    "You are a world-class goal clarification coach. Your job is to ask focused follow-up "
    "questions to turn a vague goal into something specific and achievable. Ask one question "
    "at a time. After 3 to 5 exchanges you have enough to synthesize a refined goal. When ready "
    'respond with JSON: {"type": "question", "message": "..."} or '
    '{"type": "refined", "message": "...", "refined_goal": "..."}. '
    "Never ask more than 5 questions total. Questions should uncover: what specifically they want "
    "to achieve, who it is for or affects, what success looks like in measurable terms, what has "
    "stopped them before, what resources or time they have. "
    "Return ONLY the JSON object, no preamble. Never use em dashes; use commas or periods."
)


async def generate_itinerary(name: str, tasks: list[str]) -> dict:
    """Turn a shared list (name + tasks) into a structured itinerary."""
    system = (
        "You are a world-class planner. Given an event or trip name and a list of tasks, produce a "
        "clear, structured plan. Return ONLY JSON: "
        '{"time_blocks": [{"time": "Friday evening", "title": "...", "detail": "one sentence"}], '
        '"suggestions": ["3 to 6 helpful ideas not already in the list"], '
        '"packing_list": ["6 to 12 concrete items to bring or prepare"]}. '
        "Keep it concise and practical. Never use em dashes; use commas or periods. No preamble."
    )
    user = (
        f"Name: {name}\n"
        f"Existing tasks:\n" + ("\n".join(f"- {t}" for t in tasks) if tasks else "(none yet)")
        + "\n\nBuild the itinerary."
    )
    return await _json_call(system, user, 2000)


async def assess_feasibility(goal: str, duration_days: int, goal_type: str = "sprint") -> dict:
    """Judge whether the chosen timeline is realistic for the goal.

    Returns {"feasible": bool, "recommended_days": int, "message": str}.
    Lifestyle (ongoing) goals are always feasible (no finish line)."""
    if goal_type == "lifestyle":
        return {"feasible": True, "recommended_days": duration_days, "message": ""}
    system = (
        "You are a realistic goal-planning coach. Given a goal and a chosen number of days, judge whether "
        "that timeline is realistic to achieve the goal meaningfully. Return ONLY JSON: "
        '{"feasible": true|false, "recommended_days": <integer>, "message": "<one short paragraph, or empty string>"}. '
        "If the timeline is reasonable, feasible is true, recommended_days equals the chosen days, message is empty. "
        "If it is too short to achieve the goal meaningfully, feasible is false, recommended_days is a realistic "
        "number of days, and message follows EXACTLY this shape: "
        '"Your goal of GOAL typically takes TIME to achieve meaningfully. With N days I can build you a strong '
        'foundation, but you may want to consider extending to M for full results. Would you like to adjust?" '
        "Replace GOAL, TIME, N, and M naturally. Never use em dashes; use commas or periods."
    )
    user = f"Goal: {goal}\nChosen timeline: {duration_days} days."
    data = await _json_call(system, user, 400)
    try:
        rec = int(data.get("recommended_days"))
    except (TypeError, ValueError):
        rec = duration_days
    return {
        "feasible": bool(data.get("feasible", True)),
        "recommended_days": rec,
        "message": _strip_em_dashes(str(data.get("message", ""))),
    }


async def clarify_goal(conversation: list[dict], life_area: str | None = None) -> dict:
    """One turn of the goal-clarification chat.

    Returns {"type": "question", "message": str} or
    {"type": "refined", "message": str, "refined_goal": str}.
    """
    asked = sum(1 for m in conversation if m.get("role") in ("ai", "assistant"))
    answered = sum(1 for m in conversation if m.get("role") == "user")
    transcript = "\n".join(
        f"{'COACH' if m.get('role') in ('ai', 'assistant') else 'USER'}: {m.get('content', '')}"
        for m in conversation
    )
    force = answered >= 5 or asked >= 5
    user = (
        (f"Life area: {life_area}\n\n" if life_area else "")
        + "Conversation so far:\n" + (transcript or "(no messages yet)") + "\n\n"
        + (
            "You have asked enough questions. You MUST respond with type 'refined' now, "
            "synthesizing everything into one specific, measurable refined_goal."
            if force else
            "Respond with your next step as JSON. If you already have enough to be specific and "
            "measurable, respond with type 'refined'; otherwise ask one more focused question."
        )
    )
    data = await _json_call(_CLARIFY_SYSTEM, user, 600)

    typ = data.get("type")
    if typ not in ("question", "refined"):
        typ = "refined" if data.get("refined_goal") else "question"
    out = {"type": typ, "message": _strip_em_dashes(str(data.get("message", "")))}
    if typ == "refined":
        refined = str(data.get("refined_goal") or data.get("message") or "")
        out["refined_goal"] = _strip_em_dashes(refined)
    return out


async def plan_analysis(ctx: dict) -> dict:
    """Stage 1: understand the goal and the blockers. Feeds later stages."""
    system = (
        _COACH_IDENTITY + "\n\nYou are analyzing one person before building their plan. "
        'Return ONLY a JSON object: {"core_challenge": "one sentence naming the real obstacle", '
        '"approach": "one to two sentences on the strategy that fits this person", '
        '"key_levers": ["3 to 5 short, specific levers tailored to this goal and these blockers"]}. '
        "No preamble. Never use em dashes."
    )
    user = (
        "Analyze this person honestly.\n"
        f"Goal: {ctx['goals']}\n"
        f"Life area: {ctx['life_area'] or 'unspecified'}\n"
        f"Why now: {ctx['why_now'] or 'unspecified'}\n"
        f"Past blockers: {ctx['past_blockers'] or 'unspecified'}\n"
        f"Focused hours/day: {ctx['hours_per_day']}\n"
        f"Rhythm: {ctx['daily_rhythm'] or 'unspecified'}"
    )
    return await _json_call(system, user, 800)


async def plan_chapters(ctx: dict, analysis: dict) -> list:
    """Stage 2: cinematic weekly chapter titles."""
    n = ctx["num_weeks"]
    system = (
        _COACH_IDENTITY + "\n\nYou map the journey into cinematic weekly chapters. "
        'Return ONLY JSON: {"chapter_titles": ["..."]}. '
        f"Exactly {n} titles, one per week, progressing foundation to momentum to depth to mastery. "
        "Short, evocative, specific to this goal. Never use em dashes."
    )
    user = (
        f"=== CONTEXT ===\n{_ctx_block(ctx)}\n\n"
        f"=== ANALYSIS ===\n{json.dumps(analysis)}\n\n"
        f"Write exactly {n} chapter titles."
    )
    data = await _json_call(system, user, 1200)
    return data.get("chapter_titles", [])


# Only the opening days of tasks are generated up front so the heaviest stage
# stays well under the 60s timeout regardless of total goal length (these rich
# tasks generate at roughly 12s/day, so 3 days lands near 45s). The nightly cron
# rolls the rest forward day by day (see routes/cron.py).
SEED_DAYS = 3


async def _gen_tasks(ctx: dict, analysis: dict, chapters: list, n_days: int, timeout: float = 60.0) -> list:
    system = (
        f"{_COACH_IDENTITY}\n\n{_TASK_RULES}\n\n"
        'Return ONLY JSON: {"daily_tasks": [{"day": 1, "tasks": '
        '[{"content": "specific task with its one-sentence \'why this today\' rationale", '
        '"voice_style": "direct|motivational|reflective", "duration": 15}]}]}. '
        "duration is the estimated minutes (15, 30, 45, or 60). No preamble."
    )
    total = ctx["duration_days"]
    user = (
        f"=== CONTEXT ===\n{_ctx_block(ctx)}\n\n"
        f"=== ANALYSIS ===\n{json.dumps(analysis)}\n\n"
        f"=== CHAPTER MAP ===\n{json.dumps(chapters)}\n\n"
        "=== REQUIREMENTS ===\n"
        f"- This is a {total}-day plan. Generate ONLY the first {n_days} days now (day 1 through day {n_days}).\n"
        f"- daily_tasks: exactly {n_days} entries.\n"
        f"{_duration_rules(ctx)}\n"
        "- Every task references THIS goal, their blockers, their life area, or their why. Nothing generic.\n"
        "- Every task states a clear completion condition and ends with a one-sentence 'why this today'.\n"
        "- These are the opening days: foundation work that later days build on. Establish baselines, create systems, remove friction.\n"
        "- From day 3 on, build explicitly on what earlier days established.\n"
        f"- Schedule the heaviest tasks in their {ctx['daily_rhythm'] or 'peak'} window.\n"
        "- Return only the JSON object."
    )
    data = await _json_call(system, user, 8000, timeout=timeout)
    days = data.get("daily_tasks", [])
    for entry in days:
        entry["tasks"] = _norm_durations(entry.get("tasks") or [])
    return days


def _fallback_day1(analysis: dict) -> list:
    """Minimal day-1 plan from the analysis levers, used only if generation times out."""
    levers = [str(x) for x in (analysis.get("key_levers") or []) if x][:5]
    while len(levers) < 5:
        levers.append("Take one concrete step toward your goal today.")
    return [{"day": 1, "tasks": [{"content": l, "voice_style": "direct"} for l in levers]}]


def _phase_for(day: int, total: int) -> str:
    if day <= 3:
        return "Foundation: establish baselines, create systems, remove friction."
    if day <= 10:
        return "Momentum: build the core habit, increase intensity."
    if day <= 20:
        return "Depth: go deeper, attack the named blockers, push the comfort zone."
    return "Mastery: consolidate, reflect, prepare for life after the plan."


def _hours_plan(hours_per_day) -> tuple[int, str]:
    """Total focused minutes for the day + a target task-count band."""
    h = hours_per_day if (hours_per_day and hours_per_day > 0) else 2
    total = h * 60
    if h <= 1:
        count = "2 to 3"
    elif h <= 2:
        count = "3 to 4"
    else:
        count = "4 to 5"
    return total, count


_DURATIONS = [15, 30, 45, 60]


def _norm_durations(tasks: list) -> list:
    """Snap each task's duration to one of 15/30/45/60 minutes; default 30."""
    for t in tasks:
        try:
            d = int(t.get("duration"))
        except (TypeError, ValueError):
            d = 30
        t["duration"] = min(_DURATIONS, key=lambda x: abs(x - d))
    return tasks


def _duration_rules(ctx: dict) -> str:
    total_min, count = _hours_plan(ctx.get("hours_per_day"))
    h = ctx.get("hours_per_day") or 2
    return (
        f"- TIME BUDGET: the user has {h} hour(s) = {total_min} focused minutes today.\n"
        f"- Generate {count} tasks. Give each a duration of 15, 30, 45, or 60 minutes.\n"
        f"- The durations must sum to AT MOST {total_min} minutes. With little time, fewer shorter "
        "tasks; with more time, fewer deeper tasks. Never over-schedule the day."
    )


async def plan_day(ctx: dict, day_number: int, timeout: float = 55.0) -> dict:
    """Generate a single day's tasks, sized to the user's hours. Fast (runs concurrently)."""
    total = ctx["duration_days"]
    system = (
        f"{_COACH_IDENTITY}\n\n{_TASK_RULES}\n\n"
        'Return ONLY JSON: {"tasks": [{"content": "task with its one-sentence \'why this today\'", '
        '"voice_style": "direct|motivational|reflective", "duration": 15}]}. '
        "duration is the estimated minutes (15, 30, 45, or 60). No preamble."
    )
    user = (
        f"=== CONTEXT ===\n{_ctx_block(ctx)}\n\n"
        f"=== DAY ===\nGenerate day {day_number} of {total}. Phase: {_phase_for(day_number, total)}\n"
        f"{_duration_rules(ctx)}\n"
        "- Each task is specific to the goal, blockers, life area, or why, with a clear completion condition.\n"
        "- Return only the JSON object."
    )
    data = await _json_call(system, user, 2000, timeout=timeout)
    return {"day": day_number, "tasks": _norm_durations(data.get("tasks") or [])[:6]}


async def plan_task_range(ctx: dict, start_day: int, end_day: int) -> list:
    """Generate days start..end concurrently (one call per day). Returns daily_tasks
    entries; any day that fails gets a minimal placeholder so nothing is missing."""
    days = list(range(start_day, end_day + 1))
    results = await asyncio.gather(*[plan_day(ctx, d) for d in days], return_exceptions=True)
    out: list[dict] = []
    for d, r in zip(days, results):
        if isinstance(r, Exception) or not isinstance(r, dict) or not r.get("tasks"):
            out.append({"day": d, "tasks": [
                {"content": f"Take one concrete, specific step toward your goal today (day {d}).",
                 "voice_style": "direct"}
            ]})
        else:
            out.append(r)
    return _strip_dashes_deep(out)


async def plan_tasks(ctx: dict, analysis: dict, chapters: list) -> list:
    """Stage 3: seed the opening days of tasks (bounded for speed).

    60s timeout per attempt; on timeout retry a smaller window, then fall back to
    a minimal day-1 plan so the user is never left with nothing. The nightly cron
    fills in the remaining days of the plan over time.
    """
    seed = min(ctx["duration_days"], SEED_DAYS)
    try:
        return await _gen_tasks(ctx, analysis, chapters, seed)
    except anthropic.APITimeoutError:
        # Partial plan: a single day generates fast; the cron fills the rest.
        if seed > 1:
            try:
                return await _gen_tasks(ctx, analysis, chapters, 1)
            except anthropic.APITimeoutError:
                pass
        return _fallback_day1(analysis)


async def plan_mission(ctx: dict, analysis: dict) -> str:
    """Stage 4: the personal mission statement."""
    system = (
        _COACH_IDENTITY + "\n\n"
        'Return ONLY JSON: {"mission_statement": "2 to 3 sentences"}. '
        "Second person, charged by their reason for starting. Never use em dashes."
    )
    user = (
        f"=== CONTEXT ===\n{_ctx_block(ctx)}\n\n"
        f"=== ANALYSIS ===\n{json.dumps(analysis)}\n\n"
        "Write their personal mission statement."
    )
    data = await _json_call(system, user, 500)
    return data.get("mission_statement", "")


async def plan_theme(ctx: dict) -> dict:
    """Stage 5: the visual identity."""
    system = (
        "You are a creative director choosing a visual identity. Return ONLY JSON: "
        '{"color_palette": "dark-ember|arctic-focus|soft-earth", '
        '"typography_variant": "bold-condensed|editorial|minimal", '
        '"layout_variant": "cinematic|dashboard|journal"}. '
        "Choose values that match the stated aesthetic preference, the life area, and the goal's energy. "
        "Never use em dashes."
    )
    user = (
        f"Aesthetic preference: {ctx['aesthetic']}\n"
        f"Life area: {ctx['life_area'] or 'unspecified'}\n"
        f"Goal: {ctx['goals']}"
    )
    return await _json_call(system, user, 300)


async def plan_signal_day1(ctx: dict, day1_tasks: list) -> str:
    """Stage 6: the Day 1 signal wall entry."""
    system = (
        _COACH_IDENTITY + "\n\nYou write the Day 1 signal wall entry, a short narrative dispatch "
        "that makes day one feel like the start of something real. "
        'Return ONLY JSON: {"signal_wall_entry": "3 sentences"}. Never use em dashes.'
    )
    tasks_txt = "; ".join(day1_tasks) if day1_tasks else "the first set of tasks"
    user = (
        f"Goal: {ctx['goals']}\n"
        f"Why now: {ctx['why_now'] or 'unspecified'}\n"
        f"Day 1 tasks: {tasks_txt}\n\n"
        "Write the Day 1 signal wall entry."
    )
    data = await _json_call(system, user, 400)
    return data.get("signal_wall_entry", "")


def day1_contents(daily_tasks: list) -> list:
    """Pull the day-1 task strings out of a daily_tasks structure."""
    for entry in daily_tasks:
        if int(entry.get("day", 0)) == 1:
            return [t.get("content", "") for t in entry.get("tasks", [])]
    return []


def assemble_plan(theme: dict, mission: str, chapters: list, signal: str, tasks: list) -> dict:
    """Combine the stage outputs into the plan dict the persistence layer expects."""
    return _strip_dashes_deep({
        "theme": theme,
        "mission_statement": mission,
        "chapter_titles": chapters,
        "day_1_signal_wall_entry": signal,
        "daily_tasks": tasks,
    })


async def generate_plan(
    goals: str,
    duration_days: int,
    aesthetic: str,
    life_area: str | None = None,
    why_now: str | None = None,
    past_blockers: str | None = None,
    hours_per_day: int | None = None,
    daily_rhythm: str | None = None,
) -> dict:
    """Non-streaming orchestration of all stages (used when adding another goal)."""
    ctx = plan_inputs(goals, duration_days, aesthetic, life_area, why_now,
                      past_blockers, hours_per_day, daily_rhythm)
    analysis = await plan_analysis(ctx)
    chapters = await plan_chapters(ctx, analysis)
    tasks = await plan_tasks(ctx, analysis, chapters)
    mission = await plan_mission(ctx, analysis)
    theme = await plan_theme(ctx)
    signal = await plan_signal_day1(ctx, day1_contents(tasks))
    return assemble_plan(theme, mission, chapters, signal, tasks)


async def verify_proof(task_description: str, image_bytes: bytes, media_type: str) -> dict:
    """Use Claude vision to judge whether an image is evidence of a completed task.

    Returns {"verified": bool, "confidence": "high|medium|low", "comment": str}.
    Only images are supported by the vision API; callers handle video separately.
    """
    client = _get_client()
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    prompt = (
        f"The user's task for today was: {task_description}. "
        "Review this image/video screenshot and determine if it provides evidence of "
        "completing this task. Respond with JSON: "
        '{verified: true/false, confidence: high/medium/low, comment: one sentence}. '
        "Return only the JSON object, no preamble. Never use em dashes; use commas or periods."
    )
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    raw = next(b.text for b in response.content if b.type == "text").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    data = json.loads(raw)
    # Normalize the shape so downstream code can rely on it
    confidence = str(data.get("confidence", "low")).lower()
    if confidence not in ("high", "medium", "low"):
        confidence = "low"
    return {
        "verified": bool(data.get("verified", False)),
        "confidence": confidence,
        "comment": _strip_em_dashes(str(data.get("comment", ""))),
    }


def _strip_em_dashes(text: str) -> str:
    # Replace em/en dashes with a comma-space; collapse any accidental ", ," runs.
    cleaned = text.replace(" — ", ", ").replace("—", ", ").replace(" – ", ", ").replace("–", ", ")
    while ", ," in cleaned:
        cleaned = cleaned.replace(", ,", ",")
    return cleaned.strip()


def _strip_dashes_deep(obj):
    """Recursively strip em/en dashes from every string in a parsed JSON structure."""
    if isinstance(obj, str):
        return _strip_em_dashes(obj)
    if isinstance(obj, list):
        return [_strip_dashes_deep(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _strip_dashes_deep(v) for k, v in obj.items()}
    return obj


async def generate_projected_outcome(
    goal_description: str,
    duration_days: int,
    hours_per_day: int | None,
    life_area: str | None,
) -> str:
    """Generate a specific, vivid projected outcome for finishing the plan.

    Returns plain text with no em dashes.
    """
    client = _get_client()
    hours = hours_per_day or 2
    sessions = duration_days * hours  # rough "focused sessions/hours" figure to anchor specificity

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=(
            "You are a world-class productivity coach. You write a single specific, vivid "
            "projection of what someone will have achieved if they show up every single day "
            "of their plan. Be concrete: reference real numbers (sessions, hours, milestones), "
            "a tangible deliverable, and the compounding habit that outlasts the plan. "
            "Write 2 to 3 sentences, second person ('you will have...'). "
            "IMPORTANT: Never use em dashes or en dashes. Use periods or commas only. "
            "Return ONLY the projection text, no preamble, no quotes."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Goal: {goal_description}\n"
                    f"Duration: {duration_days} days\n"
                    f"Focused hours per day: {hours}\n"
                    f"Life area: {life_area or 'unspecified'}\n"
                    f"Approx. total focused hours across the plan: {sessions}\n\n"
                    f"Write the projected outcome for completing day {duration_days}."
                ),
            }
        ],
    )
    raw = next(b.text for b in response.content if b.type == "text").strip().strip('"')
    return _strip_em_dashes(raw)


_REPLAN_SYSTEM_PROMPT = f"""\
{_COACH_IDENTITY}

The user's plan has hit a real-world change and you are rewriting the affected tasks. The \
rewritten tasks must hold the exact same standard as the original plan: specific, completion-bound, \
progressive, and tied to this person's goal and blockers. A replan is never an excuse for vaguer \
or easier tasks. Honor the change request, then keep the arc intact.

{_TASK_RULES}

Stream each rewritten task on its own line as you write it. Keep its date prefix if one was given. \
Each task still ends with a one-sentence 'why this today'. Output only the tasks, no preamble or commentary."""


async def stream_replan(current_tasks: list[str], change_request: str, context: str | None = None):
    client = _get_client()
    user_content = ""
    if context:
        user_content += f"=== WHO THIS IS FOR ===\n{context}\n\n"
    user_content += (
        f"=== CURRENT UPCOMING TASKS ===\n{chr(10).join(current_tasks)}\n\n"
        f"=== WHAT CHANGED ===\n{change_request}\n\n"
        "Rewrite the affected tasks to absorb this change while keeping every task specific, "
        "completion-bound, and tied to the goal. Stream each task as you write it."
    )
    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_REPLAN_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        async for text in stream.text_stream:
            yield text.replace('—', ', ').replace('–', ', ')


_NIGHTLY_SYSTEM_PROMPT = f"""\
{_COACH_IDENTITY}

You generate the NEXT day's tasks for a person who is already mid-plan. The new tasks must be \
just as specific and personal as a brand-new plan, and they must continue the arc: build on what \
was completed, and escalate appropriately for where they are in the plan.

{_TASK_RULES}

Return ONLY a single valid JSON object with this schema:
{{
  "tasks": [{{"content": "<specific task for THIS goal with its one-sentence 'why this today'>", "duration": 15}}],
  "daily_headline": "<1 cinematic sentence that fits where they are in the plan>",
  "signal_wall_entry": "<3-sentence narrative dispatch reflecting yesterday's effort and today's focus>"
}}
- Each task's "duration" is the estimated minutes: 15, 30, 45, or 60.
No markdown fences, no preamble. Start with {{ and end with }}."""


async def generate_nightly(
    goal_description: str,
    completed_tasks: list[str],
    day_number: int,
    total_days: int,
    life_area: str | None = None,
    why_now: str | None = None,
    past_blockers: str | None = None,
    hours_per_day: int | None = None,
    daily_rhythm: str | None = None,
) -> dict:
    client = _get_client()

    if day_number <= 3:
        phase = "foundation (establish baselines, create systems, remove friction)"
    elif day_number <= 10:
        phase = "momentum (build the core habit, increase intensity)"
    elif day_number <= 20:
        phase = "depth (go deeper, attack the named blockers, push the comfort zone)"
    else:
        phase = "mastery (consolidate, reflect, prepare for life after the plan)"

    context_lines = [
        f"Life area: {life_area or 'unspecified'}",
        f"The goal: {goal_description}",
        f"Why now (their urgency): {why_now or 'unspecified'}",
        f"What has blocked them before: {past_blockers or 'unspecified'}",
        f"Focused hours available per day: {hours_per_day if hours_per_day is not None else 'unspecified'}",
        f"Daily rhythm: {daily_rhythm or 'unspecified'} person",
        f"Generating tasks for day {day_number} of {total_days}. Phase: {phase}.",
        f"What they completed yesterday: {', '.join(completed_tasks) if completed_tasks else 'nothing'}",
    ]

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=[
            {
                "type": "text",
                "text": _NIGHTLY_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": (
                    "Generate tomorrow's content for this person, continuing their plan.\n\n"
                    "=== CONTEXT ===\n"
                    + "\n".join(context_lines)
                    + "\n\n=== REQUIREMENTS ===\n"
                    + _duration_rules({"hours_per_day": hours_per_day}) + "\n"
                    f"- Each task is specific to THIS goal with a clear completion condition and a one-sentence 'why this today'.\n"
                    f"- Build on what they completed yesterday. Do not repeat finished work.\n"
                    f"- Match the day {day_number} phase above and escalate from yesterday.\n"
                    f"- Return only the JSON object."
                ),
            }
        ],
    )
    raw = next(b.text for b in response.content if b.type == "text").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return _strip_dashes_deep(json.loads(raw))
