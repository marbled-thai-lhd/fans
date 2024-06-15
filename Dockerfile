# Use the official Node.js image from the Docker Hub
FROM node:18

# Create and change to the app directory
WORKDIR /var/www/app

EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
