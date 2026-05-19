# Use the Playwright image version that matches backend/package.json
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
# We use --production to keep the image small, but Playwright needs his own install
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 5000

# Command to run the application
# We use npm start or a direct node command
CMD ["npm", "start"]
