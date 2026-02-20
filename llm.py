import os
import random
import logging

from openai import OpenAI
from databricks.sdk.core import Config

logger = logging.getLogger(__name__)


def _get_client() -> OpenAI:
    cfg = Config()
    headers = cfg.authenticate()
    token = headers.get("Authorization", "").replace("Bearer ", "")
    return OpenAI(
        api_key=token,
        base_url=f"https://{cfg.host}/serving-endpoints",
    )


def generate_ai_score(human_score: int) -> int:
    """Generate an AI score calibrated so humans win ~60% of the time."""
    factor = random.uniform(0.4, 1.4)
    ai_score = int(human_score * factor)
    ai_score = max(10, ai_score + random.randint(-20, 20))
    return ai_score


def generate_commentary(
    human_score: int, ai_score: int, player_name: str
) -> str:
    """Use Foundation Model API to generate fun commentary comparing scores."""
    human_won = human_score > ai_score
    endpoint = os.getenv("SERVING_ENDPOINT_NAME", "databricks-meta-llama-3-3-70b-instruct")

    prompt = f"""You are a witty, fun announcer at a tech conference booth running a T-Rex dinosaur runner game.
A player just finished playing against an AI opponent. Generate a short, entertaining commentary (2-3 sentences max).

Player name: {player_name}
Human score: {human_score}
AI score: {ai_score}
Human won: {human_won}

Rules:
- If the human won, congratulate them enthusiastically and mention they've earned swag!
- If the AI won, be playful and encouraging - tell them the machines got lucky this time.
- Keep it fun, conference-appropriate, and energetic.
- Use the player's name.
- Don't use hashtags or emojis.
- Keep it under 280 characters."""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=endpoint,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.9,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        if human_won:
            return f"Incredible, {player_name}! You scored {human_score} and crushed the AI's {ai_score}. The machines aren't ready for you — go claim your swag!"
        else:
            return f"Close one, {player_name}! The AI edged you out {ai_score} to {human_score}. The robots got lucky this round — try again!"
