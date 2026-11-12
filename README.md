# 🪐 ORBIT (`/orbit` / `/llm` / `/web-llm-orchestrator`) [v2.5.0]

> **Orchestrated Reasoning Bridge for Interactive Tabs**  
> *One orchestration core. An entire orbit of web intelligence.*  
> Stateful multi-LLM browser orchestration, multi-session context isolation, stream recovery, formula-preserving extraction, Lyra 4-D adaptive intent optimizer, Evidence-Gated Critique, Google Gemini 4 Argon, hybrid resilient quota reclaim, & multi-tier failover for Antigravity & local AI coding agents via Chrome DevTools Protocol (CDP port 127.0.0.1:9222).

---

> [!IMPORTANT]
> **📜 Repository Governance & Mandatory Documentation Constraint (`.geminirules`)**  
> Setiap kali ada penambahan fitur baru, perubahan arsitektur/logika (failover, stream recovery, lock manager, driver), atau modifikasi test suite, AI Agent / Kontributor **WAJIB** memperbarui dokumen berikut secara sinkron sebelum tugas dinyatakan selesai:
> - [x] **`PRD.md`**: Spesifikasi teknis, versi rilis, problem-solution mapping, dan status test matrix.
> - [x] **`README.md`**: Ringkasan fitur, diagram arsitektur mermaid, struktur direktori, dan panduan penggunaan.
> - [x] **`SKILL.md`**: Panduan instruksi slash command lokal dan global di `%USERPROFILE%\.gemini\config\skills\web-llm-orchestrator\SKILL.md`.  
> *Prinsip: Zero Documentation Debt — Tidak ada kode produksi yang dianggap selesai jika dokumentasi belum mencerminkan kondisi riil.*

---

## 📌 Ringkasan & Tujuan Utama

Proyek ini dibangun sebagai mekanisme **arbitrase kuota**—memanfaatkan langganan web pengguna yang sudah aktif (Claude Pro, Gemini Advanced/Free, Qwen Free/Thinking, ChatGPT Plus) untuk menghemat pool kuota model non-Gemini di Antigravity, dengan ketahanan tinggi:
1. **Multi-Tier Sequential Failover (Claude $\rightarrow$ Gemini $\rightarrow$ Qwen $\rightarrow$ ChatGPT):** Ketika Claude mencapai limit kuota harian, sistem memotong rapi generasi parsial, menyusun *Handoff Bundle* ber-nonce, dan otomatis melanjutkan pengerjaan ke Gemini 4 Argon, lalu ke Qwen (Thinking Model), dan akhirnya ke ChatGPT jika dibutuhkan.
2. **Stream Recovery & Tail Sealing (`stream_recovery.js`):**
   - `sealTail`: Memotong code fence / blok `$$` yang menggantung di akhir kalimat buntung dan membuang notice kuota vendor.
   - `buildLedger`: Menganalisis outline yang sudah terselesaikan, notasi matematis, urutan sitasi, dan bahasa pengantar.
   - `buildPrompt`: Membungkus prompt rehydration dalam *Nonce Bounding Box* `[[BEGIN:NAME:nonce]]` anti-prompt-injection.
   - `stitch`: Merekonsiliasi output lanjutan dengan eliminasi overlap whitespace-insensitive dan pembersihan sisa tag `<think>`.
3. **Universal "Engineering Caveman" Contracts (Generate vs. Handoff across All Models):**
   - **Rezim Generate:** Mengadopsi pola Caveman *Answer-First* `[THING] [ACTION] [REASON]` dengan kurung siku wajib, aksi universal (`ANSWER | ANALYZE | AUDIT | DERIVE | IMPLEMENT | FIX`), *Zero Ceremony* (bebas basa-basi sapaan/hedging), serta *Floor Non-Negotiable* (kode, derivasi LaTeX utuh, angka, dan kata logika ingkar haram dipotong). Diterapkan secara universal pada seluruh model (**Claude, Gemini, Qwen, dan ChatGPT**) pada turn pertama, dan otomatis disusul pengingat ringkas pada turn 2+ agar model tidak kembali berbicara santai/berbasa-basi.
   - **Rezim Handoff Continuation:** Mematikan metadata header secara mutlak, melarang keras preamble/pengantar ("Berikut...", "Melanjutkan...", "Sure"), mempertahankan kedalaman teknis secara penuh, serta dilengkapi pre-sanitizer runtime `stripPreface()` untuk menjamin 100% kelanjutan murni.
4. **LaTeX Math Normalizer & Quarantine (`math_normalizer.js`):** Mengonversi delimiter `\[...\]`, `\(...\)`, dan environment TeX (`align`, `equation`) ke standar markdown `$$` dan `$`, membedakan simbol mata uang (aturan Pandoc), serta mengarantina formula rusak ke blok ````tex```` (*zero silent failure*).
5. **Automated Model & Deep Reasoning Lock:**
   - **Gemini Driver:** Otomatis memilih model unggulan `4 Argon` via menu `[data-test-id="bard-mode-menu-button"]` dan mengunci tingkat penalaran `"Tinggi"`.
   - **Qwen Driver:** Otomatis memilih model unggulan `Qwen3.8-Max` via dropdown `.wms-trigger` dan mengunci mode penalaran `"Berpikir"` via `.qwen-thinking-selector`.
   - **ChatGPT Driver:** Mengaktifkan mode penalaran mendalam `"Berpikir"` baik melalui tombol antarmuka web maupun shortcut keyboard native `Ctrl + Shift + M`.
6. **Turn-Count Guard & Anti-Premature Return:** Mencegah driver membaca pesan turn sebelumnya saat model sedang berada di fasa penalaran panjang (20-72 detik) melalui pelacakan `currentCount > this.initialCount`, evaluasi elemen penalaran aktif (`data-testid*="thought"`, `.thoughts-status-message`, stop buttons), dan stabilitas stream respons.
7. **Multi-Tier Formula Preservation:** Mengekstrak tag `<annotation encoding="application/x-tex">`, fallback native MathML child `Node.TEXT_NODE` (khusus Qwen custom KaTeX renderer), dan MathJax script secara non-destruktif dengan layout restorasi 100% utuh via offscreen container pre-wrap.
8. **Injeksi File Langsung (`files: []`):** File proyek dibaca langsung dari disk ke browser, memangkas konsumsi token jendela konteks Antigravity hingga 100%.
9. **Proteksi Mutex Lintas Proses (`LockManager`):** Menggunakan file lock atomik berbasis PID dan TTL 3 menit dengan UUID token fencing untuk mencegah benturan pengetikan saat beberapa proses berjalan bersamaan.
10. **Privacy Guard & Keamanan Profil:** Profil browser dan riwayat sesi disimpan di `%USERPROFILE%\.web-llm-orchestrator\` (di luar repositori proyek), serta pemindaian blacklist otomatis untuk mencegah kebocoran file sensitif (`.env`, `*.key`, `id_rsa*`).
11. **Lyra 4-D Prompt Optimizer (`prompt_synthesizer.js`):** Mengonversi ide mentah pengguna menjadi prompt tangguh anti-halusinasi melalui 4 fase (Deconstruct $\rightarrow$ Diagnose $\rightarrow$ Develop $\rightarrow$ Deliver) dengan penguncian pagu hardware Belmawa ($\le$ Rp3,5M), komponen COTS lokal, dan Negative Constraints ketat.
12. **Domain-Agnostic Evaluator-Optimizer Engine v2.0 (`critic_engine.js` & `critique_contract.js`):** Menggantikan klasifikasi regex statis dan kamus domain kaku dengan Dynamic Framing ($U_1, U_2, U_3$) dan Evidence-Gated Critique Schema v1.0 (*Huang et al. 2023, Du et al. 2023, Anthropic Evaluator-Optimizer*). Mengeliminasi "Domain Explosion" dan sanggahan halusinasi (misal: menuntut flume box atau simulator bencana pada tugas web coding).
13. **Deterministic Objective Convergence Scoring ($S_t$):** Mengukur konvergensi murni secara kuantitatif ($S_t = \sum_{f \in O_t} w(\text{sev}_f) + 5 U_t + 8 L_t$), bukan dari basa-basi verbal LLM (anti-sycophancy). Memutus perdebatan secara otonom saat $S_t = 0$ (*Zero Open Flaws*) atau jika terjadi stagnasi/regresi ($S_t \ge S_{t-1}$).
14. **Evidence-Gated Critique Protocol & Local Verifier Anchoring:** Setiap temuan kritik wajib menyertakan sitasi bukti konkret (`tool`, `quote`, atau `reasoning`) yang terkait langsung dengan kriteria framing awal. Temuan tanpa bukti nyata ditolak untuk mencegah halusinasi evaluator.
15. **Risk-Tiered Turn Budgets (`--tier 1|2|3`):** Alokasi budget putaran dinamis sesuai profil risiko tugas: Tier 1 (1-2 turn) untuk general/daily inquiries, Tier 2 (2-3 turn) untuk core architecture/refactoring, dan Tier 3 (4-5 turn) untuk high-risk/mission-critical audit.
16. **Cross-Directory File Attachment & Multi-File CLI Parsing:** Mendukung injeksi file dengan path absolut dari direktori/workspace mana pun (`C:\dapa\LINUX-COMMUNITY`), pemisahan koma pada CLI (`--files "file1.ts,file2.ts"`), dan penegakan *Privacy Guard* ketat agar model web menerima kode sumber utuh tanpa kebocoran berkas rahasia.
17. **Dynamic Blocker Handling & Source Verification:** Mendeteksi status `BLOCKER` saat model web melaporkan kekurangan file kode sumber, menghentikan loop perdebatan halusinasi secara transparan (`status: 'BLOCKED'`), dan meminta berkas yang dibutuhkan alih-alih berhalusinasi.
18. **Native Trusted Click & Post-Send Verification Guard (`chatgpt_driver.js`):** Mengganti klik sintetis JavaScript yang ditolak oleh composer React/Lexical ChatGPT dengan Puppeteer `ElementHandle.click()` (`isTrusted: true`), fallback penekanan Enter pada input aktif, dan verifikasi pasca-kirim `isStillStuck` ganda untuk menjamin prompt tidak pernah tersangkut di input box.
19. **Pre-Send Busy Guard, Isolated Composer Selectors, & Strict Generating Guard (`chatgpt_driver.js` & `selectors.json`):** Mencegah *race condition* pada giliran interogasi lanjutan (Turn 2+) dengan mengunci pengiriman hingga Stop button hilang via `waitForIdle()`, mengisolasi selektor `div.ProseMirror` dari pembajakan editor kode Canvas (`:not(.cm-content)`), dan menyetel timeout model penalaran mendalam ke 420s (7 menit).
20. **Client-Side Render Failure Auto-Healing (`chatgpt_driver.js`):** Mengatasi *glitch* render virtual DOM React ChatGPT (`data-dil-render-failed` / `"Respons ini tidak dapat dimuat"`) pada respon ultra-panjang ($>35.000$ karakter) dengan mendeteksi elemen kegagalan dan secara otomatis merefresh halaman (`page.reload()`) untuk merestorasi teks utuh dari database server OpenAI.
21. **Claude Driver Hardening & Auto-Healing Parity (`claude_driver.js`):** Menyelaraskan ketahanan Claude Driver dengan ChatGPT Driver melalui implementasi Pre-Send Busy Guard `waitForIdle(120000)` (memeriksa stop button, status streaming, dan `[data-cds="TurnStatusStep"]`), Post-Send Verification Guard dengan native trusted click `ElementHandle.click()`, deteksi galat generasi UI (`generation_error_patterns` di `selectors.json`), dan pemulihan render otomatis via `page.reload()` saat antarmuka web mengalami kegagalan generasi/tampilan.
22. **Aktivasi Skill Native Claude (`/caveman` pada Sesi Awal):** Mendukung pemicuan otomatis skill kustom pengguna (`/caveman`) khusus pada tab Claude di giliran pertama setiap sesi chat baru (Turn 1). Driver mengetikkan `/caveman` via keyboard native dan mengonfirmasinya dengan tombol Enter untuk membentuk skill chip (`data-skill-id="caveman"`), lalu menyisipkan teks prompt. Pada giliran obrolan berikutnya dalam sesi yang sama (Turn 2+), `/caveman` tidak diulang demi mencegah redundansi chip, dan akan aktif kembali saat sesi direset (`/web-llm-orchestrator reset`).
23. **Instant Claude Rate Limit Detection & Clean WebSocket Lifecycle (`claude_driver.js`, `browser_manager.js`, `orchestrator.js`):** Menambahkan pre-send rate limit check 0ms sebelum `waitForIdle()`, early exit pada `waitForIdle()` saat limit terdeteksi, deteksi DOM komprehensif (dialog, modal, sticky footer, treewalker, disabled send button), penanganan `!sent` ber-fallback limit, serta implementasi `BrowserManager.disconnect()` dan `Orchestrator.close()` untuk membersihkan event loop Node.js seketika (mencegah hanging background task). Terverifikasi live: limit Claude ditangkap dalam 0ms dan otomatis dialihkan ke Qwen secara mulus.
24. **Full MCP Schema Parity & Qwen 0ms Pre-Send Guard (`mcp_server.js`, `qwen_driver.js`):** Menyelaraskan seluruh kendali evaluasi (`tier: 1|2|3`, `domain`, `interrogate`, `optimize_prompt`) ke dalam `inputSchema` tool `ask_web_llm` JSON-RPC 2.0, menambahkan trap `rl.on('close')` dan `SIGINT`/`SIGTERM` untuk memutuskan sesi CDP secara bersih saat server stdio ditutup, serta menyuntikkan pre-send rate limit check 0ms pada `QwenDriver` sebelum pemilihan model guna efisiensi failover.
25. **URL /new Dominance, Infallible Skill Chip Verification, & Reset Flags (`claude_driver.js`, `orchestrator.js`, `cli.js`, `mcp_server.js`):** Driver Claude memprioritaskan status fisik tab browser (`currentUrl.includes('/new')`) sebagai *single source of truth* untuk sesi obrolan baru, mengesampingkan stale turn history dari pemanggilan sebelumnya. Menyertakan verifikasi pasca-ketik untuk skill chip `[data-skill-id="caveman"]`, fallback teks otomatis jika chip tidak terbentuk, runtutan seleksi kursor ke ujung akhir (`range.collapse(false)`), serta dukungan bendera `--new` / `--reset` pada CLI `ask` dan `reset_session: true` pada MCP tool `ask_web_llm`.
26. **Multi-Turn Organic Dialectic Debater, --prompt-file, & Tab Physical Reset Navigation (`cli.js`, `orchestrator.js`):** Mendukung perdebatan dialektika multi-turn live tanpa pra-skrip (*pure organic dialectic*). Menambahkan bendera CLI `--prompt-file <path>` untuk membaca teks sanggahan multi-paragraf bebas risiko shell escaping Windows PowerShell. Mengintegrasikan navigasi tab fisik via `browserManager.resetTabs()` saat `--new` diaktifkan agar tab berpindah ke URL bersih (`/new` atau `chatgpt.com`), mencegah tab terkunci dalam busy state dari generasi sebelumnya.
27. **Hierarchical Multi-Agent Dialectic Architecture & Qwen Hardening Implementation:** Mengadopsi pola pembagian tanggung jawab (*Division of Responsibility*) di mana Subagent bertindak sebagai *Dialectic Debater* dan Parent Orchestrator bertindak sebagai *Supervisor & Final Reviewer*. Dilengkapi 5 pilar pertahanan: Toulmin Argumentation DAG, Epistemic Firewall (Burden of Proof Protocol anti-gaslighting), Semantic-Topological Invariance Metric ($\Phi$), Triangulated Pareto Oracle, serta Sliced Critical Pivots + Traceability Chain Hash (hemat 90% context window). Diperkuat dengan implementasi Silent Web Audio Keep-Awake Injector (1 Hz) di `browser_manager.js`, resilient PID check di `lock_manager.js`, dan Evidence Delegation Router di `critic_engine.js`.
28. **Composer & Form Containment Isolation Shield (`claude_driver.js`, `chatgpt_driver.js`, `qwen_driver.js`):** Mengeliminasi false-positive rate limit detection yang terpicu saat pengguna melampirkan file atau teks yang menyebut kata kuota (*"You are out of free messages"*, *"rate limit"*). Mengecualikan area composer (`isInsideComposerOrMessage`) dan container luar yang membungkus input form (`!containsComposer(el)`), mengganti selektor substring `div[class*="banner"]` yang mencocokkan Tailwind utility class `--organization-banner-column-height`, dan mengabaikan node input pada `TreeWalker`.
29. **Hierarchical Concurrency Testing & Enterprise Production Blueprint (`scratch/claude_architecture_debate_synthesis.md`):** Mengonfirmasi keberhasilan orkestrasi konkurensi multi-agen bertingkat (Coordinator memicu 2 Worker subagen konkuren untuk ChatGPT dan Qwen tanpa tabrakan file lock). Merumuskan blueprint 4 pilar enterprise: `SecretPseudonymizer` (in-memory reversible hashing), `extractWithSyntacticValidation` (zero-overhead KaTeX inspection), `stitchHybrid` (15-line LCS dynamic programming window), dan `Graceful Epistemic Degradation` (`BLOCKED_UNVERIFIABLE`).
30. **Eliminasi Total Kamus Domain Hardcoded pada Prompt Synthesizer (`prompt_synthesizer.js` & `domain_rules.json`):** Memisahkan seluruh konfigurasi domain (pola deteksi ber-boundary kata `\b`, persona, batasan kuantitatif, negative constraints, format keluaran, dan required checks) ke dalam skema deklaratif eksternal `src/templates/domain_rules.json`. Menghapus percabangan hardcode `if/else` dari mesin `PromptSynthesizer`, mewujudkan arsitektur 100% data-driven dengan fallback mulus ke arsitektur universal saat aturan domain tidak ditemukan.
31. **Eliminasi Total Dead Code AMTIL & Netralisasi Bias Hardware Universal (`interrogation_engine.js`, `prompt_synthesizer.js`, `domain_rules.json`):** Mengganti 351 baris dead code `interrogation_engine.js` (AMTIL v1.0) dengan backward-compatibility bridge tipis yang mewarisi `CriticEngine` v2.0; membersihkan artefak legacy 'aturan kompetisi' dan 'tabel komponen fisik pasaran umum' dari prompt universal default; serta menstandardisasi domain `software_engineering` tanpa penguncian framework spesifik (Next.js/NestJS/WebSocket). Diverifikasi live di Qwen: output bersih 100% tanpa distorsi hardware.
32. **Tri-Layer Execution Gate & Shell Safety Guard (`prompt_input.js`, `cli.js`, `SKILL.md`, `GEMINI.md`):** Menutup celah *attention dilution* dan *task hijacking* pada agen lokal saat menerima prompt kompleks (>300 char / multi-baris / persona reviewer / formula matematika). Memasang Lapis 1 (Router frontmatter berbobot tinggi), Lapis 2 (Workspace Interceptor Gate yang mewajibkan delegasi via berkas sementara di `scratch/`), dan Lapis 3 (CLI Guardrail yang menolak inline multiline dengan kode galat `E_INLINE_UNSAFE` exit code 2 dan mewajibkan `--prompt-file <path>`). Menghilangkan korupsi shell quoting PowerShell dan menjamin eksekusi peramban terpicu 100%.
33. **Integrasi Flagship Google Gemini 4 Argon, Long Thinking Telemetry, & Segmented Mode Control (`gemini_driver.js`):** Menghubungkan Google Gemini (`gemini.google.com`) sebagai provider web tingkat pertama. Mengunci model flagship **`4 Argon`** (dengan opsi `3.8 Flash`) dan tingkat penalaran **`Tinggi`** (dengan opsi `Sedang`/`Rendah`). Mendukung segmented mode button `"Percakapan"` (default) vs `"Tugas"`, injeksi Quill editor `.ql-editor` via `document.execCommand('insertText')` + space trigger untuk memunculkan tombol kirim dinamis, penanganan Long Thinking Silence (45–72 detik) tanpa timeout prematur, dan ekstraksi formula KaTeX `<annotation>` non-destruktif ber-offscreen pre-wrap container. Terintegrasi penuh ke dalam rantai failover utama: `Claude` $\rightarrow$ `Gemini` $\rightarrow$ `Qwen` $\rightarrow$ `ChatGPT`.
34. **Silent Model Downgrade Detection & Targeted Model Auto-Failover Protocol (`gemini_driver.js`, `orchestrator.js`, `cli.js`):** Mencegah degradasi kualitas diam-diam saat kuota model unggulan (Gemini 4 Argon) habis dan web Gemini otomatis berpindah ke `3.5 Flash-Lite` tanpa banner dialog error. Driver mendeteksi badge composer dan status disabled menu dropdown, lalu menandai status limit kuota. Di tingkat Orchestrator, jika mode terarah (`--model gemini`) terkena limit/downgrade, sistem tidak melempar crash fatal, melainkan mencatat `[AUTO-FAILOVER]` dan secara otomatis **mengoper (failover)** tugas ke kandidat berikutnya di rantai (`Claude`/`Qwen`/`ChatGPT`) berbekal Handoff Bundle Stream Recovery v1.5. CLI juga menyediakan opsi opt-in sadar `--allow-downgrade` jika pengguna sengaja mengizinkan fallback ke Flash-Lite.
35. **Hybrid Resilient Quota Reclaim Architecture & DOM Reset Timestamp Predictive Lease (`parse_reset.js`, `cooldown_store.js`, `orchestrator.js`):** Mengganti cooldown statis (blind 60m / 12h) dengan arsitektur Circuit Breaker berbasis lease prediktif. `parse_reset.js` mengekstrak waktu reset konkret dari DOM UI multibahasa (ID/EN) vendor web ("Batas direset pada 14 Okt, 20.51", "until 3:00 AM", "dalam 45 menit") dan menyimpannya secara atomik ke `cooldown_state.json` via `cooldown_store.js` untuk dibagikan lintas proses (CLI & MCP). Selama `now < resetAt`, provider diskip instan (zero DOM overhead). Saat `now >= resetAt`, sistem memasuki fase `HALF_OPEN` untuk melakukan authoritative probe, otomatis menghapus status cooldown, dan merebut kembali (*reclaim*) model unggulan (Claude / Gemini 4 Argon) tanpa pernah terjebak permanen di Qwen. Dilengkapi decoupling pemeriksaan badge Flash-Lite pra-kirim pada `gemini_driver.js` sehingga switch kembali ke Argon pasca-reset kuota berjalan 100% mulus.
36. **Multi-Session Context Isolation, Dynamic Failover Attribution, & Adaptive Intent Synthesis (`session_history.js`, `prompt_synthesizer.js`, `domain_rules.json`):** Mengisolasi riwayat percakapan per-ID sesi (`--session <id>`), auto-compaction sliding window, tracking metadata sesi, serta perintah CLI manajemen sesi (`session-list`, `session-show`, `session-export`). Mengganti notice pengalihan statis Claude menjadi notice dinamis berbasis vendor asal failover. Memperluas `PromptSynthesizer` dengan ekstraksi intent tugas (`audit_review`, `refactor_optimize`, `design_architecture`, `math_derivation`, `debug_fix`, `debate_challenge`), protokol penalaran mendalam (`--reasoning deep`), kendali tone (`caveman`/`academic`/`production`), sandboxing payload tugas, dan perluasan skema domain (`cybersecurity_audit`, `cloud_devops_infra`, `ai_agent_orchestration`).

---

## 🚀 Alur Kerja & Arsitektur (v2.5.0)

```mermaid
flowchart TD
    User["Antigravity / User (/web-llm-orchestrator)"] -->|MCP stdio / CLI| Orch["Orchestrator Core"]
    
    subgraph CoreEngine ["Orchestration & Governance Engine"]
        Orch --> Lock["LockManager (PID + 3-min TTL + Fencing Token)"]
        Orch --> Privacy["Privacy Guard (Blacklist Scanner)"]
        Orch --> History["Session History (Atomic Turn State)"]
        Orch --> BrowserMgr["Browser Manager (CDP 127.0.0.1:9222)"]
        Orch --> CriticEng["CriticEngine (Domain-Agnostic Evaluator-Optimizer)"]
        CriticEng --> Contract["CritiqueContract (Schema & Evidence-Gating)"]
    end

    BrowserMgr --> ClaudeDriver["Claude Driver (Tab 1: claude.ai)<br/>Multi-Signal Quorum & ToolStep Check"]
    BrowserMgr --> GeminiDriver["Gemini Driver (Tab 2: gemini.google.com)<br/>Locked: 4 Argon + Tinggi + Percakapan/Tugas"]
    BrowserMgr --> QwenDriver["Qwen Driver (Tab 3: chat.qwen.ai)<br/>Locked: Qwen3.8-Max + Berpikir"]
    BrowserMgr --> ChatGPTDriver["ChatGPT Driver (Tab 4: chatgpt.com)<br/>Locked: Berpikir (Ctrl+Shift+M)"]

    ClaudeDriver -->|Output Generasi Turn t| Eval{"Evaluator-Optimizer<br/>Evidence-Gated Assessment"}
    GeminiDriver -->|Output Generasi Turn t| Eval
    QwenDriver -->|Output Generasi Turn t| Eval
    ChatGPTDriver -->|Output Generasi Turn t| Eval

    Eval -->|Hitung Skor Objektif| ScoreCalc["S_t = Σ w(sev) + 5 U_t + 8 L_t"]
    
    ScoreCalc -->|S_t == 0 (Konvergen)| MathNorm["Math Normalizer (Delimiter & Quarantine)"]
    ScoreCalc -->|S_t > 0 & Budget Tersedia| CounterGen["Evidence-Gated Counter-Prompt<br/>[AUDIT_REVISE] (Turn t+1)"]
    ScoreCalc -->|Plateau / Regresi S_t >= S_t-1| Rollback["Best-Known Checkpoint<br/>& Exit Loop"]
    Rollback --> MathNorm

    CounterGen -->|Debat Ulang di Tab Browser| ClaudeDriver
    CounterGen -->|Debat Ulang di Tab Browser| GeminiDriver
    CounterGen -->|Debat Ulang di Tab Browser| QwenDriver
    CounterGen -->|Debat Ulang di Tab Browser| ChatGPTDriver

    ClaudeDriver -->|Rate Limit Buntung| Recovery["Stream Recovery (sealTail + buildLedger)"]
    Recovery -->|Nonce Bounding Box Prompt| GeminiDriver
    GeminiDriver -->|Rate Limit Lanjutan| RecoveryQwen["Forward Recovery to Qwen"]
    RecoveryQwen --> QwenDriver
    QwenDriver -->|Output Lanjutan| Stitch["Stream Stitcher (Overlap & Think Trimmer)"]
    QwenDriver -->|Rate Limit Lanjutan| ForwardRec["Forward Recovery Prompt"]
    ForwardRec --> ChatGPTDriver
    ChatGPTDriver --> Stitch

    Stitch --> MathNorm
    MathNorm --> Untrusted["Wrap: &lt;web_llm_untrusted_output&gt;"]
    Untrusted --> Final["Executive Battle-Tested Blueprint"]
    Final --> User
```

---

## 💻 Panduan Penggunaan Cepat

### 1. Meluncurkan Browser Terisolasi
Jalankan skrip peluncur (hanya perlu dijalankan sekali per sesi kerja):
```cmd
.\start_browser.bat
```
*Atau via PowerShell:*
```powershell
.\start_browser.ps1
```
> Browser Chrome resmi akan terbuka dengan 4 tab: `claude.ai`, `gemini.google.com`, `chat.qwen.ai`, dan `chatgpt.com` dengan profil aman di `%USERPROFILE%\.web-llm-orchestrator\chrome-profile`. Silakan login dengan akun masing-masing.

---

### 2. Pengujian via CLI Runner

```bash
# Cek kesiapan koneksi CDP port 9222 dan tab yang terbuka (Claude, Gemini, Qwen, ChatGPT)
node src/cli.js status

# Buka jendela browser secara langsung jika belum tampil
node src/cli.js open

# Kirim prompt (Alur default failover: Claude -> Gemini 4 Argon -> Qwen -> ChatGPT)
node src/cli.js ask "Tolong evaluasi konsistensi formula ini"

# Kirim prompt + lampirkan file langsung dari disk (Bypass token Antigravity)
node src/cli.js ask --files sections/methodology.tex "Tolong cek konsistensi metodologi"

# Evaluator-Optimizer dengan Risk Tier khusus (Tier 1: 1-2 turn, Tier 2: 2-3 turn, Tier 3: 4-5 turn)
node src/cli.js ask --tier 1 "Tuliskan ringkasan arsitektur mikroservis"
node src/cli.js ask --tier 2 --files "apps/web/src/app/page.tsx" "Audit kelemahan komponen ini"

# Paksa kirim langsung ke Google Gemini 4 Argon (Mode Percakapan atau Tugas)
node src/cli.js ask --model gemini "Turunkan persamaan diferensial ini secara analitik"
node src/cli.js ask --model gemini --mode tugas "Rancang checklist migrasi arsitektur sistem"

# Paksa kirim langsung ke model tertentu lainnya (Claude / Qwen / ChatGPT)
node src/cli.js ask --model qwen "Analisis alur penalaran logika berikut"
node src/cli.js ask --model chatgpt "Berikan second-opinion ringkas"

# Bersihkan riwayat percakapan lokal & alihkan seluruh tab browser (Claude, Gemini, Qwen, ChatGPT) ke sesi obrolan baru
node src/cli.js reset
```

---

### 3. Penggunaan Langsung dari Chat Antigravity

MCP server telah terdaftar secara otomatis di `~/.gemini/config/mcp_config.json`. Anda cukup meminta Antigravity:

> *"Antigravity, tolong diskusikan dengan Claude di browser untuk meninjau formula di sections/methodology.tex."*

Antigravity akan mengeksekusi tool `ask_web_llm` dengan parameter `files: ["sections/methodology.tex"]`, membaca respons dari browser, dan memberikan ringkasan eksekutif kepada Anda.

---

## 🎛️ Registry Selector Eksternal (`selectors.json`)

Jika antarmuka web penyedia berubah, Anda cukup memperbarui konfigurasi di [selectors.json](file:///C:/dapa/Web-LLM%20Orchestrator%20-%20SKILL/selectors.json) tanpa mengubah kode:

```json
{
  "claude": {
    "url_pattern": "claude.ai",
    "home_url": "https://claude.ai/new",
    "input_selectors": ["div[contenteditable='true'].ProseMirror"],
    "rate_limit_patterns": ["message limit", "reached your limit", "resets at"]
  },
  "gemini": {
    "url_pattern": "gemini.google.com",
    "home_url": "https://gemini.google.com/app?hl=id",
    "default_model": "4 Argon",
    "default_reasoning": "Tinggi",
    "model_trigger_selector": "[data-test-id=\"bard-mode-menu-button\"] button",
    "input_selectors": [".ql-editor[role=\"textbox\"]", "rich-textarea", "div[contenteditable=\"true\"]"],
    "send_button_selectors": ["button[aria-label=\"Kirim pesan\"]", "button[aria-label*=\"Send\"]"],
    "stop_button_selectors": ["button[aria-label*=\"Hentikan respons\"]", "button[aria-label*=\"Stop\"]"],
    "rate_limit_patterns": ["batas kuota", "coba lagi nanti", "terlalu banyak permintaan", "rate limit"]
  },
  "qwen": {
    "url_pattern": "chat.qwen.ai",
    "home_url": "https://chat.qwen.ai",
    "default_model": "Qwen3.8-Max",
    "default_reasoning": "Berpikir",
    "model_trigger_selector": ".wms-trigger",
    "reasoning_trigger_selector": ".qwen-thinking-selector",
    "input_selectors": ["textarea[placeholder*='Ask']", "textarea"],
    "rate_limit_patterns": ["usage limit", "rate limit", "too many requests"]
  },
  "chatgpt": {
    "url_pattern": "chatgpt.com",
    "home_url": "https://chatgpt.com",
    "default_thinking": true,
    "input_selectors": ["#prompt-textarea", "div[contenteditable='true']"],
    "rate_limit_patterns": ["you've reached your", "limit for"]
  }
}
```

---

## 📂 Struktur Proyek

```text
Web-LLM Orchestrator - SKILL/
├── .geminirules                 # Aturan Repository Governance (Mandatory PRD & README Sync)
├── start_browser.bat            # Peluncur Chrome port 9222 (Windows CMD)
├── start_browser.ps1            # Peluncur Chrome port 9222 (PowerShell)
├── selectors.json               # Registry selector DOM & konfigurasi model/penalaran (Claude, Gemini, Qwen, ChatGPT)
├── package.json                 # Dependensi proyek (puppeteer-core) v2.5.0
├── SKILL.md                     # Skill resmi untuk Antigravity & Claude Code (v2.5.0)
├── README.md                    # Dokumentasi lengkap proyek (v2.5.0)
├── PRD.md                       # Product Requirements Document resmi (v2.5.0)
├── references/                  # Bundled skill references (progressive disclosure)
│   ├── domain_catalogs.md       # Katalog lengkap skema domain Lyra 4-D
│   ├── cli_and_mcp_reference.md # Referensi parameter CLI dan skema tool MCP
│   └── troubleshooting.md       # Panduan recovery koneksi, CDP, dan batas kuota
├── src/
│   ├── browser_manager.js       # Pengelola koneksi CDP & persistent tabs (Claude, Gemini, Qwen, ChatGPT)
│   ├── orchestrator.js          # Koordinator alur failover (Claude -> Gemini -> Qwen -> ChatGPT), stream recovery & critic loop
│   ├── critic_engine.js         # Evaluator-Optimizer Engine (Dynamic Framing, scoring deterministik & evidence-gating)
│   ├── interrogation_engine.js  # Interrogation Engine (Backward compatibility bridge to CriticEngine)
│   ├── prompt_input.js          # Shell Safety Guard & prompt file reader (anti attention dilution & escaping safe)
│   ├── parse_reset.js           # Multilingual deterministic reset timestamp parser (Gemini, Claude, ChatGPT, Qwen)
│   ├── cooldown_store.js        # Cross-process atomic cooldown lease store with file locking
│   ├── contracts/
│   │   └── critique_contract.js # Universal Critique & Framing Contract validator
│   ├── templates/
│   │   └── domain_rules.json    # Skema deklaratif multi-domain (software_engineering, cybersecurity, devops, agents, pkm_kc)
│   ├── prompt_synthesizer.js    # Lyra 4-D prompt optimizer v2.5 & adaptive intent engine
│   ├── stream_recovery.js       # Engine sealTail, buildLedger, buildPrompt nonce & stitch
│   ├── math_normalizer.js       # Parser regex delimiter LaTeX, currency guard & quarantine
│   ├── session_history.js       # Turn-by-turn buffer, multi-session isolation & dynamic Handoff Bundle
│   ├── lock_manager.js          # File mutex lock berbasis PID, UUID token, dan TTL
│   ├── cli.js                   # Terminal runner (--session, --tier, --files, --model, --tone, --reasoning)
│   ├── mcp_server.js            # Server Model Context Protocol (stdio JSON-RPC)
│   └── drivers/
│       ├── base_driver.js       # Base class + preservasi LaTeX + deteksi Auth
│       ├── claude_driver.js     # Driver Claude (Pre-Send Guard, Auto-Healing, Multi-signal quorum & ToolStep)
│       ├── gemini_driver.js     # Driver Gemini (Gemini 4 Argon, Tingkat Penalaran Tinggi, Segmented Percakapan/Tugas)
│       ├── qwen_driver.js       # Driver Qwen (Kunci Qwen3.8-Max & mode Berpikir)
│       └── chatgpt_driver.js    # Driver ChatGPT (Kunci mode Berpikir via Ctrl+Shift+M & Pre-Send Guard)
└── tests/
    ├── prompt_input.test.js       # Unit test PromptInput Shell Safety Guard (E_INLINE_UNSAFE, BOM, file reading)
    ├── session_history.test.js    # Unit test buffer giliran & handoff bundle baseline
    ├── session_history_v2.test.js # Unit test multi-session isolation, dynamic handoff notice, & auto-compact
    ├── orchestrator_files.test.js # Unit test resolusi file & privacy guard
    ├── lock_manager.test.js       # Unit test mutex cross-process & stale cleanup
    ├── offline_fixtures.test.js   # Unit test deteksi limit, auth & ekstraksi KaTeX
    ├── gemini_driver.test.js      # Unit test driver Gemini (4 Argon, mode segmented & kontrak BaseDriver)
    ├── qwen_driver.test.js        # Unit test driver & kontrak interface Qwen
    ├── chatgpt_driver.test.js     # Unit test driver ChatGPT & isolasi composer ProseMirror
    ├── claude_driver.test.js      # Unit test driver Claude (Pre-Send Guard, Auto-Healing, /caveman Skill & Error Detection)
    ├── orchestrator_recovery.test.js # Unit test integrasi stream recovery & normalizer
    ├── prompt_synthesizer.test.js # Unit test Lyra 4-D synthesizer & domain rules baseline
    ├── prompt_synthesizer_v2.test.js # Unit test intent extraction, reasoning enforcement & new domains
    ├── interrogation_engine.test.js # Unit test AMTIL dynamic loop & plateau detection
    ├── critique_contract.test.js  # Unit test schema critique contract & evidence validation
    ├── critic_engine.test.js      # Unit test scoring deterministik, dynamic framing & plateau
    ├── parse_reset.test.js        # Unit test parser timestamp reset multibahasa (ID/EN)
    ├── cooldown_store.test.js     # Unit test persistensi atomik & lock lease cooldown
    └── modules.test.js            # 24 Unit test native (sealTail, ledger, math, stitch)
```

---

## 🧪 Verifikasi & Pengujian Otomatis (19/19 Suites Passed)

Seluruh modul dilengkapi unit test mandiri tanpa bergantung pada browser hidup. Eksekusi pengujian secara menyeluruh:

```bash
npm test
```

Hasil verifikasi:
```text
✅ Unit test prompt_input.test.js: BERHASIL (100% Passed)!
✅ Unit test critique_contract.test.js: BERHASIL (100% Passed)!
✅ Unit test critic_engine.test.js: BERHASIL (100% Passed)!
✅ Unit test session_history.test.js: BERHASIL (100% Passed)!
✅ Unit test session_history_v2.test.js: BERHASIL (100% Passed)!
✅ Unit test orchestrator_files.test.js: BERHASIL (Privacy Guard 100% Passed)!
✅ Unit test lock_manager.test.js: BERHASIL (100% Passed)!
✅ Unit test offline_fixtures.test.js: BERHASIL (100% Passed)!
✅ Unit test gemini_driver.test.js: BERHASIL (100% Passed)!
✅ Unit test qwen_driver.test.js: BERHASIL (100% Passed)!
✅ Unit test chatgpt_driver.test.js: BERHASIL (100% Passed)!
✅ Unit test claude_driver.test.js: BERHASIL (100% Passed)!
✅ Unit test orchestrator_recovery.test.js: BERHASIL (100% Passed)!
✅ Unit test prompt_synthesizer.test.js: BERHASIL (100% Passed)!
✅ Unit test prompt_synthesizer_v2.test.js: BERHASIL (100% Passed)!
✅ Unit test interrogation_engine.test.js: BERHASIL (100% Passed)!
✅ Unit test parse_reset.test.js: BERHASIL (100% Passed)!
✅ Unit test cooldown_store.test.js: BERHASIL (100% Passed)!
ℹ tests 24 (modules.test.js: sealTail, ledger, prompt, stitch, math_normalizer)
ℹ pass 24 / fail 0
```

### 🎯 Hasil Pengujian Adversarial Live (Chrome Port 9222)
1. **Qwen Deep Thinking Stress Test (`test_qwen_adversarial.js`):**
   - Penurunan matriks Hessian analitik multivariat (prompt 2318 karakter, fasa berpikir 100.1 detik).
   - Ekstraksi formula KaTeX/MathML berhasil memulihkan **58 dari 58 formula** (21 inline `$..$`, 37 display `$$..$$`).
   - Restorasi DOM 100% utuh tanpa residu node teks visual. Nol kebocoran kartu status pemikiran.
2. **ChatGPT Reasoning & Shortcut Stress Test (`test_chatgpt_adversarial.js`):**
   - Shortcut `Ctrl + Shift + M` dan tombol UI "Berpikir" terverifikasi melakukan toggle state `aria-pressed` secara responsif.
   - Deteksi siklus berpikir (19.8 detik) via stop button dan thought nodes mencegah risiko *premature return* terhadap pesan turn sebelumnya.
   - Formula canonical LaTeX Dirichlet terpreservasi bersih.
3. **Concurrency LockManager & Stream Recovery (`test_concurrency_failover.js`):**
   - 2 Worker konkuren berhasil diserialisasi secara mutlak (3344 ms vs 2500 ms minimum serial), membuktikan sistem kebal terhadap *tab typing collision*.
   - `sealTail()` berhasil menutup struktur matematika gantung dan `stitch()` menyambungkan kelanjutan handoff tanpa duplikasi heading.
4. **Dual-Subagent Multi-File Injection & Universal Contract Test (`run_test_qwen_files.js` & `run_test_chatgpt_files.js`):**
   - Diuji serentak menggunakan 2 subagent mandiri dengan 2 dummy file (`dummy_math.tex` & `dummy_code.py`).
   - **Qwen:** 100% memahami kedua file, menemukan celah asumsi simetri matriks ($A = A^T$) sebelum `eigvalsh`, mematuhi format Caveman `[KODE] [AUDIT] [INTI_BENAR_TAPI_SIMETRI_TIDAK_DIVALIDASI]` secara sempurna, nol basa-basi, serta mengekstrak 27 inline dan 49 display KaTeX formula.
   - **ChatGPT:** 100% memahami kedua file dengan temuan identik, mematuhi Answer-First (`[AUDIT]`, `[ACTION]`, `[REASON]`), nol basa-basi, 11 inline formula utuh, dan formula display yang terpotong dikarantina aman via `math_normalizer.js`.
   - **Claude Parity:** Terverifikasi menggunakan alur eksekusi, injeksi kontrak, dan pembacaan berkas yang 100% identik di level orchestrator.
5. **Dual-Subagent New Session Isolation & Deep Reset (`test_qwen_new_session.js` & `test_chatgpt_new_session.js`):**
   - Diuji dengan alur: Sesi 1 (*"halo, aku budi"*) $\rightarrow$ Deep Reset $\rightarrow$ Sesi 2 (*"budi, halo aku"*).
   - **Qwen:** URL berubah dari `.../c/3897194e...` ke `https://chat.qwen.ai/` pasca-reset, lalu membentuk conversation thread baru `.../c/d6a79618...` pada sesi 2 (100% terisolasi).
   - **ChatGPT:** URL berubah dari `.../c/6acc60a7...` ke `https://chatgpt.com/` pasca-reset, lalu membentuk thread baru `.../c/6acc60b7...` pada sesi 2 (100% terisolasi).
   - **Eliminasi Context Leakage:** Sesi kedua berjalan bersih tanpa terpengaruh perkenalan identitas dari sesi pertama.
6. **Live Multi-Turn Organic Dialectic Convergence (ChatGPT 4-Turn Debate):**
   - Topik: *High-Throughput Zero-Data-Loss National Payment Gateway Event Processing* (Kafka vs Pulsar vs Redpanda).
   - Evaluasi tanpa skrip pra-rekayasa: Subagen membaca respon aktual ChatGPT dan menyanggah celah teknis spesifik.
   - ChatGPT menyerah 3 kali berturut-turut: Turn 1 (Pulsar BookKeeper) $\rightarrow$ Turn 2 (Kafka Stretch Cluster) $\rightarrow$ Turn 3 (Redpanda Stretch RF=5) $\rightarrow$ Turn 4 (Konvergensi Sempurna: Memisahkan Authoritative Multi-Region Synchronous ACID Ledger dari Local Streaming Broker Kafka RF=3 via Transactional Outbox).
7. **Qwen Deep Thinking Architecture Stress-Test & Consensus Formulation:**
   - Evaluasi komparatif arsitektur Web-LLM Orchestrator terhadap standar SOTA Agent Systems 2026.
   - Menghasilkan 4 inovasi arsitektural konsensus: Silent Web Audio Keep-Awake Injector (1 Hz), PID-Heartbeat File Mutex, Atomic JSON Write-Ahead File Swap, dan Evidence Delegation Router.
8. **Hierarchical Multi-Agent Dialectic Debate with Qwen (2-Turn Live Defense):**
   - Topik: Evaluasi pola *Subagent Debater $\to$ Web-LLM $\to$ Parent Orchestrator Reviewer*.
   - Menginterogasi 4 paradoks: Second-Hand Evaluator Blindness, Dialectical Gaslighting, Double Evaluator Echo Chamber, dan Ketiadaan Kriteria Terminasi Deterministik.
   - Menghasilkan konsensus formal 5 pilar: Toulmin Argumentation DAG Engine, Epistemic Firewall (Burden of Proof Protocol), Metrik Terminasi Semantik-Topologis $\Phi \ge 0.92$, Triangulated Pareto Oracle, serta Sliced Critical Pivots + Traceability Chain Hash (lihat [`scratch/qwen_debate_architecture_synthesis.md`](file:///C:/Users/Lenovo/.gemini/antigravity-cli/brain/26126196-ee5c-40f2-ac1f-fbc913679553/scratch/qwen_debate_architecture_synthesis.md)).
9. **Live Complex Prompt & Shell Safety Guard Verification with Qwen (v2.2.3):**
   - Uji coba live skenario review naskah segmentasi MRI 3D (3D U-Net vs Swin-UNETR, stabilitas gradien loss multi-task $\mathcal{L}_{\text{total}}$, dan reviewer IEEE TMI/MICCAI).
   - Guardrail Lapis 3 (`prompt_input.js`) memblokir string inline multi-baris berbahaya dengan `E_INLINE_UNSAFE` (exit code 2).
   - Eksekusi via `--prompt-file` di Qwen Thinking Mode selesai dengan status sukses (exit code 0): membuktikan secara analitik ledakan gradien $\mathcal{L}_{\text{HD95}}$ ($d_G(k)^2$), menganalisis vanishing gradient Dice Loss $\frac{\partial \mathcal{L}_{\text{Dice}}}{\partial p_k}$, dan membedah 3 kelemahan validitas metodologis dengan preservasi formula LaTeX 100% utuh tanpa kerusakan KaTeX.
10. **Live Stress-Testing & End-to-End Verification Google Gemini 4 Argon (v2.3.0):**
   - **Mode Percakapan (LaTeX & Code):** Penurunan analitik fungsi kuadratik multivariat $f(x)$, gradien $\nabla f(x)$, Hessian $\nabla^2 f(x)$, dan script Python scipy. Waktu berpikir 48s, streaming 34s, total 82s (6.035 karakter). 100% formula KaTeX terpreservasi via offscreen pre-wrap container.
   - **Mode Tugas (Enterprise Architecture):** Panduan migrasi CDC zero-downtime PostgreSQL ke ClickHouse. Waktu berpikir 72s, streaming 33s, total 105s (8.907 karakter). Output terstruktur utuh dengan konfigurasi Debezium JSON, DDL SQL Kafka engine, dan tabel perbandingan risiko markdown.
   - **Live CLI End-to-End Test:** Perintah `node src/cli.js ask --model gemini --no-eval "..."` sukses terkirim ke Chrome CDP port 9222 dan mengembalikan hasil terstruktur Answer-First dengan formula KaTeX canonical utuh (exit code 0).

---

## 🔒 Keamanan, Privasi & Kepatuhan ToS

* **Data Tak Tepercaya:** Teks balasan dari Web LLM selalu dibungkus tag `<web_llm_untrusted_output provider="...">`. Antigravity dilarang mengeksekusi shell berbahaya dari output web tanpa izin pengguna.
* **Isolasi Profil:** Seluruh cookie dan riwayat browser tersimpan di `%USERPROFILE%\.web-llm-orchestrator\chrome-profile\`, terisolasi dari profil harian dan aman saat folder proyek di-zip atau dibagikan.
* **Scanner Blacklist:** Mencegah pengiriman file sensitif seperti kredensial, kunci privat, atau file konfigurasi rahasia.
* **Kepatuhan Akun:** Menggunakan browser resmi pengguna untuk penggunaan harian pribadi tanpa rotasi bot atau multi-akun.
