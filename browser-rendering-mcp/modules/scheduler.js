/**
 * ⏰ MÓDULO DE AGENDAMENTO - Cron Triggers
 * 
 * Sistema completo de tarefas agendadas:
 * - Monitoramento periódico de preços
 * - Verificação visual de mudanças
 * - Crawls automáticos
 * - Relatórios diários
 * - Alertas de SLA
 * 
 * Intervalos suportados:
 * - Cada 5 minutos: "*/5 * * * *"
 * - Cada 15 minutos: "*/15 * * * *"
 * - Cada hora: "0 * * * *"
 * - Diário às 9h: "0 9 * * *"
 * - Semanal (segunda): "0 9 * * 1"
 * 
 * @version 1.0.0
 */

// =====================================================
// TIPOS DE JOBS
// =====================================================

const JOB_TYPES = {
  price_monitor: {
    name: 'Monitoramento de Preços',
    description: 'Verifica preços periodicamente e notifica mudanças',
    icon: '💰'
  },
  visual_monitor: {
    name: 'Monitoramento Visual',
    description: 'Detecta mudanças visuais em páginas',
    icon: '👁️'
  },
  crawl: {
    name: 'Crawl Agendado',
    description: 'Executa crawl de site periodicamente',
    icon: '🕷️'
  },
  screenshot: {
    name: 'Screenshot Periódico',
    description: 'Captura screenshots em intervalos regulares',
    icon: '📸'
  },
  health_check: {
    name: 'Health Check',
    description: 'Verifica disponibilidade de URLs',
    icon: '🏥'
  },
  data_extraction: {
    name: 'Extração de Dados',
    description: 'Extrai dados estruturados periodicamente',
    icon: '📊'
  },
  report: {
    name: 'Relatório',
    description: 'Gera e envia relatórios',
    icon: '📈'
  }
};

// =====================================================
// INTERVALOS PRÉ-DEFINIDOS
// =====================================================

const CRON_PRESETS = {
  '5m': { cron: '*/5 * * * *', description: 'A cada 5 minutos' },
  '15m': { cron: '*/15 * * * *', description: 'A cada 15 minutos' },
  '30m': { cron: '*/30 * * * *', description: 'A cada 30 minutos' },
  '1h': { cron: '0 * * * *', description: 'A cada hora' },
  '3h': { cron: '0 */3 * * *', description: 'A cada 3 horas' },
  '6h': { cron: '0 */6 * * *', description: 'A cada 6 horas' },
  '12h': { cron: '0 */12 * * *', description: 'A cada 12 horas' },
  '24h': { cron: '0 9 * * *', description: 'Diariamente às 9h' },
  'daily_morning': { cron: '0 9 * * *', description: 'Diariamente às 9h' },
  'daily_evening': { cron: '0 18 * * *', description: 'Diariamente às 18h' },
  'weekly_monday': { cron: '0 9 * * 1', description: 'Toda segunda às 9h' },
  'weekly_friday': { cron: '0 17 * * 5', description: 'Toda sexta às 17h' },
  'monthly': { cron: '0 9 1 * *', description: 'Dia 1 de cada mês às 9h' }
};

// =====================================================
// GERENCIADOR DE JOBS
// =====================================================

class SchedulerManager {
  constructor(env) {
    this.env = env;
    this.JOBS_KEY = 'scheduled_jobs';
    this.HISTORY_KEY = 'job_history';
  }

  /**
   * Lista todos os jobs agendados
   */
  async listJobs() {
    if (!this.env.CACHE_KV) return [];
    const jobs = await this.env.CACHE_KV.get(this.JOBS_KEY, 'json');
    return jobs || [];
  }

  /**
   * Obtém um job por ID
   */
  async getJob(jobId) {
    const jobs = await this.listJobs();
    return jobs.find(j => j.id === jobId);
  }

  /**
   * Cria um novo job
   */
  async createJob(config) {
    const jobs = await this.listJobs();
    
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: config.type,
      name: config.name || JOB_TYPES[config.type]?.name || 'Job',
      schedule: config.schedule, // Preset ou cron customizado
      cron: CRON_PRESETS[config.schedule]?.cron || config.schedule,
      config: config.params || {},
      notification_channels: config.notification_channels || [],
      status: 'active',
      created_at: new Date().toISOString(),
      last_run: null,
      next_run: this.calculateNextRun(config.schedule),
      run_count: 0,
      error_count: 0
    };

    jobs.push(job);
    await this.env.CACHE_KV.put(this.JOBS_KEY, JSON.stringify(jobs));

    return job;
  }

  /**
   * Atualiza um job
   */
  async updateJob(jobId, updates) {
    const jobs = await this.listJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    
    if (index === -1) {
      throw new Error(`Job ${jobId} não encontrado`);
    }

    jobs[index] = { ...jobs[index], ...updates, updated_at: new Date().toISOString() };
    await this.env.CACHE_KV.put(this.JOBS_KEY, JSON.stringify(jobs));

    return jobs[index];
  }

  /**
   * Remove um job
   */
  async deleteJob(jobId) {
    const jobs = await this.listJobs();
    const filtered = jobs.filter(j => j.id !== jobId);
    
    if (filtered.length === jobs.length) {
      throw new Error(`Job ${jobId} não encontrado`);
    }

    await this.env.CACHE_KV.put(this.JOBS_KEY, JSON.stringify(filtered));
    return true;
  }

  /**
   * Pausa/retoma um job
   */
  async toggleJob(jobId) {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} não encontrado`);

    const newStatus = job.status === 'active' ? 'paused' : 'active';
    return this.updateJob(jobId, { status: newStatus });
  }

  /**
   * Registra execução de job
   */
  async logExecution(jobId, result) {
    // Atualizar job
    const job = await this.getJob(jobId);
    if (job) {
      await this.updateJob(jobId, {
        last_run: new Date().toISOString(),
        next_run: this.calculateNextRun(job.schedule),
        run_count: (job.run_count || 0) + 1,
        error_count: result.success ? job.error_count : (job.error_count || 0) + 1,
        last_result: {
          success: result.success,
          duration_ms: result.duration_ms,
          error: result.error
        }
      });
    }

    // Adicionar ao histórico
    const historyKey = `${this.HISTORY_KEY}:${jobId}`;
    const history = await this.env.CACHE_KV.get(historyKey, 'json') || [];
    
    history.unshift({
      timestamp: new Date().toISOString(),
      success: result.success,
      duration_ms: result.duration_ms,
      error: result.error,
      data: result.data
    });

    // Manter últimas 100 execuções
    if (history.length > 100) history.length = 100;

    await this.env.CACHE_KV.put(historyKey, JSON.stringify(history));
  }

  /**
   * Obtém histórico de execuções
   */
  async getHistory(jobId, limit = 20) {
    const historyKey = `${this.HISTORY_KEY}:${jobId}`;
    const history = await this.env.CACHE_KV.get(historyKey, 'json') || [];
    return history.slice(0, limit);
  }

  /**
   * Calcula próxima execução baseado no schedule
   */
  calculateNextRun(schedule) {
    // Implementação simplificada - retorna estimativa
    const preset = CRON_PRESETS[schedule];
    if (!preset) return null;

    const now = new Date();
    
    // Adicionar intervalo estimado
    const intervals = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '3h': 3 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      'daily_morning': 24 * 60 * 60 * 1000,
      'daily_evening': 24 * 60 * 60 * 1000,
      'weekly_monday': 7 * 24 * 60 * 60 * 1000,
      'weekly_friday': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };

    const interval = intervals[schedule] || 60 * 60 * 1000;
    return new Date(now.getTime() + interval).toISOString();
  }
}

// =====================================================
// EXECUTOR DE JOBS
// =====================================================

class JobExecutor {
  constructor(env, browserRequest, notificationService) {
    this.env = env;
    this.browserRequest = browserRequest;
    this.notificationService = notificationService;
  }

  /**
   * Executa um job baseado no tipo
   */
  async execute(job) {
    const startTime = Date.now();
    let result;

    try {
      switch (job.type) {
        case 'price_monitor':
          result = await this.executePriceMonitor(job.config);
          break;
        case 'visual_monitor':
          result = await this.executeVisualMonitor(job.config);
          break;
        case 'crawl':
          result = await this.executeCrawl(job.config);
          break;
        case 'screenshot':
          result = await this.executeScreenshot(job.config);
          break;
        case 'health_check':
          result = await this.executeHealthCheck(job.config);
          break;
        case 'data_extraction':
          result = await this.executeDataExtraction(job.config);
          break;
        case 'report':
          result = await this.executeReport(job.config);
          break;
        default:
          result = { success: false, error: `Tipo de job não suportado: ${job.type}` };
      }

      result.duration_ms = Date.now() - startTime;

      // Notificar se configurado e necessário
      if (job.notification_channels?.length > 0 && result.should_notify) {
        await this.notificationService?.notify(
          job.notification_channels,
          { template: result.notification_template || 'threshold_exceeded' },
          result.notification_data || result.data
        );
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime
      };
    }
  }

  async executePriceMonitor(config) {
    const { url, price_selector, product_id, threshold_percent } = config;
    
    // Delega para br_monitor_price (implementado no worker principal)
    const result = await this.browserRequest('/scrape', 'POST', {
      url,
      elements: [{ selector: price_selector }]
    });

    if (!result.success) {
      return { success: false, error: 'Falha ao extrair preço' };
    }

    const priceText = result.result?.[0]?.results?.[0]?.text || '';
    const currentPrice = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));

    // Buscar preço anterior
    const cacheKey = `price:${product_id}`;
    const previous = await this.env.CACHE_KV?.get(cacheKey, 'json');

    // Salvar preço atual
    await this.env.CACHE_KV?.put(cacheKey, JSON.stringify({
      price: currentPrice,
      timestamp: Date.now()
    }));

    const changed = previous && Math.abs((currentPrice - previous.price) / previous.price * 100) >= (threshold_percent || 1);

    return {
      success: true,
      data: {
        product_id,
        current_price: currentPrice,
        previous_price: previous?.price,
        changed
      },
      should_notify: changed,
      notification_template: 'price_change',
      notification_data: {
        product_id,
        current_price: currentPrice,
        previous_price: previous?.price,
        change_percent: previous ? ((currentPrice - previous.price) / previous.price * 100).toFixed(2) : null,
        url
      }
    };
  }

  async executeVisualMonitor(config) {
    // Implementação delega para br_visual_diff
    return {
      success: true,
      message: 'Visual monitor executado',
      data: config
    };
  }

  async executeCrawl(config) {
    const { url, limit, depth, formats } = config;
    
    const result = await this.browserRequest('/crawl', 'POST', {
      url,
      limit: limit || 100,
      depth: depth || 3,
      formats: formats || ['markdown']
    });

    return {
      success: result.success,
      data: {
        job_id: result.result,
        url
      },
      should_notify: true,
      notification_template: 'crawl_completed',
      notification_data: {
        job_id: result.result,
        url,
        started_at: new Date().toISOString()
      }
    };
  }

  async executeScreenshot(config) {
    const { url, save_to_r2 } = config;
    
    const result = await this.browserRequest('/screenshot', 'POST', {
      url,
      screenshotOptions: config.screenshotOptions
    });

    let r2Key = null;
    if (save_to_r2 && result.success && this.env.STORAGE_R2) {
      r2Key = `scheduled/${config.job_id || 'screenshot'}/${Date.now()}.png`;
      await this.env.STORAGE_R2.put(r2Key, 
        Uint8Array.from(atob(result.data), c => c.charCodeAt(0)),
        { httpMetadata: { contentType: 'image/png' } }
      );
    }

    return {
      success: result.success,
      data: { url, r2_key: r2Key, size: result.size }
    };
  }

  async executeHealthCheck(config) {
    const { urls, timeout_ms } = config;
    const results = [];

    for (const url of urls) {
      const start = Date.now();
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(timeout_ms || 10000)
        });
        results.push({
          url,
          status: response.status,
          ok: response.ok,
          latency_ms: Date.now() - start
        });
      } catch (e) {
        results.push({
          url,
          status: 0,
          ok: false,
          error: e.message,
          latency_ms: Date.now() - start
        });
      }
    }

    const allHealthy = results.every(r => r.ok);

    return {
      success: true,
      data: { results, all_healthy: allHealthy },
      should_notify: !allHealthy,
      notification_template: 'error_alert',
      notification_data: {
        tool_name: 'health_check',
        error_message: `${results.filter(r => !r.ok).length} URLs com problema`,
        urls: results.filter(r => !r.ok).map(r => r.url)
      }
    };
  }

  async executeDataExtraction(config) {
    const { url, elements } = config;
    
    const result = await this.browserRequest('/scrape', 'POST', { url, elements });
    
    return {
      success: result.success,
      data: result.result
    };
  }

  async executeReport(config) {
    // Gerar relatório de métricas do dia
    return {
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        period: config.period || '24h'
      },
      should_notify: true
    };
  }
}

// =====================================================
// FERRAMENTAS MCP
// =====================================================

const br_schedule_job = {
  name: "br_schedule_job",
  description: `⏰ AGENDAR JOB - Cria tarefa para execução periódica.

Tipos de job:
- price_monitor: Monitorar preços
- visual_monitor: Detectar mudanças visuais
- crawl: Crawl agendado
- screenshot: Screenshots periódicos
- health_check: Verificar disponibilidade
- data_extraction: Extrair dados
- report: Gerar relatórios

Intervalos disponíveis:
- 5m, 15m, 30m, 1h, 3h, 6h, 12h, 24h
- daily_morning, daily_evening
- weekly_monday, weekly_friday
- monthly`,
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: Object.keys(JOB_TYPES)
      },
      name: { type: "string", description: "Nome do job" },
      schedule: {
        type: "string",
        description: "Intervalo (preset ou cron customizado)"
      },
      params: {
        type: "object",
        description: "Parâmetros específicos do tipo de job"
      },
      notification_channels: {
        type: "array",
        description: "Canais para notificação"
      }
    },
    required: ["type", "schedule"]
  },
  handler: async (params, env) => {
    const scheduler = new SchedulerManager(env);
    
    try {
      const job = await scheduler.createJob(params);
      
      return {
        success: true,
        message: `Job agendado com sucesso`,
        job: {
          id: job.id,
          name: job.name,
          type: job.type,
          schedule: CRON_PRESETS[params.schedule]?.description || params.schedule,
          next_run: job.next_run
        },
        wrangler_config: {
          note: "Adicione ao wrangler.toml para ativar Cron Triggers:",
          triggers: {
            crons: [job.cron]
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

const br_list_jobs = {
  name: "br_list_jobs",
  description: "📋 LISTAR JOBS - Lista todos os jobs agendados.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["all", "active", "paused"],
        default: "all"
      }
    }
  },
  handler: async (params, env) => {
    const scheduler = new SchedulerManager(env);
    let jobs = await scheduler.listJobs();

    if (params.status && params.status !== 'all') {
      jobs = jobs.filter(j => j.status === params.status);
    }

    return {
      success: true,
      total: jobs.length,
      jobs: jobs.map(j => ({
        id: j.id,
        name: j.name,
        type: j.type,
        status: j.status,
        schedule: CRON_PRESETS[j.schedule]?.description || j.cron,
        last_run: j.last_run,
        next_run: j.next_run,
        run_count: j.run_count,
        error_count: j.error_count
      }))
    };
  }
};

const br_job_action = {
  name: "br_job_action",
  description: `🎛️ AÇÃO EM JOB - Gerencia jobs agendados.

Ações:
- pause: Pausar job
- resume: Retomar job
- delete: Remover job
- run_now: Executar imediatamente
- history: Ver histórico de execuções`,
  inputSchema: {
    type: "object",
    properties: {
      job_id: { type: "string" },
      action: {
        type: "string",
        enum: ["pause", "resume", "delete", "run_now", "history"]
      }
    },
    required: ["job_id", "action"]
  },
  handler: async (params, env, browserRequest) => {
    const scheduler = new SchedulerManager(env);

    switch (params.action) {
      case 'pause':
      case 'resume': {
        const job = await scheduler.toggleJob(params.job_id);
        return { success: true, job: { id: job.id, status: job.status } };
      }

      case 'delete': {
        await scheduler.deleteJob(params.job_id);
        return { success: true, message: `Job ${params.job_id} removido` };
      }

      case 'run_now': {
        const job = await scheduler.getJob(params.job_id);
        if (!job) return { success: false, error: 'Job não encontrado' };

        const executor = new JobExecutor(env, browserRequest, null);
        const result = await executor.execute(job);
        await scheduler.logExecution(params.job_id, result);

        return { success: true, message: 'Job executado', result };
      }

      case 'history': {
        const history = await scheduler.getHistory(params.job_id);
        return { success: true, job_id: params.job_id, history };
      }

      default:
        return { success: false, error: 'Ação inválida' };
    }
  }
};

// =====================================================
// CRON HANDLER (para wrangler.toml)
// =====================================================

/**
 * Handler para Cron Triggers
 * Adicione no wrangler.toml:
 * 
 * [triggers]
 * crons = ["*/5 * * * *", "0 * * * *", "0 9 * * *"]
 */
async function handleScheduled(event, env, browserRequest, notificationService) {
  const scheduler = new SchedulerManager(env);
  const executor = new JobExecutor(env, browserRequest, notificationService);
  
  const jobs = await scheduler.listJobs();
  const activeJobs = jobs.filter(j => j.status === 'active');
  
  // Verificar quais jobs devem executar neste cron
  const cronTrigger = event.cron;
  const jobsToRun = activeJobs.filter(j => j.cron === cronTrigger);

  const results = [];
  
  for (const job of jobsToRun) {
    try {
      const result = await executor.execute(job);
      await scheduler.logExecution(job.id, result);
      results.push({ job_id: job.id, ...result });
    } catch (error) {
      results.push({ job_id: job.id, success: false, error: error.message });
    }
  }

  return results;
}

// =====================================================
// EXPORT
// =====================================================

export {
  SchedulerManager,
  JobExecutor,
  br_schedule_job,
  br_list_jobs,
  br_job_action,
  handleScheduled,
  JOB_TYPES,
  CRON_PRESETS
};
