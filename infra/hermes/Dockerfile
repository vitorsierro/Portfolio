# Base oficial fixada e atualizações pontuais de segurança do ambiente Python.
ARG HERMES_BASE_IMAGE=nousresearch/hermes-agent@sha256:276d44685c65c0cb2a25f190b63c65c8906f9dc76486fb1c05ae71b5826bda08
FROM ${HERMES_BASE_IMAGE}
# Codec exigido pelo Discord para reproduzir e decodificar áudio em salas de voz.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libopus0 \
    && rm -rf /var/lib/apt/lists/*
RUN set -eu; uv_bin=$(find /opt/hermes/tools -type f -name uv -perm /111 | head -n 1); test -n "$uv_bin"; "$uv_bin" pip install --python /opt/hermes/.venv/bin/python \
    'oauthlib==4.0.1' 'tornado==6.6.1' \
    'opentelemetry-api==1.45.2' 'opentelemetry-sdk==1.45.2' \
    'opentelemetry-exporter-otlp-proto-http==1.45.2'
