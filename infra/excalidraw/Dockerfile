FROM excalidraw/excalidraw@sha256:f7ee194addd607bf831d2af0f0a34463dd4225e426cf35199ef0b12a803398e9 AS assets
FROM nginx:alpine
COPY --from=assets /usr/share/nginx/html /usr/share/nginx/html
