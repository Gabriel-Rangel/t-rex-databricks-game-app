import os
import uuid
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

from databricks.sdk import WorkspaceClient

logger = logging.getLogger(__name__)

# Module-level cached token and identity
_cached_token = None
_cached_username = None


def _refresh_credentials():
    """Generate a fresh OAuth token for the app's service principal."""
    global _cached_token, _cached_username
    w = WorkspaceClient()
    _cached_username = w.current_user.me().user_name
    cred = w.database.generate_database_credential(
        request_id=str(uuid.uuid4()),
        instance_names=[os.getenv("LAKEBASE_INSTANCE_NAME", "trex-game-db")],
    )
    _cached_token = cred.token
    logger.info("Lakebase OAuth token refreshed.")


def get_connection():
    global _cached_token, _cached_username
    if _cached_token is None:
        _refresh_credentials()

    try:
        conn = psycopg2.connect(
            host=os.getenv("LAKEBASE_HOST"),
            database=os.getenv("LAKEBASE_DATABASE", "databricks_postgres"),
            user=_cached_username,
            password=_cached_token,
            port=os.getenv("LAKEBASE_PORT", "5432"),
            sslmode="require",
        )
        return conn
    except psycopg2.OperationalError:
        # Token may have expired — refresh and retry once
        logger.info("Connection failed, refreshing token and retrying...")
        _refresh_credentials()
        return psycopg2.connect(
            host=os.getenv("LAKEBASE_HOST"),
            database=os.getenv("LAKEBASE_DATABASE", "databricks_postgres"),
            user=_cached_username,
            password=_cached_token,
            port=os.getenv("LAKEBASE_PORT", "5432"),
            sslmode="require",
        )


@contextmanager
def get_cursor(commit=False):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
            if commit:
                conn.commit()
    finally:
        conn.close()


def init_db():
    with get_cursor(commit=True) as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                company VARCHAR(200),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Add unique constraint if missing (for existing tables)
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'players_email_key'
                ) THEN
                    ALTER TABLE players ADD CONSTRAINT players_email_key UNIQUE (email);
                END IF;
            END $$
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS game_sessions (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id),
                human_score INTEGER NOT NULL,
                ai_score INTEGER NOT NULL,
                human_won BOOLEAN NOT NULL,
                llm_commentary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


def create_player(name: str, email: str, company: str = None) -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO players (name, email, company) VALUES (%s, %s, %s)
               ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, company = EXCLUDED.company
               RETURNING id""",
            (name, email, company),
        )
        return cur.fetchone()["id"]


def save_game_session(
    player_id: int,
    human_score: int,
    ai_score: int,
    human_won: bool,
    llm_commentary: str,
) -> int:
    with get_cursor(commit=True) as cur:
        cur.execute(
            """INSERT INTO game_sessions (player_id, human_score, ai_score, human_won, llm_commentary)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (player_id, human_score, ai_score, human_won, llm_commentary),
        )
        return cur.fetchone()["id"]


def get_leaderboard(limit: int = 50) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """SELECT p.name, p.company, gs.human_score AS score, gs.ai_score,
                      gs.human_won, gs.created_at
               FROM game_sessions gs
               JOIN players p ON p.id = gs.player_id
               ORDER BY gs.human_score DESC
               LIMIT %s""",
            (limit,),
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def get_stats() -> dict:
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM players")
        total_players = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS total FROM game_sessions")
        total_games = cur.fetchone()["total"]

        cur.execute(
            "SELECT COUNT(*) AS wins FROM game_sessions WHERE human_won = TRUE"
        )
        human_wins = cur.fetchone()["wins"]

        cur.execute("SELECT MAX(human_score) AS best FROM game_sessions")
        row = cur.fetchone()
        best_score = row["best"] if row["best"] is not None else 0

        win_rate = round(human_wins / total_games * 100, 1) if total_games > 0 else 0

        return {
            "total_players": total_players,
            "total_games": total_games,
            "human_wins": human_wins,
            "win_rate": win_rate,
            "best_score": best_score,
        }
