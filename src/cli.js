#!/usr/bin/env node

/**
 * CLI Runner untuk Web-LLM Orchestrator (v1.1 Hardened)
 * Penggunaan:
 *   node src/cli.js ask "Tolong review formula ini"
 *   node src/cli.js ask --files sections/methodology.tex "Tolong review formula ini"
 *   node src/cli.js ask --model chatgpt "Prompt"
 *   node src/cli.js status
 *   node src/cli.js reset
 */

const fs = require('fs');
const Orchestrator = require('./orchestrator');
const { resolvePrompt, PromptInputError } = require('./prompt_input');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  const orchestrator = new Orchestrator();

  try {
    if (command === 'status') {
      const status = await orchestrator.getStatus();
      console.log('\n=== STATUS WEB-LLM ORCHESTRATOR ===');
      console.log(JSON.stringify(status, null, 2));
    } else if (command === 'reset') {
      const modelIdx = args.indexOf('--model');
      const targetModel = modelIdx !== -1 ? args[modelIdx + 1] : null;
      const res = await orchestrator.resetSession(console.log, targetModel);
      console.log(`\n✅ ${res.message}`);
    } else if (command === 'open' || command === 'start-browser') {
      console.log('\n=== MEMBUKA GOOGLE CHROME ===');
      await orchestrator.browserManager.ensureBrowser(console.log);
      console.log('✅ Google Chrome telah aktif dengan tab Claude, Gemini, Qwen, dan ChatGPT.');
    } else if (command === 'prompt-optimize') {
      const rawPrompt = args.slice(1).join(' ');
      if (!rawPrompt.trim()) {
        console.error('Error: Masukkan teks pertanyaan / instruksi yang ingin dioptimasi.');
        process.exit(1);
      }
      const synthRes = orchestrator.promptSynthesizer.synthesize(rawPrompt);
      console.log(synthRes.previewBox);
      console.log('=== HASIL OPTIMASI PROMPT (LYRA 4-D) ===');
      console.log(synthRes.optimizedPrompt);
      console.log('========================================\n');
    } else if (command === 'ask') {
      let promptArgs = args.slice(1);
      let forceModel = null;
      let mode = null;
      let reasoning = null;
      let files = [];
      let previewPrompt = true;
      let optimizePrompt = true;
      let interrogate = true;
      let safetyMaxTurns = 5;
      let explicitDomain = null;
      let tier = 2;
      let resetSession = false;
      let promptFile = null;
      let useStdin = false;
      let allowDowngrade = false;

      while (promptArgs.length > 0 && promptArgs[0].startsWith('--')) {
        if (promptArgs[0] === '--model') {
          forceModel = promptArgs[1];
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--mode') {
          mode = promptArgs[1];
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--reasoning') {
          reasoning = promptArgs[1];
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--files' || promptArgs[0] === '--file') {
          if (promptArgs[1]) {
            const rawItems = promptArgs[1].split(',').map(f => f.trim()).filter(Boolean);
            files.push(...rawItems);
          }
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--prompt-file') {
          promptFile = promptArgs[1];
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--stdin') {
          useStdin = true;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--allow-downgrade') {
          allowDowngrade = true;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--tier') {
          tier = parseInt(promptArgs[1], 10) || 2;
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--domain') {
          explicitDomain = promptArgs[1];
          promptArgs = promptArgs.slice(2);
        } else if (promptArgs[0] === '--new' || promptArgs[0] === '--reset') {
          resetSession = true;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--silent') {
          previewPrompt = false;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--preview') {
          previewPrompt = true;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--no-optimize') {
          optimizePrompt = false;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--no-eval' || promptArgs[0] === '--no-interrogate') {
          interrogate = false;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--eval' || promptArgs[0] === '--interrogate') {
          interrogate = true;
          promptArgs = promptArgs.slice(1);
        } else if (promptArgs[0] === '--max-turns') {
          safetyMaxTurns = parseInt(promptArgs[1], 10) || 5;
          promptArgs = promptArgs.slice(2);
        } else {
          break;
        }
      }

      let prompt;
      try {
        prompt = await resolvePrompt({
          promptFile,
          stdin: useStdin,
          inlineText: promptArgs.join(' ')
        });
      } catch (inputErr) {
        if (inputErr instanceof PromptInputError) {
          console.error(`\n[web-llm-orchestrator] ${inputErr.code}: ${inputErr.message}`);
          process.exit(2);
        }
        throw inputErr;
      }

      console.log('\n==================================================');
      console.log(`Prompt      : "${prompt}"`);
      if (files.length > 0) console.log(`Files       : ${files.join(', ')}`);
      if (forceModel) console.log(`Model Target: ${forceModel}`);
      if (mode) console.log(`Mode Target : ${mode}`);
      if (reasoning) console.log(`Reasoning   : ${reasoning}`);
      if (explicitDomain) console.log(`Domain      : ${explicitDomain}`);
      if (resetSession) console.log(`Reset Sesi  : Aktif (New Chat)`);
      if (allowDowngrade) console.log(`Downgrade   : Diizinkan (--allow-downgrade)`);
      console.log(`Evaluator   : ${interrogate ? `Aktif (Tier ${tier}, Max ${safetyMaxTurns} turns)` : 'Nonaktif'}`);
      console.log(`Lyra 4-D    : ${optimizePrompt ? 'Aktif' : 'Nonaktif'}`);
      console.log('==================================================\n');

      const result = await orchestrator.ask(prompt, {
        forceModel,
        mode,
        reasoning,
        files,
        domain: explicitDomain,
        tier,
        previewPrompt,
        optimizePrompt,
        interrogate,
        safetyMaxTurns,
        resetSession,
        allowDowngrade
      });

      console.log('\n==================================================');
      if (result.failover) {
        console.log(`⚠️  [HASIL FAILOVER KE ${result.provider_used.toUpperCase()}]`);
        console.log(`Info: Dialihkan dari ${result.failover_detail?.from} karena kuota tercapai.\n`);
      } else {
        console.log(`✅ [HASIL DARI ${result.provider_used.toUpperCase()}]`);
      }
      const evalTurns = result.evaluator_turns || result.amtil_turns;
      const evalConverged = result.evaluator_converged !== undefined ? result.evaluator_converged : result.amtil_converged;
      if (evalTurns) {
        console.log(`ℹ️  Evaluasi Putaran: ${evalTurns} | Status: ${evalConverged ? 'KONVERGEN (LULUS)' : 'SELESAI'}`);
      }
      console.log('--------------------------------------------------');
      console.log(result.answer);
      console.log('==================================================\n');
    } else {
      console.log('Perintah yang tersedia:');
      console.log('  node src/cli.js status                                    # Cek koneksi Chrome & tab');
      console.log('  node src/cli.js ask "..."                                 # Kirim prompt');
      console.log('  node src/cli.js ask --tier 1 "..."                        # Mode cepat (1-2 turn)');
      console.log('  node src/cli.js ask --tier 2 "..."                        # Mode default harian (2-3 turn)');
      console.log('  node src/cli.js ask --tier 3 "..."                        # Mode arsitektur mendalam (4-5 turn)');
      console.log('  node src/cli.js ask --model gemini "..."                  # Kirim langsung ke Gemini 4 Argon');
      console.log('  node src/cli.js ask --model gemini --allow-downgrade "..."# Izinkan fallback jika Argon limit kuota');
      console.log('  node src/cli.js ask --model gemini --mode tugas "..."     # Kirim ke Gemini Mode Tugas');
      console.log('  node src/cli.js ask --model qwen "..."                    # Kirim langsung ke Qwen');
      console.log('  node src/cli.js ask --model chatgpt "..."                 # Kirim langsung ke ChatGPT');
      console.log('  node src/cli.js ask --no-eval "..."                       # Nonaktifkan loop evaluasi');
      console.log('  node src/cli.js reset                                     # Bersihkan riwayat percakapan');
    }
  } catch (err) {
    if (err instanceof PromptInputError) {
      console.error(`\n[web-llm-orchestrator] ${err.code}: ${err.message}`);
      process.exitCode = 2;
    } else {
      console.error('\n❌ ERROR:', err.message);
      process.exitCode = 1;
    }
  } finally {
    try {
      await orchestrator.close();
    } catch {}
    process.exit(process.exitCode || 0);
  }
}

if (require.main === module) {
  main();
}
