# T-Rex Runner - App para Stand Databricks

Jogo do dinossauro T-Rex (estilo Chrome) construído como um Databricks App para stands de conferência. Os jogadores se cadastram, jogam contra uma IA alimentada por Model Serving e competem por um lugar no ranking. Vença a IA e ganhe um brinde! Inclui chat integrado do Genie para explorar os dados em linguagem natural.

## Funcionalidades Databricks Demonstradas

| Funcionalidade | Uso |
|----------------|-----|
| **Databricks Apps** | Hospeda a aplicação web full-stack (FastAPI + arquivos estáticos) |
| **Lakebase Provisioned** | Armazenamento PostgreSQL de baixa latência para jogadores e sessões |
| **Model Serving (FMAPI)** | Foundation Model API (Llama 3.3 70B) alimenta o oponente de IA do jogo |
| **Unity Catalog** | Catálogo `selbetti` vinculado ao Lakebase para governança de dados |
| **Genie Space** | Exploração em linguagem natural dos dados do jogo diretamente do Lakebase |

## Arquitetura

```
+------------------------------------------------------+
|             Databricks App (FastAPI)                  |
|                                                      |
|  Arquivos Estáticos (HTML/JS/CSS)                    |
|  +-- Tela de Cadastro                                |
|  +-- Jogo T-Rex (HTML5 Canvas)                       |
|  +-- Comparação IA vs Humano (Model Serving)          |
|  +-- Ranking                                         |
|                                                      |
|  Endpoints da API                                    |
|  +-- POST /api/register                              |
|  +-- POST /api/score                                 |
|  +-- GET  /api/leaderboard                           |
|  +-- GET  /api/stats                                 |
+------------------------------------------------------+
|  Lakebase         |  Model Serving  |  Unity Catalog |
|  (PostgreSQL)     |  (LLM - FMAPI) |  selbetti.*    |
|  - players        |  - oponente IA  |                |
|  - game_sessions  |  - análise      |  Genie Space   |
|                   |                 |  (consultas    |
|                   |                 |   em linguagem |
|                   |                 |   natural)     |
+------------------------------------------------------+
```

## Fluxo do Usuário

1. **Cadastro** - Jogador insere nome, email e empresa
2. **Jogo** - Jogo do T-Rex runner (pular cactos, abaixar de pássaros)
3. **Envio de Pontuação** - Pontuação enviada para a API, armazenada no Lakebase
4. **IA Joga** - A IA joga sua rodada usando Model Serving
5. **Resultado** - Comparação lado a lado Humano vs IA com análise gerada por LLM, banner de brinde se o humano vencer
6. **Ranking** - Classificação de todos os jogadores (atualiza automaticamente) + chat Genie para explorar dados
7. **Volta ao Cadastro** - Pronto para o próximo visitante do stand

## Estrutura do Projeto

```
t-rex-app/
+-- app.py              # Servidor FastAPI, endpoints da API, servir arquivos estáticos
+-- app.yaml            # Configuração de runtime do Databricks App
+-- requirements.txt    # Dependências Python (psycopg2, openai, databricks-sdk)
+-- db.py               # Conexão com Lakebase (tokens OAuth), gerenciamento de schema, CRUD
+-- llm.py              # Integração com Foundation Model API (oponente IA + análise)
+-- genie.py            # Integração com Genie Conversation API (chat de linguagem natural)
+-- README.md           # Este arquivo
+-- static/
    +-- index.html      # Single-page app (5 telas) com branding Databricks
    +-- style.css       # Tema escuro com cores Databricks (fonte Press Start 2P)
    +-- game.js         # Motor do jogo T-Rex (HTML5 Canvas, sprites pixel-art)
    +-- app.js          # Lógica do app (transições de tela, chamadas API, chat Genie)
```

### Arquivos Backend

| Arquivo | Descrição |
|---------|-----------|
| `app.py` | Servidor FastAPI. Monta arquivos estáticos, define endpoints da API, inicializa banco na startup. Inclui endpoint `/metrics` de health check exigido pelo proxy do Databricks Apps. |
| `db.py` | Camada de conexão com Lakebase (PostgreSQL). Usa `databricks-sdk` para gerar tokens OAuth para o service principal do app. Cria automaticamente as tabelas `players` e `game_sessions` na startup. Inclui refresh automático de token em caso de falha de conexão. |
| `llm.py` | Integração com Foundation Model API via cliente compatível com OpenAI. Alimenta o oponente de IA do jogo — gera pontuações calibradas e análises personalizadas das partidas usando Llama 3.3 70B. Inclui fallback automático para garantir fluxo contínuo do jogo. |
| `genie.py` | Integração com Genie Conversation API via `databricks-sdk`. Permite que jogadores façam perguntas em linguagem natural sobre os dados do jogo diretamente no chat popup do ranking. |
| `app.yaml` | Configuração de runtime do Databricks App. Roda `uvicorn` na porta **8000**. Define variáveis de ambiente para o serving endpoint, conexão Lakebase e Genie Space ID. |

### Arquivos Frontend

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | SPA com 5 telas: Cadastro, Jogo, IA Jogando, Resultados, Ranking. |
| `style.css` | Tema escuro com estética retro pixel-art. Usa fonte `Press Start 2P` do Google Fonts. Responsivo para displays de stand e mobile. |
| `game.js` | Clone completo do T-Rex runner. Sprites pixel-art renderizados em HTML5 Canvas. Dino corre, pula (Espaço/Cima) e abaixa (Baixo). Obstáculos: cactos (3 tipos) e pássaros. Aumento progressivo de velocidade, ciclo dia/noite, contagem de pontuação. |
| `app.js` | Gerenciamento de telas, formulário de cadastro, chamadas API, animação da IA "jogando", animação de contagem de pontuação, renderização do ranking com auto-refresh, e chat popup do Genie com sugestões de perguntas e renderização de tabelas de dados. |

## Pré-requisitos

- Workspace Databricks com:
  - **Databricks CLI** v0.240+ autenticado (`databricks auth login`)
  - **Lakebase Provisioned** habilitado no workspace
  - **Foundation Model API** com acesso (endpoints pay-per-token)
- Python 3.11+ (para testes locais)

## Guia de Deploy

### Passo 1: Criar Recursos no Unity Catalog

Crie o catálogo `selbetti` e vincule-o à instância Lakebase (via Databricks UI: Catalog > Create Catalog > selecione "Lakebase database catalog" e vincule à instância).

### Passo 2: Criar Instância Lakebase

```bash
databricks database create-database-instance trex-game-db --capacity CU_1
```

Aguarde a instância atingir o estado `AVAILABLE`:

```bash
databricks database get-database-instance trex-game-db
```

Anote o valor `read_write_dns` da saída — você precisará dele para o `app.yaml`.

### Passo 3: Atualizar `app.yaml`

Edite `app.yaml` e defina o valor de `LAKEBASE_HOST` com o DNS do Passo 2:

```yaml
env:
  - name: LAKEBASE_HOST
    value: "<seu-dns-da-instância>"
```

### Passo 4: Criar e Fazer Deploy do App

```bash
# Criar o app
databricks apps create t-rex-game --description "T-Rex Runner - Stand de Conferência"

# Sincronizar código fonte para o workspace
databricks sync --full \
  --exclude "__pycache__" --exclude "*.pyc" \
  . /Workspace/Users/<seu-email>/apps/t-rex-game

# Deploy
databricks apps deploy t-rex-game \
  --source-code-path /Workspace/Users/<seu-email>/apps/t-rex-game
```

### Passo 5: Adicionar Recursos ao App

Vincule o banco Lakebase e o endpoint de model serving ao app:

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

### Passo 6: Conceder Permissões no Lakebase

O service principal do app precisa de permissão `CREATE` no schema `public`. Conecte-se à instância Lakebase como seu usuário e execute:

```sql
GRANT CREATE ON SCHEMA public TO "<service-principal-client-id>";
GRANT USAGE ON SCHEMA public TO "<service-principal-client-id>";
```

Você pode encontrar o `service_principal_client_id` na saída de `databricks apps get t-rex-game`.

Para conectar ao Lakebase de uma máquina local:

```python
import psycopg2, subprocess, json

# Gerar token OAuth
result = subprocess.run(
    ["databricks", "database", "generate-database-credential",
     "--json", '{"instance_names": ["trex-game-db"]}', "--output", "json"],
    capture_output=True, text=True
)
token = json.loads(result.stdout)["token"]

conn = psycopg2.connect(
    host="<seu-dns-da-instância>",
    database="databricks_postgres",
    user="<seu-email>",
    password=token,
    port=5432,
    sslmode="require",
)
```

### Passo 7: Refazer Deploy

Após conceder permissões, refaça o deploy para acionar a criação das tabelas:

```bash
databricks sync --full \
  --exclude "__pycache__" --exclude "*.pyc" \
  . /Workspace/Users/<seu-email>/apps/t-rex-game

databricks apps deploy t-rex-game \
  --source-code-path /Workspace/Users/<seu-email>/apps/t-rex-game
```

### Passo 8: Verificar

```bash
databricks apps get t-rex-game
```

O `app_status.state` deve ser `RUNNING`. Abra a `url` da saída no seu navegador.

## Desenvolvimento Local

Execute o app localmente com autenticação Databricks completa:

```bash
databricks apps run-local \
  --entry-point app.yaml \
  --env LAKEBASE_INSTANCE_NAME=trex-game-db \
  --env LAKEBASE_HOST=<seu-dns-da-instância> \
  --env LAKEBASE_DATABASE=databricks_postgres \
  --env LAKEBASE_PORT=5432 \
  --env SERVING_ENDPOINT_NAME=databricks-meta-llama-3-3-70b-instruct
```

O app estará disponível em `http://localhost:8001`.

## Novo Deploy

Após alterações no código:

```bash
databricks sync --full \
  --exclude "__pycache__" --exclude "*.pyc" \
  . /Workspace/Users/<seu-email>/apps/t-rex-game

databricks apps deploy t-rex-game \
  --source-code-path /Workspace/Users/<seu-email>/apps/t-rex-game
```

## Referência da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/` | GET | Serve o SPA do jogo |
| `/metrics` | GET | Health check (exigido pelo proxy do Databricks Apps) |
| `/api/register` | POST | Cadastrar jogador. Body: `{"name", "email", "company"}` |
| `/api/score` | POST | Enviar pontuação. Body: `{"player_id", "player_name", "score"}`. Aciona o Model Serving para a rodada da IA e retorna resultado. |
| `/api/leaderboard` | GET | Top 50 pontuações com informações dos jogadores |
| `/api/stats` | GET | Total de jogadores, partidas, taxa de vitória dos humanos, melhor pontuação |
| `/api/genie/ask` | POST | Pergunta ao Genie. Body: `{"question", "conversation_id?"}`. Retorna texto, SQL, colunas e dados. |

## Schema do Banco de Dados

### `players`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | ID auto-incremento |
| name | VARCHAR(100) | Nome do jogador |
| email | VARCHAR(255) | Email do jogador |
| company | VARCHAR(200) | Nome da empresa |
| created_at | TIMESTAMP | Data/hora do cadastro |

### `game_sessions`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | ID auto-incremento |
| player_id | INTEGER FK | Referência para players(id) |
| human_score | INTEGER | Pontuação do jogador |
| ai_score | INTEGER | Pontuação gerada pela IA |
| human_won | BOOLEAN | Se o jogador venceu a IA |
| llm_commentary | TEXT | Análise da partida gerada pelo LLM |
| created_at | TIMESTAMP | Data/hora da sessão |

## Genie Space

Um Genie Space **"T-Rex Game Analytics"** está configurado para consultar as tabelas do Lakebase diretamente via Unity Catalog (`selbetti.public.players` e `selbetti.public.game_sessions`). Isso permite exploração dos dados do jogo em linguagem natural.

### Configuração

O Genie Space é criado via REST API:

```bash
# Criar o Genie Space (tabelas devem estar ordenadas alfabeticamente por identifier)
databricks api post /api/2.0/genie/spaces --json '{
  "title": "T-Rex Game Analytics",
  "description": "Exploração em linguagem natural dos dados do jogo T-Rex.",
  "warehouse_id": "<id-do-sql-warehouse>",
  "serialized_space": "{\"version\": 2, \"data_sources\": {\"tables\": [{\"identifier\": \"selbetti.public.game_sessions\"}, {\"identifier\": \"selbetti.public.players\"}]}}"
}'
```

### Perguntas de Exemplo

- "Quem tem a maior pontuação?"
- "Qual a taxa de vitória dos humanos contra a IA?"
- "Quantas pessoas jogaram hoje?"
- "Mostre os top 10 jogadores por pontuação"
- "Qual empresa tem mais jogadores?"

## Notas Importantes de Implementação

- **Porta 8000**: Databricks Apps espera o processo do app na porta 8000 (não 8080).
- **Endpoint `/metrics`**: Exigido pelo proxy do Databricks Apps para health checks. Sem ele, o proxy retorna 502.
- **OAuth do Lakebase**: O service principal do app gera tokens OAuth via `databricks-sdk`. Tokens são cacheados e atualizados automaticamente em caso de falha de conexão.
- **`databricks-sdk>=0.81.0`**: Necessário no `requirements.txt` para a API `WorkspaceClient.database`. A versão pré-instalada no runtime do Apps é muito antiga.
- **Permissões do schema**: O service principal precisa receber explicitamente `CREATE` + `USAGE` no schema `public` do Lakebase.
- **Fallback do LLM**: Se a chamada à Foundation Model API falhar, respostas fixas em português são retornadas para que o fluxo do jogo nunca seja interrompido.
- **Calibração da pontuação IA**: Pontuações da IA usam `human_score * uniform(0.8, 1.6) + randint(-10, 30)` para que humanos vençam aproximadamente 30% das vezes.
- **Chat Genie**: Popup de chat integrado na tela de ranking permite perguntas em linguagem natural sobre os dados do jogo. Usa a Genie Conversation API (`w.genie.start_conversation_and_wait`).
