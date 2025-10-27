import { Observable } from 'rxjs';
declare enum ServingStatus {
    UNKNOWN = 0,
    SERVING = 1,
    NOT_SERVING = 2,
    SERVICE_UNKNOWN = 3
}
interface HealthCheckRequest {
    service: string;
}
interface HealthCheckResponse {
    status: ServingStatus;
}
export declare class HealthController {
    private readonly serviceStatus;
    constructor();
    check(data: HealthCheckRequest): HealthCheckResponse;
    watch(data$: Observable<HealthCheckRequest>): Observable<HealthCheckResponse>;
    setServiceStatus(service: string, status: ServingStatus): void;
}
export {};
