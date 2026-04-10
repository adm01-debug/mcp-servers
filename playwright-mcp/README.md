# Playwright MCP Server

MCP Server para automação de browser usando Cloudflare Browser Rendering API com interface Playwright-style.

## 🌐 URL do MCP
```
https://playwright-mcp.adm01.workers.dev/mcp
```

## 🔧 Ferramentas Disponíveis (23)

### Navegação
| Ferramenta | Descrição |
|------------|-----------|
| `pw_navigate` | Navega para URL |
| `pw_go_back` | Volta página anterior |
| `pw_go_forward` | Avança próxima página |

### Captura
| Ferramenta | Descrição |
|------------|-----------|
| `pw_screenshot` | Screenshot PNG |
| `pw_pdf` | Gera PDF |
| `pw_snapshot` | ARIA snapshot |
| `pw_get_html` | HTML da página |
| `pw_get_text` | Texto puro |
| `pw_get_markdown` | Página em Markdown |

### Interação
| Ferramenta | Descrição |
|------------|-----------|
| `pw_click` | Clica em elemento |
| `pw_type` | Digita texto |
| `pw_fill` | Preenche campo |
| `pw_select` | Seleciona opção |
| `pw_check` | Marca checkbox |
| `pw_uncheck` | Desmarca checkbox |
| `pw_hover` | Hover sobre elemento |
| `pw_scroll` | Scroll na página |

### Extração
| Ferramenta | Descrição |
|------------|-----------|
| `pw_scrape` | Scraping por CSS |
| `pw_links` | Extrai todos os links |
| `pw_json` | Extração estruturada |
| `pw_crawl` | Crawl de múltiplas páginas |

### Espera
| Ferramenta | Descrição |
|------------|-----------|
| `pw_wait_selector` | Aguarda elemento |

### Sessão
| Ferramenta | Descrição |
|------------|-----------|
| `pw_session_info` | Info da sessão |

## 🔑 Secrets Necessários

```
CF_API_TOKEN    # Token com permissão Browser Rendering - Edit
CF_ACCOUNT_ID   # ID da conta Cloudflare
```

## ⚠️ Permissão Especial

O token da API Cloudflare precisa ter a permissão:
- **Account → Browser Rendering → Edit**

Crie em: https://dash.cloudflare.com/profile/api-tokens

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
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/playwright-mcp" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -F "worker.js=@worker.js;type=application/javascript+module" \
  -F "metadata=@metadata.json;type=application/json"

# Configurar secrets (usar token com Browser Rendering)
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/playwright-mcp/secrets" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "CF_API_TOKEN", "text": "BROWSER_RENDERING_TOKEN", "type": "secret_text"}'
```

## 🆚 Comparação com outros MCPs

| Recurso | Playwright MCP | Bright Data | Chrome Browser |
|---------|----------------|-------------|----------------|
| Custo | GRÁTIS ♾️ | 5k/mês | GRÁTIS ♾️ |
| Click/Type | ✅ | ✅ | ❌ |
| Screenshot | ✅ | ✅ | ✅ |
| PDF | ✅ | ❌ | ✅ |
| Markdown | ✅ | ✅ | ✅ |
| Bypass CAPTCHA | ❌ | ✅ | ❌ |

## 📄 Licença
MIT
