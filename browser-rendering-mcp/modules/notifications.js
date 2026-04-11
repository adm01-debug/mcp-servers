/**
 * 🔔 MÓDULO DE NOTIFICAÇÕES - Multi-Canal
 * 
 * Sistema completo de notificações:
 * - Slack (webhook)
 * - Discord (webhook)
 * - WhatsApp (via Evolution API / Z-API)
 * - Email (via Resend/SendGrid)
 * - Webhook genérico
 * 
 * @version 1.0.0
 */

// =====================================================
// CONFIGURAÇÃO DE CANAIS
// =====================================================

const NOTIFICATION_CHANNELS = {
  slack: {
    name: 'Slack',
    icon: '💬',
    color: '#4A154B'
  },
  discord: {
    name: 'Discord',
    icon: '🎮',
    color: '#5865F2'
  },
  whatsapp: {
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366'
  },
  email: {
    name: 'Email',
    icon: '📧',
    color: '#EA4335'
  },
  webhook: {
    name: 'Webhook',
    icon: '🔗',
    color: '#6B7280'
  }
};

// =====================================================
// TEMPLATES DE MENSAGENS
// =====================================================

const MESSAGE_TEMPLATES = {
  price_change: {
    title: '💰 Alteração de Preço Detectada',
    format: (data) => ({
      product: data.product_id,
      previous: `R$ ${data.previous_price?.toFixed(2) || 'N/A'}`,
      current: `R$ ${data.current_price?.toFixed(2)}`,
      change: `${data.change_percent > 0 ? '+' : ''}${data.change_percent}%`,
      direction: data.direction === 'up' ? '📈 Subiu' : '📉 Baixou',
      url: data.url
    })
  },
  crawl_completed: {
    title: '🕷️ Crawl Finalizado',
    format: (data) => ({
      job_id: data.job_id,
      pages_processed: data.total,
      successful: data.finished,
      failed: data.total - data.finished,
      browser_seconds: data.browserSecondsUsed,
      started_at: data.started_at,
      completed_at: new Date().toISOString()
    })
  },
  error_alert: {
    title: '🚨 Erro Crítico',
    format: (data) => ({
      tool: data.tool_name,
      error: data.error_message,
      error_type: data.error_type,
      url: data.url || 'N/A',
      timestamp: new Date().toISOString()
    })
  },
  visual_change: {
    title: '👁️ Mudança Visual Detectada',
    format: (data) => ({
      url: data.url,
      change_percent: `${data.difference_percent}%`,
      threshold: `${data.threshold}%`,
      screenshot_url: data.screenshot_url
    })
  },
  threshold_exceeded: {
    title: '⚠️ Limite Excedido',
    format: (data) => ({
      metric: data.metric,
      current_value: data.current_value,
      threshold: data.threshold,
      period: data.period
    })
  }
};

// =====================================================
// CLASSE DE NOTIFICAÇÕES
// =====================================================

class NotificationService {
  constructor(env) {
    this.env = env;
  }

  /**
   * Envia notificação para Slack
   */
  async sendSlack(webhookUrl, message, data) {
    const template = MESSAGE_TEMPLATES[message.template];
    const formatted = template ? template.format(data) : data;

    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: template?.title || message.title || "Notificação",
            emoji: true
          }
        },
        {
          type: "section",
          fields: Object.entries(formatted).map(([key, value]) => ({
            type: "mrkdwn",
            text: `*${key}:*\n${value}`
          }))
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🤖 Browser Rendering MCP | ${new Date().toLocaleString('pt-BR')}`
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { success: response.ok, channel: 'slack', status: response.status };
  }

  /**
   * Envia notificação para Discord
   */
  async sendDiscord(webhookUrl, message, data) {
    const template = MESSAGE_TEMPLATES[message.template];
    const formatted = template ? template.format(data) : data;

    const payload = {
      embeds: [{
        title: template?.title || message.title || "Notificação",
        color: parseInt(NOTIFICATION_CHANNELS.discord.color.slice(1), 16),
        fields: Object.entries(formatted).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true
        })),
        footer: {
          text: "Browser Rendering MCP"
        },
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { success: response.ok, channel: 'discord', status: response.status };
  }

  /**
   * Envia notificação para WhatsApp via Evolution API
   */
  async sendWhatsApp(config, message, data) {
    const { api_url, api_key, instance, number } = config;
    const template = MESSAGE_TEMPLATES[message.template];
    const formatted = template ? template.format(data) : data;

    // Formatar mensagem para WhatsApp
    let text = `*${template?.title || message.title || 'Notificação'}*\n\n`;
    for (const [key, value] of Object.entries(formatted)) {
      text += `• *${key}:* ${value}\n`;
    }
    text += `\n_Browser Rendering MCP_`;

    const payload = {
      number,
      text
    };

    const response = await fetch(`${api_url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_key
      },
      body: JSON.stringify(payload)
    });

    return { success: response.ok, channel: 'whatsapp', status: response.status };
  }

  /**
   * Envia notificação via Email (Resend)
   */
  async sendEmail(config, message, data) {
    const { api_key, from, to } = config;
    const template = MESSAGE_TEMPLATES[message.template];
    const formatted = template ? template.format(data) : data;

    // Gerar HTML do email
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${template?.title || message.title || 'Notificação'}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${Object.entries(formatted).map(([key, value]) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${key}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${value}</td>
            </tr>
          `).join('')}
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Enviado por Browser Rendering MCP
        </p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`
      },
      body: JSON.stringify({
        from: from || 'noreply@browser-rendering.mcp',
        to: Array.isArray(to) ? to : [to],
        subject: template?.title || message.title || 'Notificação',
        html
      })
    });

    return { success: response.ok, channel: 'email', status: response.status };
  }

  /**
   * Envia para webhook genérico
   */
  async sendWebhook(webhookUrl, message, data) {
    const template = MESSAGE_TEMPLATES[message.template];
    
    const payload = {
      event: message.template || 'notification',
      title: template?.title || message.title,
      data: template ? template.format(data) : data,
      timestamp: new Date().toISOString(),
      source: 'browser-rendering-mcp'
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { success: response.ok, channel: 'webhook', status: response.status };
  }

  /**
   * Envia notificação para múltiplos canais
   */
  async notify(channels, message, data) {
    const results = [];

    for (const channel of channels) {
      try {
        let result;
        
        switch (channel.type) {
          case 'slack':
            result = await this.sendSlack(channel.webhook_url, message, data);
            break;
          case 'discord':
            result = await this.sendDiscord(channel.webhook_url, message, data);
            break;
          case 'whatsapp':
            result = await this.sendWhatsApp(channel.config, message, data);
            break;
          case 'email':
            result = await this.sendEmail(channel.config, message, data);
            break;
          case 'webhook':
            result = await this.sendWebhook(channel.webhook_url, message, data);
            break;
          default:
            result = { success: false, channel: channel.type, error: 'Canal não suportado' };
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel: channel.type,
          error: error.message
        });
      }
    }

    return results;
  }
}

// =====================================================
// FERRAMENTAS MCP
// =====================================================

const br_notify = {
  name: "br_notify",
  description: `🔔 ENVIAR NOTIFICAÇÃO - Envia mensagem para múltiplos canais.

Canais suportados:
- slack: Webhook URL
- discord: Webhook URL
- whatsapp: Evolution API config
- email: Resend API config
- webhook: URL genérica

Templates disponíveis:
- price_change
- crawl_completed
- error_alert
- visual_change
- threshold_exceeded`,
  inputSchema: {
    type: "object",
    properties: {
      channels: {
        type: "array",
        description: "Lista de canais para enviar",
        items: {
          type: "object",
          properties: {
            type: { 
              type: "string", 
              enum: ["slack", "discord", "whatsapp", "email", "webhook"]
            },
            webhook_url: { type: "string" },
            config: { 
              type: "object",
              description: "Configuração específica do canal"
            }
          },
          required: ["type"]
        }
      },
      message: {
        type: "object",
        properties: {
          template: { 
            type: "string",
            enum: ["price_change", "crawl_completed", "error_alert", "visual_change", "threshold_exceeded"]
          },
          title: { type: "string", description: "Título customizado (se não usar template)" }
        }
      },
      data: {
        type: "object",
        description: "Dados para preencher o template"
      }
    },
    required: ["channels", "data"]
  },
  handler: async (params, env) => {
    const notificationService = new NotificationService(env);
    const results = await notificationService.notify(
      params.channels,
      params.message || {},
      params.data
    );

    const successful = results.filter(r => r.success).length;
    
    return {
      success: successful > 0,
      total_channels: params.channels.length,
      successful,
      failed: params.channels.length - successful,
      results
    };
  }
};

const br_notification_channels = {
  name: "br_notification_channels",
  description: `📋 GERENCIAR CANAIS - Salva/lista configurações de canais de notificação.

Salve suas configurações de webhook para não precisar informar toda vez.`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "save", "delete"],
        description: "Ação a executar"
      },
      channel_id: {
        type: "string",
        description: "ID do canal (para save/delete)"
      },
      channel_config: {
        type: "object",
        description: "Configuração do canal (para save)",
        properties: {
          type: { type: "string" },
          name: { type: "string" },
          webhook_url: { type: "string" },
          config: { type: "object" }
        }
      }
    },
    required: ["action"]
  },
  handler: async (params, env) => {
    if (!env.CACHE_KV) {
      return { success: false, error: "KV não configurado para persistência" };
    }

    const CHANNELS_KEY = 'notification_channels';

    switch (params.action) {
      case 'list': {
        const channels = await env.CACHE_KV.get(CHANNELS_KEY, 'json') || {};
        return {
          success: true,
          channels: Object.entries(channels).map(([id, config]) => ({
            id,
            type: config.type,
            name: config.name
          }))
        };
      }

      case 'save': {
        if (!params.channel_id || !params.channel_config) {
          return { success: false, error: "channel_id e channel_config são obrigatórios" };
        }
        const channels = await env.CACHE_KV.get(CHANNELS_KEY, 'json') || {};
        channels[params.channel_id] = {
          ...params.channel_config,
          updated_at: new Date().toISOString()
        };
        await env.CACHE_KV.put(CHANNELS_KEY, JSON.stringify(channels));
        return { success: true, message: `Canal ${params.channel_id} salvo` };
      }

      case 'delete': {
        if (!params.channel_id) {
          return { success: false, error: "channel_id é obrigatório" };
        }
        const channels = await env.CACHE_KV.get(CHANNELS_KEY, 'json') || {};
        delete channels[params.channel_id];
        await env.CACHE_KV.put(CHANNELS_KEY, JSON.stringify(channels));
        return { success: true, message: `Canal ${params.channel_id} removido` };
      }

      default:
        return { success: false, error: "Ação inválida" };
    }
  }
};

// =====================================================
// EXPORT
// =====================================================

export { 
  NotificationService, 
  br_notify, 
  br_notification_channels, 
  MESSAGE_TEMPLATES,
  NOTIFICATION_CHANNELS 
};
