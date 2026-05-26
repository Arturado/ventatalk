# Stage 1: builder — compila wheels de dependencias
FROM python:3.12-slim AS builder

WORKDIR /build

# Solo necesario en build
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Compila wheels en /build/wheels
RUN pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt

# Stage 2: runtime — solo lo esencial
FROM python:3.12-slim AS runtime

WORKDIR /app

# libpq5 es la lib de cliente PostgreSQL en runtime (no necesita gcc ni -dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r ventatalk && useradd -r -g ventatalk -d /app -s /sbin/nologin ventatalk

# Instalar dependencias desde los wheels del builder
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir /wheels/*.whl && rm -rf /wheels

# Directorio para Celery beat schedule
RUN mkdir -p /celery && chown -R ventatalk:ventatalk /celery

# Copiar el código con dueño correcto
COPY --chown=ventatalk:ventatalk . .

USER ventatalk

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
