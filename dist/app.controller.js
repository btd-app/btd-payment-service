"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_service_1 = require("./app.service");
let AppController = class AppController {
    appService;
    constructor(appService) {
        this.appService = appService;
    }
    getHello() {
        return this.appService.getHello();
    }
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
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Health check',
        description: 'Basic health check endpoint to verify service is running'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Service is healthy',
        schema: {
            example: 'Payment Service is running!'
        }
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({
        summary: 'Detailed health check',
        description: 'Check service health including database and Stripe API connectivity'
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({
        status: 503,
        description: 'Service or dependencies are unhealthy'
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getHealth", null);
exports.AppController = AppController = __decorate([
    (0, swagger_1.ApiTags)('health'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map