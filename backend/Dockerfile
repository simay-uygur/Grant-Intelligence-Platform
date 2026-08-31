FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app
COPY requirements.txt ./
COPY ai-agent/requirements.txt ./ai-agent-requirements.txt
RUN pip install --no-cache-dir -r requirements.txt -r ai-agent-requirements.txt
COPY . .

RUN mkdir -p /app/storage
EXPOSE 8000

# Apply database migrations before serving traffic.
# Idempotent: safe for local SQLite and required once for managed PostgreSQL.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
