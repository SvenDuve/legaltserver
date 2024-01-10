# Build stage
FROM node:14 AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# Copy the source code and build the app
COPY . .

# Run stage
FROM node:14
WORKDIR /usr/src/app
COPY --from=build /usr/src/app .

EXPOSE 8080
CMD [ "node", "index.js" ]
