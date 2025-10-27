import { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import '../types/external';
import { PrismaService } from '../prisma/prisma.service';
export declare class WebhookController {
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    private stripe;
    private endpointSecret;
    constructor(prisma: PrismaService, configService: ConfigService);
    handleStripeWebhook(signature: string, req: RawBodyRequest<Request>): Promise<{
        received: boolean;
    }>;
    private handleSubscriptionCreated;
    private handleSubscriptionUpdated;
    private handleSubscriptionDeleted;
    private handleTrialWillEnd;
    private handleInvoicePaymentSucceeded;
    private handleInvoicePaymentFailed;
    private handlePaymentIntentSucceeded;
    private handlePaymentIntentFailed;
    private handlePaymentMethodAttached;
    private handlePaymentMethodDetached;
    private handleDisputeCreated;
    private handleDisputeClosed;
    private mapStripeStatus;
    private getTierFromPriceId;
}
