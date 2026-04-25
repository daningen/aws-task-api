# Använd Node LTS
FROM node:18

# Sätt arbetskatalog
WORKDIR /app

# Kopiera package.json först (cache-optimering)
COPY package*.json ./

# Installera dependencies
RUN npm install

# Kopiera resten av koden (inkl init.sql)
COPY . .

# Exponera port
EXPOSE 3000

# Starta appen
CMD ["node", "index.js"]