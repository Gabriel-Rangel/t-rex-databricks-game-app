import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import db
import llm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="T-Rex Runner - Selbetti Booth")


@app.on_event("startup")
def startup():
    try:
        logger.info("Initializing database tables...")
        db.init_db()
        logger.info("Database ready.")
    except Exception as e:
        logger.warning(f"Database init failed (Lakebase not connected yet?): {e}")
        logger.warning("App will start but DB endpoints will fail until Lakebase is added.")


# --- Pydantic models ---

class RegisterRequest(BaseModel):
    name: str
    email: str
    company: str = ""


class ScoreRequest(BaseModel):
    player_id: int
    player_name: str
    score: int


# --- Health check (required by Databricks Apps proxy) ---

@app.get("/metrics")
def metrics():
    return {"status": "ok"}


# --- API endpoints ---

@app.post("/api/register")
def register(req: RegisterRequest):
    player_id = db.create_player(req.name, req.email, req.company)
    return {"player_id": player_id, "name": req.name}


@app.post("/api/score")
def submit_score(req: ScoreRequest):
    ai_score = llm.generate_ai_score(req.score)
    human_won = req.score > ai_score
    commentary = llm.generate_commentary(req.score, ai_score, req.player_name)
    db.save_game_session(req.player_id, req.score, ai_score, human_won, commentary)
    return {
        "human_score": req.score,
        "ai_score": ai_score,
        "human_won": human_won,
        "commentary": commentary,
    }


@app.get("/api/leaderboard")
def leaderboard():
    return db.get_leaderboard()


@app.get("/api/stats")
def stats():
    return db.get_stats()


# --- Static files ---

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")
