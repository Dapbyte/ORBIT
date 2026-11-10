'use strict';

/**
 * InterrogationEngine (Legacy AMTIL Backward-Compatibility Bridge)
 * @deprecated Digantikan sepenuhnya oleh CriticEngine (Domain-Agnostic Evaluator-Optimizer Engine v2.0+).
 * Seluruh logika evaluasi dialihkan ke CriticEngine untuk menjamin zero-dead-code dan
 * eliminasi aturan bias kompetisi/hardware legacy (seperti flume-box, MPU6050, dan batas pagu).
 */

const CriticEngine = require('./critic_engine');

class InterrogationEngine extends CriticEngine {
  constructor(options = {}) {
    super(options);
  }
}

module.exports = InterrogationEngine;
