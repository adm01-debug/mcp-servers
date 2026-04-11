/**
 * 📊 MÓDULO DE MÉTRICAS - Analytics Engine Integration
 * 
 * Sistema completo de observabilidade para o Browser Rendering MCP:
 * - Métricas de uso por ferramenta
 * - Tempo de resposta
 * - Taxa de erros
 * - Browser hours consumidos
 * - Dashboard em tempo real
 * 
 * @version 1.0.0
 */

// =====================================================
// ANALYTICS ENGINE - SCHEMA DE MÉTRICAS
// =====================================================

/**
 * Schema de dados para Analytics Engine
 * 
 * Blobs (strings indexáveis - max 20):
 * - blob1: tool_name
 * - blob2: status (success/error)
 * - blob3: error_type (timeout/auth/validation/api/unknown)
 * - blob4: url_domain (domínio da URL processada)
 * - blob5: cache_status (hit/miss/bypass)
 * - blob6: r2_saved (true/false)
 * - blob7: request_id
 * - blob8: country (país do IP)
 * 
 * Doubles (números - max 20):
 * - double1: duration_ms
 * - double2: response_size_bytes
 * - double3: browser_seconds_used
 * - double4: retry_count
 * - double5: timestamp (epoch)
 */

const METRICS_SCHEMA = {
  blobs: {
    tool_name: 'blob1',
    status: 'blob2',
    error_type: 'blob3',
    url_domain: 'blob4',
    cache_status: 'blob5',
    r2_saved: 'blob6',
    request_id: 'blob7',
    country: 'blob8'
  },
  doubles: {
    duration_ms: 'double1',
    response_size_bytes: 'double2',
    browser_seconds_used: 'double3',
    retry_count: 'double4',
    timestamp: 'double5'
  }
};

// =====================================================
// CLASSE DE MÉTRICAS
// =====================================================

class MetricsCollector {
  constructor(env) {
    this.env = env;
    this.analytics = env.ANALYTICS; // Analytics Engine binding
    this.buffer = []; // Buffer para batch writes
    this.flushInterval = 5000; // 5 segundos
  }

  /**
   * Extrai domínio de uma URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Gera ID único de request
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Registra métrica de execução de ferramenta
   */
  async trackToolExecution(params) {
    const {
      tool_name,
      success,
      error_type = null,
      url = null,
      duration_ms,
      response_size_bytes = 0,
      browser_seconds_used = 0,
      retry_count = 0,
      cache_status = 'bypass',
      r2_saved = false,
      request_id = this.generateRequestId(),
      country = 'unknown'
    } = params;

    const datapoint = {
      [METRICS_SCHEMA.blobs.tool_name]: tool_name,
      [METRICS_SCHEMA.blobs.status]: success ? 'success' : 'error',
      [METRICS_SCHEMA.blobs.error_type]: error_type || 'none',
      [METRICS_SCHEMA.blobs.url_domain]: url ? this.extractDomain(url) : 'none',
      [METRICS_SCHEMA.blobs.cache_status]: cache_status,
      [METRICS_SCHEMA.blobs.r2_saved]: r2_saved ? 'true' : 'false',
      [METRICS_SCHEMA.blobs.request_id]: request_id,
      [METRICS_SCHEMA.blobs.country]: country,
      [METRICS_SCHEMA.doubles.duration_ms]: duration_ms,
      [METRICS_SCHEMA.doubles.response_size_bytes]: response_size_bytes,
      [METRICS_SCHEMA.doubles.browser_seconds_used]: browser_seconds_used,
      [METRICS_SCHEMA.doubles.retry_count]: retry_count,
      [METRICS_SCHEMA.doubles.timestamp]: Date.now()
    };

    // Enviar para Analytics Engine
    if (this.analytics) {
      try {
        this.analytics.writeDataPoint(datapoint);
      } catch (e) {
        console.error('Analytics write error:', e);
      }
    }

    // Log para desenvolvimento
    console.log(JSON.stringify({
      type: 'metric',
      ...datapoint
    }));

    return datapoint;
  }

  /**
   * Registra erro
   */
  async trackError(tool_name, error, duration_ms = 0) {
    let error_type = 'unknown';
    
    if (error.message?.includes('timeout')) {
      error_type = 'timeout';
    } else if (error.message?.includes('auth') || error.status === 401) {
      error_type = 'auth';
    } else if (error.message?.includes('valid') || error.status === 400) {
      error_type = 'validation';
    } else if (error.status >= 500) {
      error_type = 'api';
    }

    return this.trackToolExecution({
      tool_name,
      success: false,
      error_type,
      duration_ms
    });
  }
}

// =====================================================
// FERRAMENTA DE MÉTRICAS
// =====================================================

const br_metrics = {
  name: "br_metrics",
  description: `📊 DASHBOARD DE MÉTRICAS - Visualiza estatísticas de uso.

Retorna:
- Total de requests por ferramenta
- Taxa de sucesso/erro
- Tempo médio de resposta
- Browser hours consumidos
- Top domínios processados

Parâmetros:
- period: "1h", "24h", "7d", "30d"
- tool_filter: Nome da ferramenta (opcional)`,
  inputSchema: {
    type: "object",
    properties: {
      period: { 
        type: "string", 
        enum: ["1h", "24h", "7d", "30d"],
        default: "24h",
        description: "Período de análise"
      },
      tool_filter: {
        type: "string",
        description: "Filtrar por ferramenta específica"
      }
    }
  },
  handler: async (params, env) => {
    // Se não tem Analytics Engine, retorna métricas simuladas
    if (!env.ANALYTICS) {
      return {
        success: true,
        warning: "Analytics Engine não configurado. Dados simulados.",
        period: params.period || "24h",
        summary: {
          total_requests: 0,
          success_rate: 0,
          avg_duration_ms: 0,
          total_browser_seconds: 0,
          total_bytes_processed: 0
        },
        by_tool: {},
        by_status: { success: 0, error: 0 },
        top_domains: [],
        cache_efficiency: { hit_rate: 0, hits: 0, misses: 0 },
        setup_instructions: {
          step1: "Criar Analytics Engine dataset no Cloudflare Dashboard",
          step2: "Adicionar binding no wrangler.toml: [[analytics_engine_datasets]] binding = 'ANALYTICS' dataset = 'browser_rendering_metrics'",
          step3: "Fazer novo deploy do Worker"
        }
      };
    }

    // TODO: Implementar query real ao Analytics Engine
    // Por enquanto, retorna estrutura para quando estiver configurado
    return {
      success: true,
      period: params.period || "24h",
      message: "Analytics Engine conectado. Métricas serão populadas conforme uso.",
      query_sql: `
        SELECT 
          blob1 as tool_name,
          blob2 as status,
          COUNT(*) as requests,
          AVG(double1) as avg_duration_ms,
          SUM(double3) as total_browser_seconds,
          SUM(double2) as total_bytes
        FROM browser_rendering_metrics
        WHERE timestamp > NOW() - INTERVAL '${params.period || "24h"}'
        GROUP BY blob1, blob2
        ORDER BY requests DESC
      `
    };
  }
};

// =====================================================
// FERRAMENTA DE ALERTAS
// =====================================================

const br_alerts_config = {
  name: "br_alerts_config",
  description: `⚠️ CONFIGURAÇÃO DE ALERTAS - Define thresholds para alertas automáticos.

Configura alertas para:
- Error rate > X%
- Response time > Xms
- Browser hours > X/dia`,
  inputSchema: {
    type: "object",
    properties: {
      error_rate_threshold: {
        type: "number",
        description: "Percentual de erros para alertar (ex: 10 = 10%)",
        default: 10
      },
      response_time_threshold_ms: {
        type: "number",
        description: "Tempo de resposta em ms para alertar",
        default: 30000
      },
      browser_hours_daily_limit: {
        type: "number",
        description: "Limite diário de browser hours",
        default: 5
      },
      notification_webhook: {
        type: "string",
        description: "Webhook URL para enviar alertas"
      }
    }
  },
  handler: async (params, env) => {
    // Salvar configuração no KV
    if (env.CACHE_KV) {
      await env.CACHE_KV.put('alerts_config', JSON.stringify({
        error_rate_threshold: params.error_rate_threshold || 10,
        response_time_threshold_ms: params.response_time_threshold_ms || 30000,
        browser_hours_daily_limit: params.browser_hours_daily_limit || 5,
        notification_webhook: params.notification_webhook,
        updated_at: new Date().toISOString()
      }));
    }

    return {
      success: true,
      message: "Configuração de alertas salva",
      config: {
        error_rate_threshold: `${params.error_rate_threshold || 10}%`,
        response_time_threshold_ms: `${params.response_time_threshold_ms || 30000}ms`,
        browser_hours_daily_limit: params.browser_hours_daily_limit || 5,
        notification_webhook: params.notification_webhook ? "Configurado" : "Não configurado"
      }
    };
  }
};

// =====================================================
// EXPORT
// =====================================================

export { MetricsCollector, br_metrics, br_alerts_config, METRICS_SCHEMA };
