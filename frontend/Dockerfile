# Use a Node image for building the frontend
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Use Nginx to serve the build
FROM nginx:alpine

# Copy build files from the build stage
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
