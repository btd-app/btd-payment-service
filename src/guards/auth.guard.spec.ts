/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/**
 * Auth Guard Unit Tests
 * Comprehensive test suite for JWT authentication guard
 *
 * Coverage Target: 95%+
 * Last Updated: 2025-10-26
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import * as jwt from 'jsonwebtoken';

// Mock the jsonwebtoken module
jest.mock('jsonwebtoken');

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let _configService: ConfigService;
  const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

  // Mock ConfigService
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    _configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    describe('with valid token', () => {
      it('should return true when valid JWT token is provided', () => {
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer valid-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockJwtVerify).toHaveBeenCalledWith(
          'valid-token',
          'test-secret',
        );
      });

      it('should attach decoded user (id, email) to request.user', () => {
        const mockPayload = {
          id: 'user-456',
          email: 'user@test.com',
          iat: 1234567890,
          exp: 9999999999,
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer valid-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        guard.canActivate(mockContext);

        expect(mockRequest.user).toEqual({
          id: 'user-456',
          email: 'user@test.com',
        });
      });

      it('should handle JWT with only id and email fields', () => {
        const mockPayload = {
          id: 'user-789',
          email: 'minimal@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer minimal-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockRequest.user).toEqual({
          id: 'user-789',
          email: 'minimal@example.com',
        });
      });

      it('should handle JWT with additional fields beyond id and email', () => {
        const mockPayload = {
          id: 'user-999',
          email: 'extra@example.com',
          iat: 1234567890,
          exp: 9999999999,
          role: 'admin',
          permissions: ['read', 'write'],
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer token-with-extras',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        guard.canActivate(mockContext);

        // Should only attach id and email, not extra fields
        expect(mockRequest.user).toEqual({
          id: 'user-999',
          email: 'extra@example.com',
        });
      });
    });

    describe('with invalid token', () => {
      it('should throw UnauthorizedException when JWT verification fails', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer invalid-token',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('jwt malformed');
        });

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow('Invalid token');
      });

      it('should throw UnauthorizedException when token is expired', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer expired-token',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('jwt expired');
        });

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow('Invalid token');
      });

      it('should throw UnauthorizedException when token signature is invalid', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer tampered-token',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('invalid signature');
        });

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow('Invalid token');
      });

      it('should throw UnauthorizedException for any jwt.verify error', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer problematic-token',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('Unknown JWT error');
        });

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow('Invalid token');
      });
    });

    describe('with no token', () => {
      it('should throw UnauthorizedException when no Authorization header', () => {
        const mockRequest = {
          headers: {},
        };

        const mockContext = createMockExecutionContext(mockRequest);

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should throw UnauthorizedException when Authorization header is undefined', () => {
        const mockRequest = {
          headers: {
            authorization: undefined,
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should throw UnauthorizedException when Authorization header is empty string', () => {
        const mockRequest = {
          headers: {
            authorization: '',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should throw UnauthorizedException when token type is not Bearer', () => {
        const mockRequest = {
          headers: {
            authorization: 'Basic dXNlcjpwYXNz',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should throw UnauthorizedException when Bearer has no token', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should throw UnauthorizedException when Bearer followed by only spaces', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer   ',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });
    });

    describe('JWT_SECRET configuration', () => {
      it('should use JWT_SECRET from ConfigService when available', () => {
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer test-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('custom-secret-key');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        guard.canActivate(mockContext);

        expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
        expect(mockJwtVerify).toHaveBeenCalledWith(
          'test-token',
          'custom-secret-key',
        );
      });

      it('should use default-secret fallback when JWT_SECRET is not set', () => {
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer test-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue(undefined);
        mockJwtVerify.mockReturnValue(mockPayload as never);

        guard.canActivate(mockContext);

        expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
        expect(mockJwtVerify).toHaveBeenCalledWith(
          'test-token',
          'default-secret',
        );
      });

      it('should use default-secret fallback when JWT_SECRET is null', () => {
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer test-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue(null);
        mockJwtVerify.mockReturnValue(mockPayload as never);

        guard.canActivate(mockContext);

        expect(mockJwtVerify).toHaveBeenCalledWith(
          'test-token',
          'default-secret',
        );
      });

      it('should use default-secret fallback when JWT_SECRET is empty string', () => {
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: 'Bearer test-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        guard.canActivate(mockContext);

        expect(mockJwtVerify).toHaveBeenCalledWith(
          'test-token',
          'default-secret',
        );
      });
    });

    describe('edge cases', () => {
      it('should throw UnauthorizedException when multiple spaces between Bearer and token', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer    token-with-spaces',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        // First split on space gives ['Bearer', '', '', '', 'token-with-spaces']
        // extractTokenFromHeader takes index [1], which is empty string
        // This is treated as no token, so should throw
        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should handle case-sensitive Bearer token type', () => {
        const mockRequest = {
          headers: {
            authorization: 'bearer lowercase-token',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        // Should throw because 'bearer' !== 'Bearer'
        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should handle BEARER uppercase token type', () => {
        const mockRequest = {
          headers: {
            authorization: 'BEARER uppercase-token',
          },
        };

        const mockContext = createMockExecutionContext(mockRequest);

        // Should throw because 'BEARER' !== 'Bearer'
        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(() => guard.canActivate(mockContext)).toThrow(
          'No token provided',
        );
      });

      it('should not modify request if JWT verification fails', () => {
        const mockRequest = {
          headers: {
            authorization: 'Bearer invalid-token',
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockImplementation(() => {
          throw new Error('jwt malformed');
        });

        expect(() => guard.canActivate(mockContext)).toThrow(
          UnauthorizedException,
        );
        expect(mockRequest.user).toBeUndefined();
      });

      it('should handle very long tokens', () => {
        const longToken = 'a'.repeat(10000);
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: `Bearer ${longToken}`,
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockJwtVerify).toHaveBeenCalledWith(longToken, 'test-secret');
      });

      it('should handle tokens with special characters', () => {
        const specialToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const mockPayload = {
          id: 'user-123',
          email: 'test@example.com',
        };

        const mockRequest = {
          headers: {
            authorization: `Bearer ${specialToken}`,
          },
          user: undefined,
        };

        const mockContext = createMockExecutionContext(mockRequest);

        mockConfigService.get.mockReturnValue('test-secret');
        mockJwtVerify.mockReturnValue(mockPayload as never);

        const result = guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(mockJwtVerify).toHaveBeenCalledWith(specialToken, 'test-secret');
      });
    });
  });

  describe('extractTokenFromHeader (private method testing via reflection)', () => {
    it('should extract token from valid Bearer authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token-123',
        },
      };

      // Access private method via reflection
      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBe('valid-token-123');
    });

    it('should return undefined when no Authorization header', () => {
      const mockRequest = {
        headers: {},
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBeUndefined();
    });

    it('should return undefined when Authorization header is undefined', () => {
      const mockRequest = {
        headers: {
          authorization: undefined,
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBeUndefined();
    });

    it('should return undefined when Authorization header format is wrong', () => {
      const mockRequest = {
        headers: {
          authorization: 'InvalidFormat',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBeUndefined();
    });

    it('should return undefined when type is not Bearer', () => {
      const mockRequest = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBeUndefined();
    });

    it('should return undefined when Bearer has no token part', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBeUndefined();
    });

    it('should handle Bearer with empty token part', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer ',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBe('');
    });

    it('should extract token when authorization has extra whitespace', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer  token-with-space',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      // After split on ' ', we get ['Bearer', '', 'token-with-space']
      // [1] is empty string
      expect(result).toBe('');
    });

    it('should be case-sensitive for Bearer keyword', () => {
      const mockRequest = {
        headers: {
          authorization: 'bearer lowercase-token',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBeUndefined();
    });

    it('should handle tokens with dots and hyphens (JWT format)', () => {
      const jwtToken = 'eyJhbGci.eyJzdWIi.SflKxwRJ';
      const mockRequest = {
        headers: {
          authorization: `Bearer ${jwtToken}`,
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      expect(result).toBe(jwtToken);
    });

    it('should handle authorization header with trailing spaces', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer token-123   ',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      // split(' ') gives ['Bearer', 'token-123', '', '', '']
      // [1] is 'token-123'
      expect(result).toBe('token-123');
    });

    it('should extract first token when multiple tokens provided', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer first-token second-token',
        },
      };

      const extractTokenFromHeader = (guard as any).extractTokenFromHeader.bind(
        guard,
      );
      const result = extractTokenFromHeader(mockRequest);

      // split(' ') gives ['Bearer', 'first-token', 'second-token']
      // [1] is 'first-token'
      expect(result).toBe('first-token');
    });
  });

  describe('integration scenarios', () => {
    it('should successfully authenticate valid request with all components', () => {
      const mockPayload = {
        id: 'integration-user-123',
        email: 'integration@test.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockRequest = {
        headers: {
          authorization: 'Bearer integration-test-token',
        },
        user: undefined,
      };

      const mockContext = createMockExecutionContext(mockRequest);

      mockConfigService.get.mockReturnValue('integration-secret');
      mockJwtVerify.mockReturnValue(mockPayload as never);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'integration-test-token',
        'integration-secret',
      );
      expect(mockRequest.user).toEqual({
        id: 'integration-user-123',
        email: 'integration@test.com',
      });
    });

    it('should handle consecutive authentication attempts', () => {
      const mockPayload1 = {
        id: 'user-1',
        email: 'user1@test.com',
      };
      const mockPayload2 = {
        id: 'user-2',
        email: 'user2@test.com',
      };

      const mockRequest1 = {
        headers: { authorization: 'Bearer token1' },
        user: undefined,
      };
      const mockRequest2 = {
        headers: { authorization: 'Bearer token2' },
        user: undefined,
      };

      const mockContext1 = createMockExecutionContext(mockRequest1);
      const mockContext2 = createMockExecutionContext(mockRequest2);

      mockConfigService.get.mockReturnValue('test-secret');

      mockJwtVerify.mockReturnValueOnce(mockPayload1 as never);
      guard.canActivate(mockContext1);
      expect(mockRequest1.user).toEqual({
        id: 'user-1',
        email: 'user1@test.com',
      });

      mockJwtVerify.mockReturnValueOnce(mockPayload2 as never);
      guard.canActivate(mockContext2);
      expect(mockRequest2.user).toEqual({
        id: 'user-2',
        email: 'user2@test.com',
      });

      // Ensure first request wasn't affected
      expect(mockRequest1.user).toEqual({
        id: 'user-1',
        email: 'user1@test.com',
      });
    });

    it('should properly clean up after failed authentication', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer failing-token',
        },
        user: undefined,
        someOtherProperty: 'should-remain',
      };

      const mockContext = createMockExecutionContext(mockRequest);

      mockConfigService.get.mockReturnValue('test-secret');
      mockJwtVerify.mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      expect(() => guard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.someOtherProperty).toBe('should-remain');
    });
  });
});

/**
 * Helper function to create mock ExecutionContext
 */
function createMockExecutionContext(mockRequest: any): ExecutionContext {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as unknown as ExecutionContext;
}
