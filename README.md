# 🚄 RailInfo MCP Server

An integration-ready **Model Context Protocol (MCP)** server providing real-time Indian Railways information. It gives AI models (like ChatGPT or Claude) the ability to fetch live train running status, station schedules, route maps, crossings, and upcoming train arrivals/departures with high accuracy.

---

## 🌟 Features & Tools

### 1. Live Train Status (`get_live_train_status`)
Get the current running status of any Indian Railways train.
* **Flexible Date Resolution**: Supports querying by keywords like `"today"`, `"yesterday"`, or specific dates (e.g., `"03-June-2026"`).
* **Target Station Focus**: Query a train relative to a specific station (e.g., `"When will 12357 reach Varanasi (BSB)?"`).
  * **Remaining Track Distance**: Calculates track distance remaining and number of stops to go.
  * **Physical GPS Distance**: Calculates straight-line physical distance to the station using the **Haversine formula** based on active GPS coordinates.
  * **Remaining Stops Table**: Lists upcoming stops with expected arrival time, platform, delay, and current status.

### 2. Live Station Departures (`get_trains_at_station`)
Get all trains arriving or departing at a station in the next 2 or 4 hours (matching NTES departures board).
* **Hybrid Search Algorithm**: Merges static scheduled timetables with active live trains operating within a **120 km radius** of the station. This ensures delayed or rescheduled trains are never missed.
* **Multi-Instance Handling**: Disambiguates between yesterday's delayed train and today's on-time train running concurrently.

### 3. Train Crossings & Radar (`get_train_crossings_and_radar`)
Get a "radar view" along a train's active route.
* **Oncoming Crossings**: Lists oncoming trains scheduled to pass by on opposing tracks.
* **Section Traffic (Radar)**: Identifies other trains running directly **ahead** or **behind** in the same block section. Helpful for predicting signal-related delays.

### 4. Trains Between Stations (`get_trains_between_stations`)
Find all upcoming trains running from a source station (e.g., `ALJN`) to a destination station (e.g., `NDLS`).
* **Live Schedule Aggregator**: Fetches live departure/arrival times, delay status, and platform numbers at both stations.

### 5. Train Timetable (`get_train_timetable`)
Fetch the complete scheduled route/timetable of any train.
* **Full Stops List**: Lists every single scheduled stop along the route, showing scheduled arrival/departure times, distance (km), platform number, and live expected arrival/departure times if running.

### 6. Train Route Map (`get_train_route_map`)
Get the precise geographic coordinates of a train's entire route.
* **Station Coordinates**: Look up latitude/longitude for every stop on the train's route.
* **Map Integration**: Generates clickable Google Maps links for every station to plot or visualize the path.

### 7. Trains Approaching Station (Radar) (`get_trains_approaching_station`)
Get active, live trains physically approaching a station within a specified radius (default 50 km, max 100 km).
* **Spatial Tracking**: Tracks live coordinates of active trains approaching the station.
* **Smart Filter**: Automatically ignores trains that have already departed or are moving away from the station.

---

## 🛠️ Configuration
The server reads configuration from a `.env` file at the root.

Create a `.env` file (copied from `.env.example`):
```env
CACHE_TIME=60
RAIL_API_BASE_URL=https://api.example.com
```

* `CACHE_TIME`: Cache TTL in seconds for API responses.
* `RAIL_API_BASE_URL`: The base URL for the rail status API source.

---

## 🚀 Installation & Build

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Server**:
   ```bash
   npm run build
   ```

3. **Running the Server (Locally)**:
   * **Stdio Mode (Standard MCP)**:
     ```bash
     npx tsx src/server.ts
     ```
   * **SSE Mode (HTTP Server)**:
     ```bash
     npx tsx src/http-server.ts
     ```
   * **Streamable Mode (SSE HTTP Server)**:
     ```bash
     npx tsx src/http-streamable.ts
     ```

---

## 🐳 Docker Deployment

The repository includes a multi-stage `Dockerfile` and `.dockerignore` for production deployment.

1. **Build Docker Image**:
   ```bash
   docker build -t railinfo-mcp .
   ```

2. **Run Container**:
   ```bash
   docker run -d --name railinfo-mcp -p 3000:3000 --env-file .env railinfo-mcp
   ```

---

## 🔌 MCP Client Integration

To integrate this server with Claude Desktop or other MCP clients, add it to your configuration file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

### Stdio Transport (Local Node Execution)
```json
{
  "mcpServers": {
    "railinfo-mcp": {
      "command": "node",
      "args": ["/path/to/your/project/railinfo-mcp/dist/server.js"],
      "env": {
        "RAIL_API_BASE_URL": "https://api.example.com",
        "CACHE_TIME": "60"
      }
    }
  }
}
```

### SSE Transport (HTTP Proxy)
If running the server in SSE mode on a VPS under a domain, connect via:
```json
{
  "mcpServers": {
    "railinfo-mcp-sse": {
      "url": "https://your-domain.com/mcp"
    }
  }
}
```

---

## 🗣️ Sample Prompts

Ask your AI assistant questions using the following formats:

### Live Train Status & Coordinates
* 📌 *"Where is train 12302 today?"*
* 📌 *"When will train 12357 reach Prayagraj Jn (PRYJ)?"*
* 📌 *"Get the route map coordinates for train 12951 starting today."*

### Train Radar & Crossings
* 📌 *"What trains are crossing or running ahead of train 12302?"*

### Timetable & Route Lookups
* 📌 *"Show me the full schedule and route timetable of train 12302."*

### Station boards & Train Search
* 📌 *"Show me upcoming trains at New Delhi (NDLS) in the next 2 hours."*
* 📌 *"Find trains running between Kanpur Central (CNB) and New Delhi (NDLS) starting in the next 4 hours."*
