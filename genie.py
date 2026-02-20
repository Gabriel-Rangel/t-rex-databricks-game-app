import os
import logging

from databricks.sdk import WorkspaceClient

logger = logging.getLogger(__name__)

SPACE_ID = os.getenv("GENIE_SPACE_ID", "01f10e93a00012ba90fa5af86758879e")


def _get_client() -> WorkspaceClient:
    return WorkspaceClient()


def _extract_response(w, response, conversation_id: str) -> dict:
    """Extract text, SQL, and data from a Genie response, following the cookbook pattern."""
    result = {
        "conversation_id": conversation_id,
        "message_id": getattr(response, "id", ""),
    }

    attachments = getattr(response, "attachments", None) or []
    for att in attachments:
        # Text attachment
        if att.text:
            result["text"] = att.text.content

        # Query attachment
        elif att.query:
            result["sql"] = att.query.query
            if att.query.description:
                result["description"] = att.query.description

            # Get query results via statement_execution (cookbook pattern)
            query_result = getattr(response, "query_result", None)
            if query_result and getattr(query_result, "statement_id", None):
                try:
                    stmt = w.statement_execution.get_statement(query_result.statement_id)
                    if stmt.manifest and stmt.manifest.schema and stmt.manifest.schema.columns:
                        result["columns"] = [c.name for c in stmt.manifest.schema.columns]
                    if stmt.result and stmt.result.data_array:
                        result["data"] = stmt.result.data_array[:20]
                except Exception as e:
                    logger.warning(f"Failed to fetch query result: {e}")

    if "text" not in result and "data" not in result and "sql" not in result:
        result["text"] = "Consulta processada, mas sem resultados para exibir."

    return result


def ask(question: str, conversation_id: str = None) -> dict:
    """Ask the Genie a question, optionally continuing a conversation."""
    w = _get_client()

    try:
        if conversation_id:
            response = w.genie.create_message_and_wait(
                SPACE_ID, conversation_id, question
            )
            return _extract_response(w, response, conversation_id)
        else:
            response = w.genie.start_conversation_and_wait(SPACE_ID, question)
            conv_id = getattr(response, "conversation_id", None) or conversation_id
            return _extract_response(w, response, conv_id)
    except Exception as e:
        logger.error(f"Genie API error: {e}")
        return {"error": f"Erro ao consultar o Genie: {str(e)}"}
