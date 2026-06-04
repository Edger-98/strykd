from config import settings


async def generate_plan(goals: str, duration_days: int, aesthetic: str) -> dict:
    # TODO: call Anthropic claude-sonnet-4-20250514, return parsed JSON plan
    raise NotImplementedError


async def stream_replan(current_tasks: list[str], change_request: str):
    # TODO: call Anthropic streaming API, yield token chunks
    raise NotImplementedError


async def generate_nightly(goals: str, completed_tasks: list[str]) -> dict:
    # TODO: generate tomorrow's tasks, headline, signal wall entry
    raise NotImplementedError
