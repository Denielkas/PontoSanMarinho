FROM node:20-alpine

WORKDIR /tmp/react

COPY . .

RUN npm install

RUN npm run build

RUN mkdir -p /var/www/html && cp -r dist/* /var/www/html/

VOLUME /var/www/html