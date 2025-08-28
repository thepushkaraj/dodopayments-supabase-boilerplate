import { Webhook } from 'standardwebhooks';

/**
 * Verify webhook signature from Dodo Payments
 * @param payload - Raw webhook payload as string
 * @param headers - Webhook headers containing signature and timestamp
 * @param webhookKey - Webhook secret key for verification
 * @returns Parsed webhook payload if verification succeeds
 * @throws Error if verification fails
 */
export async function verifyWebhook(
  payload: string, 
  headers: {
    'webhook-id'?: string;
    'webhook-signature'?: string;
    'webhook-timestamp'?: string;
  },
  webhookKey: string
) {
  try {
    const webhook = new Webhook(webhookKey);
    const webhookHeaders = {
      'webhook-id': headers['webhook-id'] || '',
      'webhook-signature': headers['webhook-signature'] || '',
      'webhook-timestamp': headers['webhook-timestamp'] || '',
    };

    const verifiedPayload = await webhook.verify(payload, webhookHeaders);
    return verifiedPayload;
  } catch (error) {
    throw new Error(`Webhook verification failed: ${error}`);
  }
}
