# Build
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL da API pode ir no build; credenciais preferencialmente em runtime
ARG VITE_API_URL=https://api-register.api-castilho.com.br
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Runtime
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

ENV VITE_API_URL=https://api-register.api-castilho.com.br \
    VITE_AUTH_EMAIL= \
    VITE_AUTH_PASSWORD= \
    VITE_LICENSE_CODE=

EXPOSE 8086
ENTRYPOINT ["/docker-entrypoint.sh"]
