#!/usr/bin/env node

/**
 * Standard Model Context Protocol (MCP) Server (v1.1 Hardened)
 * Menyediakan tool ask_web_llm, get_web_llm_status, dan reset_web_llm_session
 * melalui stdio JSON-RPC 2.0 untuk Antigravity.
 */

const readline = require('readline');
const Orchestrator = require('./orchestrator');

const orchestrator = new Orchestrator();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: { code, message }
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { id, method, params } = request;

  try {
    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'web-llm-orchestrator',
          version: '2.4.0'
        }
      });
    } else if (method === 'notifications/initialized') {
      // No response needed
    } else if (method === 'ping') {
      sendResponse(id, {});
    } else if (method === 'tools/list') {
      sendResponse(id, {
        tools: [
          {
            name: 'ask_web_llm',
            description: 'Kirim prompt ke model LLM di browser (Claude Sonnet 3.7 / Gemini 4 Argon). Jika terjadi batas kuota, sistem otomatis melakukan failover bertingkat ke Gemini, Qwen (Thinking Model), atau ChatGPT dengan menyertakan riwayat obrolan terkendali.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Teks instruksi, pertanyaan, atau arahan perbaikan.'
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Daftar path file lokal yang ingin disertakan langsung ke browser (misal ["sections/methodology.tex"]). Bypass pembacaan isi file oleh agen untuk hemat token.'
                },
                force_model: {
                  type: 'string',
                  enum: ['claude', 'gemini', 'qwen', 'chatgpt'],
                  description: 'Opsional: paksa model tertentu tanpa alur default.'
                },
                allow_downgrade: {
                  type: 'boolean',
                  description: 'Opsional: izinkan eksekusi Flash-Lite jika Gemini Argon mencapai batas kuota.'
                },
                tier: {
                  type: 'integer',
                  enum: [1, 2, 3],
                  description: 'Tingkat risiko/kedalaman debat evaluasi (1: daily/ringkas 1-2 turn, 2: default audit 2-3 turn, 3: arsitektur kritis 4-5 turn).'
                },
                evaluate: {
                  type: 'boolean',
                  description: 'Apakah mengaktifkan loop Evaluator-Optimizer (default true).'
                },
                interrogate: {
                  type: 'boolean',
                  description: 'Alias kompatibilitas untuk evaluate (default true).'
                },
                optimize_prompt: {
                  type: 'boolean',
                  description: 'Apakah mengaktifkan sintesis prompt Lyra 4-D (default true).'
                },
                reset_session: {
                  type: 'boolean',
                  description: 'Apakah mereset riwayat percakapan sebelum mengirim prompt ini (default false).'
                },
                session_id: {
                  type: 'string',
                  description: 'Opsional: ID sesi obrolan untuk isolasi konteks percakapan multi-thread (default "default").'
                },
                tone: {
                  type: 'string',
                  enum: ['caveman', 'academic', 'production', 'engineering'],
                  description: 'Opsional: gaya/tone output yang diharapkan.'
                },
                reasoning: {
                  type: 'string',
                  enum: ['deep', 'balanced', 'quick'],
                  description: 'Opsional: kedalaman penalaran (deep: CoT komprehensif, quick: ringkas).'
                }
              },
              required: ['prompt']
            }
          },
          {
            name: 'get_web_llm_status',
            description: 'Periksa status kesiapan browser Chrome port 9222 dan tab Claude, Gemini, Qwen, serta ChatGPT.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'reset_web_llm_session',
            description: 'Bersihkan riwayat percakapan lokal untuk memulai topik pembahasan baru.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;

      if (name === 'ask_web_llm') {
        const isEvalActive = args.evaluate !== undefined ? args.evaluate : (args.interrogate !== undefined ? args.interrogate : true);
        const result = await orchestrator.ask(args.prompt, {
          forceModel: args.force_model,
          allowDowngrade: args.allow_downgrade !== undefined ? args.allow_downgrade : false,
          files: args.files || [],
          tier: args.tier !== undefined ? args.tier : 2,
          evaluate: isEvalActive,
          interrogate: isEvalActive,
          optimizePrompt: args.optimize_prompt !== undefined ? args.optimize_prompt : true,
          resetSession: args.reset_session !== undefined ? args.reset_session : false,
          sessionId: args.session_id || 'default',
          tone: args.tone || null,
          reasoning: args.reasoning || null,
          onLog: (msg) => process.stderr.write(`${msg}\n`)
        });

        // Sanitasi tag agar tidak terjadi tag escaping injection jika model memuat teks literal tag ini
        const sanitizedAnswer = (result.answer || '').replace(/<(\/?)web_llm_untrusted_output/gi, '&lt;$1web_llm_untrusted_output');

        // Bungkus dengan penanda data tak tepercaya demi keamanan
        const untrustedOutput = 
`<web_llm_untrusted_output provider="${result.provider_used}" failover="${result.failover}">
${sanitizedAnswer}
</web_llm_untrusted_output>`;

        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: untrustedOutput
            }
          ]
        });
      } else if (name === 'get_web_llm_status') {
        const status = await orchestrator.getStatus();
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }
          ]
        });
      } else if (name === 'reset_web_llm_session') {
        const res = await orchestrator.resetSession();
        sendResponse(id, {
          content: [
            {
              type: 'text',
              text: res.message
            }
          ]
        });
      } else {
        sendError(id, -32601, `Tool tidak ditemukan: ${name}`);
      }
    } else {
      sendError(id, -32601, `Metode tidak didukung: ${method}`);
    }
  } catch (err) {
    sendResponse(id, {
      content: [
        {
          type: 'text',
          text: `Error saat mengeksekusi tool: ${err.message}`
        }
      ],
      isError: true
    });
  }
});

rl.on('close', async () => {
  await orchestrator.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await orchestrator.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await orchestrator.close();
  process.exit(0);
});
