FROM node:20-alpine

WORKDIR /app

# Dépendances Node (couche cache séparée)
COPY package.json package-lock.json ./
RUN npm install

# Code source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
