FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p data/uploads data/synthetic_outputs data/trained_models data/al_models data/pipeline_outputs

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["gunicorn", "app.main:app", \
    "--worker-class", "uvicorn.workers.UvicornWorker", \
    "--workers", "3", \
    "--bind", "0.0.0.0:8000", \
    "--timeout", "120", \
    "--max-requests", "1000", \
    "--max-requests-jitter", "100"]
