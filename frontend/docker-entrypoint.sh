#!/bin/sh

# Replace environment variables in the JS file
envsubst < /usr/share/nginx/html/env-config.js.template > /usr/share/nginx/html/env-config.js

# Start nginx
exec nginx -g 'daemon off;' 