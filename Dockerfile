# Use the official Node.js image from the Docker Hub
FROM arm32v7/node:14

# Create and change to the app directory
WORKDIR /var/www/app

COPY . .

RUN npm install

EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
