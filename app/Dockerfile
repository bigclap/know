FROM oven/bun:latest
WORKDIR /app
RUN apt-get update && apt-get install -y procps
COPY ./package*.json ./bun.lock /app/
RUN bun i
COPY . .
RUN bun run build
CMD ["bun", "run", "start:dev"]
