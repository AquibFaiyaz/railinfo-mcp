# 🚄 RailInfo MCP Server

An integration-ready **Model Context Protocol (MCP)** server providing real-time Indian Railways information. It gives AI models (like ChatGPT or Claude) the ability to fetch live train running status, localized station schedules, and upcoming train arrivals/departures with high accuracy.

---

## 🌟 Features

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

---

## 🛠️ Configuration

The server reads configuration from a `.env` file at the root.

Create a `.env` file (copied from `.env.example`):
```env
CACHE_TIME=60
RAILJOURNAL_BASE_URL=https://railjournal.in
```

* `CACHE_TIME`: Cache TTL in seconds for API responses.
* `RAILJOURNAL_BASE_URL`: The base URL for the rail status API source.

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

---

## 🔌 MCP Client Integration

To integrate this server with Claude Desktop or other MCP clients, add it to your configuration file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "railinfo-mcp": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Desktop/Learning Resources/MCP projects/railinfo-mcp/dist/server.js"],
      "env": {
        "RAILJOURNAL_BASE_URL": "https://railjournal.in",
        "CACHE_TIME": "60"
      }
    }
  }
}
```
*(Make sure to replace `/Users/YOUR_USERNAME/...` with the absolute path to your project folder).*

---

## 🗣️ Sample Prompts

Ask your AI assistant questions using the following formats:

### Live Train Status
* 📌 *"Where is train 12357 today?"*
* 📌 *"What is the running status of train 12301 yesterday?"*
* 📌 *"Give me the live status of train 12424 starting on 03-June-2026."*

### Localized Station Focus
* 📌 *"When will train 12357 reach Varanasi (BSB)?"*
* 📌 *"How far is train 12260 from Sealdah (SDAH) and what is the expected arrival time?"*
* 📌 *"Is train 12301 running late for Howrah (HWH)?"*

### Upcoming Trains at Station (Live Station)
* 📌 *"Show me upcoming trains at New Delhi (NDLS) in the next 2 hours."*
* 📌 *"What trains are arriving or departing Patna Junction (PNBE) in the next 4 hours?"*
* 📌 *"Which trains are at BSB right now or coming soon?"*
