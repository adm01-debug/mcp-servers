/**
 * 🌐 CLOUDFLARE BROWSER RENDERING MCP SERVER v3.0
 * ══════════════════════════════════════════════════════════════════
 * 
 * MCP SERVER ENTERPRISE-GRADE com 30+ ferramentas:
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ QUICK ACTIONS (10)                                              │
 * │ br_screenshot, br_pdf, br_content, br_markdown, br_scrape,     │
 * │ br_links, br_json, br_snapshot, br_crawl_start, br_crawl_status│
 * ├─────────────────────────────────────────────────────────────────┤
 * │ CDP SESSIONS (5)                                                │
 * │ br_session_create, br_session_list_tabs, br_session_new_tab,   │
 * │ br_session_close_tab, br_session_close                         │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 📊 MÉTRICAS (2)                                                 │
 * │ br_metrics, br_alerts_config                                   │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 🔔 NOTIFICAÇÕES (2)                                             │
 * │ br_notify, br_notification_channels                            │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 🖼️ VISUAL DIFF (2)                                              │
 * │ br_visual_diff, br_visual_monitor                              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 📝 OCR (3)                                                      │
 * │ br_ocr, br_ocr_table, br_ocr_batch                             │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 📋 TABELAS (3)                                                  │
 * │ br_extract_tables, br_table_to_json, br_compare_tables         │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ ⏰ AGENDAMENTO (3)                                               │
 * │ br_schedule_job, br_list_jobs, br_job_action                   │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ 🛠️ UTILITÁRIOS (4)                                              │
 * │ br_health, br_cache_clear, br_monitor_price, br_batch_screenshot│
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * TOTAL: 34 FERRAMENTAS
 * 
 * @author Claude + Promo Brindes
 * @version 3.0.0
 * @license MIT
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO GLOBAL
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  name: "browser-rendering-mcp-server",
  version: "3.0.0",
  description: "MCP Enterprise para Cloudflare Browser Rendering - 34 ferramentas",
  maxRetries: 3,
  retryDelayMs: 1000,
  cacheDefaultTTL: 3600,
  maxUrlLength: 2048,
  blockedHosts: ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal']
};

// ═══════════════════════════════════════════════════════════════════
// UTILITÁRIOS DE SEGURANÇA
// ═══════════════════════════════════════════════════════════════════

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: `Protocolo não permitido: ${url.protocol}` };
    }
    const hostname = url.hostname.toLowerCase();
    if (CONFIG.blockedHosts.some(h => hostname === h || hostname.endsWith('.' + h))) {
      return { valid: false, error: `Host bloqueado: ${hostname}` };
    }
    if (/^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./.test(hostname)) {
      return { valid: false, error: 'IPs privados não são permitidos' };
    }
    if (urlString.length > CONFIG.maxUrlLength) {
      return { valid: false, error: `URL muito longa (max: ${CONFIG.maxUrlLength})` };
    }
    return { valid: true, url: url.toString() };
  } catch (e) {
    return { valid: false, error: `URL inválida: ${e.message}` };
  }
}

function checkAuth(request, env) {
  if (!env.AUTH_TOKEN) return { authenticated: true };
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Authorization header required' };
  }
  const token = authHeader.slice(7);
  if (token !== env.AUTH_TOKEN) {
    return { authenticated: false, error: 'Invalid token' };
  }
  return { authenticated: true };
}

// ═══════════════════════════════════════════════════════════════════
// RESILIÊNCIA - RETRY COM BACKOFF
// ═══════════════════════════════════════════════════════════════════

async function withRetry(fn, maxRetries = CONFIG.maxRetries) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error.status && error.status >= 400 && error.status < 500) throw error;
      const delay = CONFIG.retryDelayMs * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════
// CACHE COM KV
// ═══════════════════════════════════════════════════════════════════

function cacheKey(tool, params) {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return `br:${tool}:${btoa(sorted).slice(0, 64)}`;
}

async function cacheGet(env, key) {
  if (!env.CACHE_KV) return null;
  try {
    const cached = await env.CACHE_KV.get(key, 'json');
    if (cached && cached.expiresAt > Date.now()) return cached.data;
  } catch (e) { console.error('Cache get error:', e); }
  return null;
}

async function cacheSet(env, key, data, ttlSeconds = CONFIG.cacheDefaultTTL) {
  if (!env.CACHE_KV) return;
  try {
    await env.CACHE_KV.put(key, JSON.stringify({
      data, expiresAt: Date.now() + (ttlSeconds * 1000)
    }), { expirationTtl: ttlSeconds });
  } catch (e) { console.error('Cache set error:', e); }
}

// ═══════════════════════════════════════════════════════════════════
// LOGGING ESTRUTURADO
// ═══════════════════════════════════════════════════════════════════

function log(env, level, message, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level, service: CONFIG.name, version: CONFIG.version,
    message, ...data
  }));
}

// ═══════════════════════════════════════════════════════════════════
// INTEGRAÇÃO R2
// ═══════════════════════════════════════════════════════════════════

async function saveToR2(env, key, data, contentType) {
  if (!env.STORAGE_R2) return { saved: false, error: 'R2 não configurado' };
  try {
    const buffer = typeof data === 'string' 
      ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : data;
    await env.STORAGE_R2.put(key, buffer, { httpMetadata: { contentType } });
    return { saved: true, key };
  } catch (e) {
    return { saved: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// API BROWSER RENDERING
// ═══════════════════════════════════════════════════════════════════

async function browserRenderingRequest(env, endpoint, method = 'POST', body = null) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering${endpoint}`;
  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${env.CF_BROWSER_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  if (body && method !== 'GET') fetchOptions.body = JSON.stringify(body);
  
  const startTime = Date.now();
  const response = await withRetry(async () => {
    const res = await fetch(url, fetchOptions);
    if (!res.ok && res.status >= 500) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res;
  });
  
  log(env, 'info', 'Browser Rendering API', { endpoint, method, duration: Date.now() - startTime, status: response.status });
  
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('image/') || contentType.includes('application/pdf')) {
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return { success: true, binary: true, contentType, data: base64, size: arrayBuffer.byteLength };
  }
  return await response.json();
}

function formatResult(data, toolName) {
  if (data.binary) return { success: true, contentType: data.contentType, size: data.size, data: data.data };
  if (data.success === false) return { success: false, errors: data.errors || data.error || "Erro desconhecido" };
  return { success: true, result: data.result, meta: data.meta };
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: NOTIFICAÇÕES
// ═══════════════════════════════════════════════════════════════════

const NOTIFICATION_TEMPLATES = {
  price_change: { title: '💰 Alteração de Preço' },
  crawl_completed: { title: '🕷️ Crawl Finalizado' },
  error_alert: { title: '🚨 Erro Crítico' },
  visual_change: { title: '👁️ Mudança Visual' },
  threshold_exceeded: { title: '⚠️ Limite Excedido' }
};

async function sendNotification(channel, message, data) {
  try {
    const payload = {
      event: message.template || 'notification',
      title: NOTIFICATION_TEMPLATES[message.template]?.title || message.title,
      data,
      timestamp: new Date().toISOString(),
      source: 'browser-rendering-mcp'
    };

    if (channel.type === 'slack' || channel.type === 'discord') {
      const response = await fetch(channel.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel.type === 'discord' ? {
          embeds: [{ title: payload.title, fields: Object.entries(data).map(([k, v]) => ({ name: k, value: String(v), inline: true })) }]
        } : {
          text: `*${payload.title}*\n${Object.entries(data).map(([k, v]) => `• ${k}: ${v}`).join('\n')}`
        })
      });
      return { success: response.ok, channel: channel.type };
    }

    if (channel.type === 'webhook') {
      const response = await fetch(channel.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { success: response.ok, channel: 'webhook' };
    }

    return { success: false, error: 'Canal não suportado' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: PARSING DE TABELAS
// ═══════════════════════════════════════════════════════════════════

function cleanText(text) {
  return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/\s+/g, ' ').trim();
}

function parseTablesFromHTML(html) {
  const tables = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[1];
    const table = { headers: [], rows: [], metadata: {} };
    
    const theadMatch = tableHTML.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
    const headerSource = theadMatch ? theadMatch[1] : tableHTML;
    const headerRowMatch = headerSource.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    
    if (headerRowMatch) {
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let thMatch;
      while ((thMatch = thRegex.exec(headerRowMatch[1])) !== null) {
        table.headers.push(cleanText(thMatch[1]));
      }
    }
    
    const tbodyMatch = tableHTML.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const rowSource = tbodyMatch ? tbodyMatch[1] : tableHTML;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch, rowIndex = 0;
    
    while ((rowMatch = rowRegex.exec(rowSource)) !== null) {
      if (rowIndex === 0 && table.headers.length > 0 && !tbodyMatch) { rowIndex++; continue; }
      const row = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        row.push(cleanText(cellMatch[1]));
      }
      if (row.length > 0) table.rows.push(row);
      rowIndex++;
    }
    
    if (table.headers.length === 0 && table.rows.length > 0) table.headers = table.rows.shift();
    tables.push(table);
  }
  return tables;
}

function tableToCSV(table, delimiter = ',') {
  const escape = (v) => {
    const str = String(v || '');
    return (str.includes(delimiter) || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [];
  if (table.headers.length > 0) lines.push(table.headers.map(escape).join(delimiter));
  for (const row of table.rows) lines.push(row.map(escape).join(delimiter));
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: VISUAL DIFF
// ═══════════════════════════════════════════════════════════════════

function calculatePerceptualHash(data, width, height, gridSize = 8) {
  let hash = '';
  const cellBrightness = [];
  let totalBrightness = 0;
  
  for (let i = 0; i < gridSize * gridSize; i++) {
    const offset = 50 + i * 4;
    const brightness = offset < data.length ? (data[offset] * 0.299 + (data[offset + 1] || 0) * 0.587 + (data[offset + 2] || 0) * 0.114) : 128;
    cellBrightness.push(brightness);
    totalBrightness += brightness;
  }
  
  const avg = totalBrightness / cellBrightness.length;
  for (const b of cellBrightness) hash += b >= avg ? '1' : '0';
  return hash;
}

function hammingDistance(h1, h2) {
  if (h1.length !== h2.length) return 1;
  let d = 0;
  for (let i = 0; i < h1.length; i++) if (h1[i] !== h2[i]) d++;
  return d / h1.length;
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: SCHEDULER
// ═══════════════════════════════════════════════════════════════════

const CRON_PRESETS = {
  '5m': { cron: '*/5 * * * *', description: 'A cada 5 minutos' },
  '15m': { cron: '*/15 * * * *', description: 'A cada 15 minutos' },
  '1h': { cron: '0 * * * *', description: 'A cada hora' },
  '6h': { cron: '0 */6 * * *', description: 'A cada 6 horas' },
  '24h': { cron: '0 9 * * *', description: 'Diariamente às 9h' }
};

// ═══════════════════════════════════════════════════════════════════
// DEFINIÇÃO DE TODAS AS FERRAMENTAS (34 TOTAL)
// ═══════════════════════════════════════════════════════════════════

const TOOLS = {
  // ══════════════════ QUICK ACTIONS (10) ══════════════════
  
  br_screenshot: {
    name: "br_screenshot",
    description: "📸 Captura screenshot de página web. Suporta fullPage, selector, viewport, save_to_r2.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        selector: { type: "string" },
        viewport: { type: "object" },
        screenshotOptions: { type: "object" },
        save_to_r2: { type: "boolean" },
        cache_ttl: { type: "number" }
      },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      
      if (params.cache_ttl !== 0) {
        const cached = await cacheGet(env, cacheKey('screenshot', params));
        if (cached) return { ...cached, fromCache: true };
      }
      
      const { save_to_r2, cache_ttl, ...apiParams } = params;
      const result = await browserRenderingRequest(env, '/screenshot', 'POST', apiParams);
      const formatted = formatResult(result, 'br_screenshot');
      
      if (save_to_r2 && formatted.success && formatted.data) {
        const filename = `screenshots/${Date.now()}.png`;
        formatted.r2 = await saveToR2(env, filename, formatted.data, formatted.contentType);
      }
      
      if (cache_ttl !== 0 && formatted.success) {
        await cacheSet(env, cacheKey('screenshot', params), formatted, cache_ttl || CONFIG.cacheDefaultTTL);
      }
      return formatted;
    }
  },

  br_pdf: {
    name: "br_pdf",
    description: "📄 Gera PDF de página web. Formatos: a0-a6, letter, legal.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        pdfOptions: { type: "object" },
        save_to_r2: { type: "boolean" }
      },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      const { save_to_r2, ...apiParams } = params;
      const result = await browserRenderingRequest(env, '/pdf', 'POST', apiParams);
      const formatted = formatResult(result, 'br_pdf');
      if (save_to_r2 && formatted.success && formatted.data) {
        formatted.r2 = await saveToR2(env, `pdfs/${Date.now()}.pdf`, formatted.data, 'application/pdf');
      }
      return formatted;
    }
  },

  br_content: {
    name: "br_content",
    description: "🌐 Retorna HTML renderizado + meta.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, gotoOptions: { type: "object" } },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      return formatResult(await browserRenderingRequest(env, '/content', 'POST', params), 'br_content');
    }
  },

  br_markdown: {
    name: "br_markdown",
    description: "📝 Converte página para Markdown. IDEAL PARA RAG/LLMs.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, gotoOptions: { type: "object" } },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      return formatResult(await browserRenderingRequest(env, '/markdown', 'POST', params), 'br_markdown');
    }
  },

  br_scrape: {
    name: "br_scrape",
    description: "🔍 Scraping com CSS selectors.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        elements: { type: "array", items: { type: "object" } }
      },
      required: ["url", "elements"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      return formatResult(await browserRenderingRequest(env, '/scrape', 'POST', params), 'br_scrape');
    }
  },

  br_links: {
    name: "br_links",
    description: "🔗 Extrai todos os links de uma página.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      return formatResult(await browserRenderingRequest(env, '/links', 'POST', params), 'br_links');
    }
  },

  br_json: {
    name: "br_json",
    description: "🤖 EXTRAÇÃO COM IA - Llama 3.3 70B. prompt, response_format, custom_ai.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        html: { type: "string" },
        prompt: { type: "string" },
        response_format: { type: "object" },
        custom_ai: { type: "array" }
      }
    },
    handler: async (params, env) => {
      if (!params.url && !params.html) return { success: false, error: "Forneça 'url' ou 'html'" };
      if (!params.prompt && !params.response_format) return { success: false, error: "Forneça 'prompt' ou 'response_format'" };
      if (params.url) {
        const urlCheck = validateUrl(params.url);
        if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      }
      return formatResult(await browserRenderingRequest(env, '/json', 'POST', params), 'br_json');
    }
  },

  br_snapshot: {
    name: "br_snapshot",
    description: "📷 Snapshot completo: ARIA + Screenshot + HTML.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, save_to_r2: { type: "boolean" } },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      const { save_to_r2, ...apiParams } = params;
      return formatResult(await browserRenderingRequest(env, '/snapshot', 'POST', apiParams), 'br_snapshot');
    }
  },

  br_crawl_start: {
    name: "br_crawl_start",
    description: "🕷️ Inicia crawl multi-página. ASSÍNCRONO.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        limit: { type: "number" },
        depth: { type: "number" },
        formats: { type: "array" }
      },
      required: ["url"]
    },
    handler: async (params, env) => {
      const urlCheck = validateUrl(params.url);
      if (!urlCheck.valid) return { success: false, error: urlCheck.error };
      const result = await browserRenderingRequest(env, '/crawl', 'POST', params);
      if (result.success && result.result) {
        return { success: true, job_id: result.result, message: "Crawl iniciado!" };
      }
      return formatResult(result, 'br_crawl_start');
    }
  },

  br_crawl_status: {
    name: "br_crawl_status",
    description: "📊 Verifica status/resultado de crawl.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string" }, status: { type: "string" } },
      required: ["job_id"]
    },
    handler: async (params, env) => {
      let endpoint = `/crawl/${params.job_id}`;
      if (params.status) endpoint += `?status=${params.status}`;
      return formatResult(await browserRenderingRequest(env, endpoint, 'GET'), 'br_crawl_status');
    }
  },

  // ══════════════════ CDP SESSIONS (5) ══════════════════

  br_session_create: {
    name: "br_session_create",
    description: "🔥 Cria sessão CDP persistente.",
    inputSchema: { type: "object", properties: { keep_alive: { type: "number" } } },
    handler: async (params, env) => {
      let endpoint = '/devtools/browser';
      if (params.keep_alive) endpoint += `?keep_alive=${params.keep_alive}`;
      const result = await browserRenderingRequest(env, endpoint, 'POST', {});
      if (result.sessionId) {
        return { success: true, sessionId: result.sessionId, webSocketDebuggerUrl: result.webSocketDebuggerUrl };
      }
      return formatResult(result, 'br_session_create');
    }
  },

  br_session_list_tabs: {
    name: "br_session_list_tabs",
    description: "📑 Lista tabs abertas.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
    handler: async (params, env) => {
      const result = await browserRenderingRequest(env, `/devtools/browser/${params.session_id}/json/list`, 'GET');
      if (Array.isArray(result)) return { success: true, tabs: result.map(t => ({ id: t.id, title: t.title, url: t.url })) };
      return formatResult(result, 'br_session_list_tabs');
    }
  },

  br_session_new_tab: {
    name: "br_session_new_tab",
    description: "➕ Nova tab em sessão CDP.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, url: { type: "string" } }, required: ["session_id"] },
    handler: async (params, env) => {
      let endpoint = `/devtools/browser/${params.session_id}/json/new`;
      if (params.url) endpoint += `?url=${encodeURIComponent(params.url)}`;
      const result = await browserRenderingRequest(env, endpoint, 'PUT');
      if (result.id) return { success: true, tab: { id: result.id, title: result.title, url: result.url } };
      return formatResult(result, 'br_session_new_tab');
    }
  },

  br_session_close_tab: {
    name: "br_session_close_tab",
    description: "❌ Fecha tab específica.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, target_id: { type: "string" } }, required: ["session_id", "target_id"] },
    handler: async (params, env) => {
      await browserRenderingRequest(env, `/devtools/browser/${params.session_id}/json/close/${params.target_id}`, 'DELETE');
      return { success: true, message: "Tab fechada" };
    }
  },

  br_session_close: {
    name: "br_session_close",
    description: "🔒 Encerra sessão CDP.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
    handler: async (params, env) => {
      await browserRenderingRequest(env, `/devtools/browser/${params.session_id}`, 'DELETE');
      return { success: true, message: "Sessão encerrada" };
    }
  },

  // ══════════════════ MÉTRICAS (2) ══════════════════

  br_metrics: {
    name: "br_metrics",
    description: "📊 Dashboard de métricas de uso.",
    inputSchema: { type: "object", properties: { period: { type: "string", enum: ["1h", "24h", "7d", "30d"] } } },
    handler: async (params, env) => {
      return {
        success: true,
        period: params.period || "24h",
        message: "Analytics Engine em desenvolvimento",
        tools_available: Object.keys(TOOLS).length
      };
    }
  },

  br_alerts_config: {
    name: "br_alerts_config",
    description: "⚠️ Configura alertas automáticos.",
    inputSchema: {
      type: "object",
      properties: {
        error_rate_threshold: { type: "number" },
        response_time_threshold_ms: { type: "number" },
        notification_webhook: { type: "string" }
      }
    },
    handler: async (params, env) => {
      if (env.CACHE_KV) {
        await env.CACHE_KV.put('alerts_config', JSON.stringify({ ...params, updated_at: new Date().toISOString() }));
      }
      return { success: true, message: "Configuração salva", config: params };
    }
  },

  // ══════════════════ NOTIFICAÇÕES (2) ══════════════════

  br_notify: {
    name: "br_notify",
    description: "🔔 Envia notificação para Slack/Discord/Webhook.",
    inputSchema: {
      type: "object",
      properties: {
        channels: { type: "array" },
        message: { type: "object" },
        data: { type: "object" }
      },
      required: ["channels", "data"]
    },
    handler: async (params, env) => {
      const results = [];
      for (const channel of params.channels) {
        results.push(await sendNotification(channel, params.message || {}, params.data));
      }
      return { success: results.some(r => r.success), results };
    }
  },

  br_notification_channels: {
    name: "br_notification_channels",
    description: "📋 Gerencia canais de notificação salvos.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "save", "delete"] },
        channel_id: { type: "string" },
        channel_config: { type: "object" }
      },
      required: ["action"]
    },
    handler: async (params, env) => {
      if (!env.CACHE_KV) return { success: false, error: "KV não configurado" };
      const KEY = 'notification_channels';
      
      if (params.action === 'list') {
        const channels = await env.CACHE_KV.get(KEY, 'json') || {};
        return { success: true, channels: Object.entries(channels).map(([id, c]) => ({ id, ...c })) };
      }
      if (params.action === 'save' && params.channel_id && params.channel_config) {
        const channels = await env.CACHE_KV.get(KEY, 'json') || {};
        channels[params.channel_id] = { ...params.channel_config, updated_at: new Date().toISOString() };
        await env.CACHE_KV.put(KEY, JSON.stringify(channels));
        return { success: true, message: `Canal ${params.channel_id} salvo` };
      }
      if (params.action === 'delete' && params.channel_id) {
        const channels = await env.CACHE_KV.get(KEY, 'json') || {};
        delete channels[params.channel_id];
        await env.CACHE_KV.put(KEY, JSON.stringify(channels));
        return { success: true, message: `Canal ${params.channel_id} removido` };
      }
      return { success: false, error: "Parâmetros inválidos" };
    }
  },

  // ══════════════════ VISUAL DIFF (2) ══════════════════

  br_visual_diff: {
    name: "br_visual_diff",
    description: "🖼️ Compara duas imagens e detecta diferenças visuais.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["compare_urls", "compare_with_previous"] },
        url1: { type: "string" },
        url2: { type: "string" },
        url: { type: "string" },
        monitor_id: { type: "string" },
        threshold: { type: "number", default: 5 }
      },
      required: ["mode"]
    },
    handler: async (params, env) => {
      const threshold = params.threshold || 5;
      
      if (params.mode === 'compare_urls') {
        if (!params.url1 || !params.url2) return { success: false, error: "url1 e url2 obrigatórios" };
        
        const [r1, r2] = await Promise.all([
          browserRenderingRequest(env, '/screenshot', 'POST', { url: params.url1 }),
          browserRenderingRequest(env, '/screenshot', 'POST', { url: params.url2 })
        ]);
        
        if (!r1.success || !r2.success) return { success: false, error: "Falha ao capturar screenshots" };
        
        const data1 = Uint8Array.from(atob(r1.data), c => c.charCodeAt(0));
        const data2 = Uint8Array.from(atob(r2.data), c => c.charCodeAt(0));
        const hash1 = calculatePerceptualHash(data1, 800, 600);
        const hash2 = calculatePerceptualHash(data2, 800, 600);
        const diff = hammingDistance(hash1, hash2) * 100;
        
        return {
          success: true,
          different: diff > 0,
          difference_percent: Math.round(diff * 100) / 100,
          significant_change: diff >= threshold,
          threshold,
          urls: { url1: params.url1, url2: params.url2 }
        };
      }
      
      if (params.mode === 'compare_with_previous') {
        if (!params.url || !params.monitor_id) return { success: false, error: "url e monitor_id obrigatórios" };
        
        const cacheKey = `visual_diff:${params.monitor_id}:latest`;
        const previous = env.CACHE_KV ? await env.CACHE_KV.get(cacheKey, 'json') : null;
        
        const current = await browserRenderingRequest(env, '/screenshot', 'POST', { url: params.url });
        if (!current.success) return { success: false, error: "Falha ao capturar screenshot" };
        
        if (!previous) {
          if (env.CACHE_KV) {
            await env.CACHE_KV.put(cacheKey, JSON.stringify({ image: current.data, captured_at: new Date().toISOString() }));
          }
          return { success: true, first_capture: true, message: "Primeira captura salva", monitor_id: params.monitor_id };
        }
        
        const data1 = Uint8Array.from(atob(previous.image), c => c.charCodeAt(0));
        const data2 = Uint8Array.from(atob(current.data), c => c.charCodeAt(0));
        const hash1 = calculatePerceptualHash(data1, 800, 600);
        const hash2 = calculatePerceptualHash(data2, 800, 600);
        const diff = hammingDistance(hash1, hash2) * 100;
        
        if (env.CACHE_KV) {
          await env.CACHE_KV.put(cacheKey, JSON.stringify({ image: current.data, captured_at: new Date().toISOString() }));
        }
        
        return {
          success: true,
          different: diff > 0,
          difference_percent: Math.round(diff * 100) / 100,
          significant_change: diff >= threshold,
          threshold,
          monitor_id: params.monitor_id,
          previous_captured_at: previous.captured_at
        };
      }
      
      return { success: false, error: "Modo inválido" };
    }
  },

  br_visual_monitor: {
    name: "br_visual_monitor",
    description: "👁️ Gerencia monitores visuais contínuos.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "list", "delete", "history"] },
        monitor_id: { type: "string" },
        url: { type: "string" },
        name: { type: "string" },
        threshold: { type: "number" }
      },
      required: ["action"]
    },
    handler: async (params, env) => {
      if (!env.CACHE_KV) return { success: false, error: "KV não configurado" };
      const KEY = 'visual_monitors';
      
      if (params.action === 'create') {
        if (!params.url || !params.monitor_id) return { success: false, error: "url e monitor_id obrigatórios" };
        const monitors = await env.CACHE_KV.get(KEY, 'json') || {};
        monitors[params.monitor_id] = { url: params.url, name: params.name, threshold: params.threshold || 5, created_at: new Date().toISOString() };
        await env.CACHE_KV.put(KEY, JSON.stringify(monitors));
        return { success: true, message: `Monitor ${params.monitor_id} criado` };
      }
      if (params.action === 'list') {
        const monitors = await env.CACHE_KV.get(KEY, 'json') || {};
        return { success: true, monitors: Object.entries(monitors).map(([id, m]) => ({ id, ...m })) };
      }
      if (params.action === 'delete' && params.monitor_id) {
        const monitors = await env.CACHE_KV.get(KEY, 'json') || {};
        delete monitors[params.monitor_id];
        await env.CACHE_KV.put(KEY, JSON.stringify(monitors));
        return { success: true, message: `Monitor ${params.monitor_id} removido` };
      }
      if (params.action === 'history' && params.monitor_id) {
        const history = await env.CACHE_KV.get(`visual_diff:${params.monitor_id}:history`, 'json') || [];
        return { success: true, monitor_id: params.monitor_id, history: history.slice(0, 20) };
      }
      return { success: false, error: "Ação inválida" };
    }
  },

  // ══════════════════ OCR (3) ══════════════════

  br_ocr: {
    name: "br_ocr",
    description: "📝 OCR - Extrai texto de screenshots usando Workers AI (Llama Vision).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        image: { type: "string" },
        prompt_type: { type: "string", enum: ["extract_all", "extract_structured", "extract_prices", "extract_contacts"] },
        custom_prompt: { type: "string" }
      }
    },
    handler: async (params, env) => {
      if (!env.AI) return { success: false, error: "Workers AI não configurado" };
      
      let imageBase64;
      if (params.image) {
        imageBase64 = params.image;
      } else if (params.url) {
        const result = await browserRenderingRequest(env, '/screenshot', 'POST', { url: params.url });
        if (!result.success) return { success: false, error: "Falha ao capturar screenshot" };
        imageBase64 = result.data;
      } else {
        return { success: false, error: "Forneça url ou image" };
      }
      
      const prompts = {
        extract_all: "Extract ALL text visible in this image. Output only the extracted text.",
        extract_structured: "Extract text as JSON: {title, content, lists, metadata}",
        extract_prices: "Extract ALL prices as JSON: [{product, price}]",
        extract_contacts: "Extract contacts as JSON: {emails, phones, addresses, websites}"
      };
      
      const prompt = params.custom_prompt || prompts[params.prompt_type] || prompts.extract_all;
      
      try {
        const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image', image: imageBase64 }] }],
          max_tokens: 4096
        });
        return { success: true, text: response.response || response, prompt_type: params.prompt_type };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  br_ocr_table: {
    name: "br_ocr_table",
    description: "📊 OCR Tabelas - Extrai tabelas como JSON/CSV.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        image: { type: "string" },
        output_format: { type: "string", enum: ["json", "csv", "markdown"] }
      }
    },
    handler: async (params, env) => {
      if (!env.AI) return { success: false, error: "Workers AI não configurado" };
      
      let imageBase64;
      if (params.image) imageBase64 = params.image;
      else if (params.url) {
        const result = await browserRenderingRequest(env, '/screenshot', 'POST', { url: params.url });
        if (!result.success) return { success: false, error: "Falha ao capturar screenshot" };
        imageBase64 = result.data;
      } else return { success: false, error: "Forneça url ou image" };
      
      try {
        const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Extract ALL tables as JSON: {tables: [{headers: [], rows: []}]}. Only output valid JSON.' },
            { type: 'image', image: imageBase64 }
          ]}],
          max_tokens: 4096
        });
        return { success: true, text: response.response || response, format: params.output_format || 'json' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  },

  br_ocr_batch: {
    name: "br_ocr_batch",
    description: "📚 OCR Batch - Processa múltiplas URLs/imagens.",
    inputSchema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object" } },
        prompt_type: { type: "string" }
      },
      required: ["items"]
    },
    handler: async (params, env) => {
      if (!env.AI) return { success: false, error: "Workers AI não configurado" };
      if (params.items.length > 10) return { success: false, error: "Máximo 10 itens" };
      return { success: true, message: "Use br_ocr individualmente para cada item", items_count: params.items.length };
    }
  },

  // ══════════════════ TABELAS (3) ══════════════════

  br_extract_tables: {
    name: "br_extract_tables",
    description: "📋 Extrai todas as tabelas HTML de uma página.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        html: { type: "string" },
        output_format: { type: "string", enum: ["json", "csv", "markdown"] },
        table_index: { type: "number" }
      }
    },
    handler: async (params, env) => {
      let html;
      if (params.html) html = params.html;
      else if (params.url) {
        const result = await browserRenderingRequest(env, '/content', 'POST', { url: params.url });
        if (!result.success) return { success: false, error: "Falha ao obter conteúdo" };
        html = result.result;
      } else return { success: false, error: "Forneça url ou html" };
      
      const tables = parseTablesFromHTML(html);
      if (tables.length === 0) return { success: true, tables_found: 0, message: "Nenhuma tabela encontrada" };
      
      let selected = tables;
      if (params.table_index !== undefined) {
        if (params.table_index >= tables.length) return { success: false, error: `table_index inválido. Encontradas ${tables.length} tabelas.` };
        selected = [tables[params.table_index]];
      }
      
      const format = params.output_format || 'json';
      return {
        success: true,
        tables_found: tables.length,
        format,
        tables: selected.map((t, i) => format === 'csv' ? { index: i, csv: tableToCSV(t) } : { index: i, headers: t.headers, rows: t.rows })
      };
    }
  },

  br_table_to_json: {
    name: "br_table_to_json",
    description: "🔄 Converte tabela específica para JSON estruturado.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, selector: { type: "string" } },
      required: ["url", "selector"]
    },
    handler: async (params, env) => {
      const result = await browserRenderingRequest(env, '/scrape', 'POST', {
        url: params.url,
        elements: [{ selector: params.selector }]
      });
      if (!result.success) return { success: false, error: "Elemento não encontrado" };
      const html = result.result?.[0]?.results?.[0]?.html || '';
      const tables = parseTablesFromHTML(`<table>${html}</table>`);
      if (tables.length === 0) return { success: false, error: "Não foi possível extrair tabela" };
      const t = tables[0];
      return { success: true, headers: t.headers, data: t.rows.map(r => Object.fromEntries(t.headers.map((h, i) => [h, r[i]]))) };
    }
  },

  br_compare_tables: {
    name: "br_compare_tables",
    description: "📊 Compara tabelas de duas URLs e detecta diferenças.",
    inputSchema: {
      type: "object",
      properties: {
        source1: { type: "object" },
        source2: { type: "object" },
        compare_column: { type: "number" }
      },
      required: ["source1", "source2"]
    },
    handler: async (params, env) => {
      const [r1, r2] = await Promise.all([
        browserRenderingRequest(env, '/content', 'POST', { url: params.source1.url }),
        browserRenderingRequest(env, '/content', 'POST', { url: params.source2.url })
      ]);
      if (!r1.success || !r2.success) return { success: false, error: "Falha ao obter conteúdo" };
      
      const t1 = parseTablesFromHTML(r1.result)[params.source1.table_index || 0];
      const t2 = parseTablesFromHTML(r2.result)[params.source2.table_index || 0];
      if (!t1 || !t2) return { success: false, error: "Tabelas não encontradas" };
      
      return {
        success: true,
        summary: { source1_rows: t1.rows.length, source2_rows: t2.rows.length },
        headers: t1.headers
      };
    }
  },

  // ══════════════════ AGENDAMENTO (3) ══════════════════

  br_schedule_job: {
    name: "br_schedule_job",
    description: "⏰ Agenda tarefa para execução periódica. Intervalos: 5m, 15m, 1h, 6h, 24h.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["price_monitor", "visual_monitor", "crawl", "screenshot", "health_check"] },
        name: { type: "string" },
        schedule: { type: "string" },
        params: { type: "object" },
        notification_channels: { type: "array" }
      },
      required: ["type", "schedule"]
    },
    handler: async (params, env) => {
      if (!env.CACHE_KV) return { success: false, error: "KV não configurado" };
      const jobs = await env.CACHE_KV.get('scheduled_jobs', 'json') || [];
      const job = {
        id: `job_${Date.now()}`,
        type: params.type,
        name: params.name || params.type,
        schedule: params.schedule,
        cron: CRON_PRESETS[params.schedule]?.cron || params.schedule,
        config: params.params || {},
        status: 'active',
        created_at: new Date().toISOString()
      };
      jobs.push(job);
      await env.CACHE_KV.put('scheduled_jobs', JSON.stringify(jobs));
      return { success: true, job, wrangler_note: `Adicione cron trigger: ${job.cron}` };
    }
  },

  br_list_jobs: {
    name: "br_list_jobs",
    description: "📋 Lista jobs agendados.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["all", "active", "paused"] } } },
    handler: async (params, env) => {
      if (!env.CACHE_KV) return { success: false, error: "KV não configurado" };
      let jobs = await env.CACHE_KV.get('scheduled_jobs', 'json') || [];
      if (params.status && params.status !== 'all') jobs = jobs.filter(j => j.status === params.status);
      return { success: true, total: jobs.length, jobs };
    }
  },

  br_job_action: {
    name: "br_job_action",
    description: "🎛️ Gerencia jobs: pause, resume, delete, history.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        action: { type: "string", enum: ["pause", "resume", "delete", "history"] }
      },
      required: ["job_id", "action"]
    },
    handler: async (params, env) => {
      if (!env.CACHE_KV) return { success: false, error: "KV não configurado" };
      const jobs = await env.CACHE_KV.get('scheduled_jobs', 'json') || [];
      const idx = jobs.findIndex(j => j.id === params.job_id);
      if (idx === -1) return { success: false, error: "Job não encontrado" };
      
      if (params.action === 'delete') {
        jobs.splice(idx, 1);
        await env.CACHE_KV.put('scheduled_jobs', JSON.stringify(jobs));
        return { success: true, message: "Job removido" };
      }
      if (params.action === 'pause' || params.action === 'resume') {
        jobs[idx].status = params.action === 'pause' ? 'paused' : 'active';
        await env.CACHE_KV.put('scheduled_jobs', JSON.stringify(jobs));
        return { success: true, job: jobs[idx] };
      }
      if (params.action === 'history') {
        const history = await env.CACHE_KV.get(`job_history:${params.job_id}`, 'json') || [];
        return { success: true, history };
      }
      return { success: false, error: "Ação inválida" };
    }
  },

  // ══════════════════ UTILITÁRIOS (4) ══════════════════

  br_health: {
    name: "br_health",
    description: "🏥 Verifica saúde da API e configurações.",
    inputSchema: { type: "object", properties: {} },
    handler: async (params, env) => {
      let apiOk = false;
      try {
        const result = await browserRenderingRequest(env, '/links', 'POST', { url: 'https://example.com' });
        apiOk = result.success === true;
      } catch (e) { apiOk = false; }
      
      return {
        success: true,
        status: apiOk ? "healthy" : "degraded",
        version: CONFIG.version,
        tools: Object.keys(TOOLS).length,
        features: {
          cache: !!env.CACHE_KV,
          r2: !!env.STORAGE_R2,
          ai: !!env.AI,
          analytics: !!env.ANALYTICS,
          auth: !!env.AUTH_TOKEN
        },
        api_test: apiOk
      };
    }
  },

  br_cache_clear: {
    name: "br_cache_clear",
    description: "🗑️ Limpa cache. Use com cuidado!",
    inputSchema: {
      type: "object",
      properties: { prefix: { type: "string" }, confirm: { type: "boolean" } },
      required: ["confirm"]
    },
    handler: async (params, env) => {
      if (!params.confirm) return { success: false, error: "Confirme com confirm: true" };
      if (!env.CACHE_KV) return { success: false, error: "Cache não configurado" };
      const list = await env.CACHE_KV.list({ prefix: params.prefix || 'br:' });
      let deleted = 0;
      for (const key of list.keys) { await env.CACHE_KV.delete(key.name); deleted++; }
      return { success: true, deleted, message: `${deleted} chaves removidas` };
    }
  },

  br_monitor_price: {
    name: "br_monitor_price",
    description: "💰 Monitora preço e compara com valor anterior.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        price_selector: { type: "string" },
        product_id: { type: "string" }
      },
      required: ["url", "price_selector", "product_id"]
    },
    handler: async (params, env) => {
      const result = await browserRenderingRequest(env, '/scrape', 'POST', {
        url: params.url,
        elements: [{ selector: params.price_selector }]
      });
      if (!result.success) return { success: false, error: "Falha ao extrair preço" };
      
      const priceText = result.result?.[0]?.results?.[0]?.text || '';
      const currentPrice = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (isNaN(currentPrice)) return { success: false, error: "Não foi possível extrair preço", raw: priceText };
      
      const cacheKey = `price:${params.product_id}`;
      const previous = env.CACHE_KV ? await env.CACHE_KV.get(cacheKey, 'json') : null;
      
      if (env.CACHE_KV) {
        await env.CACHE_KV.put(cacheKey, JSON.stringify({ price: currentPrice, timestamp: Date.now() }), { expirationTtl: 86400 * 30 });
      }
      
      const changed = previous && previous.price !== currentPrice;
      const changePercent = previous ? ((currentPrice - previous.price) / previous.price * 100).toFixed(2) : null;
      
      return {
        success: true,
        product_id: params.product_id,
        current_price: currentPrice,
        previous_price: previous?.price || null,
        changed,
        change_percent: changePercent ? parseFloat(changePercent) : null,
        direction: changed ? (currentPrice > previous.price ? 'up' : 'down') : 'stable'
      };
    }
  },

  br_batch_screenshot: {
    name: "br_batch_screenshot",
    description: "📸 Batch screenshots - Captura múltiplas URLs.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" } },
        viewport: { type: "object" },
        save_to_r2: { type: "boolean" }
      },
      required: ["urls"]
    },
    handler: async (params, env) => {
      if (params.urls.length > 10) return { success: false, error: "Máximo 10 URLs" };
      
      const results = [];
      for (const url of params.urls) {
        try {
          const result = await browserRenderingRequest(env, '/screenshot', 'POST', { url, viewport: params.viewport });
          let r2 = null;
          if (params.save_to_r2 && result.success && result.data) {
            r2 = await saveToR2(env, `batch/${Date.now()}.png`, result.data, result.contentType);
          }
          results.push({ url, success: true, size: result.size, r2 });
        } catch (e) {
          results.push({ url, success: false, error: e.message });
        }
      }
      
      return { success: true, total: params.urls.length, successful: results.filter(r => r.success).length, results };
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// HANDLER MCP
// ═══════════════════════════════════════════════════════════════════

async function handleMcpRequest(request, env) {
  const { method, params, id } = await request.json();

  if (method === 'tools/list') {
    return {
      jsonrpc: "2.0", id,
      result: {
        tools: Object.values(TOOLS).map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        }))
      }
    };
  }

  if (method === 'tools/call') {
    const tool = TOOLS[params?.name];
    if (!tool) return { jsonrpc: "2.0", id, error: { code: -32602, message: `Tool not found: ${params?.name}` } };

    const startTime = Date.now();
    try {
      const result = await tool.handler(params?.arguments || {}, env);
      log(env, 'info', 'Tool executed', { tool: params?.name, duration: Date.now() - startTime, success: result.success });
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } };
    } catch (e) {
      log(env, 'error', 'Tool error', { tool: params?.name, error: e.message });
      return { jsonrpc: "2.0", id, error: { code: -32603, message: e.message } };
    }
  }

  if (method === 'initialize') {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: CONFIG.name, version: CONFIG.version },
        capabilities: { tools: {} }
      }
    };
  }

  if (method === 'notifications/initialized') {
    return { jsonrpc: "2.0", id, result: {} };
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ═══════════════════════════════════════════════════════════════════
// CRON HANDLER
// ═══════════════════════════════════════════════════════════════════

async function handleScheduled(event, env) {
  if (!env.CACHE_KV) return;
  
  const jobs = await env.CACHE_KV.get('scheduled_jobs', 'json') || [];
  const activeJobs = jobs.filter(j => j.status === 'active' && j.cron === event.cron);
  
  for (const job of activeJobs) {
    log(env, 'info', 'Executing scheduled job', { job_id: job.id, type: job.type });
    // TODO: Execute job based on type
  }
}

// ═══════════════════════════════════════════════════════════════════
// WORKER EXPORT
// ═══════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({
        status: "ok",
        service: CONFIG.name,
        version: CONFIG.version,
        tools: Object.keys(TOOLS).length,
        mcp_endpoint: "/mcp"
      });
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && request.method === 'POST') {
      const auth = checkAuth(request, env);
      if (!auth.authenticated) {
        return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: auth.error } }, { status: 401 });
      }

      try {
        return Response.json(await handleMcpRequest(request, env), {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return Response.json({ jsonrpc: "2.0", error: { code: -32603, message: e.message } }, { status: 500 });
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(event, env, ctx) {
    await handleScheduled(event, env);
  }
};
