/**
 * 📝 MÓDULO DE OCR - Workers AI Integration
 * 
 * Sistema completo de OCR (Reconhecimento Ótico de Caracteres):
 * - Extração de texto de screenshots
 * - Suporte a múltiplos idiomas
 * - Detecção de regiões de texto
 * - Integração com Workers AI (Llama Vision)
 * - Fallback para Tesseract.js
 * 
 * Modelos suportados:
 * - @cf/meta/llama-3.2-11b-vision-instruct (recomendado)
 * - @cf/unum/uform-gen2-qwen-500m
 * 
 * @version 1.0.0
 */

// =====================================================
// CONFIGURAÇÃO DE MODELOS
// =====================================================

const OCR_MODELS = {
  llama_vision: {
    id: '@cf/meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 Vision',
    description: 'Modelo multimodal com excelente OCR',
    supports_regions: true,
    supports_tables: true
  },
  uform: {
    id: '@cf/unum/uform-gen2-qwen-500m',
    name: 'UForm Gen2',
    description: 'Modelo leve para OCR básico',
    supports_regions: false,
    supports_tables: false
  }
};

const OCR_PROMPTS = {
  extract_all: `Extract ALL text visible in this image. 
Output the text exactly as it appears, preserving:
- Line breaks
- Formatting (headers, lists, etc.)
- Numbers and special characters
Only output the extracted text, nothing else.`,

  extract_structured: `Extract text from this image and return as JSON:
{
  "title": "main title/header if present",
  "content": "main body text",
  "lists": ["array of list items if present"],
  "tables": [{"headers": [], "rows": []}],
  "metadata": {"date": "", "author": "", "other": ""}
}
Only output valid JSON.`,

  extract_prices: `Extract ALL prices and monetary values from this image.
For each price found, output:
- The price value (including currency symbol)
- The associated product/item name if visible
Format as JSON array: [{"product": "name", "price": "R$ X,XX"}]
Only output valid JSON.`,

  extract_contacts: `Extract ALL contact information from this image:
- Email addresses
- Phone numbers
- Addresses
- Social media handles
- Website URLs
Format as JSON: {"emails": [], "phones": [], "addresses": [], "social": [], "websites": []}`,

  describe_layout: `Describe the visual layout of this image:
- What type of content is shown (webpage, document, chart, etc.)
- Main sections/areas
- Text positioning
- Important visual elements
Be concise but thorough.`
};

// =====================================================
// CLASSE DE OCR
// =====================================================

class OCRService {
  constructor(env) {
    this.env = env;
    this.ai = env.AI; // Workers AI binding
  }

  /**
   * Executa OCR usando Workers AI
   */
  async extractText(imageBase64, options = {}) {
    const {
      model = 'llama_vision',
      prompt_type = 'extract_all',
      custom_prompt = null,
      language = 'auto'
    } = options;

    // Verificar se AI está disponível
    if (!this.ai) {
      return {
        success: false,
        error: 'Workers AI não configurado',
        setup_instructions: {
          step1: 'Adicionar binding no wrangler.toml: [ai] binding = "AI"',
          step2: 'Fazer novo deploy do Worker'
        }
      };
    }

    const modelConfig = OCR_MODELS[model] || OCR_MODELS.llama_vision;
    const prompt = custom_prompt || OCR_PROMPTS[prompt_type] || OCR_PROMPTS.extract_all;

    // Adicionar instrução de idioma se especificado
    let finalPrompt = prompt;
    if (language !== 'auto') {
      finalPrompt = `${prompt}\n\nThe text is in ${language}. Preserve the original language.`;
    }

    try {
      const startTime = Date.now();

      const response = await this.ai.run(modelConfig.id, {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: finalPrompt
              },
              {
                type: 'image',
                image: imageBase64
              }
            ]
          }
        ],
        max_tokens: 4096
      });

      const duration = Date.now() - startTime;

      // Tentar parsear como JSON se esperado
      let parsed = null;
      if (['extract_structured', 'extract_prices', 'extract_contacts'].includes(prompt_type)) {
        try {
          // Limpar markdown code blocks se presente
          let jsonStr = response.response || response;
          if (typeof jsonStr === 'string') {
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(jsonStr);
          }
        } catch (e) {
          // Não conseguiu parsear, retorna texto raw
        }
      }

      return {
        success: true,
        model: modelConfig.name,
        duration_ms: duration,
        text: response.response || response,
        structured: parsed,
        prompt_type
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        model: modelConfig.name
      };
    }
  }

  /**
   * OCR com regiões (detecta blocos de texto)
   */
  async extractWithRegions(imageBase64) {
    const prompt = `Analyze this image and identify all distinct text regions.
For each region, provide:
1. A description of where it is (top-left, center, bottom-right, etc.)
2. The type of text (heading, paragraph, label, button, etc.)
3. The actual text content

Format as JSON:
{
  "regions": [
    {
      "position": "top-left",
      "type": "heading",
      "text": "extracted text here"
    }
  ]
}
Only output valid JSON.`;

    return this.extractText(imageBase64, {
      custom_prompt: prompt,
      prompt_type: 'custom'
    });
  }

  /**
   * OCR especializado em tabelas
   */
  async extractTables(imageBase64) {
    const prompt = `Extract ALL tables from this image.
For each table found, output:
- Column headers
- All rows of data
- Preserve the exact cell values

Format as JSON:
{
  "tables": [
    {
      "headers": ["Column 1", "Column 2", ...],
      "rows": [
        ["value1", "value2", ...],
        ["value1", "value2", ...]
      ]
    }
  ]
}
If no tables found, return: {"tables": []}
Only output valid JSON.`;

    return this.extractText(imageBase64, {
      custom_prompt: prompt,
      prompt_type: 'custom'
    });
  }
}

// =====================================================
// FERRAMENTAS MCP
// =====================================================

const br_ocr = {
  name: "br_ocr",
  description: `📝 OCR - Extrai texto de screenshots usando IA.

Modelos:
- llama_vision: Llama 3.2 Vision (melhor qualidade)
- uform: UForm Gen2 (mais rápido)

Tipos de prompt:
- extract_all: Todo texto visível
- extract_structured: Texto estruturado em JSON
- extract_prices: Preços e valores monetários
- extract_contacts: Emails, telefones, endereços
- describe_layout: Descrição do layout

Pode processar:
- Screenshot de URL (captura + OCR)
- Imagem base64 direta`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL para capturar e extrair texto" },
      image: { type: "string", description: "Imagem base64 direta" },
      model: {
        type: "string",
        enum: ["llama_vision", "uform"],
        default: "llama_vision"
      },
      prompt_type: {
        type: "string",
        enum: ["extract_all", "extract_structured", "extract_prices", "extract_contacts", "describe_layout"],
        default: "extract_all"
      },
      custom_prompt: { type: "string", description: "Prompt customizado (sobrescreve prompt_type)" },
      language: { type: "string", default: "auto", description: "Idioma esperado (pt, en, es, auto)" },
      selector: { type: "string", description: "CSS selector para capturar área específica" },
      viewport: { type: "object" }
    }
  },
  handler: async (params, env, browserRequest) => {
    const ocrService = new OCRService(env);
    let imageBase64;

    // Obter imagem
    if (params.image) {
      imageBase64 = params.image;
    } else if (params.url) {
      // Capturar screenshot
      const screenshotResult = await browserRequest('/screenshot', 'POST', {
        url: params.url,
        selector: params.selector,
        viewport: params.viewport
      });

      if (!screenshotResult.success) {
        return { success: false, error: "Falha ao capturar screenshot", details: screenshotResult };
      }

      imageBase64 = screenshotResult.data;
    } else {
      return { success: false, error: "Forneça 'url' ou 'image'" };
    }

    // Executar OCR
    const result = await ocrService.extractText(imageBase64, {
      model: params.model,
      prompt_type: params.prompt_type,
      custom_prompt: params.custom_prompt,
      language: params.language
    });

    return {
      ...result,
      source: params.url ? 'screenshot' : 'direct_image',
      url: params.url
    };
  }
};

const br_ocr_table = {
  name: "br_ocr_table",
  description: `📊 OCR TABELAS - Extrai tabelas de imagens como JSON/CSV.

Especializado em:
- Tabelas HTML/screenshots
- Planilhas
- PDFs tabulares
- Imagens de relatórios

Retorna tabelas estruturadas com headers e rows.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      image: { type: "string" },
      output_format: {
        type: "string",
        enum: ["json", "csv", "markdown"],
        default: "json"
      },
      selector: { type: "string" }
    }
  },
  handler: async (params, env, browserRequest) => {
    const ocrService = new OCRService(env);
    let imageBase64;

    // Obter imagem
    if (params.image) {
      imageBase64 = params.image;
    } else if (params.url) {
      const screenshotResult = await browserRequest('/screenshot', 'POST', {
        url: params.url,
        selector: params.selector
      });

      if (!screenshotResult.success) {
        return { success: false, error: "Falha ao capturar screenshot" };
      }

      imageBase64 = screenshotResult.data;
    } else {
      return { success: false, error: "Forneça 'url' ou 'image'" };
    }

    // Extrair tabelas
    const result = await ocrService.extractTables(imageBase64);

    if (!result.success) {
      return result;
    }

    // Formatar saída
    const tables = result.structured?.tables || [];

    if (params.output_format === 'csv' && tables.length > 0) {
      // Converter para CSV
      const csvTables = tables.map((table, index) => {
        const headers = table.headers?.join(',') || '';
        const rows = table.rows?.map(row => row.join(',')).join('\n') || '';
        return `# Table ${index + 1}\n${headers}\n${rows}`;
      });

      return {
        success: true,
        tables_found: tables.length,
        csv: csvTables.join('\n\n'),
        raw: result.text
      };
    }

    if (params.output_format === 'markdown' && tables.length > 0) {
      // Converter para Markdown
      const mdTables = tables.map((table, index) => {
        const headers = `| ${table.headers?.join(' | ') || ''} |`;
        const separator = `| ${table.headers?.map(() => '---').join(' | ') || ''} |`;
        const rows = table.rows?.map(row => `| ${row.join(' | ')} |`).join('\n') || '';
        return `### Table ${index + 1}\n\n${headers}\n${separator}\n${rows}`;
      });

      return {
        success: true,
        tables_found: tables.length,
        markdown: mdTables.join('\n\n'),
        raw: result.text
      };
    }

    return {
      success: true,
      tables_found: tables.length,
      tables,
      raw: result.text
    };
  }
};

const br_ocr_batch = {
  name: "br_ocr_batch",
  description: `📚 OCR BATCH - Processa múltiplas imagens/URLs em paralelo.

Ideal para:
- Processar várias páginas de um documento
- Extrair texto de galeria de imagens
- Monitoramento em massa`,
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            image: { type: "string" },
            id: { type: "string", description: "ID para identificar resultado" }
          }
        },
        description: "Lista de URLs ou imagens (max 10)"
      },
      prompt_type: {
        type: "string",
        enum: ["extract_all", "extract_structured", "extract_prices", "extract_contacts"],
        default: "extract_all"
      }
    },
    required: ["items"]
  },
  handler: async (params, env, browserRequest) => {
    if (params.items.length > 10) {
      return { success: false, error: "Máximo 10 itens por batch" };
    }

    const ocrService = new OCRService(env);
    const results = [];

    // Processar em batches de 3 para não sobrecarregar
    const batchSize = 3;
    
    for (let i = 0; i < params.items.length; i += batchSize) {
      const batch = params.items.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(batch.map(async (item) => {
        try {
          let imageBase64;

          if (item.image) {
            imageBase64 = item.image;
          } else if (item.url) {
            const screenshotResult = await browserRequest('/screenshot', 'POST', { url: item.url });
            if (!screenshotResult.success) {
              return { id: item.id, url: item.url, success: false, error: "Screenshot failed" };
            }
            imageBase64 = screenshotResult.data;
          } else {
            return { id: item.id, success: false, error: "No url or image" };
          }

          const ocrResult = await ocrService.extractText(imageBase64, {
            prompt_type: params.prompt_type
          });

          return {
            id: item.id,
            url: item.url,
            ...ocrResult
          };
        } catch (e) {
          return { id: item.id, url: item.url, success: false, error: e.message };
        }
      }));

      results.push(...batchResults);
    }

    const successful = results.filter(r => r.success).length;

    return {
      success: true,
      total: params.items.length,
      successful,
      failed: params.items.length - successful,
      results
    };
  }
};

// =====================================================
// EXPORT
// =====================================================

export {
  OCRService,
  br_ocr,
  br_ocr_table,
  br_ocr_batch,
  OCR_MODELS,
  OCR_PROMPTS
};
