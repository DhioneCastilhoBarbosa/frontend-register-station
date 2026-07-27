# Build
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Variáveis VITE_* precisam existir no build (ficam no JS gerado)
ARG VITE_API_URL=https://api-register.api-castilho.com.br
ARG VITE_AUTH_EMAIL
ARG VITE_AUTH_PASSWORD
ARG VITE_LICENSE_CODE

ENV VITE_API_URL=$VITE_API_URL \
    VITE_AUTH_EMAIL=$VITE_AUTH_EMAIL \
    VITE_AUTH_PASSWORD=$VITE_AUTH_PASSWORD \
    VITE_LICENSE_CODE=$VITE_LICENSE_CODE

RUN npm run build

# Runtime
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8086
CMD ["nginx", "-g", "daemon off;"]
