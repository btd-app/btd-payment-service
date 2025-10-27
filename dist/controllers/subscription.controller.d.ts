import { StripeService } from '../services/stripe.service';
import { SubscriptionService } from '../services/subscription.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto, SubscriptionResponseDto, UserSubscriptionDto, ValidateFeatureAccessDto, FeatureAccessResponseDto, CallUsageStatsDto, SubscriptionFeaturesDto, CreateCheckoutSessionDto, CreatePortalSessionDto } from '../dto/subscription.dto';
interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
    };
}
export declare class SubscriptionController {
    private readonly stripeService;
    private readonly subscriptionService;
    constructor(stripeService: StripeService, subscriptionService: SubscriptionService);
    getCurrentSubscription(req: AuthenticatedRequest): Promise<UserSubscriptionDto>;
    createSubscription(dto: CreateSubscriptionDto, req: AuthenticatedRequest): Promise<SubscriptionResponseDto>;
    updateSubscription(subscriptionId: string, dto: UpdateSubscriptionDto, req: AuthenticatedRequest): Promise<SubscriptionResponseDto>;
    cancelSubscription(subscriptionId: string, req: AuthenticatedRequest): Promise<void>;
    createCheckoutSession(dto: CreateCheckoutSessionDto, req: AuthenticatedRequest): Promise<{
        sessionId: string;
        url: string;
    }>;
    createPortalSession(dto: CreatePortalSessionDto, req: AuthenticatedRequest): Promise<{
        url: string;
    }>;
    getSubscriptionFeatures(req: AuthenticatedRequest): Promise<SubscriptionFeaturesDto>;
    validateFeatureAccess(dto: ValidateFeatureAccessDto, req: AuthenticatedRequest): Promise<FeatureAccessResponseDto>;
    getCallUsageStats(req: AuthenticatedRequest): CallUsageStatsDto;
    trackFeatureUsage(dto: {
        feature: string;
        metadata?: Record<string, unknown>;
    }, req: AuthenticatedRequest): Promise<{
        success: boolean;
    }>;
}
export {};
