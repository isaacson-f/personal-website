import { query, initializeDatabase, closeDatabaseConnection } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigrations(): Promise<void> {
  try {
    console.log('Starting database migrations...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Migrations table ready');
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    // Check which migrations have already been executed
    const { rows: executedMigrations } = await query(
      'SELECT filename FROM migrations ORDER BY filename'
    );
    const executedFilenames = executedMigrations.map((row: any) => row.filename);
    
    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (executedFilenames.includes(filename)) {
        console.log(`Skipping already executed migration: ${filename}`);
        continue;
      }
      
      console.log(`Executing migration: ${filename}`);
      
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the migration in a transaction
      await query('BEGIN');
      try {
        await query(migrationSQL);
        await query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
        await query('COMMIT');
        console.log(`Successfully executed migration: ${filename}`);
      } catch (error) {
        await query('ROLLBACK');
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to execute migration ${filename}: ${message}`);
      }
    }
    
    console.log('All migrations completed successfully');
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

// Only run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };