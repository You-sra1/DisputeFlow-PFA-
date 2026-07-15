jest.mock('../config/database', () => {});

jest.mock('../models/disputeModel', () => ({
  generateDisputeId: jest.fn(),
  findTransactionById: jest.fn(),
  findActiveDisputeByTransactionId: jest.fn(),
  findDisputeById: jest.fn(),
  createDisputeRow: jest.fn(),
  updateDisputeStatus: jest.fn(),
  createDisputeHistoryRow: jest.fn(),
  createDisputeCommentRow: jest.fn(),
  getDisputesByFilter: jest.fn(),
  getDisputeHistory: jest.fn(),
  getDisputeComments: jest.fn(),
  getDisputeDocuments: jest.fn(),
  getDocumentContent: jest.fn(),
  createDocumentRow: jest.fn(),
  generateChargebackReference: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
}));

const disputeModel = require('../models/disputeModel');
const disputeService = require('../services/disputeService');
const AppError = require('../utils/AppError');

beforeEach(() => {
  jest.clearAllMocks();
  disputeModel.beginTransaction.mockResolvedValue();
  disputeModel.commit.mockResolvedValue();
  disputeModel.rollback.mockResolvedValue();
});

describe('createDispute', () => {
  it('should create a dispute and return result', async () => {
    disputeModel.generateDisputeId.mockResolvedValue('DSP001');
    disputeModel.createDisputeRow.mockResolvedValue({});
    disputeModel.createDisputeHistoryRow.mockResolvedValue({});
    disputeModel.createDisputeCommentRow.mockResolvedValue({});

    const result = await disputeService.createDispute({
      transactionId: 'TXN001',
      reason: 'FRAUD',
      description: 'Unauthorized charge',
      claimAmount: 100,
      currency: 'USD',
      userId: 'CLIENT001',
    });

    expect(result.dispute_id).toBe('DSP001');
    expect(result.transaction_id).toBe('TXN001');
    expect(result.status).toBe('SOUMIS');
    expect(disputeModel.createDisputeRow).toHaveBeenCalledWith(
      'DSP001', 'TXN001', 'CLIENT001', 'FRAUD', 'Unauthorized charge', 100, 'USD'
    );
    expect(disputeModel.beginTransaction).toHaveBeenCalled();
    expect(disputeModel.commit).toHaveBeenCalled();
  });

  it('should rollback on error', async () => {
    disputeModel.generateDisputeId.mockResolvedValue('DSP002');
    disputeModel.createDisputeRow.mockRejectedValue(new Error('DB error'));

    await expect(disputeService.createDispute({
      transactionId: 'TXN001', reason: 'FRAUD', description: 'test',
      claimAmount: 50, currency: 'USD', userId: 'CLIENT001',
    })).rejects.toThrow(AppError);

    expect(disputeModel.rollback).toHaveBeenCalled();
    expect(disputeModel.commit).not.toHaveBeenCalled();
  });
});

describe('reviewDispute', () => {
  it('should transition SOUMIS → EN_COURS_D_ANALYSE', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'SOUMIS', amount: 100, currency: 'USD' });
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.reviewDispute('DSP001', 'OPERATOR001', 'Taking in charge');

    expect(result.status).toBe('EN_COURS_D_ANALYSE');
    expect(result.reviewed_by).toBe('OPERATOR001');
    expect(disputeModel.updateDisputeStatus).toHaveBeenCalledWith('DSP001', 'EN_COURS_D_ANALYSE', expect.any(String));
  });

  it('should throw 404 if dispute not found', async () => {
    disputeModel.findDisputeById.mockResolvedValue(undefined);

    await expect(disputeService.reviewDispute('INVALID', 'OPERATOR001', 'comment'))
      .rejects.toMatchObject({ statusCode: 404, errorCode: '40402' });
  });

  it('should throw 409 if transition is invalid', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'APPROUVE', amount: 100, currency: 'USD' });

    await expect(disputeService.reviewDispute('DSP001', 'OPERATOR001', 'comment'))
      .rejects.toMatchObject({ statusCode: 409, errorCode: '40910' });
  });
});

describe('approveDispute', () => {
  it('should transition EN_COURS_D_ANALYSE → APPROUVE', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'EN_COURS_D_ANALYSE', amount: 100, currency: 'USD' });
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.approveDispute('DSP001', 'OPERATOR001', 'Approved');

    expect(result.status).toBe('APPROUVE');
    expect(result.approved_by).toBe('OPERATOR001');
  });

  it('should throw 409 if dispute is SOUMIS', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'SOUMIS', amount: 100, currency: 'USD' });

    await expect(disputeService.approveDispute('DSP001', 'OPERATOR001', 'comment'))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('rejectDispute', () => {
  it('should transition EN_COURS_D_ANALYSE → REJETE', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'EN_COURS_D_ANALYSE', amount: 100, currency: 'USD' });
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.rejectDispute('DSP001', 'OPERATOR001', 'Invalid claim', '');

    expect(result.status).toBe('REJETE');
    expect(result.reason).toBe('Invalid claim');
  });
});

describe('chargebackDispute', () => {
  it('should transition APPROUVE → CHARGEBACK_INITIE with valid network', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'APPROUVE', amount: 100, currency: 'USD' });
    disputeModel.generateChargebackReference.mockResolvedValue('CB202600001');
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.chargebackDispute('DSP001', 'OPERATOR001', '4837', 'Visa', 'Initiating');

    expect(result.status).toBe('CHARGEBACK_INITIE');
    expect(result.chargeback_reference).toBe('CB202600001');
  });

  it('should throw 400 for invalid network', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'APPROUVE', amount: 100, currency: 'USD' });

    await expect(disputeService.chargebackDispute('DSP001', 'OPERATOR001', '4837', 'Amex', 'comment'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: '40041' });
  });
});

describe('refundDispute', () => {
  it('should transition CHARGEBACK_INITIE → REMBOURSEMENT_EFFECTUE', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'CHARGEBACK_INITIE', amount: 100, currency: 'USD' });
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.refundDispute('DSP001', 'OPERATOR001', 50, 'USD', 'CARD_CREDIT');

    expect(result.status).toBe('REMBOURSEMENT_EFFECTUE');
    expect(result.refund_amount).toBe(50);
  });

  it('should throw 400 if refundAmount exceeds claim amount', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'CHARGEBACK_INITIE', amount: 100, currency: 'USD' });

    await expect(disputeService.refundDispute('DSP001', 'OPERATOR001', 200, 'USD', 'CARD_CREDIT'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: '40051' });
  });

  it('should throw 400 for invalid refundMethod', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'CHARGEBACK_INITIE', amount: 100, currency: 'USD' });

    await expect(disputeService.refundDispute('DSP001', 'OPERATOR001', 50, 'USD', 'CHECK'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: '40053' });
  });

  it('should throw 400 if currency mismatches', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'CHARGEBACK_INITIE', amount: 100, currency: 'USD' });

    await expect(disputeService.refundDispute('DSP001', 'OPERATOR001', 50, 'EUR', 'CARD_CREDIT'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: '40052' });
  });
});

describe('closeDispute', () => {
  it('should transition REJETE → CLOTURE', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'REJETE', amount: 100, currency: 'USD' });
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.closeDispute('DSP001', 'OPERATOR001', 'CASE_RESOLVED', 'Done');

    expect(result.status).toBe('CLOTURE');
    expect(result.closed_date).toBeDefined();
  });

  it('should throw 409 if trying to close from SOUMIS', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'SOUMIS', amount: 100, currency: 'USD' });

    await expect(disputeService.closeDispute('DSP001', 'OPERATOR001', 'CASE_RESOLVED', 'Done'))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('respondToInfoRequest', () => {
  it('should transition EN_ATTENTE_D_INFORMATIONS → EN_COURS_D_ANALYSE', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'EN_ATTENTE_D_INFORMATIONS', amount: 100, currency: 'USD' });
    disputeModel.updateDisputeStatus.mockResolvedValue({});

    const result = await disputeService.respondToInfoRequest('DSP001', 'CLIENT001', 'Here is the receipt');

    expect(result.status).toBe('EN_COURS_D_ANALYSE');
  });

  it('should throw 409 if dispute is not EN_ATTENTE_D_INFORMATIONS', async () => {
    disputeModel.findDisputeById.mockResolvedValue({ id: 'DSP001', status: 'SOUMIS', amount: 100, currency: 'USD' });

    await expect(disputeService.respondToInfoRequest('DSP001', 'CLIENT001', 'comment'))
      .rejects.toMatchObject({ statusCode: 409, errorCode: '40908' });
  });
});

describe('getDisputes', () => {
  it('should delegate to model getDisputesByFilter', async () => {
    const mockDisputes = [{ id: 'DSP001', status: 'SOUMIS' }];
    disputeModel.getDisputesByFilter.mockResolvedValue(mockDisputes);

    const result = await disputeService.getDisputes({
      role: 'CLIENT', userId: 'CLIENT001', status: 'ALL', startDate: null, endDate: null,
    });

    expect(result).toEqual(mockDisputes);
    expect(disputeModel.getDisputesByFilter).toHaveBeenCalledWith({
      role: 'CLIENT', userId: 'CLIENT001', status: 'ALL', startDate: null, endDate: null,
    });
  });
});
