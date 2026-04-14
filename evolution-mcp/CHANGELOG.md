# Evolution MCP Server - CHANGELOG

## [3.4.0] - 2026-04-14

### 🚀 New Features
- **Rate Limiting Real**: 100 requests/min com burst de 20 req/5s
- **Headers X-RateLimit-***: Limit, Remaining, Reset em todas as respostas
- **Latency Tracking**: Métricas de latência por tool (avg, min, max)
- **Abuse Protection**: Resposta 429 com retry-after para requests bloqueados
- **Slowest/Fastest Tool**: Tracking automático de performance

### 📊 Metrics Expandidas
- `rateLimited`: Contador de requests bloqueados por rate limit
- `toolLatency`: Objeto com latência por tool
- `slowestTool` / `fastestTool`: Identificação automática

### 🔧 Technical
- Rate limiter in-memory por isolate Cloudflare
- Burst window de 5 segundos para proteção contra spikes
- Graceful degradation em caso de sobrecarga

---

## [3.3.0] - 2026-04-14

### 🚀 New Features
- **Endpoint /metrics**: Contadores de uso, success rate, last tool
- **Endpoint /changelog**: Histórico de versões público
- **Timestamps no /health**: `timestamp`, `uptimeMs` adicionados
- **Graceful Degradation**: Respostas parciais quando API instável

### 📊 Metrics
- `totalCalls`, `successCalls`, `errorCalls`
- `successRate` percentual calculado
- `lastOk`, `lastError` com timestamps
- `toolCounts` por ferramenta

---

## [3.2.1] - 2026-04-14

### 🐛 Hotfix
- **Fix #13**: Rota correta `POST /chat/updateMessage/{instance}` para edição de mensagens

---

## [3.2.0] - 2026-04-14

### 🐛 Bug Fixes
- **Fix #1**: Campo `isHealthy` adicionado ao status (boolean confiável)
- **Fix #2**: Campo `number` extraído de `ownerJid` quando ausente
- **Fix #9**: Hint de QR code com diagnóstico de estado zumbi
- **Fix #12**: `footerText` com espaço quando vazio (evita erro 400)
- **Fix #14**: Botões aceitam string[] ou objeto[] flexível

### 🔧 Improvements
- Profile fetch via `/instance/fetchInstances` (compatível v2.3.7)
- Melhor tratamento de erros em respostas da API

---

## [3.1.1] - 2026-04-14

### 🔧 Baseline
- Chat list via `POST /chat/findChats/{instance}`
- Instance restart via `POST /instance/restart/{instance}`
- Profile via fetchInstances (não fetchProfile)
- 89 tools MCP operacionais

---

## Infraestrutura - 2026-04-14

### Workers Cloudflare
| Worker | Versão | Status | URL |
|--------|--------|--------|-----|
| evolution-mcp | v3.4.0 | ✅ LIVE | https://evolution-mcp.adm01.workers.dev |
| portainer-mcp | v1.0.0 | ⚠️ Backend 503 | https://portainer-mcp.adm01.workers.dev |

### Webhook Configuration
- **URL**: `https://tdprnylgyrogbbhgdoik.supabase.co/functions/v1/evolution-webhook`
- **Events**: 28/31 (90.3% cobertura)
- **Missing**: NEW_JWT_TOKEN, INSTANCE_CREATE, INSTANCE_DELETE (admin events)

### Evolution API
- **Host**: https://evolution.atomicabr.com.br
- **Instance**: wpp2
- **Version**: v2.3.7
- **Connection**: OPEN ✅

---

## Session Summary - 10/10 Improvements

| # | Improvement | Status |
|---|-------------|--------|
| 1 | Portainer MCP investigation | ⚠️ Server offline (503) |
| 2 | Instance restart (clear zombie) | ✅ |
| 3 | Evolution MCP v3.3.0 | ✅ |
| 4 | Bitrix24 notification | ✅ |
| 5 | CHANGELOG GitHub commit | ✅ |
| 6 | Portainer MCP Worker created | ✅ |
| 7 | Rate Limiting v3.4.0 | ✅ |
| 8 | Webhook expansion (90.3%) | ✅ |
| 9 | Dashboard React component | ✅ |
| 10 | Final documentation | ✅ |

---

## Tools Reference (89 total)

### Instance Management
- `evo_status` - Status com isHealthy
- `evo_instance_list` - Lista instâncias
- `evo_instance_create` - Cria instância
- `evo_instance_connect` - QR Code
- `evo_instance_restart` - Reinicia
- `evo_instance_logout` - Logout
- `evo_instance_delete` - Delete
- `evo_instance_info` - Info detalhada

### Messaging
- `evo_send_text` - Texto simples
- `evo_send_media` - Imagem/vídeo/doc/áudio
- `evo_send_audio` - Áudio PTT
- `evo_send_sticker` - Sticker
- `evo_send_location` - Localização
- `evo_send_contact` - Contato vCard
- `evo_send_buttons` - Botões interativos
- `evo_send_list` - Lista de opções
- `evo_send_poll` - Enquete
- `evo_send_reaction` - Reação emoji
- `evo_send_template` - Template HSM
- `evo_edit_message` - Editar mensagem
- `evo_delete_message` - Deletar mensagem

### Chat Management
- `evo_chat_list` - Listar chats
- `evo_find_messages` - Buscar mensagens
- `evo_mark_read` - Marcar como lida
- `evo_mark_unread` - Marcar como não lida
- `evo_archive_chat` - Arquivar chat
- `evo_check_number` - Verificar WhatsApp

### Groups
- `evo_groups` - Listar grupos
- `evo_group_create` - Criar grupo
- `evo_group_info` - Info do grupo
- `evo_group_participants` - Participantes
- `evo_group_update_*` - Atualizar configs

### Integrations
- `evo_webhook` / `evo_set_webhook`
- `evo_typebot_*` - Typebot
- `evo_openai_*` - OpenAI
- `evo_chatwoot_*` - Chatwoot
- `evo_dify_*` - Dify
- `evo_flowise_*` - Flowise

### Pipeline (Labels)
- `evo_labels` - Listar labels
- `evo_label_handle` - Add/remove label

---

*Promo Brindes - Evolution MCP Server*
*Powered by Cloudflare Workers*
