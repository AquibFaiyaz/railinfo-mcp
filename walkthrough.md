# Walkthrough - Repository Architectural Refactoring & Docker Deployment

We have successfully completed the codebase architectural refactoring, configured a continuous deployment pipeline using Docker and GitHub Actions, and set up a secure HTTPS reverse proxy using Nginx and Let's Encrypt on your VPS.

---

## 🗂️ Refactored Directory Structure

The reorganized directory structure is as follows:

```
src/
├── constants/
│   └── prompts.ts              # Centralized prompt & description strings
├── data/
│   ├── station_coords.json     # Station coordinates database
│   └── station_trains.json     # Station schedules database
├── services/
│   ├── rail-api.service.ts     # Raw Axios external API calls (getLiveTrains, getTrainInfo)
│   ├── station.service.ts      # Live Station departures business logic (getTrainsAtStation)
│   ├── token.service.ts        # Session token manager service (getToken)
│   └── train.service.ts        # Live Train status orchestrator service (getLiveTrainStatus)
├── tools/
│   ├── get_live_train_status.ts# Live Train Status MCP schema & executor
│   ├── get_trains_at_station.ts# Live Station departures MCP schema & executor
│   ├── types.ts                # Unified McpTool interface definition
│   └── index.ts                # Dynamic tools registry & loader utility
├── utils/
│   ├── axios.ts                # Custom Axios instance with env vars
│   ├── date.ts                 # Date/time normalized & parsing helpers
│   └── geo.ts                  # Haversine distance & coordinates lookup with memory caching
├── server.ts                   # Simplified Stdio MCP server
├── http-server.ts              # Simplified SSE MCP server
└── http-streamable.ts          # Simplified Streamable HTTP MCP server
```

---

## 🛠️ Key Refactoring Accomplishments

### 1. Deconstruction of `train.service.ts`
We took the giant `train.service.ts` file (~752 lines) and split it into dedicated modules:
*   **[date.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/utils/date.ts)**: Handles date normalization (`normalizeDate`), getting IST time (`getISTDateString`), and parsing ISO-style IST times (`parseISTDateTime`).
*   **[geo.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/utils/geo.ts)**: Houses the Haversine distance formula (`haversineDistance`) and the `getStationCoordinates` function. 
    > [!TIP]
    > **Performance Optimization**: `getStationCoordinates` now loads the large `station_coords.json` file once and caches it in memory, preventing repeated disk reads and JSON parsing on subsequent requests.
*   **[rail-api.service.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/rail-api.service.ts)**: Separates raw external network queries (`getLiveTrains`, `getTrainInfo`) from business logic.
*   **[station.service.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/station.service.ts)**: Re-housed the live station departures calculation (`getTrainsAtStation`) into its own service class.
*   **[train.service.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/train.service.ts)**: Simplified to contain *only* the train running status calculation (`getLiveTrainStatus`), rendering it highly readable (~500 lines reduction!).

### 2. Modular Tools & Dynamic Registry
*   Tool schemas, markdown summaries, and actions are now self-contained inside [src/tools/](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/).
*   Replaced massive inline schemas/registrations in server entry points (`server.ts`, `http-server.ts`, `http-streamable.ts`) with a single dynamic registration helper call: `registerAllTools(server, options)`.

### 3. Centralized Prompts
*   Centralized all schema descriptions and system instructions into [src/constants/prompts.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/constants/prompts.ts) for cleaner code.

---

## 🐳 Docker Deployment & CI/CD Pipeline

We migrated the application runner deployment from PM2 to Docker, configuring a fully automated CI/CD pipeline using GitHub Actions to deploy to your VPS.

### 1. Containerization
*   **[Dockerfile](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/Dockerfile)**: Added a multi-stage Docker build utilizing a slim Node.js 20 Alpine base image. This ensures optimal image size and separates building (TypeScript compilation) from the final production execution environment.
*   **[.dockerignore](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/.dockerignore)**: Prevents copying non-production artifacts (`node_modules`, `.env`, `.git`) into the container to secure secrets and speed up Docker build times.

### 2. GitHub Actions Deployment Workflow
*   **[deploy.yml](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/.github/workflows/deploy.yml)**: Created an SSH-based deployment workflow. On pushing/merging changes to the `main` branch, the workflow:
    1. Connects securely via SSH to the VPS (using IP configured in GitHub secrets).
    2. Initializes/updates the git repository at `/var/www/railinfo-mcp` (coexisting with the server's `.env`).
    3. Builds the Docker image locally on the VPS.
    4. Stops and removes any older instance of the container.
    5. Spawns the new container exposing port `3000`, using the local `.env` variables, and running it with the `unless-stopped` restart policy for high availability.
    6. Prunes dangling Docker build images to optimize disk space.

---

## 🔒 Nginx Reverse Proxy & HTTPS (SSL) Setup

To allow seamless integration with web-based clients such as ChatGPT (which requires secure HTTPS connections), we configured a reverse proxy and obtained an SSL certificate:

1.  **Nginx Reverse Proxy**: Configured Nginx on the host VPS to listen on ports `80` (HTTP) and `443` (HTTPS) and forward all traffic destined for your domain directly to the Docker container running locally on port `3000`.
2.  **Let's Encrypt SSL**: Run `certbot` to request a free SSL certificate for your domain and automatic HTTP-to-HTTPS redirect.
3.  **Endpoint verification**: Tested a secure query from outside the VPS to the secure URL:
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_live_train_status","arguments":{"trainNo":"12951","startDate":"03-Jun-2026"}}}' https://your-domain.com/mcp
    ```
    This securely resolves and streams the JSON-RPC response successfully through the SSL pipeline.

---

## 🛤️ New Feature: Train Crossings & Radar Tool

We have implemented a new MCP tool `get_train_crossings_and_radar` which fetches scheduled/active crossings, trains running ahead, and trains running behind the target train along its route.

### 🛠️ Changes Implemented

1. **Service Layer**:
   - Added [getTrainCrossingsAndRadar](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/train.service.ts#L456) in `src/services/train.service.ts` to parse the `full_running_schedule` and return meetings data, with target station filters.
   - Patched `train.service.ts` with defensive checks (`trainsResponse?.data || []`) to prevent crashes when the external API returns empty or rate-limited responses.

2. **Tool Definition**:
   - Created [src/tools/get_train_crossings_and_radar.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/get_train_crossings_and_radar.ts) which defines the Zod schemas and executes the crossing lookup.
   - Added a markdown formatting helper `formatTrainCrossingsSummary` that prints a beautiful, compact table:
     `| Station | ETA / ETD | Event | Nearby Train | Block / Section |`

3. **Tool Registry**:
   - Imported and registered `getTrainCrossingsAndRadarTool` inside [src/tools/index.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/index.ts).

4. **Constants**:
   - Added `CROSSINGS_AND_RADAR_PROMPTS` configurations in [src/constants/prompts.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/constants/prompts.ts).

### 🧪 Verification & Testing
* Created a scratch test script [scratch/test_crossings.ts](file:///Users/aquibfaiyaz/.gemini/antigravity-ide/brain/3c984891-34bf-4206-9a0b-4ad0f07bb4ee/scratch/test_crossings.ts) to run the crossings tool directly.
* Verified that the project builds successfully using `npm run build`.

---

## 🛤️ New Feature: Trains Between Stations Tool

We have implemented a new MCP tool `get_trains_between_stations` which queries live and scheduled trains departing from a source station (e.g. `ALJN`) and heading towards a destination station (e.g. `NDLS`) within a selected time window.

### 🛠️ Changes Implemented

1. **Service Layer**:
   - Added [getTrainsBetweenStations](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/station.service.ts#L182) in `src/services/station.service.ts` to locate candidate departing trains, fetch their full schedule, and filter those that stop at the destination station *after* the source station.

2. **Tool Definition**:
   - Created [src/tools/get_trains_between_stations.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/get_trains_between_stations.ts) which defines the Zod schemas and executes the query.
   - Added a markdown formatting helper `formatTrainsBetweenStationsSummary` that prints a detailed live train table:
     `| Train | Status at Source | Status at Destination | Delay | Current Location |`

3. **Tool Registry**:
   - Imported and registered `getTrainsBetweenStationsTool` inside [src/tools/index.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/index.ts).

4. **Constants**:
   - Added `TRAINS_BETWEEN_STATIONS_PROMPTS` configurations in [src/constants/prompts.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/constants/prompts.ts) (including instructions for the model to always present both code and name).

### 🧪 Verification & Testing
* Created a scratch test script [scratch/test_trains_between.ts](file:///Users/aquibfaiyaz/.gemini/antigravity-ide/brain/3c984891-34bf-4206-9a0b-4ad0f07bb4ee/scratch/test_trains_between.ts) to run the tool directly.
* Verified that the project builds successfully using `npm run build`.

---

## 🗺️ New Feature: Train Route Map Tool

We have implemented a new MCP tool `get_train_route_map` which retrieves the complete geographic route (station coordinates) of a train showing every stop, distance, latitude, longitude, and clickable Google Maps links.

### 🛠️ Changes Implemented

1. **Constants**:
   - Added `TRAIN_ROUTE_MAP_PROMPTS` under [src/constants/prompts.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/constants/prompts.ts).

2. **Service Layer**:
   - Added `getTrainRouteMap` in [src/services/train.service.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/train.service.ts) to fetch stops from the timetable and resolve `latitude` / `longitude` using `getStationCoordinates`.

3. **Tool Definition**:
   - Created [src/tools/get_train_route_map.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/get_train_route_map.ts) representing the tool implementation.
   - Added `formatRouteMapSummary` to output a clean markdown table showing the stops, distances, coordinates, and Google Maps lookup URLs.

4. **Tool Registry**:
   - Registered `getTrainRouteMapTool` inside [src/tools/index.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/index.ts).

### 🧪 Verification & Testing
* Created a scratch test script [scratch/test_route_map.ts](file:///Users/aquibfaiyaz/.gemini/antigravity-ide/brain/3c984891-34bf-4206-9a0b-4ad0f07bb4ee/scratch/test_route_map.ts) to verify the tool's behavior.
* Verified that the project builds successfully using `npm run build`.

---

## 📡 New Feature: Trains Approaching Station (Radar) Tool

We have implemented a new MCP tool `get_trains_approaching_station` which fetches active, live trains physically approaching a target station within a specified radius (up to 100 km).

### 🛠️ Changes Implemented

1. **Constants**:
   - Added `TRAINS_APPROACHING_STATION_PROMPTS` under [src/constants/prompts.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/constants/prompts.ts).

2. **Service Layer**:
   - Added `getTrainsApproachingStation` in [src/services/station.service.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/services/station.service.ts) to find nearby active trains using spatial calculations, batch-query their timetables, and verify they are approaching (not yet departed) the target station.

3. **Tool Definition**:
   - Created [src/tools/get_trains_approaching_station.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/get_trains_approaching_station.ts) for Zod inputs and markdown table outputs.
   - Enforced search radius constraints (min: 1 km, max: 100 km, default: 50 km).

4. **Tool Registry**:
   - Registered `getTrainsApproachingStationTool` inside [src/tools/index.ts](file:///Users/aquibfaiyaz/Desktop/Learning%20Resources/MCP%20projects/railinfo-mcp/src/tools/index.ts).

### 🧪 Verification & Testing
* Created a scratch test script [scratch/test_approaching.ts](file:///Users/aquibfaiyaz/.gemini/antigravity-ide/brain/3c984891-34bf-4206-9a0b-4ad0f07bb4ee/scratch/test_approaching.ts) to verify the tool's spatial distance filtering and route verification behavior.
* Verified that the project builds successfully using `npm run build`.

