import { UserBillingService } from './billingService.js';
import { billingLedger } from './billingStore.js';

export const userBillingService = new UserBillingService(billingLedger);
