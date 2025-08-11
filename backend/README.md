# Website Analytics Backend (TypeScript)

A TypeScript-based backend API for website analytics tracking system.

## Features

- **TypeScript**: Full type safety and modern JavaScript features
- **Express.js**: Fast, unopinionated web framework
- **PostgreSQL**: Robust relational database with connection pooling
- **Redis**: High-performance caching and session storage
- **Joi**: Schema validation for request data
- **Jest**: Comprehensive testing framework
- **Rate Limiting**: Built-in protection against abuse
- **Security**: Helmet.js for security headers, CORS support

## Project Structure

```
backend/
├── src/                    # TypeScript source code
│   ├── config/            # Database and configuration
│   ├── models/            # Data models (Event, Session, Visitor, PageView)
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   ├── scripts/           # Utility scripts (migrations)
│   ├── tests/             # Test files
│   ├── types/             # TypeScript type definitions
│   └── server.ts          # Main application entry point
├── dist/                  # Compiled JavaScript (generated)
├── migrations/            # Database migration files
└── package.json           # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- Redis 6+ (optional, for caching)

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Set up environment variables:
```bash
cp .env.backend.example .env.backend
# Edit .env.backend with your database credentials
```

3. Run database migrations:
```bash
npm run migrate
```

4. Build the TypeScript code:
```bash
npm run build
```

### Development

Start the development server with hot reloading:
```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

### Production

Build and start the production server:
```bash
npm run build
npm start
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reloading
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run migrate` - Run database migrations
- `npm run type-check` - Check TypeScript types without building

## API Endpoints

### Session Management
- `POST /api/session/start` - Initialize a new session
- `PUT /api/session/update` - Update session data
- `POST /api/session/end` - End a session
- `GET /api/session/:id` - Get session details

### Event Tracking
- `POST /api/track/event` - Track custom events
- `POST /api/track/page` - Track page views
- `POST /api/track/batch` - Track multiple events in batch

### Health Check
- `GET /health` - Server health status

## Data Models

### Event
Tracks user interactions and page views:
- `id` - Unique event identifier
- `session_id` - Associated session
- `event_type` - Type of event (page_view, click, etc.)
- `url` - Page URL
- `properties` - Additional event data
- `timestamp` - When the event occurred

### Session
Tracks user sessions:
- `id` - Unique session identifier
- `visitor_id` - Associated visitor
- `start_time` / `end_time` - Session duration
- `page_views` - Number of pages viewed
- `device_info` - Browser and device information
- `geographic_data` - Location information

### Visitor
Tracks unique visitors:
- `id` - Unique visitor identifier
- `first_visit` / `last_visit` - Visit timestamps
- `total_sessions` - Number of sessions
- `total_page_views` - Total pages viewed

### PageView
Detailed page view tracking:
- `id` - Unique page view identifier
- `session_id` - Associated session
- `url` - Page URL
- `title` - Page title
- `load_time` - Page load time
- `scroll_depth` - How far user scrolled
- `time_on_page` - Time spent on page

## Services

### EventValidationService
Validates and sanitizes incoming event data to prevent XSS and injection attacks.

### GeolocationService
Resolves IP addresses to geographic locations using ip-api.com with caching and rate limiting.

### UserAgentParsingService
Parses user agent strings to extract browser, OS, and device information.

## Testing

Run the test suite:
```bash
npm test
```

Tests are organized by feature:
- Model tests in `src/tests/models/`
- Route tests in `src/tests/routes/`
- Service tests in `src/tests/services/`
- Integration tests in `src/tests/integration/`

## Database Migrations

Database schema changes are managed through migration files in the `migrations/` directory.

Create a new migration:
1. Create a new `.sql` file in `migrations/` with format `XXX_description.sql`
2. Run `npm run migrate` to apply pending migrations

## Environment Variables

Key environment variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=analytics_db
DB_USER=analytics_user
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Security Features

- **Input Validation**: All inputs validated with Joi schemas
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Input sanitization
- **Rate Limiting**: Configurable request limits
- **CORS**: Cross-origin request handling
- **Security Headers**: Helmet.js integration

## Performance Optimizations

- **Connection Pooling**: PostgreSQL connection pool
- **Caching**: In-memory caching for geolocation data
- **Batch Processing**: Support for batch event insertion
- **Indexes**: Database indexes on frequently queried columns

## Monitoring and Logging

- Health check endpoint for monitoring
- Structured logging for debugging
- Error handling with appropriate HTTP status codes
- Database query performance logging in development

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update type definitions as needed
4. Run `npm run type-check` before committing
5. Ensure all tests pass with `npm test`