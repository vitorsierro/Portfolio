FROM alpine:3.24
RUN apk add --no-cache socat
USER 65534:65534
ENTRYPOINT ["socat", "TCP-LISTEN:9120,fork,reuseaddr", "TCP:127.0.0.1:9119"]
