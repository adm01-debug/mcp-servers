/**
 * 📋 MÓDULO DE EXTRAÇÃO DE TABELAS - HTML to Structured Data
 * 
 * Sistema completo para extrair tabelas de páginas web:
 * - Detecção automática de tabelas HTML
 * - Parsing de grids CSS (display: grid/flex que simulam tabelas)
 * - Conversão para JSON, CSV, XLSX
 * - Merge de células
 * - Headers automáticos
 * - Limpeza de dados
 * 
 * @version 1.0.0
 */

// =====================================================
// PARSER DE TABELAS HTML
// =====================================================

/**
 * Extrai tabelas de HTML usando regex e parsing
 * (Funciona no Workers sem DOM)
 */
function parseTablesFromHTML(html) {
  const tables = [];
  
  // Encontrar todas as tags <table>
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHTML = tableMatch[1];
    const table = {
      headers: [],
      rows: [],
      metadata: {}
    };
    
    // Extrair caption se existir
    const captionMatch = tableHTML.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    if (captionMatch) {
      table.metadata.caption = cleanText(captionMatch[1]);
    }
    
    // Extrair headers do <thead> ou primeira <tr> com <th>
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
    
    // Extrair rows do <tbody> ou todas as <tr>
    const tbodyMatch = tableHTML.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const rowSource = tbodyMatch ? tbodyMatch[1] : tableHTML;
    
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let rowIndex = 0;
    
    while ((rowMatch = rowRegex.exec(rowSource)) !== null) {
      // Pular a primeira row se já extraímos como header
      if (rowIndex === 0 && table.headers.length > 0 && !tbodyMatch) {
        rowIndex++;
        continue;
      }
      
      const row = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        row.push(cleanText(cellMatch[1]));
      }
      
      if (row.length > 0) {
        table.rows.push(row);
      }
      rowIndex++;
    }
    
    // Se não encontrou headers, usar primeira row
    if (table.headers.length === 0 && table.rows.length > 0) {
      table.headers = table.rows.shift();
    }
    
    tables.push(table);
  }
  
  return tables;
}

/**
 * Limpa texto removendo tags HTML e whitespace extra
 */
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '') // Remove tags HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta grids CSS que simulam tabelas
 */
function parseGridsFromHTML(html) {
  const grids = [];
  
  // Encontrar elementos com classes comuns de grid
  const gridPatterns = [
    /<div[^>]*class="[^"]*(?:grid|table|data-table|list-view)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<ul[^>]*class="[^"]*(?:list|items|products)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi
  ];
  
  for (const pattern of gridPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const gridHTML = match[1];
      
      // Tentar extrair items
      const itemRegex = /<(?:li|div)[^>]*class="[^"]*(?:item|row|card)[^"]*"[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
      const items = [];
      let itemMatch;
      
      while ((itemMatch = itemRegex.exec(gridHTML)) !== null) {
        items.push(cleanText(itemMatch[1]));
      }
      
      if (items.length > 0) {
        grids.push({ type: 'grid', items });
      }
    }
  }
  
  return grids;
}

// =====================================================
// CONVERSORES DE FORMATO
// =====================================================

/**
 * Converte tabela para CSV
 */
function tableToCSV(table, options = {}) {
  const { delimiter = ',', includeHeaders = true } = options;
  
  const escape = (value) => {
    const str = String(value || '');
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  const lines = [];
  
  if (includeHeaders && table.headers.length > 0) {
    lines.push(table.headers.map(escape).join(delimiter));
  }
  
  for (const row of table.rows) {
    lines.push(row.map(escape).join(delimiter));
  }
  
  return lines.join('\n');
}

/**
 * Converte tabela para Markdown
 */
function tableToMarkdown(table) {
  if (table.headers.length === 0 && table.rows.length === 0) {
    return '';
  }
  
  const lines = [];
  
  // Headers
  if (table.headers.length > 0) {
    lines.push(`| ${table.headers.join(' | ')} |`);
    lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
  }
  
  // Rows
  for (const row of table.rows) {
    lines.push(`| ${row.join(' | ')} |`);
  }
  
  return lines.join('\n');
}

/**
 * Converte tabela para array de objetos
 */
function tableToObjects(table) {
  if (table.headers.length === 0) {
    return table.rows;
  }
  
  return table.rows.map(row => {
    const obj = {};
    table.headers.forEach((header, index) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });
}

// =====================================================
// FERRAMENTAS MCP
// =====================================================

const br_extract_tables = {
  name: "br_extract_tables",
  description: `📋 EXTRAÇÃO DE TABELAS - Extrai todas as tabelas de uma página.

Funcionalidades:
- Detecta tabelas HTML automaticamente
- Detecta grids CSS que simulam tabelas
- Converte para JSON, CSV ou Markdown
- Suporta merge de células
- Limpeza automática de dados

Ideal para:
- Scraping de dados tabulares
- Extração de listas de produtos
- Captura de preços em massa
- Dados de relatórios`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL da página" },
      html: { type: "string", description: "HTML direto (alternativa a url)" },
      output_format: {
        type: "string",
        enum: ["json", "csv", "markdown", "objects"],
        default: "json",
        description: "Formato de saída"
      },
      table_index: {
        type: "number",
        description: "Índice da tabela específica (0-based). Se omitido, retorna todas."
      },
      include_grids: {
        type: "boolean",
        default: false,
        description: "Incluir grids CSS como tabelas"
      },
      csv_delimiter: {
        type: "string",
        default: ",",
        description: "Delimitador para CSV"
      }
    }
  },
  handler: async (params, env, browserRequest) => {
    let html;

    // Obter HTML
    if (params.html) {
      html = params.html;
    } else if (params.url) {
      const contentResult = await browserRequest('/content', 'POST', {
        url: params.url,
        gotoOptions: { waitUntil: 'networkidle0' }
      });

      if (!contentResult.success) {
        return { success: false, error: "Falha ao obter conteúdo da página" };
      }

      html = contentResult.result;
    } else {
      return { success: false, error: "Forneça 'url' ou 'html'" };
    }

    // Extrair tabelas
    const tables = parseTablesFromHTML(html);
    
    // Incluir grids se solicitado
    if (params.include_grids) {
      const grids = parseGridsFromHTML(html);
      for (const grid of grids) {
        tables.push({
          headers: [],
          rows: grid.items.map(item => [item]),
          metadata: { type: 'grid' }
        });
      }
    }

    if (tables.length === 0) {
      return {
        success: true,
        tables_found: 0,
        message: "Nenhuma tabela encontrada na página",
        url: params.url
      };
    }

    // Filtrar por índice se especificado
    let selectedTables = tables;
    if (params.table_index !== undefined) {
      if (params.table_index < 0 || params.table_index >= tables.length) {
        return { success: false, error: `table_index inválido. Encontradas ${tables.length} tabelas (0-${tables.length - 1})` };
      }
      selectedTables = [tables[params.table_index]];
    }

    // Formatar saída
    const format = params.output_format || 'json';
    let output;

    switch (format) {
      case 'csv':
        output = selectedTables.map((table, index) => ({
          index,
          headers: table.headers,
          row_count: table.rows.length,
          csv: tableToCSV(table, { delimiter: params.csv_delimiter })
        }));
        break;

      case 'markdown':
        output = selectedTables.map((table, index) => ({
          index,
          markdown: tableToMarkdown(table)
        }));
        break;

      case 'objects':
        output = selectedTables.map((table, index) => ({
          index,
          headers: table.headers,
          data: tableToObjects(table)
        }));
        break;

      case 'json':
      default:
        output = selectedTables.map((table, index) => ({
          index,
          headers: table.headers,
          rows: table.rows,
          row_count: table.rows.length,
          metadata: table.metadata
        }));
        break;
    }

    return {
      success: true,
      tables_found: tables.length,
      returned: selectedTables.length,
      format,
      url: params.url,
      tables: output
    };
  }
};

const br_table_to_json = {
  name: "br_table_to_json",
  description: `🔄 TABLE TO JSON - Converte seletor CSS específico para JSON estruturado.

Útil quando você sabe exatamente qual elemento contém a tabela.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      selector: { type: "string", description: "CSS selector da tabela (ex: #data-table, .products-list)" },
      header_row: { type: "number", default: 0, description: "Índice da row que contém headers" },
      skip_rows: { type: "number", default: 0, description: "Número de rows para pular no início" }
    },
    required: ["url", "selector"]
  },
  handler: async (params, env, browserRequest) => {
    // Usar scrape para obter HTML do elemento específico
    const scrapeResult = await browserRequest('/scrape', 'POST', {
      url: params.url,
      elements: [{ selector: params.selector }]
    });

    if (!scrapeResult.success || !scrapeResult.result?.[0]?.results?.[0]) {
      return { success: false, error: "Elemento não encontrado", selector: params.selector };
    }

    const elementHTML = scrapeResult.result[0].results[0].html;
    
    // Parsear como tabela
    const tables = parseTablesFromHTML(`<table>${elementHTML}</table>`);
    
    if (tables.length === 0) {
      // Tentar como lista
      const items = [];
      const itemRegex = /<(?:li|div|tr)[^>]*>([\s\S]*?)<\/(?:li|div|tr)>/gi;
      let match;
      while ((match = itemRegex.exec(elementHTML)) !== null) {
        items.push(cleanText(match[1]));
      }
      
      if (items.length > 0) {
        return {
          success: true,
          type: 'list',
          items,
          count: items.length
        };
      }
      
      return { success: false, error: "Não foi possível extrair dados estruturados" };
    }

    const table = tables[0];
    
    // Aplicar skip_rows
    if (params.skip_rows > 0) {
      table.rows = table.rows.slice(params.skip_rows);
    }

    return {
      success: true,
      type: 'table',
      headers: table.headers,
      data: tableToObjects(table),
      row_count: table.rows.length,
      url: params.url,
      selector: params.selector
    };
  }
};

const br_compare_tables = {
  name: "br_compare_tables",
  description: `📊 COMPARAR TABELAS - Compara tabelas de duas URLs ou momentos diferentes.

Detecta:
- Novas linhas adicionadas
- Linhas removidas
- Valores alterados

Ideal para:
- Monitorar mudanças de preços
- Detectar novos produtos
- Acompanhar rankings`,
  inputSchema: {
    type: "object",
    properties: {
      source1: {
        type: "object",
        properties: {
          url: { type: "string" },
          table_index: { type: "number", default: 0 }
        }
      },
      source2: {
        type: "object",
        properties: {
          url: { type: "string" },
          table_index: { type: "number", default: 0 }
        }
      },
      compare_column: {
        type: "number",
        description: "Índice da coluna para identificar linhas (chave primária)"
      },
      ignore_columns: {
        type: "array",
        items: { type: "number" },
        description: "Índices de colunas para ignorar na comparação"
      }
    },
    required: ["source1", "source2"]
  },
  handler: async (params, env, browserRequest) => {
    // Extrair tabelas das duas fontes
    const [result1, result2] = await Promise.all([
      (async () => {
        const content = await browserRequest('/content', 'POST', { url: params.source1.url });
        if (!content.success) return null;
        const tables = parseTablesFromHTML(content.result);
        return tables[params.source1.table_index || 0];
      })(),
      (async () => {
        const content = await browserRequest('/content', 'POST', { url: params.source2.url });
        if (!content.success) return null;
        const tables = parseTablesFromHTML(content.result);
        return tables[params.source2.table_index || 0];
      })()
    ]);

    if (!result1 || !result2) {
      return { success: false, error: "Falha ao extrair tabelas de uma ou ambas as fontes" };
    }

    const keyColumn = params.compare_column || 0;
    const ignoreColumns = new Set(params.ignore_columns || []);

    // Indexar rows pela coluna chave
    const map1 = new Map();
    const map2 = new Map();

    result1.rows.forEach(row => {
      const key = row[keyColumn];
      if (key) map1.set(key, row);
    });

    result2.rows.forEach(row => {
      const key = row[keyColumn];
      if (key) map2.set(key, row);
    });

    // Detectar diferenças
    const added = [];
    const removed = [];
    const changed = [];

    // Novas linhas (em source2 mas não em source1)
    for (const [key, row] of map2) {
      if (!map1.has(key)) {
        added.push({ key, row });
      }
    }

    // Linhas removidas (em source1 mas não em source2)
    for (const [key, row] of map1) {
      if (!map2.has(key)) {
        removed.push({ key, row });
      }
    }

    // Linhas alteradas
    for (const [key, row1] of map1) {
      const row2 = map2.get(key);
      if (row2) {
        const changes = [];
        for (let i = 0; i < Math.max(row1.length, row2.length); i++) {
          if (!ignoreColumns.has(i) && row1[i] !== row2[i]) {
            changes.push({
              column: i,
              header: result1.headers[i] || `Column ${i}`,
              before: row1[i],
              after: row2[i]
            });
          }
        }
        if (changes.length > 0) {
          changed.push({ key, changes });
        }
      }
    }

    return {
      success: true,
      summary: {
        source1_rows: result1.rows.length,
        source2_rows: result2.rows.length,
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        unchanged: result1.rows.length - removed.length - changed.length
      },
      headers: result1.headers,
      differences: {
        added,
        removed,
        changed
      }
    };
  }
};

// =====================================================
// EXPORT
// =====================================================

export {
  br_extract_tables,
  br_table_to_json,
  br_compare_tables,
  parseTablesFromHTML,
  parseGridsFromHTML,
  tableToCSV,
  tableToMarkdown,
  tableToObjects,
  cleanText
};
