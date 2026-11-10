'use strict';

/**
 * Universal Critique Contract (v1.0)
 * Mengadaptasi:
 * - Huang et al. 2023 ("LLMs Cannot Self-Correct Reasoning Yet")
 * - Du et al. 2023 ("Multi-Agent Debate")
 * - Madaan et al. 2023 ("Self-Refine")
 * - Shinn et al. 2023 ("Reflexion")
 * - Anthropic Research ("Building Effective Agents" - Evaluator-Optimizer)
 */

const SCHEMA_VERSION = '1.0';
const VERDICTS = Object.freeze(['PASS', 'REVISE', 'BLOCKED']);
const SEVERITIES = Object.freeze(['blocker', 'major', 'minor']);
const CRITERION_STATUS = Object.freeze(['met', 'unmet', 'unverifiable']);
const FINDING_STATUS = Object.freeze(['new', 'persisting', 'resolved', 'regressed']);
const EVIDENCE_KINDS = Object.freeze(['tool', 'quote', 'reasoning']);
const VERIFIER_KINDS = Object.freeze(['executable', 'inspectable', 'judgment']);
const BLOCK_NEEDS = Object.freeze(['human', 'tool', 'data']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validasi Framing Object (Kriteria awal yang ditetapkan untuk tugas)
 * @param {unknown} raw
 * @returns {{ok: boolean, errors: string[], framing: object|null}}
 */
function validateFraming(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['framing must be an object'], framing: null };
  }
  const errors = [];
  if (!isNonEmptyString(raw.task_summary)) errors.push('task_summary required');
  if (![1, 2, 3].includes(raw.risk_tier)) errors.push('risk_tier must be 1, 2 or 3');
  
  if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) {
    errors.push('criteria must be a non-empty array');
  } else {
    const ids = new Set();
    raw.criteria.forEach((c, i) => {
      const p = `criteria[${i}]`;
      if (!isPlainObject(c)) {
        errors.push(`${p} must be an object`);
        return;
      }
      if (!isNonEmptyString(c.id)) errors.push(`${p}.id required`);
      else if (ids.has(c.id)) errors.push(`${p}.id duplicate: ${c.id}`);
      else ids.add(c.id);
      
      if (!isNonEmptyString(c.statement)) errors.push(`${p}.statement required`);
      if (typeof c.required !== 'boolean') errors.push(`${p}.required must be boolean`);
      if (!isPlainObject(c.verifier) || !VERIFIER_KINDS.includes(c.verifier.kind)) {
        errors.push(`${p}.verifier.kind must be one of ${VERIFIER_KINDS.join('|')}`);
      } else if (c.verifier.kind === 'executable' && !isNonEmptyString(c.verifier.command_id)) {
        errors.push(`${p}.verifier.command_id required for executable`);
      }
    });
  }

  return { ok: errors.length === 0, errors, framing: errors.length === 0 ? raw : null };
}

/**
 * Validasi Critique Object (Hasil tinjauan bukti dari LLM Critic)
 * @param {unknown} raw
 * @param {object} framing
 * @param {Array<object>} priorFindings
 * @returns {{ok: boolean, errors: string[], critique: object|null}}
 */
function validateCritique(raw, framing, priorFindings = []) {
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['critique must be an object'], critique: null };
  }
  const errors = [];
  const criterionIds = new Set((framing.criteria || []).map((c) => c.id));
  const prior = new Map((priorFindings || []).map((f) => [f.id, f]));

  if (raw.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be "${SCHEMA_VERSION}"`);
  if (!VERDICTS.includes(raw.verdict)) errors.push(`verdict must be one of ${VERDICTS.join('|')}`);

  if (!Array.isArray(raw.criteria_results)) {
    errors.push('criteria_results must be an array');
  } else {
    const seen = new Set();
    raw.criteria_results.forEach((r, i) => {
      const p = `criteria_results[${i}]`;
      if (!isPlainObject(r)) {
        errors.push(`${p} must be an object`);
        return;
      }
      if (!criterionIds.has(r.criterion_id)) {
        errors.push(`${p}.criterion_id unknown: ${r.criterion_id}`);
      } else {
        seen.add(r.criterion_id);
      }
      if (!CRITERION_STATUS.includes(r.status)) errors.push(`${p}.status invalid`);
      if (!isNonEmptyString(r.evidence)) errors.push(`${p}.evidence required`);
      if (!EVIDENCE_KINDS.includes(r.evidence_kind)) errors.push(`${p}.evidence_kind invalid`);
    });
    for (const id of criterionIds) {
      if (!seen.has(id)) errors.push(`criteria_results missing criterion ${id}`);
    }
  }

  if (!Array.isArray(raw.findings)) {
    errors.push('findings must be an array');
  } else {
    const seenIds = new Set();
    const addressed = new Set();
    raw.findings.forEach((f, i) => {
      const p = `findings[${i}]`;
      if (!isPlainObject(f)) {
        errors.push(`${p} must be an object`);
        return;
      }
      if (!isNonEmptyString(f.id)) errors.push(`${p}.id required`);
      else if (seenIds.has(f.id)) errors.push(`${p}.id duplicate: ${f.id}`);
      else seenIds.add(f.id);

      if (!SEVERITIES.includes(f.severity)) errors.push(`${p}.severity invalid`);
      if (!FINDING_STATUS.includes(f.status)) errors.push(`${p}.status invalid`);
      if (f.criterion_id !== null && !criterionIds.has(f.criterion_id)) {
        errors.push(`${p}.criterion_id out of framing: ${f.criterion_id}`);
      }
      if (f.criterion_id === null && f.severity !== 'minor') {
        errors.push(`${p} out-of-scope finding (criterion_id null) must be minor`);
      }

      if (!isNonEmptyString(f.claim)) errors.push(`${p}.claim required`);
      if (!isNonEmptyString(f.evidence)) errors.push(`${p}.evidence required (evidence-gated critique)`);
      if (!EVIDENCE_KINDS.includes(f.evidence_kind)) errors.push(`${p}.evidence_kind invalid`);
      if (f.status !== 'resolved' && !isNonEmptyString(f.counter_action)) {
        errors.push(`${p}.counter_action required unless resolved`);
      }
      if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) {
        errors.push(`${p}.confidence must be a number in [0,1]`);
      }
      if (f.status === 'new' && prior.has(f.id)) {
        errors.push(`${p}.id collides with prior finding: ${f.id}`);
      }
      if (f.status !== 'new') {
        if (prior.has(f.id)) addressed.add(f.id);
        else errors.push(`${p}.status "${f.status}" but id not in prior findings: ${f.id}`);
      }
    });

    for (const id of prior.keys()) {
      if (!addressed.has(id)) errors.push(`prior finding not addressed: ${id}`);
    }
  }

  if (raw.blocked !== null && raw.blocked !== undefined) {
    if (!isPlainObject(raw.blocked) || !isNonEmptyString(raw.blocked.missing) || !BLOCK_NEEDS.includes(raw.blocked.needs)) {
      errors.push('blocked must be null or {missing:string, needs:human|tool|data}');
    }
  }

  if (raw.unverified_assumptions !== undefined && !Array.isArray(raw.unverified_assumptions)) {
    errors.push('unverified_assumptions must be an array if provided');
  }

  return { ok: errors.length === 0, errors, critique: errors.length === 0 ? raw : null };
}

module.exports = {
  SCHEMA_VERSION,
  VERDICTS,
  SEVERITIES,
  CRITERION_STATUS,
  FINDING_STATUS,
  EVIDENCE_KINDS,
  VERIFIER_KINDS,
  BLOCK_NEEDS,
  validateFraming,
  validateCritique
};
