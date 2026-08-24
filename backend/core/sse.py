import asyncio
import json
from collections.abc import AsyncIterator, Callable, Iterator
from datetime import UTC, datetime
from typing import Any


def format_sse_event(data: dict[str, Any] | str) -> str:
    """Format a dict or string into a standard Server-Sent Event string."""
    if isinstance(data, dict):
        if "timestamp" not in data:
            data["timestamp"] = datetime.now(UTC).isoformat()
        payload = json.dumps(data)
    else:
        payload = str(data)
    return f"data: {payload}\n\n"


async def sse_generator_bridge(
    sync_generator_func: Callable[..., Iterator[dict[str, Any]]],
    *args: Any,
    **kwargs: Any,
) -> AsyncIterator[str]:
    """Run a synchronous generator function in a background thread and yield SSE formatted events asynchronously."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any] | None | Exception] = asyncio.Queue()

    def _worker():
        try:
            for item in sync_generator_func(*args, **kwargs):
                loop.call_soon_threadsafe(queue.put_nowait, item)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    loop.run_in_executor(None, _worker)

    while True:
        item = await queue.get()
        if item is None:
            break
        if isinstance(item, Exception):
            # Yield error event before re-raising or ending
            error_event = {
                "event": "error",
                "stage": "pipeline",
                "message": f"Pipeline execution failed: {item}",
                "timestamp": datetime.now(UTC).isoformat(),
            }
            yield format_sse_event(error_event)
            break
        yield format_sse_event(item)
