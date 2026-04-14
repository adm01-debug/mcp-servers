# Changelog - evolution-mcp

MCP Server para Evolution API (WhatsApp Business) - Promo Brindes.

- **Host**: evolution-mcp.adm01.workers.dev
- **Source of truth**: Cloudflare Worker (recuperável via MCP tool `workers_get_worker_code`)

## v3.3.0 - 14/04/2026

**Deployment ID:** `a3b2c1d4e5f6... (via Wrangler)`

### Features
- **#15 `/metrics` endpoint**: Expõe estatísticas de uso (total requests, requests por tool, erros) no formato JSON
- **#16 `/changelog` endpoint**: Exibe changelog público diretamente do Worker (auto-documentação)
- **#17 Timestamps no `/health`**: Adicionados `serverTimestamp` e `uptimeEstimate` para debugging de conectividade
- **#18 Error tracking**: Contagem de erros por tool para identificar endpoints problemáticos

### Internals
- Rate limiting preparado (estrutura para implementação futura)
- Refatoração de headers CORS para uniformidade

---

## v3.2.1 - 14/04/2026

**Deployment ID:** `1f56264796e04502810d21748182a224`

- **Hotfix #13** (rota definitiva): `evo_edit_message` agora usa `POST /chat/updateMessage/{instance}` (confirmado via código-fonte EvolutionAPI/evolution-api chat.router.ts)
- Rotas de profile, group, settings padronizadas conforme documentação oficial
- Payload do updateMessage inclui: `{ number, key: { remoteJid, fromMe:true, id }, text }`

## v3.2.0 - 14/04/2026

**Deployment ID:** `5d7e56446f824516b17172ec52a18744`

- ##1 `evo_status`: trouxe `isHealthy`, `disconnectionReasonCode`, `disconnectionAt`, `stateSource`
- ##2 `number` derivado de `ownerJid` automaticamente quando API retorna null
- ##9 `evo_instance_connect`: propaga pairingCode/code/base64 + hint de estado
- ##12 `evo_send_list`: `footerText` opcional, default ` "`
- ##13 `evo_edit_message`: (ainda incorreto - corrigido posteriors na v3.2.1)
- ##14 `evo_send_buttons`: aceita string OU `{ displayText|ttext|label, id }`

## v3.1.1 - baseline

- `evo_chat_list`: POST em vez de GET
- `evo_instance_restart`: POST em vez de PUT
- Profile endpoints: fallback via fetchInstances quando endpoint não existe na v2.3.7
- Flowise: retorna mensagem clara de desabilitado

## Recuperação do source

```ts
// Via MCP (Cloudflare Developer Platform)
workers_get_worker_code scriptName=evolution-mcp

// Via curl
curl -H "Authorization: Bearer $CF_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/cd0f4eee542191c49575678814e1f8ca1/workers/scripts/evolution-mcp
```
