FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api
EXPOSE 3001
CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push --schema=apps/api/prisma/schema.prisma && npm run seed --workspace=apps/api && npm start --workspace=apps/api"]
