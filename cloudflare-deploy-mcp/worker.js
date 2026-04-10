/**
 * Cloudflare Deploy MCP Server v1.0
 * Adiciona ferramentas de DEPLOY que faltam no MCP oficial!
 * 
 * FERRAMENTAS:
 * - worker_deploy: Deploy de worker (código completo)
 * - worker_deploy_simple: Deploy simplificado (inline code)
 * - worker_delete: Deletar worker
 * - secret_put: Adicionar/atualizar secret
 * - secret_delete: Remover secret
 * - secret_list: Listar secrets
 * - kv_put: Escrever no KV
 * - kv_get: Ler do KV
 * - kv_delete: Deletar do KV
 * - kv_list: Listar keys do KV
 * - r2_put: Upload para R2
 * - r2_get: Download do R2
 * - r2_delete: Deletar do R2
 * - r2_list: Listar objetos R2
 * - worker_tail: Ver logs em tempo real
 * - worker_settings: Obter/atualizar settings
 * 
 * @version 1.0.0
 * @author Claude + Pink
 */

// ============================================
// CLOUDFLARE API CLIENT
// ============================================
class CloudflareClient {
  constructor(apiToken, accountId) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
  }

  async request(method, path, body, contentType = 'application/json') {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
    };
    
    if (contentType === 'application/json') {
      headers['Content-Type'] = 'application/json';
    }

    const options = { method, headers };
    
    if (body) {
      if (contentType === 'application/json') {
        options.body = JSON.stringify(body);
      } else {
        options.body = body;
      }
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.success) {
      const errors = data.errors?.map(e => e.message).join(', ') || 'Unknown error';
      throw new Error(errors);
    }

    return data.result;
  }

  // ========== WORKERS ==========
  async deployWorker(scriptName, code, metadata = {}) {
    const formData = new FormData();
    
    // Adicionar código
    const codeBlob = new Blob([code], { type: 'application/javascript+module' });
    formData.append('worker.mjs', codeBlob, 'worker.mjs');
    
    // Metadata
    const meta = {
      main_module: 'worker.mjs',
      compatibility_date: metadata.compatibility_date || '2024-01-01',
      ...metadata
    };
    formData.append('metadata', JSON.stringify(meta));

    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${scriptName}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${this.apiToken}` },
        body: formData
      }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.errors?.map(e => e.message).join(', ') || 'Deploy failed');
    }
    return data.result;
  }

  async deleteWorker(scriptName) {
    return this.request('DELETE', `/accounts/${this.accountId}/workers/scripts/${scriptName}`);
  }

  async getWorkerSettings(scriptName) {
    return this.request('GET', `/accounts/${this.accountId}/workers/scripts/${scriptName}/settings`);
  }

  async listWorkers() {
    return this.request('GET', `/accounts/${this.accountId}/workers/scripts`);
  }

  // ========== SECRETS ==========
  async putSecret(scriptName, secretName, secretValue) {
    return this.request('PUT', 
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets/${secretName}`,
      { name: secretName, text: secretValue, type: 'secret_text' }
    );
  }

  async deleteSecret(scriptName, secretName) {
    return this.request('DELETE',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets/${secretName}`
    );
  }

  async listSecrets(scriptName) {
    return this.request('GET',
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets`
    );
  }

  // ========== KV ==========
  async kvPut(namespaceId, key, value, metadata = null) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'text/plain'
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: value
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'KV put failed');
    return { success: true, key };
  }

  async kvGet(namespaceId, key) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });

    if (response.status === 404) return null;
    return await response.text();
  }

  async kvDelete(namespaceId, key) {
    return this.request('DELETE',
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`
    );
  }

  async kvList(namespaceId, prefix = '', limit = 1000) {
    let path = `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/keys?limit=${limit}`;
    if (prefix) path += `&prefix=${encodeURIComponent(prefix)}`;
    return this.request('GET', path);
  }

  // ========== R2 ==========
  async r2Put(bucketName, key, content, contentType = 'application/octet-stream') {
    // R2 usa S3-compatible API, precisa de endpoint diferente
    const url = `https://${this.accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': contentType
      },
      body: content
    });

    if (!response.ok) {
      throw new Error(`R2 upload failed: ${response.status}`);
    }
    return { success: true, bucket: bucketName, key };
  }

  async r2List(bucketName, prefix = '', limit = 1000) {
    return this.request('GET',
      `/accounts/${this.accountId}/r2/buckets/${bucketName}/objects?prefix=${encodeURIComponent(prefix)}&limit=${limit}`
    );
  }

  async r2Delete(bucketName, key) {
    return this.request('DELETE',
      `/accounts/${this.accountId}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`
    );
  }

  // ========== SUBDOMAIN/ROUTES ==========
  async enableWorkersSubdomain() {
    return this.request('PUT', `/accounts/${this.accountId}/workers/subdomain`, { enabled: true });
  }

  async getWorkersSubdomain() {
    return this.request('GET', `/accounts/${this.accountId}/workers/subdomain`);
  }
}

// ============================================
// TOOL DEFINITIONS
// ============================================
const TOOLS = [
  // === DEPLOY ===
  {
    name: 'cf_worker_deploy',
    description: 'Deploy a Cloudflare Worker. Supports ES modules format. The worker will be available at {name}.{subdomain}.workers.dev',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Worker script name (e.g., my-api)' },
        code: { type: 'string', description: 'Full JavaScript/TypeScript code for the worker (ES module format with export default)' },
        compatibility_date: { type: 'string', description: 'Compatibility date (default: 2024-01-01)' }
      },
      required: ['name', 'code']
    }
  },
  {
    name: 'cf_worker_delete',
    description: 'Delete a Cloudflare Worker permanently',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Worker script name to delete' }
      },
      required: ['name']
    }
  },
  {
    name: 'cf_worker_list',
    description: 'List all Cloudflare Workers in the account',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'cf_worker_get_settings',
    description: 'Get settings and bindings of a Worker',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Worker script name' }
      },
      required: ['name']
    }
  },

  // === SECRETS ===
  {
    name: 'cf_secret_put',
    description: 'Add or update a secret for a Worker',
    inputSchema: {
      type: 'object',
      properties: {
        worker_name: { type: 'string', description: 'Worker script name' },
        secret_name: { type: 'string', description: 'Name of the secret (e.g., API_KEY)' },
        secret_value: { type: 'string', description: 'Secret value' }
      },
      required: ['worker_name', 'secret_name', 'secret_value']
    }
  },
  {
    name: 'cf_secret_delete',
    description: 'Delete a secret from a Worker',
    inputSchema: {
      type: 'object',
      properties: {
        worker_name: { type: 'string', description: 'Worker script name' },
        secret_name: { type: 'string', description: 'Name of the secret to delete' }
      },
      required: ['worker_name', 'secret_name']
    }
  },
  {
    name: 'cf_secret_list',
    description: 'List all secrets for a Worker (names only, not values)',
    inputSchema: {
      type: 'object',
      properties: {
        worker_name: { type: 'string', description: 'Worker script name' }
      },
      required: ['worker_name']
    }
  },

  // === KV ===
  {
    name: 'cf_kv_put',
    description: 'Write a value to KV namespace',
    inputSchema: {
      type: 'object',
      properties: {
        namespace_id: { type: 'string', description: 'KV namespace ID' },
        key: { type: 'string', description: 'Key to write' },
        value: { type: 'string', description: 'Value to store' }
      },
      required: ['namespace_id', 'key', 'value']
    }
  },
  {
    name: 'cf_kv_get',
    description: 'Read a value from KV namespace',
    inputSchema: {
      type: 'object',
      properties: {
        namespace_id: { type: 'string', description: 'KV namespace ID' },
        key: { type: 'string', description: 'Key to read' }
      },
      required: ['namespace_id', 'key']
    }
  },
  {
    name: 'cf_kv_delete',
    description: 'Delete a key from KV namespace',
    inputSchema: {
      type: 'object',
      properties: {
        namespace_id: { type: 'string', description: 'KV namespace ID' },
        key: { type: 'string', description: 'Key to delete' }
      },
      required: ['namespace_id', 'key']
    }
  },
  {
    name: 'cf_kv_list',
    description: 'List keys in KV namespace',
    inputSchema: {
      type: 'object',
      properties: {
        namespace_id: { type: 'string', description: 'KV namespace ID' },
        prefix: { type: 'string', description: 'Optional prefix filter' },
        limit: { type: 'number', description: 'Max keys to return (default 1000)' }
      },
      required: ['namespace_id']
    }
  },

  // === R2 ===
  {
    name: 'cf_r2_put',
    description: 'Upload content to R2 bucket',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'R2 bucket name' },
        key: { type: 'string', description: 'Object key (path)' },
        content: { type: 'string', description: 'Content to upload (text or base64)' },
        content_type: { type: 'string', description: 'MIME type (default: text/plain)' }
      },
      required: ['bucket', 'key', 'content']
    }
  },
  {
    name: 'cf_r2_list',
    description: 'List objects in R2 bucket',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'R2 bucket name' },
        prefix: { type: 'string', description: 'Optional prefix filter' },
        limit: { type: 'number', description: 'Max objects to return' }
      },
      required: ['bucket']
    }
  },
  {
    name: 'cf_r2_delete',
    description: 'Delete object from R2 bucket',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string', description: 'R2 bucket name' },
        key: { type: 'string', description: 'Object key to delete' }
      },
      required: ['bucket', 'key']
    }
  },

  // === UTILITY ===
  {
    name: 'cf_subdomain_get',
    description: 'Get workers.dev subdomain info',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'cf_health_check',
    description: 'Check Cloudflare API health and account info',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ============================================
// TOOL HANDLERS
// ============================================
async function handleTool(client, name, args) {
  switch (name) {
    // === DEPLOY ===
    case 'cf_worker_deploy':
      return await client.deployWorker(args.name, args.code, {
        compatibility_date: args.compatibility_date || '2024-01-01'
      });

    case 'cf_worker_delete':
      await client.deleteWorker(args.name);
      return { success: true, deleted: args.name };

    case 'cf_worker_list':
      return await client.listWorkers();

    case 'cf_worker_get_settings':
      return await client.getWorkerSettings(args.name);

    // === SECRETS ===
    case 'cf_secret_put':
      return await client.putSecret(args.worker_name, args.secret_name, args.secret_value);

    case 'cf_secret_delete':
      await client.deleteSecret(args.worker_name, args.secret_name);
      return { success: true, deleted: args.secret_name };

    case 'cf_secret_list':
      return await client.listSecrets(args.worker_name);

    // === KV ===
    case 'cf_kv_put':
      return await client.kvPut(args.namespace_id, args.key, args.value);

    case 'cf_kv_get':
      const value = await client.kvGet(args.namespace_id, args.key);
      return value !== null ? { key: args.key, value } : { key: args.key, value: null, found: false };

    case 'cf_kv_delete':
      await client.kvDelete(args.namespace_id, args.key);
      return { success: true, deleted: args.key };

    case 'cf_kv_list':
      return await client.kvList(args.namespace_id, args.prefix || '', args.limit || 1000);

    // === R2 ===
    case 'cf_r2_put':
      return await client.r2Put(args.bucket, args.key, args.content, args.content_type || 'text/plain');

    case 'cf_r2_list':
      return await client.r2List(args.bucket, args.prefix || '', args.limit || 1000);

    case 'cf_r2_delete':
      await client.r2Delete(args.bucket, args.key);
      return { success: true, deleted: args.key };

    // === UTILITY ===
    case 'cf_subdomain_get':
      return await client.getWorkersSubdomain();

    case 'cf_health_check':
      const workers = await client.listWorkers();
      return {
        status: 'ok',
        account_id: client.accountId,
        workers_count: workers.length,
        timestamp: new Date().toISOString()
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================
// MCP PROTOCOL HANDLER
// ============================================
async function handleMCPRequest(request, env) {
  const client = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  
  const body = await request.json();
  const { method, params, id } = body;

  let result;

  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'cloudflare-deploy-mcp',
          version: '1.0.0',
          description: 'Deploy Workers, manage secrets, KV, and R2 via MCP'
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
        server: 'cloudflare-deploy-mcp',
        version: '1.0.0',
        tools_count: TOOLS.length,
        tools: TOOLS.map(t => t.name),
        description: 'Deploy Workers, manage secrets, KV, and R2 via MCP'
      }), {
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
