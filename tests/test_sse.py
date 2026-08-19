import asyncio
from backend.core.sse import format_sse_event, sse_generator_bridge


def test_format_sse_event_string():
    formatted = format_sse_event("hello world")
    assert formatted == "data: hello world\n\n"


def test_format_sse_event_dict():
    event_dict = {"event": "thinking", "stage": "keywords", "message": "Test message"}
    formatted = format_sse_event(event_dict)
    assert formatted.startswith("data: {")
    assert '"event": "thinking"' in formatted
    assert '"timestamp":' in formatted
    assert formatted.endswith("\n\n")


def test_sse_generator_bridge():
    def sample_sync_generator(count: int):
        for i in range(count):
            yield {"event": "progress", "stage": "keywords", "message": f"Step {i}"}

    async def run_test():
        results = []
        async for chunk in sse_generator_bridge(sample_sync_generator, 3):
            results.append(chunk)
        return results

    chunks = asyncio.run(run_test())
    assert len(chunks) == 3
    assert 'data: {"event": "progress"' in chunks[0]
    assert "Step 0" in chunks[0]
    assert "Step 2" in chunks[2]
