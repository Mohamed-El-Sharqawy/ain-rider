$DataDir = Join-Path $PSScriptRoot "..\data\osrm"

if (!(Test-Path $DataDir)) {
    New-Item -ItemType Directory -Force -Path $DataDir
}

Set-Location $DataDir

$OsmFile = "iraq-latest.osm.pbf"
if (!(Test-Path $OsmFile)) {
    Write-Host "Downloading Iraq OSM data from Geofabrik..."
    curl.exe -L -o $OsmFile https://download.geofabrik.de/asia/iraq-latest.osm.pbf
} else {
    Write-Host "Iraq OSM data already exists, skipping download."
}

Write-Host "Processing with OSRM (car profile)..."
# Using a single container for extract, partition, and customize for stability on Windows.
# The container is automatically removed (--rm) after completion.
docker run --rm -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend:v6.0.0 sh -c "
    osrm-extract -p /opt/car.lua /data/iraq-latest.osm.pbf && \
    osrm-partition /data/iraq-latest.osrm && \
    osrm-customize /data/iraq-latest.osrm
"

Write-Host "`nOSRM data ready. Run: docker compose up -d osrm-backend"
