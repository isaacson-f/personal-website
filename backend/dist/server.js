"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env['CORS_ORIGIN'] || '*',
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'] || 'development'
    });
});
// Import routes
const session_1 = __importDefault(require("./routes/session"));
const tracking_1 = __importDefault(require("./routes/tracking"));
// API routes
app.use('/api/session', session_1.default);
app.use('/api/track', tracking_1.default);
// Catch-all for unimplemented API routes
app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});
// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
    });
});
// 404 handler
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Only start the server if not in test mode
if (process.env['NODE_ENV'] !== 'test') {
    app.listen(PORT, () => {
        console.log(`Analytics API server running on port ${PORT}`);
        console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map