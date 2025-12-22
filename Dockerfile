FROM node:20-alpine AS development-dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
RUN npm ci
COPY . /app

FROM node:20-alpine AS build-env
WORKDIR /app
COPY --from=development-dependencies-env /app /app
RUN npm run -w apps/web build

FROM node:20-alpine AS production-dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/apps/web/build /app/apps/web/build
CMD ["npm", "run", "-w", "apps/web", "start"]
