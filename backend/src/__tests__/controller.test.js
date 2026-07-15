jest.mock('../models/disputeModel', () => ({}));
jest.mock('../models/transactionModel', () => ({}));
jest.mock('../config/database', () => {});

const disputeService = require('../services/disputeService');
const AppError = require('../utils/AppError');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    query: {},
    user: { id: 'CLIENT001', role: 'CLIENT' },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('createDispute (controller)', () => {
  const { createDispute } = require('../controllers/disputeController');

  it('should return 201 on valid input', async () => {
    disputeService.findTransactionById = jest.fn().mockResolvedValue({ id: 'TXN001', client_id: 'CLIENT001' });
    disputeService.findActiveDisputeByTransactionId = jest.fn().mockResolvedValue(undefined);
    disputeService.createDispute = jest.fn().mockResolvedValue({
      dispute_id: 'DSP001', transaction_id: 'TXN001', status: 'SOUMIS', created_at: '2026-01-01',
    });

    const req = mockReq({
      body: {
        requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'CLIENT001' },
        transactionId: 'TXN001', reason: 'FRAUD', description: 'test', claimAmount: 100, currency: 'USD',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    await createDispute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with 40001 for missing requestInfo', async () => {
    const req = mockReq({
      body: { transactionId: 'TXN001', reason: 'FRAUD', description: 'test', claimAmount: 100, currency: 'USD' },
    });
    const res = mockRes();
    const next = jest.fn();

    await createDispute(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40001' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next with 40011 for invalid reason', async () => {
    const req = mockReq({
      body: {
        requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'CLIENT001' },
        transactionId: 'TXN001', reason: 'INVALID_REASON', description: 'test', claimAmount: 100, currency: 'USD',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    await createDispute(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40011' }));
  });

  it('should call next with 40013 for invalid claimAmount', async () => {
    const req = mockReq({
      body: {
        requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'CLIENT001' },
        transactionId: 'TXN001', reason: 'FRAUD', description: 'test', claimAmount: -50, currency: 'USD',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    await createDispute(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40013' }));
  });

  it('should call next with 40401 for missing transaction', async () => {
    disputeService.findTransactionById = jest.fn().mockResolvedValue(undefined);

    const req = mockReq({
      body: {
        requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'CLIENT001' },
        transactionId: 'TXN999', reason: 'FRAUD', description: 'test', claimAmount: 100, currency: 'USD',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    await createDispute(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, errorCode: '40401' }));
  });

  it('should call next with 40901 for duplicate active dispute', async () => {
    disputeService.findTransactionById = jest.fn().mockResolvedValue({ id: 'TXN001', client_id: 'CLIENT001' });
    disputeService.findActiveDisputeByTransactionId = jest.fn().mockResolvedValue({ id: 'DSP001', status: 'SOUMIS' });

    const req = mockReq({
      body: {
        requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'CLIENT001' },
        transactionId: 'TXN001', reason: 'FRAUD', description: 'test', claimAmount: 100, currency: 'USD',
      },
    });
    const res = mockRes();
    const next = jest.fn();

    await createDispute(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, errorCode: '40901' }));
  });
});

describe('review (operatorController)', () => {
  const { review } = require('../controllers/operatorController');

  it('should return 200 on valid review', async () => {
    disputeService.reviewDispute = jest.fn().mockResolvedValue({
      dispute_id: 'DSP001', status: 'EN_COURS_D_ANALYSE', reviewed_by: 'OPERATOR001', review_date: '2026-01-01',
    });

    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, comment: 'Taking in charge' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await review(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with 40031 for missing comment', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' } },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await review(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40031' }));
  });

  it('should call next with 40001 for missing requestInfo', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { comment: 'test' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await review(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40001' }));
  });
});

describe('reject (operatorController)', () => {
  const { reject } = require('../controllers/operatorController');

  it('should return 200 on valid reject', async () => {
    disputeService.rejectDispute = jest.fn().mockResolvedValue({
      dispute_id: 'DSP001', status: 'REJETE', reason: 'Invalid',
    });

    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, reason: 'Invalid' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await reject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should call next with 40032 for missing reason', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' } },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await reject(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40032' }));
  });
});

describe('chargeback (operatorController)', () => {
  const { chargeback } = require('../controllers/operatorController');

  it('should return 200 on valid chargeback', async () => {
    disputeService.chargebackDispute = jest.fn().mockResolvedValue({
      dispute_id: 'DSP001', status: 'CHARGEBACK_INITIE', chargeback_reference: 'CB202600001',
    });

    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, chargebackReasonCode: '4837', network: 'Visa' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await chargeback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should call next with 40040 for missing chargebackReasonCode', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, network: 'Visa' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await chargeback(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40040' }));
  });
});

describe('refund (operatorController)', () => {
  const { refund } = require('../controllers/operatorController');

  it('should return 200 on valid refund', async () => {
    disputeService.refundDispute = jest.fn().mockResolvedValue({
      dispute_id: 'DSP001', status: 'REMBOURSEMENT_EFFECTUE', refund_amount: 100, currency: 'USD',
    });

    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, refundAmount: 100, currency: 'USD', refundMethod: 'CARD_CREDIT' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await refund(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should call next with 40050 for invalid refundAmount', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, refundAmount: -50, currency: 'USD', refundMethod: 'CARD_CREDIT' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await refund(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40050' }));
  });

  it('should call next with 40053 for invalid refundMethod', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, refundAmount: 100, currency: 'USD', refundMethod: 'CHECK' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await refund(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40053' }));
  });
});

describe('close (operatorController)', () => {
  const { close } = require('../controllers/operatorController');

  it('should return 200 on valid close', async () => {
    disputeService.closeDispute = jest.fn().mockResolvedValue({
      dispute_id: 'DSP001', status: 'CLOTURE', closed_date: '2026-01-01',
    });

    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, closureReason: 'CASE_RESOLVED', comment: 'Done' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await close(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should call next with 40060 for invalid closureReason', async () => {
    const req = mockReq({
      params: { id: 'DSP001' },
      body: { requestInfo: { requestUID: 'R1', requestDate: '2026-01-01', userID: 'OPERATOR001' }, closureReason: 'BAD', comment: 'Done' },
      user: { id: 'OPERATOR001', role: 'OPERATOR' },
    });
    const res = mockRes();
    const next = jest.fn();

    await close(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40060' }));
  });
});

describe('getDisputes (controller)', () => {
  const { getDisputes } = require('../controllers/disputeController');

  it('should return 200 with disputes', async () => {
    disputeService.getDisputes = jest.fn().mockResolvedValue([{ id: 'DSP001' }]);

    const req = mockReq({ query: { status: 'ALL' } });
    const res = mockRes();
    const next = jest.fn();

    await getDisputes(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should call next with 40020 for invalid status', async () => {
    const req = mockReq({ query: { status: 'BAD_STATUS' } });
    const res = mockRes();
    const next = jest.fn();

    await getDisputes(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40020' }));
  });

  it('should call next with 40003 for invalid date format', async () => {
    const req = mockReq({ query: { startDate: 'not-a-date' } });
    const res = mockRes();
    const next = jest.fn();

    await getDisputes(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, errorCode: '40003' }));
  });
});
