# MCP Servers Collection

Coleção de servidores MCP (Model Context Protocol) para integração com Claude.ai.

## 📦 Servidores Disponíveis

| MCP | Ferramentas | URL | Descrição |
|-----|-------------|-----|-----------|
| **GitHub MCP** | 108 | `https://github-mcp-server.adm01.workers.dev/mcp` | Gerenciamento completo de repositórios GitHub |
| **Cloudflare Deploy MCP** | 16 | `https://cloudflare-deploy-mcp.adm01.workers.dev/mcp` | Deploy e gerenciamento de infraestrutura Cloudflare |
| **Playwright MCP** | 23 | `https://playwright-mcp.adm01.workers.dev/mcp` | Automação de browser via Cloudflare Browser Rendering |

## 🚀 Quick Start

Para adicionar um MCP no Claude.ai:
1. Vá em **Settings** → **Integrations** → **MCP Servers**
2. Adicione a URL do MCP desejado
3. Autorize a conexão

## 📁 Estrutura

```
mcp-servers/
├── README.md
├── github-mcp-server/
│   ├── worker.js
│   └── README.md
├── cloudflare-deploy-mcp/
│   ├── worker.js
│   └── README.md
└── playwright-mcp/
    ├── worker.js
    └── README.md
```

## 🔧 Tecnologias

- **Runtime:** Cloudflare Workers
- **Protocolo:** MCP (Model Context Protocol)
- **Linguagem:** JavaScript (ES Modules)

## 📄 Licença

MIT

---

*Mantido por adm01-debug*
