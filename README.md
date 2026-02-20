# T-Rex Runner - Databricks Conference Booth App

A Chrome T-Rex runner game built as a Databricks App for conference booths (Selbetti). Players register, play the game, then an AI "plays" and an LLM provides trash-talk commentary comparing scores. Beat the AI and win swag. A live leaderboard ranks all players.

## Databricks Features Showcased

| Feature | Usage |
|---------|-------|
| **Databricks Apps** | Hosts the full-stack web application (FastAPI + static files) |
| **Lakebase Provisioned** | Low-latency PostgreSQL storage for players and game sessions |
| **Model Serving (FMAPI)** | Foundation Model API (Llama 3.3 70B) generates AI commentary |
| **Unity Catalog** | Catalog `selbetti`, schema `analytics` for data governance |
| **Delta Table Sync** | Reverse ETL: Lakebase -> Delta table for Spark/SQL analytics |
| **Genie Space** | Natural language exploration of game analytics data |

## Architecture

```
+------------------------------------------------------+
|             Databricks App (FastAPI)                  |
|                                                      |
|  Static Files (HTML/JS/CSS)                          |
|  +-- Registration Screen                             |
|  +-- T-Rex Game (HTML5 Canvas)                       |
|  +-- AI vs Human Comparison + LLM Commentary         |
|  +-- Leaderboard                                     |
|                                                      |
|  API Endpoints                                       |
|  +-- POST /api/register                              |
|  +-- POST /api/score                                 |
|  +-- GET  /api/leaderboard                           |
|  +-- GET  /api/stats                                 |
+------------------------------------------------------+
|  Lakebase         |  Model Serving  |  Unity Catalog |
|  (PostgreSQL)     |  (LLM - FMAPI) |  selbetti.*    |
|  - players        |  - AI score     |                |
|  - game_sessions  |  - commentary   |  Delta Table   |
|                   |                 |  (synced from  |
|                   |                 |   Lakebase)    |
+------------------------------------------------------+
```

## User Flow

1. **Registration** - Player enters name, email, and company
2. **Game** - T-Rex runner game (jump over cacti, duck under birds)
3. **Score Submit** - Score sent to API, stored in Lakebase
4. **AI Play** - Fast-forward animation of AI "playing", LLM generates score + trash talk
5. **Result** - Human vs AI side-by-side comparison, swag banner if human wins
6. **Leaderboard** - Ranking of all players (auto-refreshes)
7. **Back to Registration** - Ready for the next booth visitor

## Project Structure

```
t-rex-app/
+-- app.py              # FastAPI server, API endpoints, static file serving
+-- app.yaml            # Databricks App runtime configuration
+-- requirements.txt    # Python dependencies (psycopg2, openai, databricks-sdk)
+-- db.py               # Lakebase connection (OAuth tokens), schema management, CRUD
+-- llm.py              # Foundation Model API integration (AI score + commentary)
+-- README.md           # This file
+-- static/
    +-- index.html      # Single-page app (5 screens)
    +-- style.css       # Retro pixel-art dark theme (Press Start 2P font)
    +-- game.js         # T-Rex game engine (HTML5 Canvas, pixel-art sprites)
    +-- app.js          # App logic (screen transitions, API calls, AI animation)
```

### Backend Files

| File | Description |
|------|-------------|
| `app.py` | FastAPI server. Mounts static files, defines API endpoints, initializes DB on startup. Includes `/metrics` health check required by the Databricks Apps proxy. |
| `db.py` | Lakebase (PostgreSQL) connection layer. Uses `databricks-sdk` to generate OAuth tokens for the app's service principal. Auto-creates `players` and `game_sessions` tables on startup. Includes automatic token refresh on connection failure. |
| `llm.py` | Foundation Model API integration via OpenAI-compatible client. Generates AI scores calibrated so humans win ~60% of the time. Calls Llama 3.3 70B for entertaining game commentary. Falls back to hardcoded messages if the LLM call fails. |
| `app.yaml` | Databricks App runtime config. Runs `uvicorn` on port **8000**. Defines environment variables for the serving endpoint and Lakebase connection. |

### Frontend Files

| File | Description |
|------|-------------|
| `index.html` | SPA with 5 screen containers: Register, Game, AI Playing, Results, Leaderboard. |
| `style.css` | Dark theme with retro pixel-art aesthetic. Uses `Press Start 2P` Google Font. Responsive for both booth displays and mobile. |
| `game.js` | Complete T-Rex runner clone. Pixel-art sprites rendered on HTML5 Canvas. Dino runs, jumps (Space/Up), and ducks (Down). Obstacles: cacti (3 types) and birds. Progressive speed increase, day/night cycle, score tracking. |
| `app.js` | Screen management, registration form handling, API calls, AI "playing" animation, score comparison with count-up animation, leaderboard rendering with auto-refresh. |

## Prerequisites

- Databricks workspace with:
  - **Databricks CLI** v0.240+ authenticated (`databricks auth login`)
  - **Lakebase Provisioned** enabled in the workspace
  - **Foundation Model API** access (pay-per-token endpoints)
- Python 3.11+ (for local testing)

## Deployment Guide

### Step 1: Create Unity Catalog Resources

```bash
databricks catalogs create selbetti --comment "T-Rex Game Conference Booth"
databricks schemas create analytics selbetti --comment "Game analytics schema"
```

### Step 2: Create Lakebase Instance

```bash
databricks database create-database-instance trex-game-db --capacity CU_1
```

Wait for the instance to reach `AVAILABLE` state:

```bash
databricks database get-database-instance trex-game-db
```

Note the `read_write_dns` value from the output -- you'll need it for `app.yaml`.

### Step 3: Update `app.yaml`

Edit `app.yaml` and set the `LAKEBASE_HOST` value to the DNS from Step 2:

```yaml
env:
  - name: LAKEBASE_HOST
    value: "<your-instance-dns-here>"
```

### Step 4: Create and Deploy the App

```bash
# Create the app
databricks apps create t-rex-game --description "T-Rex Runner - Conference Booth"

# Sync source code to workspace
databricks sync --full \
  --exclude "__pycache__" --exclude "*.pyc" \
  . /Workspace/Users/<your-email>/apps/t-rex-game

# Deploy
databricks apps deploy t-rex-game \
  --source-code-path /Workspace/Users/<your-email>/apps/t-rex-game
```

### Step 5: Add App Resources

Attach the Lakebase database and model serving endpoint to the app:

```bash
databricks apps update t-rex-game --json '{
  "resources": [
    {
      "name": "database",
      "database": {
        "instance_name": "trex-game-db",
        "database_name": "databricks_postgres",
        "permission": "CAN_CONNECT_AND_CREATE"
      }
    },
    {
      "name": "serving-endpoint",
      "serving_endpoint": {
        "name": "databricks-meta-llama-3-3-70b-instruct",
        "permission": "CAN_QUERY"
      }
    }
  ]
}'
```

### Step 6: Grant Lakebase Permissions

The app's service principal needs `CREATE` permission on the `public` schema. Connect to the Lakebase instance as your user and run:

```sql
GRANT CREATE ON SCHEMA public TO "<service-principal-client-id>";
GRANT USAGE ON SCHEMA public TO "<service-principal-client-id>";
```

You can find the `service_principal_client_id` in the output of `databricks apps get t-rex-game`.

To connect to Lakebase from a local machine:

```python
import psycopg2, subprocess, json

# Generate OAuth token
result = subprocess.run(
    ["databricks", "database", "generate-database-credential",
     "--json", '{"instance_names": ["trex-game-db"]}', "--output", "json"],
    capture_output=True, text=True
)
token = json.loads(result.stdout)["token"]

conn = psycopg2.connect(
    host="<your-instance-dns>",
    database="databricks_postgres",
    user="<your-email>",
    password=token,
    port=5432,
    sslmode="require",
)
```

### Step 7: Redeploy

After granting permissions, redeploy to trigger table creation:

```bash
databricks sync --full \
  --exclude "__pycache__" --exclude "*.pyc" \
  . /Workspace/Users/<your-email>/apps/t-rex-game

databricks apps deploy t-rex-game \
  --source-code-path /Workspace/Users/<your-email>/apps/t-rex-game
```

### Step 8: Verify

```bash
databricks apps get t-rex-game
```

The `app_status.state` should be `RUNNING`. Open the `url` from the output in your browser.

## Local Development

Run the app locally with full Databricks authentication:

```bash
databricks apps run-local \
  --entry-point app.yaml \
  --env LAKEBASE_INSTANCE_NAME=trex-game-db \
  --env LAKEBASE_HOST=<your-instance-dns> \
  --env LAKEBASE_DATABASE=databricks_postgres \
  --env LAKEBASE_PORT=5432 \
  --env SERVING_ENDPOINT_NAME=databricks-meta-llama-3-3-70b-instruct
```

The app will be available at `http://localhost:8001`.

## Redeployment

After making code changes:

```bash
databricks sync --full \
  --exclude "__pycache__" --exclude "*.pyc" \
  . /Workspace/Users/<your-email>/apps/t-rex-game

databricks apps deploy t-rex-game \
  --source-code-path /Workspace/Users/<your-email>/apps/t-rex-game
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the game SPA |
| `/metrics` | GET | Health check (required by Databricks Apps proxy) |
| `/api/register` | POST | Register a player. Body: `{"name", "email", "company"}` |
| `/api/score` | POST | Submit score. Body: `{"player_id", "player_name", "score"}`. Returns AI score, commentary, and win result. |
| `/api/leaderboard` | GET | Top 50 scores with player info |
| `/api/stats` | GET | Total players, games, human win rate, best score |

## Database Schema

### `players`

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| name | VARCHAR(100) | Player name |
| email | VARCHAR(255) | Player email |
| company | VARCHAR(200) | Company name |
| created_at | TIMESTAMP | Registration time |

### `game_sessions`

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| player_id | INTEGER FK | References players(id) |
| human_score | INTEGER | Player's game score |
| ai_score | INTEGER | AI-generated score |
| human_won | BOOLEAN | Whether the player beat the AI |
| llm_commentary | TEXT | LLM-generated trash talk / congratulations |
| created_at | TIMESTAMP | Game session time |

## Optional: Delta Table Sync and Genie Space

### Delta Table Sync (Reverse ETL)

Sync game data from Lakebase to a Delta table for Spark/SQL analytics:

```
Source: trex-game-db / databricks_postgres / public.game_sessions
Target: selbetti.analytics.game_sessions
Policy: TRIGGERED
```

### Genie Space

Create a Genie Space "T-Rex Game Analytics" on `selbetti.analytics.game_sessions` with sample questions:

- "Who has the highest score?"
- "What's the human win rate against the AI?"
- "How many people played today?"
- "Show me the top 10 players by score"
- "What company has the most players?"

## Key Implementation Notes

- **Port 8000**: Databricks Apps expect the app process on port 8000 (not 8080).
- **`/metrics` endpoint**: Required by the Databricks Apps proxy for health checks. Without it, the proxy returns 502.
- **Lakebase OAuth**: The app's service principal generates OAuth tokens via `databricks-sdk`. Tokens are cached and auto-refreshed on connection failure.
- **`databricks-sdk>=0.81.0`**: Required in `requirements.txt` for the `WorkspaceClient.database` API. The pre-installed version in the Apps runtime is too old.
- **Schema permissions**: The service principal must be explicitly granted `CREATE` + `USAGE` on the `public` schema in Lakebase.
- **LLM fallback**: If the Foundation Model API call fails, hardcoded commentary is returned so the game flow is never broken.
- **AI score calibration**: AI scores use `human_score * uniform(0.4, 1.4)` so humans win approximately 60% of the time.
