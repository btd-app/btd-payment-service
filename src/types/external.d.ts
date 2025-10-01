/**
 * Temporary type declarations for external modules
 * These are mock declarations to enable TypeScript compilation
 * when node_modules are not available
 */

declare module 'stripe' {
  namespace Stripe {
    interface Event {
      id: string;
      type: string;
      data: {
        object: any;
      };
    }
    interface Customer {
      id: string;
      email?: string;
      invoice_settings?: {
        default_payment_method?: string;
      };
    }
    interface PaymentIntent {
      id: string;
      client_secret: string | null;
      amount: number;
      currency: string;
      status: string;
    }
    interface Subscription {
      id: string;
      customer: string;
      status: string;
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
      items: {
        data: Array<{
          id?: string;
          price?: {
            id: string;
          };
        }>;
      };
    }
    interface Invoice {
      id: string;
      customer: string;
      amount_paid?: number;
      amount_due: number;
      currency: string;
      status?: string;
      description?: string;
      period_start: number;
      period_end: number;
      hosted_invoice_url?: string;
      invoice_pdf?: string;
    }
    interface PaymentMethod {
      id: string;
      customer?: string;
      type: string;
      card?: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
      };
    }
    interface SubscriptionUpdateParams {
      items?: Array<{
        id?: string;
        price: string;
      }>;
      proration_behavior?: string;
      cancel_at_period_end?: boolean;
    }
    interface Response<T> {
      id: string;
    }
  }
  class Stripe {
    constructor(secretKey: string, options?: any);
    webhooks: {
      constructEvent: (body: Buffer, signature: string, secret: string) => Stripe.Event;
    };
    customers: {
      create: (data: any) => Promise<Stripe.Customer>;
      retrieve: (id: string) => Promise<Stripe.Customer>;
      update: (id: string, data: any) => Promise<Stripe.Customer>;
    };
    paymentIntents: {
      create: (data: any) => Promise<Stripe.PaymentIntent>;
      update: (id: string, data: any) => Promise<Stripe.PaymentIntent>;
    };
    subscriptions: {
      create: (data: any) => Promise<Stripe.Subscription>;
      retrieve: (id: string) => Promise<Stripe.Subscription>;
      update: (id: string, data: Stripe.SubscriptionUpdateParams) => Promise<Stripe.Subscription>;
      cancel: (id: string) => Promise<Stripe.Subscription>;
      list: (options?: any) => Promise<{ data: Stripe.Subscription[] }>;
    };
    invoices: {
      list: (options: any) => Promise<{ data: Stripe.Invoice[] }>;
    };
    paymentMethods: {
      attach: (id: string, data: any) => Promise<Stripe.PaymentMethod>;
      detach: (id: string) => Promise<Stripe.PaymentMethod>;
      list: (options: any) => Promise<{ data: Stripe.PaymentMethod[] }>;
    };
    setupIntents: {
      create: (data: any) => Promise<{ id: string; client_secret: string | null }>;
    };
    checkout: {
      sessions: {
        create: (data: any) => Promise<{ id: string; url: string | null }>;
      };
    };
    billingPortal: {
      sessions: {
        create: (data: any) => Promise<{ url: string }>;
      };
    };
  }
  export = Stripe;
}

declare module '@nestjs/swagger' {
  export function ApiTags(...tags: string[]): ClassDecorator;
  export function ApiOperation(options: any): MethodDecorator;
  export function ApiResponse(options: any): MethodDecorator;
  export function ApiExcludeEndpoint(): MethodDecorator;
}

declare module '@nestjs/common' {
  export interface Request {}
  export interface RawBodyRequest<T> extends Request {
    rawBody?: Buffer;
    body?: any;
  }
  export interface OnModuleInit {
    onModuleInit(): Promise<void> | void;
  }
  export interface OnModuleDestroy {
    onModuleDestroy(): Promise<void> | void;
  }
  export function Controller(path?: string): ClassDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Put(path?: string): MethodDecorator;
  export function Delete(path?: string): MethodDecorator;
  export function Patch(path?: string): MethodDecorator;
  export function Headers(name?: string): ParameterDecorator;
  export function Body(): ParameterDecorator;
  export function Param(name?: string): ParameterDecorator;
  export function Query(name?: string): ParameterDecorator;
  export function Req(): ParameterDecorator;
  export function Res(): ParameterDecorator;
  export function HttpCode(code: number): MethodDecorator;
  export function Injectable(): ClassDecorator;
  export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500
  }
  export class BadRequestException extends Error {}
  export class NotFoundException extends Error {}
  export class InternalServerErrorException extends Error {}
  export class Logger {
    constructor(context?: string);
    log(message: string, context?: any): void;
    error(message: string, trace?: string): void;
    warn(message: string): void;
    debug(message: string): void;
  }
}

declare module '@prisma/client' {
  export enum SubscriptionTier {
    DISCOVER = 'DISCOVER',
    CONNECT = 'CONNECT',
    COMMUNITY = 'COMMUNITY'
  }

  export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',
    EXPIRED = 'EXPIRED',
    CANCELLED = 'CANCELLED',
    BILLING_RETRY = 'BILLING_RETRY',
    PENDING = 'PENDING'
  }

  export enum InvoiceStatus {
    DRAFT = 'DRAFT',
    OPEN = 'OPEN',
    PAID = 'PAID',
    UNCOLLECTIBLE = 'UNCOLLECTIBLE',
    VOID = 'VOID'
  }

  export enum PaymentStatus {
    PENDING = 'PENDING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
  }

  export class PrismaClient {
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
  }
}

declare module '@nestjs/config' {
  export class ConfigService {
    constructor();
    get(key: string): any;
  }
  export function registerAs(token: string, factory: () => any): any;
}

declare module 'express' {
  export interface Request {}
  export interface Response {}
}

declare module 'uuid' {
  export function v4(): string;
}