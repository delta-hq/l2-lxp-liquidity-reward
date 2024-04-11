# 1. Base image
FROM python:3.12-slim

# Python environment variables
ENV APP_DIR='/project' \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_CACHE_DIR='/var/cache/pypoetry'

WORKDIR "$APP_DIR"

ENV PYTHONPATH "${PYTHONPATH}:${APP_DIR}"

# Add Python project files
COPY poetry.lock .
COPY pyproject.toml .
COPY config.py .
COPY main.py .
COPY Makefile .
COPY src/ ./src/
COPY config/ ./config/
COPY adapters/block_numbers.csv ./adapters/

RUN mkdir -p ./data/

# Install dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl gnupg build-essential && \
    pip install "poetry==$POETRY_VERSION" && \
    poetry config virtualenvs.create false && \
    poetry install $(test "$APP_ENV" = production && echo "--no-dev") --no-interaction --no-ansi && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g typescript && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Add protocols codes to image
COPY ./adapters /project/adapters/
