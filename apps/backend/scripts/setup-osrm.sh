#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(dirname "${SCRIPT_DIR}")/data/osrm"

mkdir -p "${DATA_DIR}"
cd "${DATA_DIR}"

if [ ! -f egypt-latest.osm.pbf ]; then
  echo "Downloading Egypt OSM data from Geofabrik..."
  wget https://download.geofabrik.de/africa/egypt-latest.osm.pbf
else
  echo "Egypt OSM data already exists, skipping download."
fi

echo "Processing with OSRM (car profile)..."
docker run -t -v "$(pwd)":/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/egypt-latest.osm.pbf
docker run -t -v "$(pwd)":/data osrm/osrm-backend osrm-partition /data/egypt-latest.osrm
docker run -t -v "$(pwd)":/data osrm/osrm-backend osrm-customize /data/egypt-latest.osrm

echo "OSRM data ready. Run: docker compose up osrm-backend"
