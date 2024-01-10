# Build stage
FROM node:14 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# Copy the source code and build the app
COPY . .

EXPOSE 3000
CMD [ "node", "index.js" ]
