// Mock NestJS decorators BEFORE importing the controller
// This prevents the decorators from transforming the method signatures
jest.mock('@nestjs/microservices', () => ({
  GrpcMethod: () => () => {},
  GrpcStreamMethod: () => () => {},
}));

jest.mock('@nestjs/common', () => ({
  Controller: () => () => {},
}));

import { HealthController } from './health.controller';
import { Subject } from 'rxjs';

enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

interface HealthCheckRequest {
  service: string;
}

interface HealthCheckResponse {
  status: ServingStatus;
}

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  describe('constructor', () => {
    it('should initialize serviceStatus map', () => {
      // Verify the map is created by checking it can be used
      const result = controller.check({ service: '' });
      expect(result).toBeDefined();
    });

    it('should set default status for empty string service to SERVING', () => {
      const result = controller.check({ service: '' });
      expect(result.status).toBe(ServingStatus.SERVING);
    });

    it('should set default status for btd.payment.Payment to SERVING', () => {
      const result = controller.check({ service: 'btd.payment.Payment' });
      expect(result.status).toBe(ServingStatus.SERVING);
    });

    it('should initialize with exactly two default services', () => {
      // Test that unknown services return SERVICE_UNKNOWN
      const unknownResult = controller.check({ service: 'unknown.service' });
      expect(unknownResult.status).toBe(ServingStatus.SERVICE_UNKNOWN);
    });
  });

  describe('check', () => {
    describe('for default services', () => {
      it('should return SERVING for empty service name', () => {
        const result = controller.check({ service: '' });
        expect(result).toEqual({ status: ServingStatus.SERVING });
      });

      it('should return SERVING for btd.payment.Payment', () => {
        const result = controller.check({ service: 'btd.payment.Payment' });
        expect(result).toEqual({ status: ServingStatus.SERVING });
      });

      it('should handle request without explicit service property', () => {
        const result = controller.check({} as HealthCheckRequest);
        expect(result.status).toBe(ServingStatus.SERVING);
      });

      it('should treat undefined service as empty string', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = controller.check({ service: undefined as any });
        expect(result.status).toBe(ServingStatus.SERVING);
      });
    });

    describe('for unknown services', () => {
      it('should return SERVICE_UNKNOWN for unknown service', () => {
        const result = controller.check({ service: 'unknown.service' });
        expect(result).toEqual({ status: ServingStatus.SERVICE_UNKNOWN });
      });

      it('should return SERVICE_UNKNOWN for non-existent service', () => {
        const result = controller.check({ service: 'btd.payment.NonExistent' });
        expect(result.status).toBe(ServingStatus.SERVICE_UNKNOWN);
      });

      it('should return SERVICE_UNKNOWN for random string', () => {
        const result = controller.check({ service: 'random.test.service' });
        expect(result.status).toBe(ServingStatus.SERVICE_UNKNOWN);
      });
    });

    describe('after status updates', () => {
      it('should return updated status after setServiceStatus called', () => {
        controller.setServiceStatus('', ServingStatus.NOT_SERVING);
        const result = controller.check({ service: '' });
        expect(result.status).toBe(ServingStatus.NOT_SERVING);
      });

      it('should return NOT_SERVING when service is marked as not serving', () => {
        controller.setServiceStatus(
          'btd.payment.Payment',
          ServingStatus.NOT_SERVING,
        );
        const result = controller.check({ service: 'btd.payment.Payment' });
        expect(result.status).toBe(ServingStatus.NOT_SERVING);
      });

      it('should return UNKNOWN when service status is set to UNKNOWN', () => {
        controller.setServiceStatus(
          'btd.payment.Payment',
          ServingStatus.UNKNOWN,
        );
        const result = controller.check({ service: 'btd.payment.Payment' });
        expect(result.status).toBe(ServingStatus.UNKNOWN);
      });

      it('should handle multiple status updates for same service', () => {
        controller.setServiceStatus('', ServingStatus.NOT_SERVING);
        let result = controller.check({ service: '' });
        expect(result.status).toBe(ServingStatus.NOT_SERVING);

        controller.setServiceStatus('', ServingStatus.SERVING);
        result = controller.check({ service: '' });
        expect(result.status).toBe(ServingStatus.SERVING);
      });

      it('should handle status updates for newly added services', () => {
        const newService = 'btd.payment.NewService';
        controller.setServiceStatus(newService, ServingStatus.SERVING);
        const result = controller.check({ service: newService });
        expect(result.status).toBe(ServingStatus.SERVING);
      });
    });
  });

  describe('watch', () => {
    describe('observable emission', () => {
      it('should return an Observable that can be subscribed to', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const result = controller.watch(request$.asObservable());

        // The method returns an Observable
        result.subscribe({
          complete: () => {
            done();
          },
        });

        request$.complete();
      });

      it('should emit health status when request received', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response).toBeDefined();
            expect(response.status).toBeDefined();
            done();
          },
        });

        request$.next({ service: '' });
        request$.complete();
      });

      it('should complete when input Observable completes', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          complete: () => {
            done();
          },
        });

        request$.next({ service: '' });
        request$.complete();
      });

      it('should emit immediately for each request in stream', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        const emittedResponses: HealthCheckResponse[] = [];

        response$.subscribe({
          next: (response) => {
            emittedResponses.push(response);
          },
          complete: () => {
            expect(emittedResponses).toHaveLength(3);
            done();
          },
        });

        request$.next({ service: '' });
        request$.next({ service: 'btd.payment.Payment' });
        request$.next({ service: 'unknown' });
        request$.complete();
      });
    });

    describe('for known services', () => {
      it('should emit SERVING status for empty service name', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response.status).toBe(ServingStatus.SERVING);
            done();
          },
        });

        request$.next({ service: '' });
        request$.complete();
      });

      it('should emit SERVING status for btd.payment.Payment', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response.status).toBe(ServingStatus.SERVING);
            done();
          },
        });

        request$.next({ service: 'btd.payment.Payment' });
        request$.complete();
      });

      it('should emit correct status after service status update', (done) => {
        controller.setServiceStatus(
          'btd.payment.Payment',
          ServingStatus.NOT_SERVING,
        );
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response.status).toBe(ServingStatus.NOT_SERVING);
            done();
          },
        });

        request$.next({ service: 'btd.payment.Payment' });
        request$.complete();
      });

      it('should handle undefined service in watch request', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response.status).toBe(ServingStatus.SERVING);
            done();
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        request$.next({ service: undefined as any });
        request$.complete();
      });
    });

    describe('for unknown services', () => {
      it('should emit SERVICE_UNKNOWN for unknown service', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response.status).toBe(ServingStatus.SERVICE_UNKNOWN);
            done();
          },
        });

        request$.next({ service: 'unknown.service' });
        request$.complete();
      });

      it('should emit SERVICE_UNKNOWN for non-existent service', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());

        response$.subscribe({
          next: (response) => {
            expect(response.status).toBe(ServingStatus.SERVICE_UNKNOWN);
            done();
          },
        });

        request$.next({ service: 'btd.payment.NonExistent' });
        request$.complete();
      });
    });

    describe('with multiple requests', () => {
      it('should emit status for each request in sequence', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        const emittedStatuses: ServingStatus[] = [];

        response$.subscribe({
          next: (response) => {
            emittedStatuses.push(response.status);
          },
          complete: () => {
            expect(emittedStatuses).toEqual([
              ServingStatus.SERVING, // empty service
              ServingStatus.SERVING, // btd.payment.Payment
              ServingStatus.SERVICE_UNKNOWN, // unknown
            ]);
            done();
          },
        });

        request$.next({ service: '' });
        request$.next({ service: 'btd.payment.Payment' });
        request$.next({ service: 'unknown.service' });
        request$.complete();
      });

      it('should handle mixed known and unknown service requests', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        const emittedResponses: HealthCheckResponse[] = [];

        response$.subscribe({
          next: (response) => {
            emittedResponses.push(response);
          },
          complete: () => {
            expect(emittedResponses).toHaveLength(4);
            expect(emittedResponses[0].status).toBe(ServingStatus.SERVING);
            expect(emittedResponses[1].status).toBe(
              ServingStatus.SERVICE_UNKNOWN,
            );
            expect(emittedResponses[2].status).toBe(ServingStatus.SERVING);
            expect(emittedResponses[3].status).toBe(
              ServingStatus.SERVICE_UNKNOWN,
            );
            done();
          },
        });

        request$.next({ service: '' });
        request$.next({ service: 'unknown1' });
        request$.next({ service: 'btd.payment.Payment' });
        request$.next({ service: 'unknown2' });
        request$.complete();
      });

      it('should handle rapid sequential requests', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        let emitCount = 0;

        response$.subscribe({
          next: () => {
            emitCount++;
          },
          complete: () => {
            expect(emitCount).toBe(10);
            done();
          },
        });

        for (let i = 0; i < 10; i++) {
          request$.next({ service: '' });
        }
        request$.complete();
      });
    });

    describe('stream completion', () => {
      it('should not emit after stream completes', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        let emitCount = 0;

        response$.subscribe({
          next: () => {
            emitCount++;
          },
          complete: () => {
            expect(emitCount).toBe(1);
            // Try to emit after completion (should not affect anything)
            request$.next({ service: 'btd.payment.Payment' });
            // Wait a bit to ensure no additional emissions
            setTimeout(() => {
              expect(emitCount).toBe(1);
              done();
            }, 10);
          },
        });

        request$.next({ service: '' });
        request$.complete();
      });

      it('should handle empty stream (no requests before completion)', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        let emitCount = 0;

        response$.subscribe({
          next: () => {
            emitCount++;
          },
          complete: () => {
            expect(emitCount).toBe(0);
            done();
          },
        });

        request$.complete();
      });
    });

    describe('status updates during watch', () => {
      it('should reflect status changes made during active watch stream', (done) => {
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        const emittedStatuses: ServingStatus[] = [];

        response$.subscribe({
          next: (response) => {
            emittedStatuses.push(response.status);
          },
          complete: () => {
            expect(emittedStatuses).toEqual([
              ServingStatus.SERVING,
              ServingStatus.NOT_SERVING,
              ServingStatus.SERVING,
            ]);
            done();
          },
        });

        request$.next({ service: 'btd.payment.Payment' });
        controller.setServiceStatus(
          'btd.payment.Payment',
          ServingStatus.NOT_SERVING,
        );
        request$.next({ service: 'btd.payment.Payment' });
        controller.setServiceStatus(
          'btd.payment.Payment',
          ServingStatus.SERVING,
        );
        request$.next({ service: 'btd.payment.Payment' });
        request$.complete();
      });

      it('should detect new services added during watch stream', (done) => {
        const newService = 'btd.payment.NewService';
        const request$ = new Subject<HealthCheckRequest>();
        const response$ = controller.watch(request$.asObservable());
        const emittedStatuses: ServingStatus[] = [];

        response$.subscribe({
          next: (response) => {
            emittedStatuses.push(response.status);
          },
          complete: () => {
            expect(emittedStatuses).toEqual([
              ServingStatus.SERVICE_UNKNOWN,
              ServingStatus.SERVING,
            ]);
            done();
          },
        });

        request$.next({ service: newService });
        controller.setServiceStatus(newService, ServingStatus.SERVING);
        request$.next({ service: newService });
        request$.complete();
      });
    });
  });

  describe('setServiceStatus', () => {
    it('should update service status in map', () => {
      controller.setServiceStatus(
        'btd.payment.Payment',
        ServingStatus.NOT_SERVING,
      );
      const result = controller.check({ service: 'btd.payment.Payment' });
      expect(result.status).toBe(ServingStatus.NOT_SERVING);
    });

    it('should allow adding new services', () => {
      const newService = 'btd.payment.NewService';
      controller.setServiceStatus(newService, ServingStatus.SERVING);
      const result = controller.check({ service: newService });
      expect(result.status).toBe(ServingStatus.SERVING);
    });

    it('should allow updating existing services', () => {
      controller.setServiceStatus('', ServingStatus.NOT_SERVING);
      let result = controller.check({ service: '' });
      expect(result.status).toBe(ServingStatus.NOT_SERVING);

      controller.setServiceStatus('', ServingStatus.SERVING);
      result = controller.check({ service: '' });
      expect(result.status).toBe(ServingStatus.SERVING);
    });

    it('should set status to NOT_SERVING', () => {
      controller.setServiceStatus(
        'btd.payment.Payment',
        ServingStatus.NOT_SERVING,
      );
      const result = controller.check({ service: 'btd.payment.Payment' });
      expect(result.status).toBe(ServingStatus.NOT_SERVING);
    });

    it('should set status back to SERVING after NOT_SERVING', () => {
      controller.setServiceStatus(
        'btd.payment.Payment',
        ServingStatus.NOT_SERVING,
      );
      controller.setServiceStatus('btd.payment.Payment', ServingStatus.SERVING);
      const result = controller.check({ service: 'btd.payment.Payment' });
      expect(result.status).toBe(ServingStatus.SERVING);
    });

    it('should set status to UNKNOWN', () => {
      controller.setServiceStatus('btd.payment.Payment', ServingStatus.UNKNOWN);
      const result = controller.check({ service: 'btd.payment.Payment' });
      expect(result.status).toBe(ServingStatus.UNKNOWN);
    });

    it('should handle all ServingStatus enum values', () => {
      const testService = 'test.service';

      controller.setServiceStatus(testService, ServingStatus.UNKNOWN);
      expect(controller.check({ service: testService }).status).toBe(
        ServingStatus.UNKNOWN,
      );

      controller.setServiceStatus(testService, ServingStatus.SERVING);
      expect(controller.check({ service: testService }).status).toBe(
        ServingStatus.SERVING,
      );

      controller.setServiceStatus(testService, ServingStatus.NOT_SERVING);
      expect(controller.check({ service: testService }).status).toBe(
        ServingStatus.NOT_SERVING,
      );

      controller.setServiceStatus(testService, ServingStatus.SERVICE_UNKNOWN);
      expect(controller.check({ service: testService }).status).toBe(
        ServingStatus.SERVICE_UNKNOWN,
      );
    });

    it('should allow independent status for different services', () => {
      controller.setServiceStatus('', ServingStatus.NOT_SERVING);
      controller.setServiceStatus('btd.payment.Payment', ServingStatus.SERVING);

      expect(controller.check({ service: '' }).status).toBe(
        ServingStatus.NOT_SERVING,
      );
      expect(controller.check({ service: 'btd.payment.Payment' }).status).toBe(
        ServingStatus.SERVING,
      );
    });

    it('should allow setting status for empty string service', () => {
      controller.setServiceStatus('', ServingStatus.NOT_SERVING);
      const result = controller.check({ service: '' });
      expect(result.status).toBe(ServingStatus.NOT_SERVING);
    });

    it('should persist status changes across multiple checks', () => {
      controller.setServiceStatus(
        'btd.payment.Payment',
        ServingStatus.NOT_SERVING,
      );

      for (let i = 0; i < 5; i++) {
        const result = controller.check({ service: 'btd.payment.Payment' });
        expect(result.status).toBe(ServingStatus.NOT_SERVING);
      }
    });
  });
});
