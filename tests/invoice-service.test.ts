import assert from 'node:assert/strict';
import test from 'node:test';

import { InvoiceService } from '../services/invoice-service';
import { MidtransStrategy } from '../services/vendor/payment/midtrans-strategy';

process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.PAYPAL_CLIENT_ID = 'test_id';
process.env.PAYPAL_CLIENT_SECRET = 'test_secret';
process.env.XENDIT_SECRET_KEY = 'xendit_test';
process.env.MIDTRANS_SERVER_KEY = 'server-key';
process.env.MIDTRANS_CLIENT_KEY = 'client-key';

test('getStrategyByPaymentMethod resolves STRIPE', () => {
  const s = InvoiceService.getStrategyByPaymentMethod('STRIPE');
  assert.equal(s.constructor.name, 'StripeStrategy');
});

test('getStrategyByPaymentMethod resolves MIDTRANS', () => {
  const s = InvoiceService.getStrategyByPaymentMethod('MIDTRANS');
  assert.equal(s.constructor.name, 'MidtransStrategy');
});

test('getStrategyByPaymentMethod resolves PAYPAL', () => {
  const s = InvoiceService.getStrategyByPaymentMethod('PAYPAL');
  assert.equal(s.constructor.name, 'PaypalStrategy');
});

test('getStrategyByPaymentMethod resolves XENDIT', () => {
  const s = InvoiceService.getStrategyByPaymentMethod('XENDIT');
  assert.equal(s.constructor.name, 'XenditStrategy');
});

test('getStrategyByPaymentMethod throws on unknown method', () => {
  try {
    InvoiceService.getStrategyByPaymentMethod('CASHAPP');
    assert.fail('Should throw');
  } catch (error) {
    assert.match((error as Error).message, /unsupported/i);
  }
});

test('getStrategyForInvoice falls back to default payment method', () => {
  const service = new InvoiceService('STRIPE');
  const s = service.getStrategyForInvoice({} as any);
  assert.equal(s.constructor.name, 'StripeStrategy');
});

test('chargeInvoice returns failure on missing id', async () => {
  const service = new InvoiceService();
  const result = await service.chargeInvoice({} as any);
  assert.equal(result.success, false);
  assert.match(result.errorMessage!, /Invoice ID is required/i);
});

test('MidtransStrategy isProduction flag respects string "true"', () => {
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  const s = new MidtransStrategy();
  assert.equal((s as any).snapClient.apiConfig.isProduction, false);

  process.env.MIDTRANS_IS_PRODUCTION = 'true';
  const s2 = new MidtransStrategy();
  assert.equal((s2 as any).snapClient.apiConfig.isProduction, true);

  delete process.env.MIDTRANS_IS_PRODUCTION;
});

test('MidtransStrategy uses deterministic order id and forwards destination', async () => {
  const strategy = new MidtransStrategy();
  let captured: any;
  (strategy as any).snapClient.createTransaction = async (p: any) => {
    captured = p;
    return { token: 'tok', redirect_url: 'https://example.com/r' };
  };

  await strategy.chargeInvoice({
    id: '11111111-1111-1111-1111-111111111111',
    project_id: '22222222-2222-2222-2222-222222222222',
    title: 'Sprint',
    currency: 'IDR',
    amount: 125000n,
    payment_method: 'MIDTRANS',
    destination_account_id: 'acct_123',
    due_date: new Date('2027-01-01'),
  } as any);

  assert.equal(captured.transaction_details.order_id, 'invoice-11111111-1111-1111-1111-111111111111');
  assert.equal(captured.custom_field2, 'acct_123');
  assert.equal(captured.custom_field1, '22222222-2222-2222-2222-222222222222');
});

test('MidtransStrategy handles missing destination gracefully', async () => {
  const strategy = new MidtransStrategy();
  let captured: any;
  (strategy as any).snapClient.createTransaction = async (p: any) => {
    captured = p;
    return { token: 'tok2', redirect_url: 'https://example.com/r2' };
  };

  await strategy.chargeInvoice({
    id: '33333333-3333-3333-3333-333333333333',
    project_id: '44444444-4444-4444-4444-444444444444',
    title: 'Dev',
    currency: 'IDR',
    amount: 250000n,
    payment_method: 'MIDTRANS',
    due_date: new Date('2027-01-01'),
  } as any);

  assert.equal(captured.custom_field2, undefined);
});

test('DI constructor accepts custom db', () => {
  const mockDb = { invoice: {} };
  const service = new InvoiceService('STRIPE', mockDb as any);
  assert.equal((service as any).db, mockDb);
});

test('DI constructor defaults to global prisma', () => {
  const service = new InvoiceService();
  assert.ok((service as any).db);
});
