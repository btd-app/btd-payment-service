/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/unbound-method */

/**
 * PrismaService Unit Tests
 * Comprehensive test suite for database connection lifecycle management
 *
 * Coverage Target: 95%+
 * Last Updated: 2025-10-26
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

// Mock PrismaClient parent class
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(function (
      this: any,
      ...args: any[]
    ) {
      // Store constructor options for verification
      this.constructorOptions = args[0];
      this.$connect = jest.fn();
      this.$disconnect = jest.fn();
      this.featureUsage = { deleteMany: jest.fn() };
      this.paymentMethod = { deleteMany: jest.fn() };
      this.webhookEvent = { deleteMany: jest.fn() };
      this.billingHistory = { deleteMany: jest.fn() };
      this.paymentIntent = { deleteMany: jest.fn() };
      this.subscription = { deleteMany: jest.fn() };
    }),
  };
});

describe('PrismaService', () => {
  let service: PrismaService;
  let _configService: ConfigService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    _configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with DATABASE_URL from ConfigService', () => {
      const mockDatabaseUrl = 'postgresql://user:pass@localhost:5432/testdb';
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return mockDatabaseUrl;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      const _module = Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      expect(mockConfigService.get).toHaveBeenCalledWith('DATABASE_URL');
    });

    it('should set logging to ["query", "error", "warn"] in development', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://localhost:5432/db';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      // Verify that the service was constructed with development logging
      expect(mockConfigService.get).toHaveBeenCalledWith('NODE_ENV');
      expect((testService as any).constructorOptions.log).toEqual([
        'query',
        'error',
        'warn',
      ]);
    });

    it('should set logging to ["error"] in production', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://localhost:5432/db';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      expect((testService as any).constructorOptions.log).toEqual(['error']);
    });

    it('should set logging to ["error"] in test environment', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://localhost:5432/db';
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      expect((testService as any).constructorOptions.log).toEqual(['error']);
    });

    it('should pass correct datasource configuration to PrismaClient', async () => {
      const mockDatabaseUrl =
        'postgresql://user:pass@10.27.27.70:5432/payment_db';
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return mockDatabaseUrl;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      expect((testService as any).constructorOptions.datasources).toEqual({
        db: {
          url: mockDatabaseUrl,
        },
      });
    });
  });

  describe('onModuleInit', () => {
    describe('successful connection', () => {
      it('should call $connect() on initialization', async () => {
        const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();

        await service.onModuleInit();

        expect(connectSpy).toHaveBeenCalledTimes(1);
      });

      it('should log success message when connection succeeds', async () => {
        jest.spyOn(service, '$connect').mockResolvedValue();

        await service.onModuleInit();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '✅ Connected to payment database',
        );
      });

      it('should await $connect properly', async () => {
        const connectPromise = Promise.resolve();
        jest.spyOn(service, '$connect').mockReturnValue(connectPromise);

        await service.onModuleInit();

        expect(service.$connect).toHaveBeenCalled();
      });
    });

    describe('failed connection', () => {
      it('should catch and log warning when connection fails with Error instance', async () => {
        const mockError = new Error('Connection timeout');
        jest.spyOn(service, '$connect').mockRejectedValue(mockError);

        await service.onModuleInit();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '⚠️  Database connection failed, running without database:',
          'Connection timeout',
        );
      });

      it('should handle Error instances correctly', async () => {
        const mockError = new Error('Database not found');
        jest.spyOn(service, '$connect').mockRejectedValue(mockError);

        await service.onModuleInit();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.any(String),
          'Database not found',
        );
      });

      it('should handle non-Error exceptions', async () => {
        const nonErrorException = 'String error message';
        jest.spyOn(service, '$connect').mockRejectedValue(nonErrorException);

        await service.onModuleInit();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '⚠️  Database connection failed, running without database:',
          'Unknown error',
        );
      });

      it('should handle null exception', async () => {
        jest.spyOn(service, '$connect').mockRejectedValue(null);

        await service.onModuleInit();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '⚠️  Database connection failed, running without database:',
          'Unknown error',
        );
      });

      it('should handle undefined exception', async () => {
        jest.spyOn(service, '$connect').mockRejectedValue(undefined);

        await service.onModuleInit();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '⚠️  Database connection failed, running without database:',
          'Unknown error',
        );
      });

      it('should handle object exception without message property', async () => {
        const objectException = { code: 'ERR_CONNECTION_REFUSED' };
        jest.spyOn(service, '$connect').mockRejectedValue(objectException);

        await service.onModuleInit();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '⚠️  Database connection failed, running without database:',
          'Unknown error',
        );
      });

      it('should continue execution when connection fails (graceful degradation)', async () => {
        const mockError = new Error('Network error');
        jest.spyOn(service, '$connect').mockRejectedValue(mockError);

        // Should not throw
        await expect(service.onModuleInit()).resolves.not.toThrow();
      });

      it('should not log success message when connection fails', async () => {
        const mockError = new Error('Connection failed');
        jest.spyOn(service, '$connect').mockRejectedValue(mockError);

        await service.onModuleInit();

        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          '✅ Connected to payment database',
        );
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect() on destruction', async () => {
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue();

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it('should await disconnection properly', async () => {
      const disconnectPromise = Promise.resolve();
      jest.spyOn(service, '$disconnect').mockReturnValue(disconnectPromise);

      await service.onModuleDestroy();

      expect(service.$disconnect).toHaveBeenCalled();
    });

    it('should handle disconnection errors gracefully', async () => {
      const mockError = new Error('Disconnection failed');
      jest.spyOn(service, '$disconnect').mockRejectedValue(mockError);

      // Should propagate the error (no try-catch in onModuleDestroy)
      await expect(service.onModuleDestroy()).rejects.toThrow(
        'Disconnection failed',
      );
    });
  });

  describe('cleanDatabase', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    describe('in test environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
      });

      it('should delete all records in correct order (reverse dependency)', async () => {
        const featureUsageDeleteSpy = jest
          .spyOn(service.featureUsage, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        const paymentMethodDeleteSpy = jest
          .spyOn(service.paymentMethod, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        const webhookEventDeleteSpy = jest
          .spyOn(service.webhookEvent, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        const billingHistoryDeleteSpy = jest
          .spyOn(service.billingHistory, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        const paymentIntentDeleteSpy = jest
          .spyOn(service.paymentIntent, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        const subscriptionDeleteSpy = jest
          .spyOn(service.subscription, 'deleteMany')
          .mockResolvedValue({ count: 0 });

        await service.cleanDatabase();

        // Verify all tables are cleaned
        expect(featureUsageDeleteSpy).toHaveBeenCalledWith({});
        expect(paymentMethodDeleteSpy).toHaveBeenCalledWith({});
        expect(webhookEventDeleteSpy).toHaveBeenCalledWith({});
        expect(billingHistoryDeleteSpy).toHaveBeenCalledWith({});
        expect(paymentIntentDeleteSpy).toHaveBeenCalledWith({});
        expect(subscriptionDeleteSpy).toHaveBeenCalledWith({});
      });

      it('should call deleteMany on all tables: featureUsage, paymentMethod, webhookEvent, billingHistory, paymentIntent, subscription', async () => {
        jest
          .spyOn(service.featureUsage, 'deleteMany')
          .mockResolvedValue({ count: 5 });
        jest
          .spyOn(service.paymentMethod, 'deleteMany')
          .mockResolvedValue({ count: 3 });
        jest
          .spyOn(service.webhookEvent, 'deleteMany')
          .mockResolvedValue({ count: 10 });
        jest
          .spyOn(service.billingHistory, 'deleteMany')
          .mockResolvedValue({ count: 7 });
        jest
          .spyOn(service.paymentIntent, 'deleteMany')
          .mockResolvedValue({ count: 2 });
        jest
          .spyOn(service.subscription, 'deleteMany')
          .mockResolvedValue({ count: 1 });

        await service.cleanDatabase();

        expect(service.featureUsage.deleteMany).toHaveBeenCalled();
        expect(service.paymentMethod.deleteMany).toHaveBeenCalled();
        expect(service.webhookEvent.deleteMany).toHaveBeenCalled();
        expect(service.billingHistory.deleteMany).toHaveBeenCalled();
        expect(service.paymentIntent.deleteMany).toHaveBeenCalled();
        expect(service.subscription.deleteMany).toHaveBeenCalled();
      });

      it('should delete in reverse dependency order', async () => {
        const deletionOrder: string[] = [];

        jest
          .spyOn(service.featureUsage, 'deleteMany')
          .mockImplementation((() => {
            deletionOrder.push('featureUsage');
            return Promise.resolve({ count: 0 });
          }) as any);
        jest
          .spyOn(service.paymentMethod, 'deleteMany')
          .mockImplementation((() => {
            deletionOrder.push('paymentMethod');
            return Promise.resolve({ count: 0 });
          }) as any);
        jest
          .spyOn(service.webhookEvent, 'deleteMany')
          .mockImplementation((() => {
            deletionOrder.push('webhookEvent');
            return Promise.resolve({ count: 0 });
          }) as any);
        jest
          .spyOn(service.billingHistory, 'deleteMany')
          .mockImplementation((() => {
            deletionOrder.push('billingHistory');
            return Promise.resolve({ count: 0 });
          }) as any);
        jest
          .spyOn(service.paymentIntent, 'deleteMany')
          .mockImplementation((() => {
            deletionOrder.push('paymentIntent');
            return Promise.resolve({ count: 0 });
          }) as any);
        jest
          .spyOn(service.subscription, 'deleteMany')
          .mockImplementation((() => {
            deletionOrder.push('subscription');
            return Promise.resolve({ count: 0 });
          }) as any);

        await service.cleanDatabase();

        expect(deletionOrder).toEqual([
          'featureUsage',
          'paymentMethod',
          'webhookEvent',
          'billingHistory',
          'paymentIntent',
          'subscription',
        ]);
      });

      it('should complete successfully when tables are already empty', async () => {
        jest
          .spyOn(service.featureUsage, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        jest
          .spyOn(service.paymentMethod, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        jest
          .spyOn(service.webhookEvent, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        jest
          .spyOn(service.billingHistory, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        jest
          .spyOn(service.paymentIntent, 'deleteMany')
          .mockResolvedValue({ count: 0 });
        jest
          .spyOn(service.subscription, 'deleteMany')
          .mockResolvedValue({ count: 0 });

        await expect(service.cleanDatabase()).resolves.not.toThrow();
      });

      it('should handle database errors during cleanup', async () => {
        const mockError = new Error('Database cleanup failed');
        jest
          .spyOn(service.featureUsage, 'deleteMany')
          .mockRejectedValue(mockError);

        await expect(service.cleanDatabase()).rejects.toThrow(
          'Database cleanup failed',
        );
      });
    });

    describe('in non-test environment', () => {
      it('should throw error when NODE_ENV is "development"', async () => {
        process.env.NODE_ENV = 'development';

        await expect(service.cleanDatabase()).rejects.toThrow(
          'cleanDatabase() can only be called in test environment',
        );
      });

      it('should throw error when NODE_ENV is "production"', async () => {
        process.env.NODE_ENV = 'production';

        await expect(service.cleanDatabase()).rejects.toThrow(
          'cleanDatabase() can only be called in test environment',
        );
      });

      it('should throw error when NODE_ENV is "staging"', async () => {
        process.env.NODE_ENV = 'staging';

        await expect(service.cleanDatabase()).rejects.toThrow(
          'cleanDatabase() can only be called in test environment',
        );
      });

      it('should throw error when NODE_ENV is undefined', async () => {
        delete process.env.NODE_ENV;

        await expect(service.cleanDatabase()).rejects.toThrow(
          'cleanDatabase() can only be called in test environment',
        );
      });

      it('should not call deleteMany when environment check fails', async () => {
        process.env.NODE_ENV = 'production';

        const featureUsageDeleteSpy = jest.spyOn(
          service.featureUsage,
          'deleteMany',
        );
        const paymentMethodDeleteSpy = jest.spyOn(
          service.paymentMethod,
          'deleteMany',
        );
        const webhookEventDeleteSpy = jest.spyOn(
          service.webhookEvent,
          'deleteMany',
        );
        const billingHistoryDeleteSpy = jest.spyOn(
          service.billingHistory,
          'deleteMany',
        );
        const paymentIntentDeleteSpy = jest.spyOn(
          service.paymentIntent,
          'deleteMany',
        );
        const subscriptionDeleteSpy = jest.spyOn(
          service.subscription,
          'deleteMany',
        );

        try {
          await service.cleanDatabase();
        } catch (_error) {
          // Expected to throw
        }

        expect(featureUsageDeleteSpy).not.toHaveBeenCalled();
        expect(paymentMethodDeleteSpy).not.toHaveBeenCalled();
        expect(webhookEventDeleteSpy).not.toHaveBeenCalled();
        expect(billingHistoryDeleteSpy).not.toHaveBeenCalled();
        expect(paymentIntentDeleteSpy).not.toHaveBeenCalled();
        expect(subscriptionDeleteSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lifecycle: init -> destroy', async () => {
      jest.spyOn(service, '$connect').mockResolvedValue();
      jest.spyOn(service, '$disconnect').mockResolvedValue();

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(service.$connect).toHaveBeenCalledTimes(1);
      expect(service.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple init calls', async () => {
      jest.spyOn(service, '$connect').mockResolvedValue();

      await service.onModuleInit();
      await service.onModuleInit();
      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalledTimes(3);
    });

    it('should handle init failure followed by successful destroy', async () => {
      jest
        .spyOn(service, '$connect')
        .mockRejectedValue(new Error('Init failed'));
      jest.spyOn(service, '$disconnect').mockResolvedValue();

      await service.onModuleInit(); // Should not throw
      await service.onModuleDestroy(); // Should succeed

      expect(service.$disconnect).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle ConfigService returning null for DATABASE_URL', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return null;
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      expect(
        (testService as any).constructorOptions.datasources.db.url,
      ).toBeNull();
    });

    it('should handle ConfigService returning empty string for DATABASE_URL', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return '';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      expect((testService as any).constructorOptions.datasources.db.url).toBe(
        '',
      );
    });

    it('should handle ConfigService returning null for NODE_ENV', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://localhost:5432/db';
        if (key === 'NODE_ENV') return null;
        return undefined;
      });

      const _module = await Test.createTestingModule({
        providers: [
          PrismaService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testService = _module.get<PrismaService>(PrismaService);

      // When NODE_ENV is null, it should default to production logging
      expect((testService as any).constructorOptions.log).toEqual(['error']);
    });
  });
});
