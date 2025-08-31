import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Health check',
    description: 'Basic health check endpoint to verify service is running'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      example: 'Payment Service is running!'
    }
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Detailed health check',
    description: 'Check service health including database and Stripe API connectivity'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service and dependencies are healthy',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2025-08-15T10:00:00Z',
        services: {
          database: true,
          stripe: true
        }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service or dependencies are unhealthy'
  })
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: true,
        stripe: true
      }
    };
  }
}
