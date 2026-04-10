# GitHub MCP Server v3.0

Servidor MCP para GitHub com **108 ferramentas** - PARIDADE TOTAL com o oficial!

## 🌐 Deploy

**URL:** `https://github-mcp-server.adm01.workers.dev/mcp`  
**Plataforma:** Cloudflare Workers

## ✨ Funcionalidades v3.0

### Base (63 tools - v2.0)
- Repos, Branches, Files, Commits
- Issues, Pull Requests, Comments
- Search (code, repos, issues)
- Actions (workflows, runs, jobs)
- Gists, Releases, Tags
- Collaborators, Rate Limit

### Novidades v3.0 (+45 tools)
- **Notifications:** list, get_thread, mark_read, mark_all_read, subscriptions (9 tools)
- **Stars:** list_starred, is_starred, star_repo, unstar_repo, list_stargazers (5 tools)
- **Organizations:** get_org, list_members, list_teams, get_team (6 tools)
- **Code Security:** list/get/update code scanning alerts (3 tools)
- **Dependabot:** list/get/update vulnerability alerts (3 tools)
- **Secret Scanning:** list/get/update alerts + locations (4 tools)
- **Security Advisories:** global + repo advisories (4 tools)
- **Labels:** CRUD completo (5 tools)
- **Discussions:** via GraphQL (3 tools)
- **Search Users/Orgs:** (2 tools)

## 🔧 Configuração

O worker usa a variável de ambiente `GITHUB_TOKEN` (secret no Cloudflare).

## 📄 Licença

MIT © 2026 Claude + Pink
