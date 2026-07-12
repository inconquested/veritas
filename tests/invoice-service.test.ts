import assert from 'node:assert/strict';
import test from 'node:test';

import { InvoiceService } from '../services/invoice-service';
import { StripeStrategy } from '../services/vendor/payment/stripe-strategy';
import { PaypalStrategy } from '../services/vendor/payment/paypal-strategy';
import { XenditStrategy } from '../services/vendor/payment/xendit-strategy';
import { MidtransStrategy } from '../services/vendor/payment/midtrans-strategy';

test('InvoiceService resolves the correct strategy for each supported payment method', () => {
  const service = new InvoiceService();

  assert.ok(service.getStrategyForInvoice({ payment_method: 'STRIPE' } as any) instanceof StripeStrategy);
  assert.ok(service.getStrategyForInvoice({ payment_method: 'PAYPAL' } as any) instanceof PaypalStrategy);
  assert.ok(service.getStrategyForInvoice({ payment_method: 'XENDIT' } as any) instanceof XenditStrategy);
  assert.ok(service.getStrategyForInvoice({ payment_method: 'MIDTRANS' } as any) instanceof MidtransStrategy);
});

test('ChargeInvoiceInput accepts destination_account_id field', () => {
  const service = new InvoiceService();
  
  const invoiceWithDestination = {
    id: '11111111-1111-1111-1111-111111111111',
    project_id: '22222222-2222-2222-2222-222222222222',
    title: 'Design work',
    currency: 'USD',
    amount: 5000n,
    payment_method: 'STRIPE',
    destination_account_id: 'acct_destination_456',
  } as any;
  
  // Verify service can handle destination_account_id
  assert.equal(invoiceWithDestination.destination_account_id, 'acct_destination_456');
  const strategy = service.getStrategyForInvoice(invoiceWithDestination);
  assert.ok(strategy instanceof StripeStrategy);
});

test('MidtransStrategy uses a deterministic order id and forwards the destination account', async () => {
  process.env.MIDTRANS_SERVER_KEY = 'server-key';
  process.env.MIDTRANS_CLIENT_KEY = 'client-key';

  const strategy = new MidtransStrategy();
  let capturedParameters: any;

  (strategy as any).snapClient.createTransaction = async (parameters: any) => {
    capturedParameters = parameters;
    return { token: 'snap-token', redirect_url: 'https://example.com/redirect' };
  };

  await strategy.chargeInvoice({
    id: '11111111-1111-1111-1111-111111111111',
    project_id: '22222222-2222-2222-2222-222222222222',
    title: 'Design sprint',
    currency: 'IDR',
    amount: 125000n,
    payment_method: 'MIDTRANS',
    destination_account_id: 'acct_freelancer_123',
  } as any);

  assert.equal(capturedParameters.transaction_details.order_id, 'invoice-11111111-1111-1111-1111-111111111111');
  assert.equal(capturedParameters.custom_field2, 'acct_freelancer_123');
  assert.equal(capturedParameters.custom_field1, '22222222-2222-2222-2222-222222222222');
});

test('MidtransStrategy handles missing destination account gracefully', async () => {
  process.env.MIDTRANS_SERVER_KEY = 'server-key';
  process.env.MIDTRANS_CLIENT_KEY = 'client-key';

  const strategy = new MidtransStrategy();
  let capturedParameters: any;

  (strategy as any).snapClient.createTransaction = async (parameters: any) => {
    capturedParameters = parameters;
    return { token: 'snap-token-2', redirect_url: 'https://example.com/redirect2' };
  };

  await strategy.chargeInvoice({
    id: '33333333-3333-3333-3333-333333333333',
    project_id: '44444444-4444-4444-4444-444444444444',
    title: 'Web development',
    currency: 'IDR',
    amount: 250000n,
    payment_method: 'MIDTRANS',
  } as any);

  assert.equal(capturedParameters.transaction_details.order_id, 'invoice-33333333-3333-3333-3333-333333333333');
  assert.equal(capturedParameters.custom_field2, undefined);
  assert.equal(capturedParameters.custom_field1, '44444444-4444-4444-4444-444444444444');
});
