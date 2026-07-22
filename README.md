# Grant Intelligence Backend

## Local Setup

1. Create a virtual environment.
2. Install dependencies from `requirements.txt`.
3. Copy `.env.example` to `.env`.
4. Run:

```bash
uvicorn app.main:app --reload
```

## First Endpoints

- `GET /api/v1/health`
- `POST /api/v1/chat/message`
- `POST /api/v1/grants/search`


Don't forget to create the `.env` file right next to `.env.example`.
