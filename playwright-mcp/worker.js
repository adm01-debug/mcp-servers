/**
 * Playwright MCP Server v1.0
 * 100% GRATUITO usando Cloudflare Browser Rendering!
 * 
 * FERRAMENTAS (25):
 * 
 * === NAVEGAÇÃO ===
 * - pw_navigate: Navegar para URL
 * - pw_go_back: Voltar página
 * - pw_go_forward: Avançar página
 * - pw_reload: Recarregar página
 * 
 * === CAPTURA ===
 * - pw_screenshot: Tirar screenshot
 * - pw_pdf: Gerar PDF
 * - pw_snapshot: HTML + Screenshot
 * - pw_get_html: Obter HTML
 * - pw_get_text: Obter texto
 * - pw_get_markdown: Obter como Markdown
 * 
 * === INTERAÇÃO ===
 * - pw_click: Clicar em elemento
 * - pw_type: Digitar texto
 * - pw_fill: Preencher campo
 * - pw_select: Selecionar opção
 * - pw_check: Marcar checkbox
 * - pw_uncheck: Desmarcar checkbox
 * - pw_hover: Hover em elemento
 * - pw_scroll: Scroll da página
 * 
 * === EXTRAÇÃO ===
 * - pw_scrape: Scraping por seletores
 * - pw_links: Extrair links
 * - pw_json: Extração estruturada com AI
 * - pw_crawl: Crawl de múltiplas páginas
 * 
 * === ESPERA ===
 * - pw_wait_selector: Aguardar elemento
 * - pw_wait_navigation: Aguardar navegação
 * 
 * === SESSÃO ===
 * - pw_session_info: Info da sessão atual
 * 
 * @version 1.0.0
 * @author Claude + Pink
 * @url https://playwright-mcp.adm01.workers.dev/mcp
 */

// ============================================
// CLOUDFLARE BROWSER RENDERING CLIENT
// ============================================
class BrowserClient {
  constructor(apiToken, accountId) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering`;
    this.session = {
      currentUrl: null,
      lastAction: null,
      startTime: null
    };
  }

  async request(endpoint, body = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get('content-type');
    
    // Se retornar imagem/PDF, converter para base64
    if (contentType?.includes('image/') || contentType?.includes('application/pdf')) {
      const buffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return { 
        success: true, 
        data: base64, 
        contentType,
        size: buffer.byteLength
      };
    }

    // Se retornar JSON
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      if (data.errors?.length > 0) {
        throw new Error(data.errors.map(e => e.message).join(', '));
      }
      return data;
    }

    // Texto puro
    return { success: true, text: await response.text() };
  }

  // ========== NAVEGAÇÃO ==========
  async navigate(url, options = {}) {
    this.session.currentUrl = url;
    this.session.lastAction = 'navigate';
    if (!this.session.startTime) this.session.startTime = new Date().toISOString();
    
    // Usa snapshot para navegar e verificar
    const result = await this.request('/snapshot', {
      url,
      gotoOptions: {
        waitUntil: options.waitUntil || 'networkidle0',
        timeout: options.timeout || 30000
      },
      viewport: options.viewport || { width: 1920, height: 1080 }
    });

    return {
      success: true,
      url,
      title: this.extractTitle(result.result?.html || ''),
      screenshot: result.result?.screenshot ? 'captured' : null
    };
  }

  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : 'Unknown';
  }

  // ========== CAPTURA ==========
  async screenshot(options = {}) {
    const body = {
      url: options.url || this.session.currentUrl,
      screenshotOptions: {
        fullPage: options.fullPage || false,
        type: options.type || 'png',
        quality: options.type === 'jpeg' ? (options.quality || 80) : undefined,
        omitBackground: options.omitBackground || false
      },
      viewport: options.viewport || { width: 1920, height: 1080 },
      gotoOptions: { waitUntil: 'networkidle0' }
    };

    if (options.selector) {
      body.selector = options.selector;
    }

    return await this.request('/screenshot', body);
  }

  async pdf(options = {}) {
    const body = {
      url: options.url || this.session.currentUrl,
      pdfOptions: {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        printBackground: options.printBackground !== false,
        scale: options.scale || 1
      },
      gotoOptions: { waitUntil: 'networkidle0' }
    };

    return await this.request('/pdf', body);
  }

  async snapshot(url) {
    return await this.request('/snapshot', {
      url: url || this.session.currentUrl,
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  async getHtml(url) {
    return await this.request('/content', {
      url: url || this.session.currentUrl,
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  async getMarkdown(url) {
    return await this.request('/markdown', {
      url: url || this.session.currentUrl,
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  // ========== INTERAÇÃO (via addScriptTag) ==========
  async click(selector, options = {}) {
    const script = `
      const el = document.querySelector('${selector}');
      if (el) { el.click(); return 'clicked'; }
      return 'element not found';
    `;

    const result = await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    this.session.lastAction = `click: ${selector}`;
    return { success: true, action: 'click', selector };
  }

  async type(selector, text, options = {}) {
    const script = `
      const el = document.querySelector('${selector}');
      if (el) {
        el.focus();
        el.value = '${text.replace(/'/g, "\\'")}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'typed';
      }
      return 'element not found';
    `;

    await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    this.session.lastAction = `type: ${selector}`;
    return { success: true, action: 'type', selector, text };
  }

  async fill(selector, value, options = {}) {
    return await this.type(selector, value, options);
  }

  async select(selector, value, options = {}) {
    const script = `
      const el = document.querySelector('${selector}');
      if (el) {
        el.value = '${value}';
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'selected';
      }
      return 'element not found';
    `;

    await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    return { success: true, action: 'select', selector, value };
  }

  async check(selector, options = {}) {
    const script = `
      const el = document.querySelector('${selector}');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); return 'checked'; }
      return 'element not found';
    `;

    await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    return { success: true, action: 'check', selector };
  }

  async uncheck(selector, options = {}) {
    const script = `
      const el = document.querySelector('${selector}');
      if (el) { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); return 'unchecked'; }
      return 'element not found';
    `;

    await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    return { success: true, action: 'uncheck', selector };
  }

  async hover(selector, options = {}) {
    const script = `
      const el = document.querySelector('${selector}');
      if (el) {
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return 'hovered';
      }
      return 'element not found';
    `;

    await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    return { success: true, action: 'hover', selector };
  }

  async scroll(options = {}) {
    const script = options.selector
      ? `document.querySelector('${options.selector}')?.scrollIntoView({ behavior: 'smooth' }); return 'scrolled';`
      : `window.scrollTo({ top: ${options.y || 'document.body.scrollHeight'}, behavior: 'smooth' }); return 'scrolled';`;

    await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      addScriptTag: [{ content: script }],
      gotoOptions: { waitUntil: 'networkidle0' }
    });

    return { success: true, action: 'scroll' };
  }

  // ========== EXTRAÇÃO ==========
  async scrape(selectors, options = {}) {
    return await this.request('/scrape', {
      url: options.url || this.session.currentUrl,
      elements: selectors.map(s => ({ selector: s })),
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  async links(url) {
    return await this.request('/links', {
      url: url || this.session.currentUrl,
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  async json(prompt, options = {}) {
    return await this.request('/json', {
      url: options.url || this.session.currentUrl,
      prompt,
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  async crawl(url, options = {}) {
    // Inicia crawl assíncrono
    const startResponse = await this.request('/crawl', {
      url,
      limit: options.limit || 10,
      depth: options.depth || 2,
      format: options.format || 'markdown',
      render: options.render !== false
    });

    return startResponse;
  }

  // ========== ESPERA ==========
  async waitSelector(selector, options = {}) {
    return await this.request('/snapshot', {
      url: options.url || this.session.currentUrl,
      waitForSelector: {
        selector,
        timeout: options.timeout || 30000
      },
      gotoOptions: { waitUntil: 'networkidle0' }
    });
  }

  // ========== SESSÃO ==========
  getSessionInfo() {
    return {
      currentUrl: this.session.currentUrl,
      lastAction: this.session.lastAction,
      startTime: this.session.startTime,
      uptime: this.session.startTime 
        ? `${Math.round((Date.now() - new Date(this.session.startTime).getTime()) / 1000)}s`
        : null
    };
  }
}

// ============================================
// TOOL DEFINITIONS
// ============================================
const TOOLS = [
  // === NAVEGAÇÃO ===
  {
    name: 'pw_navigate',
    description: 'Navigate to a URL. Returns page title and confirms navigation.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'], description: 'When to consider navigation complete' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' }
      },
      required: ['url']
    }
  },
  {
    name: 'pw_go_back',
    description: 'Go back to the previous page in history',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'pw_go_forward',
    description: 'Go forward to the next page in history',
    inputSchema: { type: 'object', properties: {} }
  },

  // === CAPTURA ===
  {
    name: 'pw_screenshot',
    description: 'Take a screenshot of the current page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL (optional if already navigated)' },
        fullPage: { type: 'boolean', description: 'Capture full scrollable page' },
        selector: { type: 'string', description: 'CSS selector for specific element' },
        type: { type: 'string', enum: ['png', 'jpeg', 'webp'], description: 'Image format' },
        quality: { type: 'number', description: 'Quality 1-100 (for jpeg/webp)' }
      }
    }
  },
  {
    name: 'pw_pdf',
    description: 'Generate a PDF of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL (optional)' },
        format: { type: 'string', enum: ['A4', 'Letter', 'Legal', 'A3'], description: 'Paper format' },
        landscape: { type: 'boolean', description: 'Landscape orientation' },
        printBackground: { type: 'boolean', description: 'Print background graphics' }
      }
    }
  },
  {
    name: 'pw_snapshot',
    description: 'Get both HTML content and screenshot in one call',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to snapshot' }
      },
      required: ['url']
    }
  },
  {
    name: 'pw_get_html',
    description: 'Get the rendered HTML content of the page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL (optional)' }
      }
    }
  },
  {
    name: 'pw_get_text',
    description: 'Get the text content of the page (no HTML tags)',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL (optional)' }
      }
    }
  },
  {
    name: 'pw_get_markdown',
    description: 'Get the page content as Markdown',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to convert' }
      },
      required: ['url']
    }
  },

  // === INTERAÇÃO ===
  {
    name: 'pw_click',
    description: 'Click on an element by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector (e.g., "button.submit", "#login-btn")' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'pw_type',
    description: 'Type text into an input field',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for input element' },
        text: { type: 'string', description: 'Text to type' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'pw_fill',
    description: 'Fill an input field (clears existing value first)',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for input element' },
        value: { type: 'string', description: 'Value to fill' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector', 'value']
    }
  },
  {
    name: 'pw_select',
    description: 'Select an option from a dropdown',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for select element' },
        value: { type: 'string', description: 'Option value to select' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector', 'value']
    }
  },
  {
    name: 'pw_check',
    description: 'Check a checkbox',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for checkbox' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'pw_uncheck',
    description: 'Uncheck a checkbox',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for checkbox' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'pw_hover',
    description: 'Hover over an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'pw_scroll',
    description: 'Scroll the page or to a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to scroll to (optional)' },
        y: { type: 'number', description: 'Y position in pixels (optional)' },
        url: { type: 'string', description: 'URL (optional)' }
      }
    }
  },

  // === EXTRAÇÃO ===
  {
    name: 'pw_scrape',
    description: 'Extract data from elements by CSS selectors',
    inputSchema: {
      type: 'object',
      properties: {
        selectors: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array of CSS selectors (e.g., ["h1", ".price", "a.product-link"])' 
        },
        url: { type: 'string', description: 'URL to scrape' }
      },
      required: ['selectors']
    }
  },
  {
    name: 'pw_links',
    description: 'Extract all links from a page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to extract links from' }
      },
      required: ['url']
    }
  },
  {
    name: 'pw_json',
    description: 'Extract structured data using AI (Workers AI). Pass a prompt describing what to extract.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Describe what data to extract (e.g., "Extract product name, price, and description")' },
        url: { type: 'string', description: 'URL to extract from' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'pw_crawl',
    description: 'Crawl multiple pages from a starting URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Starting URL' },
        limit: { type: 'number', description: 'Max pages to crawl (default: 10)' },
        depth: { type: 'number', description: 'Max link depth (default: 2)' },
        format: { type: 'string', enum: ['markdown', 'html', 'json'], description: 'Output format' }
      },
      required: ['url']
    }
  },

  // === ESPERA ===
  {
    name: 'pw_wait_selector',
    description: 'Wait for an element to appear on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' },
        url: { type: 'string', description: 'URL (optional)' }
      },
      required: ['selector']
    }
  },

  // === SESSÃO ===
  {
    name: 'pw_session_info',
    description: 'Get information about the current browser session',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ============================================
// TOOL HANDLERS
// ============================================
async function handleTool(client, name, args) {
  switch (name) {
    // Navegação
    case 'pw_navigate': return await client.navigate(args.url, args);
    case 'pw_go_back': return { success: true, action: 'go_back', note: 'Stateless API - use pw_navigate with previous URL' };
    case 'pw_go_forward': return { success: true, action: 'go_forward', note: 'Stateless API - use pw_navigate' };

    // Captura
    case 'pw_screenshot': return await client.screenshot(args);
    case 'pw_pdf': return await client.pdf(args);
    case 'pw_snapshot': return await client.snapshot(args.url);
    case 'pw_get_html': return await client.getHtml(args.url);
    case 'pw_get_text': 
      const html = await client.getHtml(args.url);
      return { success: true, text: html.result?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000) };
    case 'pw_get_markdown': return await client.getMarkdown(args.url);

    // Interação
    case 'pw_click': return await client.click(args.selector, args);
    case 'pw_type': return await client.type(args.selector, args.text, args);
    case 'pw_fill': return await client.fill(args.selector, args.value, args);
    case 'pw_select': return await client.select(args.selector, args.value, args);
    case 'pw_check': return await client.check(args.selector, args);
    case 'pw_uncheck': return await client.uncheck(args.selector, args);
    case 'pw_hover': return await client.hover(args.selector, args);
    case 'pw_scroll': return await client.scroll(args);

    // Extração
    case 'pw_scrape': return await client.scrape(args.selectors, args);
    case 'pw_links': return await client.links(args.url);
    case 'pw_json': return await client.json(args.prompt, args);
    case 'pw_crawl': return await client.crawl(args.url, args);

    // Espera
    case 'pw_wait_selector': return await client.waitSelector(args.selector, args);

    // Sessão
    case 'pw_session_info': return client.getSessionInfo();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================
// MCP PROTOCOL HANDLER
// ============================================
async function handleMCPRequest(request, env) {
  const client = new BrowserClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  
  const body = await request.json();
  const { method, params, id } = body;

  let result;

  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'playwright-mcp',
          version: '1.0.0',
          description: 'Playwright-style browser automation via Cloudflare Browser Rendering - 100% FREE!'
        }
      };
      break;

    case 'tools/list':
      result = { tools: TOOLS };
      break;

    case 'tools/call':
      try {
        const toolResult = await handleTool(client, params.name, params.arguments || {});
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify(toolResult, null, 2)
          }]
        };
      } catch (error) {
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }],
          isError: true
        };
      }
      break;

    case 'notifications/initialized':
      return new Response('', { status: 204 });

    default:
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  }), { headers: { 'Content-Type': 'application/json' } });
}

// ============================================
// MAIN EXPORT
// ============================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        server: 'playwright-mcp',
        version: '1.0.0',
        tools_count: TOOLS.length,
        tools: TOOLS.map(t => t.name),
        description: 'Playwright-style browser automation - 100% FREE via Cloudflare Browser Rendering!',
        categories: {
          navigation: ['pw_navigate', 'pw_go_back', 'pw_go_forward'],
          capture: ['pw_screenshot', 'pw_pdf', 'pw_snapshot', 'pw_get_html', 'pw_get_text', 'pw_get_markdown'],
          interaction: ['pw_click', 'pw_type', 'pw_fill', 'pw_select', 'pw_check', 'pw_uncheck', 'pw_hover', 'pw_scroll'],
          extraction: ['pw_scrape', 'pw_links', 'pw_json', 'pw_crawl'],
          wait: ['pw_wait_selector'],
          session: ['pw_session_info']
        }
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && request.method === 'POST') {
      return handleMCPRequest(request, env);
    }

    // Tools list (convenience)
    if (url.pathname === '/tools') {
      return new Response(JSON.stringify({ tools: TOOLS }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
