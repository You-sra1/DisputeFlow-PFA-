const { validateTransition, getAllowedTransitions, VALID_TRANSITIONS } = require('../services/disputeService');
const AppError = require('../utils/AppError');

describe('VALID_TRANSITIONS', () => {
  const expectedTransitions = {
    SOUMIS:                    ['EN_COURS_D_ANALYSE'],
    EN_COURS_D_ANALYSE:        ['EN_ATTENTE_D_INFORMATIONS', 'APPROUVE', 'REJETE'],
    EN_ATTENTE_D_INFORMATIONS: ['EN_COURS_D_ANALYSE', 'APPROUVE', 'REJETE'],
    APPROUVE:                  ['CHARGEBACK_INITIE'],
    CHARGEBACK_INITIE:         ['REPONSE_MERCHANT_REÇUE'],
    REPONSE_MERCHANT_REÇUE:    ['REMBOURSEMENT_EFFECTUE'],
    REMBOURSEMENT_EFFECTUE:    ['CLOTURE'],
    REJETE:                    ['CLOTURE'],
    CLOTURE:                   [],
  };

  it('should contain exactly the 9 expected statuses', () => {
    expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual(Object.keys(expectedTransitions).sort());
  });

  it('should match all expected transitions', () => {
    for (const [status, allowed] of Object.entries(expectedTransitions)) {
      expect(VALID_TRANSITIONS[status]).toEqual(allowed);
    }
  });

  it('should have empty array for CLOTURE (terminal status)', () => {
    expect(VALID_TRANSITIONS.CLOTURE).toEqual([]);
  });

  it('should not allow any transition from CLOTURE', () => {
    for (const status of Object.keys(VALID_TRANSITIONS)) {
      expect(VALID_TRANSITIONS.CLOTURE).not.toContain(status);
    }
  });
});

describe('validateTransition', () => {
  it('should return true for valid transitions', () => {
    expect(validateTransition('SOUMIS', 'EN_COURS_D_ANALYSE')).toBe(true);
    expect(validateTransition('EN_COURS_D_ANALYSE', 'APPROUVE')).toBe(true);
    expect(validateTransition('EN_COURS_D_ANALYSE', 'REJETE')).toBe(true);
    expect(validateTransition('EN_COURS_D_ANALYSE', 'EN_ATTENTE_D_INFORMATIONS')).toBe(true);
    expect(validateTransition('APPROUVE', 'CHARGEBACK_INITIE')).toBe(true);
    expect(validateTransition('CHARGEBACK_INITIE', 'REPONSE_MERCHANT_REÇUE')).toBe(true);
    expect(validateTransition('REPONSE_MERCHANT_REÇUE', 'REMBOURSEMENT_EFFECTUE')).toBe(true);
    expect(validateTransition('REMBOURSEMENT_EFFECTUE', 'CLOTURE')).toBe(true);
    expect(validateTransition('REJETE', 'CLOTURE')).toBe(true);
    expect(validateTransition('EN_ATTENTE_D_INFORMATIONS', 'EN_COURS_D_ANALYSE')).toBe(true);
  });

  it('should throw AppError(409, 40910) for invalid transitions', () => {
    expect(() => validateTransition('SOUMIS', 'APPROUVE')).toThrow(AppError);
    expect(() => validateTransition('SOUMIS', 'CLOTURE')).toThrow(AppError);
    expect(() => validateTransition('CLOTURE', 'SOUMIS')).toThrow(AppError);
    expect(() => validateTransition('APPROUVE', 'SOUMIS')).toThrow(AppError);
    expect(() => validateTransition('REJETE', 'APPROUVE')).toThrow(AppError);
    expect(() => validateTransition('CHARGEBACK_INITIE', 'SOUMIS')).toThrow(AppError);

    try {
      validateTransition('SOUMIS', 'APPROUVE');
    } catch (e) {
      expect(e.statusCode).toBe(409);
      expect(e.errorCode).toBe('40910');
    }
  });

  it('should throw AppError(409, 40910) for unknown status', () => {
    expect(() => validateTransition('INVALID_STATUS', 'SOUMIS')).toThrow(AppError);

    try {
      validateTransition('INVALID_STATUS', 'SOUMIS');
    } catch (e) {
      expect(e.statusCode).toBe(409);
      expect(e.errorCode).toBe('40910');
    }
  });

  it('should reject transitions from terminal status CLOTURE', () => {
    expect(() => validateTransition('CLOTURE', 'SOUMIS')).toThrow(AppError);
    expect(() => validateTransition('CLOTURE', 'APPROUVE')).toThrow(AppError);
    expect(() => validateTransition('CLOTURE', 'CLOTURE')).toThrow(AppError);
  });

  it('should reject skipping steps (e.g. SOUMIS → APPROUVE)', () => {
    expect(() => validateTransition('SOUMIS', 'APPROUVE')).toThrow(AppError);
    expect(() => validateTransition('SOUMIS', 'CHARGEBACK_INITIE')).toThrow(AppError);
    expect(() => validateTransition('APPROUVE', 'REMBOURSEMENT_EFFECTUE')).toThrow(AppError);
    expect(() => validateTransition('CHARGEBACK_INITIE', 'REMBOURSEMENT_EFFECTUE')).toThrow(AppError);
  });
});

describe('getAllowedTransitions', () => {
  it('should return allowed next statuses for each status', () => {
    expect(getAllowedTransitions('SOUMIS')).toEqual(['EN_COURS_D_ANALYSE']);
    expect(getAllowedTransitions('EN_COURS_D_ANALYSE')).toEqual(['EN_ATTENTE_D_INFORMATIONS', 'APPROUVE', 'REJETE']);
    expect(getAllowedTransitions('APPROUVE')).toEqual(['CHARGEBACK_INITIE']);
    expect(getAllowedTransitions('CHARGEBACK_INITIE')).toEqual(['REPONSE_MERCHANT_REÇUE']);
    expect(getAllowedTransitions('REPONSE_MERCHANT_REÇUE')).toEqual(['REMBOURSEMENT_EFFECTUE']);
    expect(getAllowedTransitions('CLOTURE')).toEqual([]);
  });

  it('should return empty array for unknown status', () => {
    expect(getAllowedTransitions('INVALID')).toEqual([]);
  });

  it('should return a copy (not mutate original)', () => {
    const result = getAllowedTransitions('EN_COURS_D_ANALYSE');
    result.push('INVALID');
    expect(getAllowedTransitions('EN_COURS_D_ANALYSE')).not.toContain('INVALID');
  });
});
