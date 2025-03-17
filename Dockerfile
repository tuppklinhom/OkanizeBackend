# Use a lightweight Node.js image
FROM node:20-alpine
RUN npm config rm proxy
RUN npm config rm https-proxy
RUN npm i -g  typescript
# Set working directory
WORKDIR /app

COPY eng.traineddata tha.traineddata ./

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install
# RUN npm list pg || npm install pg

# Copy the rest of the application files
COPY . .
# Build TypeScript
RUN npm run build

RUN node ./dist/scripts/genKeyPair.js

# Expose the port the app runs on
EXPOSE 4000

RUN env
# Start the server
CMD ["npm", "start"]