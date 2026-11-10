# 📋 SOP: Domain-Agnostic Evaluator-Optimizer Engine (v2.2.2)
**Web-LLM Orchestrator Protocol — v2.2 Standard Operating Procedure**

---

## 1. 📌 Latar Belakang & Filosofi "Dua Peran Orkestrator"

Dalam arsitektur agentic pairing, pengguna menugaskan Orchestrator bukan sekadar sebagai kurir pemindah teks (*passive transport layer*), melainkan sebagai **Autonomous Co-Engineer & Devil's Advocate**.

Orchestrator mengemban **2 Pekerjaan Wajib (Dual Mandatory Jobs)**:
1. **Job 1 (Prompting & Dynamic Framing):** Merumuskan prompt awal terstruktur, menurunkan kriteria evaluasi dasar ($U_1, U_2, U_3$) secara kontekstual, dan mengoptimalkan batasan via skema deklaratif data-driven.
2. **Job 2 (Auditing, Evidence-Gated Critiquing & Hardening):** Membedah hasil generasi LLM secara kritis, memverifikasi kepatuhan terhadap kontrak framing, dan **mendebat kembali model web di browser tab yang sama** menggunakan sanggahan berbasis bukti konkret sebelum artefak diserahkan kepada pengguna.

> **Golden Rule:** *Zero Raw Ideas Dumped to User. Pengguna hanya menerima produk akhir yang matang, realistis, dan battle-tested. Jangan pernah melempar ide mentah beserta keluhannya ke pengguna jika Orchestrator masih bisa mendebat dan menyelesaikannya bersama LLM web.*

---

## 2. 🔍 Fase 1: Universal Dynamic Framing & Baseline Criteria

Saat prompt awal pengguna diterima, Orchestrator menurunkan **Dynamic Baseline Framing** tanpa bergantung pada kamus domain statis atau regex semantik:

### Kriteria Framing Universal ($U_1, U_2, U_3$):
- **$U_1$: Kebenaran Fungsional & Logika Inti (Functional Core):** Apakah algoritma, arsitektur kode, derivasi formula matematika, atau solusi teknis memenuhi tujuan utama yang diminta pengguna secara konkret dan dapat dieksekusi?
- **$U_2$: Batasan & Integritas Kontrak (Integrity & Constraints):** Apakah solusi mematuhi batasan modular, tipe/DTO kontrak, tipe pengembalian, runtime compatibility, sanitasi data, dan penanganan error?
- **$U_3$: Kasus Ekstrem & Ketahanan (Edge Cases & Resilience):** Apakah solusi memperhitungkan kondisi batas (boundary conditions), non-blocking lifecycle, degradasi anggun, dan mitigasi anti-pola arsitektural?

---

## 3. ⚔️ Fase 2: Evidence-Gated Verbal Critique Protocol

Ketika respon Turn $t$ diterima dari peramban web (Claude / Qwen / ChatGPT), Orchestrator mengevaluasi respon terhadap framing $U_1, U_2, U_3$.

### Aturan Protokol Berbasis Bukti (Anti-Halusinasi Evaluator):
1. **Evidence Anchor Mandat:** Setiap temuan celah (`flaw`) **WAJIB** menyertakan bukti konkret:
   - `tool`: Hasil verifikasi alat lokal (compiler, typecheck, linter, test runner).
   - `quote`: Kutipan kalimat/kode verbatim dari respon model web.
   - `reasoning`: Penurunan logika deduktif formal jika verifier lokal tidak tersedia.
2. **Penolakan Sanggahan di Luar Framing:** Kritik yang merujuk kriteria fiktif di luar konteks (misal: menuntut meja uji simulator hardware pada proyek web coding) **DITOLAK SECARA OTOMATIS** oleh validator kontrak.
3. **Deteksi Blocker Transparan:** Jika model web membutuhkan berkas kode sumber lokal yang belum disertakan, loop dihentikan rapi dengan status `BLOCKED` untuk meminta berkas ke pengguna secara transparan alih-alih berhalusinasi.

### Template Universal Counter-Prompt Turn $t+1$:

```markdown
[ATURAN KELUARAN — ENGINEERING CAVEMAN AUDIT_REVISE]
[THING] [AUDIT_REVISE] [ELIMINATE VERIFIED FLAWS]

Sebagai Lead Technical Reviewer, hasil evaluasi terhadap kriteria dasar mengidentifikasi celah konkret berikut yang WAJIB diperbaiki:

1. [CRITICAL_FLAW]: <Kutipan verbatim / bukti celah fungsional pada U1>.
2. [MAJOR_FLAW]: <Celah kontrak, penanganan error, atau integrasi modular pada U2>.
3. [EDGE_CASE]: <Kelemahan pada kasus ekstrem atau skalabilitas pada U3>.

INSTRUKSI REVISI WAJIB (NON-NEGOTIABLE):
- Perbaiki seluruh celah terverifikasi di atas secara konkret tanpa placeholder (// TODO).
- Terapkan pemisahan lapisan arsitektur modular dan kontrak data yang eksplisit.
- Jawab LANGSUNG artefak kode/arsitektur revisi lengkap tanpa kalimat basa-basi permohonan maaf.
```

---

## 4. 🏁 Fase 3: Kriteria Konvergensi & Skor Deterministik ($S_t$)

### 4.1 Scoring Konvergensi Deterministik ($S_t$)
Orchestrator mengukur kesiapan teknis secara kuantitatif, bukan dari basa-basi verbal LLM (*anti-sycophancy*):

$$S_t = \sum_{f \in O_t} w(\text{sev}_f) + 5 U_t + 8 L_t$$

- $w(\text{CRITICAL}) = 10, w(\text{MAJOR}) = 5, w(\text{MINOR}) = 2$
- $U_t$: Jumlah kriteria framing yang belum terpenuhi.
- $L_t$: Bobot penalti celah laten.

### 4.2 Kriteria Penghentian (Exit Conditions)
1. **Konvergensi Penuh ($S_t = 0$):** Seluruh kriteria framing terpenuhi dan tidak ada celah tersisa $\rightarrow$ **STATUS: CONVERGED**.
2. **Deteksi Plateau / Regresi ($S_t \ge S_{t-1}$):** Jika perbaikan jalan di tempat atau memicu regresi celah baru $\rightarrow$ Hentikan loop dan lakukan rollback ke checkpoint terbaik.
3. **Batas Budget Putaran Berjenjang (`--tier 1|2|3`):**
   - **Tier 1 (Daily / General):** Budget 1-2 turn.
   - **Tier 2 (Core Architecture / Refactor):** Budget 2-3 turn.
   - **Tier 3 (Mission-Critical Audit):** Budget 4-5 turn.

---

## 5. 📑 Format Hasil Akhir (Executive Battle-Tested Blueprint)

Setelah loop konvergen, Orchestrator menyajikan artefak final matang bertajuk **Executive Battle-Tested Blueprint**:
1. 🏗️ **Arsitektur & Diagnosis Akar Masalah:** Gambaran menyeluruh sistem dan trade-off rekayasa.
2. 💻 **Artefak Kode / Spesifikasi Tervalidasi:** Kode lengkap siap eksekusi (*Zero Placeholder*) atau derivasi matematika formal canonical LaTeX ($ / $$).
3. 🛡️ **Penanganan Error & Skalabilitas:** Penanganan kasus batas (*boundary conditions*), konkurensi, dan validasi data.
4. 📊 **Log Evaluasi & Konvergensi:** Ringkasan putaran perdebatan, metrik penurunan skor $S_t$, dan bukti konvergensi akhir.
