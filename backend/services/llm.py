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
- Never write a task that could apply to anyone. Every task must reference the user's specific goal, \
their blockers, their life area, or their why.
- Every task must have a clear completion condition. The user must know exactly when it is done.
- Tasks must build on each other across days. On day 3 and later, reference what was built or done before.
- Day 1 to 3: Foundation tasks. Establish baselines, create systems, remove friction.
- Day 4 to 10: Momentum tasks. Build the core habit, increase intensity.
- Day 11 to 20: Depth tasks. Go deeper, address the exact blockers they named, push the comfort zone.
- Day 21 and beyond: Mastery tasks. Consolidate, reflect, prepare for life after the plan.
- Each task must include a one-sentence "why this today" rationale as part of the task text.
- Never use generic filler phrases like "this is important" or "don't forget to".
- Never use em dashes or en dashes anywhere. Use periods or commas only."""


# Stable system prompt — cached at the breakpoint so per-user prompts share it.
_SYSTEM_PROMPT = f"""\
{_COACH_IDENTITY}

You are also a creative director: alongside the plan you design one distinctive visual identity \
that matches the life area and the energy of the user's reason for starting. Use ALL of the \
context you are given: life area, the goal itself, why this matters right now, what has blocked \
them before, focused hours per day, and morning vs evening rhythm.
- Tailor task load to their available hours and front-load the heaviest work into their peak window. \
Never schedule more than their stated hours can hold.
- Let their "why now" set the emotional register of the mission statement, headlines, and signal wall. \
This is the fuel. Make them feel it.

{_TASK_RULES}

Return ONLY a single valid JSON object. No markdown fences, no code blocks, no preamble, \
no explanation. Your response must start with {{ and end with }}.

Required JSON schema:
{{
  "theme": {{
    "color_palette": "<exactly one of: dark-ember | arctic-focus | soft-earth>",
    "typography_variant": "<exactly one of: bold-condensed | editorial | minimal>",
    "layout_variant": "<exactly one of: cinematic | dashboard | journal>"
  }},
  "mission_statement": "<2-3 sentence personal mission statement>",
  "chapter_titles": ["<cinematic week title>", ...],
  "day_1_signal_wall_entry": "<3-sentence narrative personal dispatch for Day 1>",
  "daily_tasks": [
    {{
      "day": 1,
      "tasks": [
        {{"content": "<specific task for THIS goal, with its one-sentence 'why this today' rationale in the same string>", "voice_style": "<direct|motivational|reflective>"}},
        {{"content": "...", "voice_style": "..."}},
        {{"content": "...", "voice_style": "..."}},
        {{"content": "...", "voice_style": "..."}},
        {{"content": "...", "voice_style": "..."}}
      ]
    }}
  ]
}}

Schema rules:
- daily_tasks must have exactly one entry per day from day 1 through the final day
- Each day must have exactly 5 tasks, each following the TASK GENERATION RULES above
- chapter_titles must have one entry per week (ceil(duration_days / 7))
- voice_style must be one of: direct, motivational, reflective
- color_palette, typography_variant, layout_variant must be chosen based on the aesthetic preference
"""


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
    client = _get_client()
    num_weeks = (duration_days + 6) // 7

    context_lines = [
        f"Life area: {life_area or 'unspecified'}",
        f"The goal: {goals}",
        f"Why now (their urgency): {why_now or 'unspecified'}",
        f"What has blocked them before: {past_blockers or 'unspecified'}",
        f"Focused hours available per day: {hours_per_day if hours_per_day is not None else 'unspecified'}",
        f"Daily rhythm: {daily_rhythm or 'unspecified'} person",
        f"Aesthetic preference: {aesthetic}",
        f"Duration: {duration_days} days ({num_weeks} weeks)",
    ]

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=32000,
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": (
                    "Generate a complete, deeply personalized accountability plan for this person.\n\n"
                    "=== CONTEXT ===\n"
                    + "\n".join(context_lines)
                    + "\n\n=== REQUIREMENTS ===\n"
                    f"- daily_tasks: exactly {duration_days} entries (day 1 through day {duration_days}), 5 tasks each\n"
                    f"- Every task references THIS goal, their blockers, their life area, or their why. Nothing generic.\n"
                    f"- Every task states a clear completion condition and ends with a one-sentence 'why this today'.\n"
                    f"- Honor the day phases: foundation (1-3), momentum (4-10), depth (11-20), mastery (21+).\n"
                    f"- From day 3 on, build explicitly on what earlier days established.\n"
                    f"- Respect their {hours_per_day if hours_per_day is not None else 'available'} hours/day. Do not over-schedule.\n"
                    f"- Schedule the heaviest tasks in their {daily_rhythm or 'peak'} window.\n"
                    f"- Tasks in the depth phase must directly attack the blockers they named.\n"
                    f"- chapter_titles: exactly {num_weeks} entries.\n"
                    f"- Return only the JSON object, nothing else."
                ),
            }
        ],
    )

    raw = next(b.text for b in response.content if b.type == "text").strip()

    # Strip accidental markdown fences if Claude adds them despite instructions
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return _strip_dashes_deep(json.loads(raw))


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
  "tasks": ["<specific task for THIS goal with its one-sentence 'why this today' rationale>", "...", "...", "...", "..."],
  "daily_headline": "<1 cinematic sentence that fits where they are in the plan>",
  "signal_wall_entry": "<3-sentence narrative dispatch reflecting yesterday's effort and today's focus>"
}}
- "tasks" must contain exactly 5 strings.
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
                    f"- Exactly 5 tasks, each specific to THIS goal with a clear completion condition.\n"
                    f"- Build on what they completed yesterday. Do not repeat finished work.\n"
                    f"- Match the day {day_number} phase above and escalate from yesterday.\n"
                    f"- Each task ends with a one-sentence 'why this today'.\n"
                    f"- Respect their {hours_per_day if hours_per_day is not None else 'available'} hours/day.\n"
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
