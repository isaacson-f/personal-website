"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const database_1 = require("../config/database");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function runMigrations() {
    try {
        console.log('Starting database migrations...');
        // Initialize database connection
        await (0, database_1.initializeDatabase)();
        // Create migrations table if it doesn't exist
        await (0, database_1.query)(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Migrations table ready');
        // Get list of migration files
        const migrationsDir = path_1.default.join(__dirname, '../../migrations');
        const migrationFiles = fs_1.default.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        console.log(`Found ${migrationFiles.length} migration files`);
        // Check which migrations have already been executed
        const { rows: executedMigrations } = await (0, database_1.query)('SELECT filename FROM migrations ORDER BY filename');
        const executedFilenames = executedMigrations.map((row) => row.filename);
        // Execute pending migrations
        for (const filename of migrationFiles) {
            if (executedFilenames.includes(filename)) {
                console.log(`Skipping already executed migration: ${filename}`);
                continue;
            }
            console.log(`Executing migration: ${filename}`);
            const migrationPath = path_1.default.join(migrationsDir, filename);
            const migrationSQL = fs_1.default.readFileSync(migrationPath, 'utf8');
            // Execute the migration in a transaction
            await (0, database_1.query)('BEGIN');
            try {
                await (0, database_1.query)(migrationSQL);
                await (0, database_1.query)('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
                await (0, database_1.query)('COMMIT');
                console.log(`Successfully executed migration: ${filename}`);
            }
            catch (error) {
                await (0, database_1.query)('ROLLBACK');
                const message = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Failed to execute migration ${filename}: ${message}`);
            }
        }
        console.log('All migrations completed successfully');
    }
    catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
    finally {
        await (0, database_1.closeDatabaseConnection)();
    }
}
// Only run migrations if this file is executed directly
if (require.main === module) {
    runMigrations();
}
//# sourceMappingURL=migrate.js.map