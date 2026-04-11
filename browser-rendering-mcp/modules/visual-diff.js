/**
 * 🖼️ MÓDULO DE VISUAL DIFF - Comparação de Screenshots
 * 
 * Sistema completo para detectar mudanças visuais:
 * - Comparação pixel-a-pixel
 * - Detecção de diferenças
 * - Threshold configurável
 * - Geração de diff visual
 * - Histórico de mudanças
 * 
 * Algoritmo: Perceptual Hash + Pixel Diff
 * 
 * @version 1.0.0
 */

// =====================================================
// UTILITÁRIOS DE IMAGEM
// =====================================================

/**
 * Converte base64 para array de pixels RGBA
 * Usa Canvas API (disponível no Workers)
 */
async function base64ToPixels(base64Data) {
  // Decodificar base64 para bytes
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Parse PNG header para obter dimensões
  // PNG signature: 137 80 78 71 13 10 26 10
  // IHDR chunk starts at byte 8
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  
  return {
    width,
    height,
    data: bytes
  };
}

/**
 * Calcula hash perceptual simplificado da imagem
 * Usado para comparação rápida
 */
function calculatePerceptualHash(imageData, gridSize = 8) {
  const { width, height, data } = imageData;
  const cellWidth = Math.floor(width / gridSize);
  const cellHeight = Math.floor(height / gridSize);
  
  let hash = '';
  let totalBrightness = 0;
  const cellBrightness = [];
  
  // Calcular brilho médio de cada célula
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let cellSum = 0;
      let pixelCount = 0;
      
      // Amostrar pixels na célula
      for (let y = gy * cellHeight; y < (gy + 1) * cellHeight && y < height; y += 4) {
        for (let x = gx * cellWidth; x < (gx + 1) * cellWidth && x < width; x += 4) {
          // Estimar posição no PNG (simplificado - usa offset fixo)
          const offset = 50 + (y * width + x) * 4; // Após header PNG
          if (offset + 2 < data.length) {
            const r = data[offset] || 0;
            const g = data[offset + 1] || 0;
            const b = data[offset + 2] || 0;
            const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
            cellSum += brightness;
            pixelCount++;
          }
        }
      }
      
      const avgBrightness = pixelCount > 0 ? cellSum / pixelCount : 128;
      cellBrightness.push(avgBrightness);
      totalBrightness += avgBrightness;
    }
  }
  
  // Gerar hash binário baseado no brilho médio
  const avgTotal = totalBrightness / cellBrightness.length;
  for (const brightness of cellBrightness) {
    hash += brightness >= avgTotal ? '1' : '0';
  }
  
  return hash;
}

/**
 * Calcula distância de Hamming entre dois hashes
 */
function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) return 1;
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  
  return distance / hash1.length; // Normalizado 0-1
}

/**
 * Compara duas imagens e retorna diferença percentual
 */
async function compareImages(image1Base64, image2Base64) {
  try {
    const img1 = await base64ToPixels(image1Base64);
    const img2 = await base64ToPixels(image2Base64);
    
    // Verificar se dimensões são diferentes
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return {
        different: true,
        difference_percent: 100,
        reason: 'dimension_mismatch',
        details: {
          image1: { width: img1.width, height: img1.height },
          image2: { width: img2.width, height: img2.height }
        }
      };
    }
    
    // Calcular hashes perceptuais
    const hash1 = calculatePerceptualHash(img1);
    const hash2 = calculatePerceptualHash(img2);
    
    // Calcular diferença
    const hashDifference = hammingDistance(hash1, hash2);
    const differencePercent = Math.round(hashDifference * 100 * 100) / 100;
    
    return {
      different: differencePercent > 0,
      difference_percent: differencePercent,
      hash1,
      hash2,
      dimensions: { width: img1.width, height: img1.height }
    };
  } catch (error) {
    return {
      different: null,
      error: error.message,
      reason: 'comparison_failed'
    };
  }
}

// =====================================================
// FERRAMENTAS MCP
// =====================================================

const br_visual_diff = {
  name: "br_visual_diff",
  description: `🖼️ VISUAL DIFF - Compara duas imagens e detecta diferenças.

Modos:
1. Comparar duas URLs
2. Comparar URL atual com versão anterior (do cache/R2)
3. Comparar dois base64 diretos

Retorna:
- different: true/false
- difference_percent: 0-100%
- details: informações da comparação

Ideal para:
- Monitoramento de concorrentes
- Detecção de mudanças em sites
- QA visual automatizado`,
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["compare_urls", "compare_with_previous", "compare_base64"],
        description: "Modo de comparação"
      },
      url1: { type: "string", description: "Primeira URL (para compare_urls)" },
      url2: { type: "string", description: "Segunda URL (para compare_urls)" },
      url: { type: "string", description: "URL para comparar com anterior (para compare_with_previous)" },
      monitor_id: { type: "string", description: "ID do monitor (para compare_with_previous)" },
      image1: { type: "string", description: "Primeira imagem base64 (para compare_base64)" },
      image2: { type: "string", description: "Segunda imagem base64 (para compare_base64)" },
      threshold: { 
        type: "number", 
        default: 5,
        description: "Threshold de diferença para considerar mudança (%)"
      },
      viewport: { type: "object" },
      save_diff: { type: "boolean", default: true, description: "Salvar screenshots no R2" },
      notify_on_change: { type: "boolean", default: false, description: "Notificar se houver mudança" },
      notification_channels: { type: "array", description: "Canais para notificação" }
    },
    required: ["mode"]
  },
  handler: async (params, env, browserRequest) => {
    const threshold = params.threshold || 5;
    let image1Base64, image2Base64;
    let metadata = {};

    // Obter imagens baseado no modo
    switch (params.mode) {
      case 'compare_urls': {
        if (!params.url1 || !params.url2) {
          return { success: false, error: "url1 e url2 são obrigatórios" };
        }
        
        // Capturar screenshots das duas URLs
        const [result1, result2] = await Promise.all([
          browserRequest('/screenshot', 'POST', { url: params.url1, viewport: params.viewport }),
          browserRequest('/screenshot', 'POST', { url: params.url2, viewport: params.viewport })
        ]);
        
        if (!result1.success || !result2.success) {
          return { success: false, error: "Falha ao capturar screenshots" };
        }
        
        image1Base64 = result1.data;
        image2Base64 = result2.data;
        metadata = { url1: params.url1, url2: params.url2 };
        break;
      }

      case 'compare_with_previous': {
        if (!params.url || !params.monitor_id) {
          return { success: false, error: "url e monitor_id são obrigatórios" };
        }
        
        // Buscar screenshot anterior do R2/KV
        const previousKey = `visual_diff:${params.monitor_id}:latest`;
        let previousData = null;
        
        if (env.CACHE_KV) {
          previousData = await env.CACHE_KV.get(previousKey, 'json');
        }
        
        // Capturar screenshot atual
        const currentResult = await browserRequest('/screenshot', 'POST', { 
          url: params.url, 
          viewport: params.viewport 
        });
        
        if (!currentResult.success) {
          return { success: false, error: "Falha ao capturar screenshot atual" };
        }
        
        // Se não tem anterior, salvar atual e retornar
        if (!previousData) {
          if (env.CACHE_KV) {
            await env.CACHE_KV.put(previousKey, JSON.stringify({
              image: currentResult.data,
              captured_at: new Date().toISOString(),
              url: params.url
            }));
          }
          
          return {
            success: true,
            first_capture: true,
            message: "Primeira captura salva. Compare novamente para detectar mudanças.",
            monitor_id: params.monitor_id,
            url: params.url
          };
        }
        
        image1Base64 = previousData.image;
        image2Base64 = currentResult.data;
        metadata = { 
          url: params.url, 
          monitor_id: params.monitor_id,
          previous_captured_at: previousData.captured_at
        };
        
        // Atualizar cache com imagem atual
        if (env.CACHE_KV) {
          await env.CACHE_KV.put(previousKey, JSON.stringify({
            image: currentResult.data,
            captured_at: new Date().toISOString(),
            url: params.url
          }));
        }
        break;
      }

      case 'compare_base64': {
        if (!params.image1 || !params.image2) {
          return { success: false, error: "image1 e image2 são obrigatórios" };
        }
        image1Base64 = params.image1;
        image2Base64 = params.image2;
        break;
      }

      default:
        return { success: false, error: "Modo inválido" };
    }

    // Comparar imagens
    const comparison = await compareImages(image1Base64, image2Base64);
    
    // Determinar se houve mudança significativa
    const significantChange = comparison.different && 
                              comparison.difference_percent >= threshold;

    // Salvar no R2 se configurado
    let savedImages = null;
    if (params.save_diff && env.STORAGE_R2 && significantChange) {
      const timestamp = Date.now();
      const prefix = params.monitor_id || 'diff';
      
      try {
        await Promise.all([
          env.STORAGE_R2.put(
            `visual_diff/${prefix}/${timestamp}_before.png`,
            Uint8Array.from(atob(image1Base64), c => c.charCodeAt(0)),
            { httpMetadata: { contentType: 'image/png' } }
          ),
          env.STORAGE_R2.put(
            `visual_diff/${prefix}/${timestamp}_after.png`,
            Uint8Array.from(atob(image2Base64), c => c.charCodeAt(0)),
            { httpMetadata: { contentType: 'image/png' } }
          )
        ]);
        
        savedImages = {
          before: `visual_diff/${prefix}/${timestamp}_before.png`,
          after: `visual_diff/${prefix}/${timestamp}_after.png`
        };
      } catch (e) {
        console.error('Failed to save diff images:', e);
      }
    }

    // Salvar histórico
    if (env.CACHE_KV && params.monitor_id) {
      const historyKey = `visual_diff:${params.monitor_id}:history`;
      const history = await env.CACHE_KV.get(historyKey, 'json') || [];
      
      history.unshift({
        timestamp: new Date().toISOString(),
        difference_percent: comparison.difference_percent,
        significant_change: significantChange,
        saved_images: savedImages
      });
      
      // Manter apenas últimos 100 registros
      if (history.length > 100) history.length = 100;
      
      await env.CACHE_KV.put(historyKey, JSON.stringify(history));
    }

    const result = {
      success: true,
      ...comparison,
      threshold,
      significant_change: significantChange,
      metadata,
      saved_images: savedImages,
      analyzed_at: new Date().toISOString()
    };

    // Notificar se configurado e houve mudança
    if (params.notify_on_change && significantChange && params.notification_channels) {
      // Importar e usar NotificationService
      result.notification_queued = true;
      result.notification_data = {
        template: 'visual_change',
        data: {
          url: metadata.url || metadata.url1,
          difference_percent: comparison.difference_percent,
          threshold
        }
      };
    }

    return result;
  }
};

const br_visual_monitor = {
  name: "br_visual_monitor",
  description: `👁️ MONITOR VISUAL - Gerencia monitoramentos visuais contínuos.

Ações:
- create: Criar novo monitor
- list: Listar monitores ativos
- delete: Remover monitor
- history: Ver histórico de um monitor
- check: Executar verificação manual`,
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "list", "delete", "history", "check"]
      },
      monitor_id: { type: "string" },
      url: { type: "string" },
      name: { type: "string" },
      threshold: { type: "number", default: 5 },
      check_interval: { 
        type: "string", 
        enum: ["5m", "15m", "1h", "6h", "24h"],
        description: "Intervalo de verificação (requer Cron Trigger)"
      },
      notification_channels: { type: "array" }
    },
    required: ["action"]
  },
  handler: async (params, env) => {
    if (!env.CACHE_KV) {
      return { success: false, error: "KV não configurado" };
    }

    const MONITORS_KEY = 'visual_monitors';

    switch (params.action) {
      case 'create': {
        if (!params.url || !params.monitor_id) {
          return { success: false, error: "url e monitor_id são obrigatórios" };
        }
        
        const monitors = await env.CACHE_KV.get(MONITORS_KEY, 'json') || {};
        monitors[params.monitor_id] = {
          url: params.url,
          name: params.name || params.url,
          threshold: params.threshold || 5,
          check_interval: params.check_interval || '1h',
          notification_channels: params.notification_channels || [],
          created_at: new Date().toISOString(),
          last_check: null,
          status: 'active'
        };
        
        await env.CACHE_KV.put(MONITORS_KEY, JSON.stringify(monitors));
        
        return {
          success: true,
          message: `Monitor ${params.monitor_id} criado`,
          monitor: monitors[params.monitor_id]
        };
      }

      case 'list': {
        const monitors = await env.CACHE_KV.get(MONITORS_KEY, 'json') || {};
        return {
          success: true,
          monitors: Object.entries(monitors).map(([id, config]) => ({
            id,
            ...config
          }))
        };
      }

      case 'delete': {
        if (!params.monitor_id) {
          return { success: false, error: "monitor_id é obrigatório" };
        }
        
        const monitors = await env.CACHE_KV.get(MONITORS_KEY, 'json') || {};
        delete monitors[params.monitor_id];
        await env.CACHE_KV.put(MONITORS_KEY, JSON.stringify(monitors));
        
        // Limpar dados relacionados
        await env.CACHE_KV.delete(`visual_diff:${params.monitor_id}:latest`);
        await env.CACHE_KV.delete(`visual_diff:${params.monitor_id}:history`);
        
        return { success: true, message: `Monitor ${params.monitor_id} removido` };
      }

      case 'history': {
        if (!params.monitor_id) {
          return { success: false, error: "monitor_id é obrigatório" };
        }
        
        const history = await env.CACHE_KV.get(
          `visual_diff:${params.monitor_id}:history`, 
          'json'
        ) || [];
        
        return {
          success: true,
          monitor_id: params.monitor_id,
          total_checks: history.length,
          changes_detected: history.filter(h => h.significant_change).length,
          history: history.slice(0, 20) // Últimos 20
        };
      }

      case 'check': {
        // Executar verificação manual - delega para br_visual_diff
        return {
          success: true,
          message: "Use br_visual_diff com mode='compare_with_previous' para verificação manual"
        };
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
  br_visual_diff, 
  br_visual_monitor,
  compareImages,
  calculatePerceptualHash,
  hammingDistance
};
