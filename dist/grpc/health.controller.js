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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
var ServingStatus;
(function (ServingStatus) {
    ServingStatus[ServingStatus["UNKNOWN"] = 0] = "UNKNOWN";
    ServingStatus[ServingStatus["SERVING"] = 1] = "SERVING";
    ServingStatus[ServingStatus["NOT_SERVING"] = 2] = "NOT_SERVING";
    ServingStatus[ServingStatus["SERVICE_UNKNOWN"] = 3] = "SERVICE_UNKNOWN";
})(ServingStatus || (ServingStatus = {}));
let HealthController = class HealthController {
    constructor() {
        this.serviceStatus = new Map();
        this.serviceStatus.set('', ServingStatus.SERVING);
        this.serviceStatus.set('btd.payment.Payment', ServingStatus.SERVING);
    }
    check(data) {
        const service = data.service || '';
        const status = this.serviceStatus.get(service);
        if (status === undefined) {
            return { status: ServingStatus.SERVICE_UNKNOWN };
        }
        return { status };
    }
    watch(data$) {
        const subject = new rxjs_1.Subject();
        const onNext = (request) => {
            const service = request.service || '';
            const status = this.serviceStatus.get(service);
            if (status === undefined) {
                subject.next({ status: ServingStatus.SERVICE_UNKNOWN });
            }
            else {
                subject.next({ status });
            }
        };
        const onComplete = () => subject.complete();
        data$.subscribe({
            next: onNext,
            complete: onComplete,
        });
        return subject.asObservable();
    }
    setServiceStatus(service, status) {
        this.serviceStatus.set(service, status);
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, microservices_1.GrpcMethod)('Health', 'Check'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], HealthController.prototype, "check", null);
__decorate([
    (0, microservices_1.GrpcStreamMethod)('Health', 'Watch'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [rxjs_1.Observable]),
    __metadata("design:returntype", rxjs_1.Observable)
], HealthController.prototype, "watch", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [])
], HealthController);
//# sourceMappingURL=health.controller.js.map