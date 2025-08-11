import { Pool, PoolClient } from 'pg';
declare const pool: Pool;
export declare function checkDatabaseHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    version?: string;
    poolSize?: number;
    idleCount?: number;
    waitingCount?: number;
    error?: string;
}>;
export declare function initializeDatabase(): Promise<boolean>;
export declare function closeDatabaseConnection(): Promise<void>;
export declare function query(text: string, params?: any[]): Promise<any>;
export declare function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
export { pool };
//# sourceMappingURL=database.d.ts.map