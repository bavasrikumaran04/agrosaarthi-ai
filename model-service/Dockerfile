# AgroSaarthi model service — CPU inference container.
# Works on generic container hosts and Hugging Face Spaces (Docker SDK expects UID 1000 and port 7860).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    MODEL_DIR=/home/appuser/models/current \
    ENVIRONMENT=production

RUN useradd --create-home --uid 1000 appuser
WORKDIR /home/appuser/service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN mkdir -p /home/appuser/models && chown -R appuser:appuser /home/appuser
USER appuser

EXPOSE 7860
# The model artifact is NOT baked into the image: mount it at MODEL_DIR, or set
# MODEL_ARTIFACT_URL + MODEL_ARTIFACT_SHA256 so it is downloaded and verified at startup.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','7860'), timeout=4)"

CMD ["python", "-m", "app"]
