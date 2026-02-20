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

    prompt = f"""Você é um narrador divertido e carismático em um stand de conferência de tecnologia com um jogo do dinossauro T-Rex.
Um jogador acabou de jogar contra um oponente de IA. Gere um comentário curto e divertido (2-3 frases no máximo).

Nome do jogador: {player_name}
Pontuação do humano: {human_score}
Pontuação da IA: {ai_score}
Humano venceu: {human_won}

Regras:
- Se o humano venceu, parabenize com entusiasmo e mencione que ele ganhou um brinde!
- Se a IA venceu, seja brincalhão e encorajador - diga que as máquinas tiveram sorte dessa vez.
- Mantenha divertido, apropriado para conferência e energético.
- Use o nome do jogador.
- Não use hashtags ou emojis.
- Responda SEMPRE em português brasileiro.
- Máximo de 280 caracteres."""

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
            return f"Incrível, {player_name}! Você fez {human_score} pontos e destruiu a IA com {ai_score}. As máquinas não estão prontas para você — vá buscar seu brinde!"
        else:
            return f"Foi por pouco, {player_name}! A IA venceu com {ai_score} contra seus {human_score}. Os robôs tiveram sorte dessa vez — tente novamente!"
