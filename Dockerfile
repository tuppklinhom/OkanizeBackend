# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

COPY eng.traineddata tha.traineddata ./

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install
RUN npm list pg || npm install pg

# Copy the rest of the application files
COPY . .

ENV PORT=3000
ENV DATABASE_HOST=db
ENV DATABASE_PORT=5432
ENV DATABASE_USER=okanize
ENV DATABASE_PASSWORD=okanizeIsCool
ENV DATABASE_NAME=okanize_db
# Build TypeScript
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["npm", "start"]