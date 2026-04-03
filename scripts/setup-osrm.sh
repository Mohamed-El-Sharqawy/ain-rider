#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data/osrm"

mkdir -p "${DATA_DIR}"
cd "${DATA_DIR}"

if [ ! -f iraq-latest.osm.pbf ]; then
  echo "Downloading Iraq OSM data from Geofabrik..."
  wget https://download.geofabrik.de/asia/iraq-latest.osm.pbf
else
  echo "Iraq OSM data already exists, skipping download."
fi

echo "Processing with OSRM (car profile)..."
docker run -t -v "$(pwd)":/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/iraq-latest.osm.pbf
docker run -t -v "$(pwd)":/data osrm/osrm-backend osrm-partition /data/iraq-latest.osrm
docker run -t -v "$(pwd)":/data osrm/osrm-backend osrm-customize /data/iraq-latest.osrm

echo "OSRM data ready. Run: docker compose up osrm-backend"
