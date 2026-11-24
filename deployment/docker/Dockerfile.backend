FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DB_PATH=/data/predictions.db
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY model ./model

RUN useradd --create-home appuser && mkdir /data && chown appuser /data
USER appuser
VOLUME /data
ENV PORT=8000
EXPOSE 8000

# ONE worker on purpose: the scheduler lives inside the process, and more workers would
# each run their own copy (duplicate runs and alerts). Scale reads separately if needed.
CMD ["sh", "-c", "uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
