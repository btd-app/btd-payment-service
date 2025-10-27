import { StripeService } from '../services/stripe.service';
import { CreatePaymentIntentDto, CreateSetupIntentDto, PaymentIntentResponseDto, SetupIntentResponseDto, PaymentMethodDto, BillingHistoryDto } from '../dto/payment.dto';
import { SubscriptionPlanDto } from '../dto/subscription.dto';
interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
    };
}
export declare class PaymentController {
    private readonly stripeService;
    constructor(stripeService: StripeService);
    getPlans(): SubscriptionPlanDto[];
    createPaymentIntent(dto: CreatePaymentIntentDto, req: AuthenticatedRequest): Promise<PaymentIntentResponseDto>;
    createSetupIntent(dto: CreateSetupIntentDto, req: AuthenticatedRequest): Promise<SetupIntentResponseDto>;
    getBillingHistory(req: AuthenticatedRequest): Promise<BillingHistoryDto[]>;
    getPaymentMethods(req: AuthenticatedRequest): Promise<PaymentMethodDto[]>;
    deletePaymentMethod(paymentMethodId: string, req: AuthenticatedRequest): Promise<void>;
    setDefaultPaymentMethod(paymentMethodId: string, req: AuthenticatedRequest): Promise<{
        success: boolean;
    }>;
}
export {};
