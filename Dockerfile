FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ARG TELEGPT_BUILD_ID=dev
ARG TELEGPT_GIT_SHA=""

ENV TELEGPT_ENV=prod
ENV TELEGPT_PORT=8787
ENV TELEGPT_HOST=0.0.0.0
ENV TELEGPT_BUILD_ID=$TELEGPT_BUILD_ID
ENV TELEGPT_GIT_SHA=$TELEGPT_GIT_SHA

LABEL org.opencontainers.image.title="tele-gpt"
LABEL org.opencontainers.image.revision=$TELEGPT_GIT_SHA
LABEL org.opencontainers.image.version=$TELEGPT_BUILD_ID

COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

RUN apk add --no-cache wget

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${TELEGPT_PORT}/ready || exit 1

STOPSIGNAL SIGTERM

CMD ["npm", "run", "start:server"]
