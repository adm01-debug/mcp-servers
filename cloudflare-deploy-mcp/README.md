# Cloudflare Deploy MCP Server

MCP Server para gerenciamento de infraestrutura Cloudflare via Claude.ai.

## 🌐 URL do MCP
```
https://cloudflare-deploy-mcp.adm01.workers.dev/mcp
```

## 🔧 Ferramentas Disponíveis (16)

### Workers
| Ferramenta | Descrição |
|------------|-----------|
| `cf_workers_list` | Lista todos os workers |
| `cf_worker_get` | Detalhes de um worker |
| `cf_worker_deploy` | Deploy de código |
| `cf_worker_delete` | Remove worker |

### Secrets
| Ferramenta | Descrição |
|------------|-----------|
| `cf_secret_put` | Cria/atualiza secret |
| `cf_secret_list` | Lista secrets |
| `cf_secret_delete` | Remove secret |

### KV Namespaces
| Ferramenta | Descrição |
|------------|-----------|
| `cf_kv_list` | Lista namespaces |
| `cf_kv_create` | Cria namespace |
| `cf_kv_delete` | Remove namespace |

### R2 Buckets
| Ferramenta | Descrição |
|------------|-----------|
| `cf_r2_list` | Lista buckets |
| `cf_r2_create` | Cria bucket |
| `cf_r2_delete` | Remove bucket |

### Subdomains
| Ferramenta | Descrição |
|------------|-----------|
| `cf_subdomain_enable` | Ativa workers.dev |
| `cf_subdomain_get` | Consulta status |

### Health
| Ferramenta | Descrição |
|------------|-----------|
| `cf_health` | Status da infraestrutura |

## 🔑 Secrets Necessários

```
CF_API_TOKEN    # Token da API Cloudflare
CF_ACCOUNT_ID   # ID da conta Cloudflare
```

## 📦 Deploy

```bash
# Criar metadata.json
cat > metadata.json << 'METADATA'
{
  "main_module": "worker.js",
  "compatibility_date": "2024-01-01",
  "bindings": []
}
METADATA

# Deploy via curl
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/cloudflare-deploy-mcp" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -F "worker.js=@worker.js;type=application/javascript+module" \
  -F "metadata=@metadata.json;type=application/json"

# Configurar secrets
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/cloudflare-deploy-mcp/secrets" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "CF_API_TOKEN", "text": "YOUR_TOKEN", "type": "secret_text"}'
```

## 📄 Licença
MIT
