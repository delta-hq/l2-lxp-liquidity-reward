# 1. Base image
FROM python:3.12-slim

ARG APP_ENV='dev'

# Python environment variables
ENV APP_DIR='/project' \
    APP_ENV=${APP_ENV} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_CACHE_DIR='/var/cache/pypoetry'

WORKDIR "$APP_DIR"

ENV PYTHONPATH "${PYTHONPATH}:${APP_DIR}"

# Copy Python project files
COPY ./poetry.lock .
COPY ./pyproject.toml .
COPY ./config.py .
COPY ./main.py .
COPY ./src/ ${APP_DIR}/src/
COPY ./config/ ${APP_DIR}/config/

RUN mkdir -p ${APP_DIR}/data/

# Install Python packages, Node.js, TypeScript, and build essentials including gcc
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl gnupg build-essential && \
    pip install "poetry==$POETRY_VERSION" && \
    poetry config virtualenvs.create false && \
    poetry install $(test "$APP_ENV" = production && echo "--no-dev") --no-interaction --no-ansi && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g typescript && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy TypeScript project files
COPY ./adapters /project/adapters/

# Install TypeScript dependencies and compile TypeScript files
# You might need to adjust commands based on your project's setup.
# RUN npm install
# RUN tsc