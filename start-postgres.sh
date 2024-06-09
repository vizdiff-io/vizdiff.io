#!/usr/bin/env bash

# Check if the postgres Docker volume already exists. If not, create it
VOLUME=$(docker volume ls | grep postgres-data)
if [ -z "$VOLUME" ]; then
  docker volume create postgres-data
fi

# Check if the postgres container is already running
CONTAINER=$(docker ps --filter name=postgres-local -q)

# If the container is running, stop it and remove it
if [ -n "$CONTAINER" ]; then
  docker stop postgres-local
  docker rm postgres-local
fi

# Start the postgres Docker container
docker run --name postgres-local -e POSTGRES_PASSWORD=postgres -p 5432:5432 -v postgres-data:/var/lib/postgresql/data -d postgres:16

# Sleep for a bit to allow postgres to start
echo "Sleeping for 5 seconds to allow postgres to start..."
sleep 5

# Check if the vizdiff database exists and save the output
# If the output doesn't contain a 1, then the database doesn't exist and we need to create it
DB_EXIST=$(docker exec postgres-local psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'vizdiff'")
if [[ $DB_EXIST != *"1"* ]]; then
  docker exec postgres-local psql -U postgres -c "CREATE DATABASE vizdiff"
fi

# Do the same for the `vizdiff_test` database
DB_EXIST=$(docker exec postgres-local psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'vizdiff_test'")
if [[ $DB_EXIST != *"1"* ]]; then
  docker exec postgres-local psql -U postgres -c "CREATE DATABASE vizdiff_test"
fi

echo 'Postgres is running. Use `pgcli -h localhost -p 5432 -U postgres -d vizdiff` to connect to the database.'
