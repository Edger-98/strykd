import json

import anthropic

from config import settings

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


# Stable system prompt — cached at the breakpoint so per-user prompts share it.
_SYSTEM_PROMPT = """\
You are a world-class productivity coach and creative director who builds deeply personalized \
accountability systems. You generate precise daily plans and distinctive visual identities.

You will be given rich context about a person: their life area, the goal itself, why this \
matters to them *right now*, what has blocked them in the past, how many focused hours they \
have each day, and whether they operate best in the morning or evening. Use ALL of it:

- Tailor task TIMING and load to their available hours and daily rhythm (front-load the hard \
  work into their peak window; never schedule more than their stated hours can hold).
- Directly counter the SPECIFIC blockers they named — design tasks and a voice that defuse \
  those exact failure modes, don't just give generic advice.
- Let their "why now" set the emotional register of the mission statement, headlines, and \
  signal wall — this is the fuel; make them feel it.
- Match the visual theme to the life area and the energy of their reason for starting.

Return ONLY a single valid JSON object. No markdown fences, no code blocks, no preamble, \
no explanation. Your response must start with { and end with }.

Required JSON schema:
{
  "theme": {
    "color_palette": "<exactly one of: dark-ember | arctic-focus | soft-earth>",
    "typography_variant": "<exactly one of: bold-condensed | editorial | minimal>",
    "layout_variant": "<exactly one of: cinematic | dashboard | journal>"
  },
  "mission_statement": "<2-3 sentence personal mission statement>",
  "chapter_titles": ["<cinematic week title>", ...],
  "day_1_signal_wall_entry": "<3-sentence narrative personal dispatch for Day 1>",
  "daily_tasks": [
    {
      "day": 1,
      "tasks": [
        {"content": "<specific actionable task>", "voice_style": "<direct|motivational|reflective>"},
        {"content": "...", "voice_style": "..."},
        {"content": "...", "voice_style": "..."},
        {"content": "...", "voice_style": "..."},
        {"content": "...", "voice_style": "..."}
      ]
    }
  ]
}

Rules:
- daily_tasks must have exactly one entry per day from day 1 through the final day
- Each day must have exactly 5 tasks
- chapter_titles must have one entry per week (ceil(duration_days / 7))
- voice_style must be one of: direct, motivational, reflective
- color_palette, typography_variant, layout_variant must be chosen based on the aesthetic preference
- Never use em dashes or en dashes anywhere in any text. Use periods or commas only.
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
        max_tokens=16000,
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
                    f"- Respect their {hours_per_day if hours_per_day is not None else 'available'} hours/day — do not over-schedule\n"
                    f"- Schedule the heaviest tasks in their {daily_rhythm or 'peak'} window\n"
                    f"- Tasks must actively counter the blockers they named\n"
                    f"- chapter_titles: exactly {num_weeks} entries\n"
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


async def stream_replan(current_tasks: list[str], change_request: str):
    client = _get_client()
    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=(
            "You are the user's personal AI accountability coach with full context of "
            "their goals and progress. Stream each revised task as you write it. Never use em dashes or en dashes; use periods or commas only."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Current tasks:\n{chr(10).join(current_tasks)}\n\n"
                    f"Change request: {change_request}\n\n"
                    "Rewrite the affected tasks. Stream each task as you write it."
                ),
            }
        ],
    ) as stream:
        async for text in stream.text_stream:
            yield text.replace('—', ', ').replace('–', ', ')


async def generate_nightly(goals: str, completed_tasks: list[str]) -> dict:
    client = _get_client()
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system="You are generating daily content for an accountability platform. Return ONLY valid JSON. Never use em dashes or en dashes in any text; use periods or commas only.",
        messages=[
            {
                "role": "user",
                "content": (
                    f"User goals: {goals}\n"
                    f"Today's completed tasks: {', '.join(completed_tasks) if completed_tasks else 'none'}\n\n"
                    "Generate JSON with:\n"
                    '- "tasks": array of 5 task strings for tomorrow\n'
                    '- "daily_headline": 1 cinematic sentence\n'
                    '- "signal_wall_entry": 3-sentence narrative\n\n'
                    "Return only the JSON object."
                ),
            }
        ],
    )
    raw = next(b.text for b in response.content if b.type == "text").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return _strip_dashes_deep(json.loads(raw))
