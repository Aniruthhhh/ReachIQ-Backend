FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build --workspace=apps/channel
EXPOSE 3002
CMD ["npm", "start", "--workspace=apps/channel"]
