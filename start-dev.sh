#!/bin/bash

# BTD Payment Service Development Startup Script
# Last Updated On: 2025-08-06

echo "Starting BTD Payment Service..."

# Check if database is accessible
echo "Checking database connection..."
PGPASSWORD=btd_local_password psql -h localhost -p 5433 -U btd_user -d btd_payments -c '\q' 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Error: Cannot connect to database. Please ensure PostgreSQL is running on port 5433"
    exit 1
fi

# Run any pending migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the service
echo "Starting service on port 3500..."
npm run start:dev