/**
 * app.js
 * -----------------------------------------------------------------------
 * Express application setup.
 * Owns middleware wiring and route mounting ONLY.
 */

const path = require('path');
const express = require('express');

const { traceIdMiddleware } = require('./utils/traceId');
const errorHandler = require('./api/middlewares/errorHandler');

const healthRoutes = require('./api/routes/health.routes');
const authRoutes = require('./api/routes/auth.routes');
const complaintRoutes = require('./api/routes/complaint.routes');
const officerRoutes = require('./api/routes/officer.routes');
const assignmentRuleRoutes = require('./api/routes/assignmentRule.routes');
const citizenRoutes = require('./api/routes/citizen.routes');
const citizenAuthRoutes = require('./api/routes/citizen-auth.routes');
const analyticsRoutes = require('./api/routes/analytics.routes');
const adminRoutes = require('./api/routes/admin.routes');
const officerPortalRoutes = require('./api/routes/officer-portal.routes');
const whatsappRoutes = require('./channels/whatsapp/whatsapp.routes');

const authMiddleware = require('./api/middlewares/auth.middleware');
const { initNotificationService } = require('./notifications/notificationService');
const AppError = require('./utils/AppError');

function createApp() {
  const app = express();

  // Initialize background notification event listeners
  initNotificationService();

  // -----------------------------------------------------------------------
  // Core middleware
  // -----------------------------------------------------------------------

  app.use(traceIdMiddleware);

  // WhatsApp webhook needs raw body for HMAC signature verification (PUBLIC)
  app.use(
    '/api/webhooks/whatsapp',
    express.raw({ type: 'application/json' }),
    whatsappRoutes
  );

  app.use('/api/media', authMiddleware, require('./api/routes/media.routes'));
  app.use('/uploads', authMiddleware, require('./api/routes/media.routes'));

  app.use(express.json());

  // -----------------------------------------------------------------------
  // Static frontend assets
  // -----------------------------------------------------------------------

  app.get('/login', (req, res) => res.redirect('/index.html?openLogin=true'));
  app.get('/login.html', (req, res) => res.redirect('/index.html?openLogin=true'));
  app.get('/officer-login.html', (req, res) => res.redirect('/index.html?openLogin=true'));
  app.get('/citizen-login.html', (req, res) => res.redirect('/index.html?openLogin=true'));
  app.get('/admin/login', (req, res) => res.redirect('/index.html?openLogin=true'));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // -----------------------------------------------------------------------
  // Routes
  // -----------------------------------------------------------------------

  // Health check (PUBLIC)
  app.use('/api/health', healthRoutes);

  // Public Citizen status lookup (PUBLIC - rate limited by phone)
  app.use('/api/citizen', citizenRoutes);
  app.use('/api/citizen', citizenAuthRoutes);

  // Authentication (PUBLIC login/register)
  app.use('/api/auth', authRoutes);

  // Protected Complaints routes
  app.use('/api/complaints', authMiddleware, complaintRoutes);

  // Protected Officers routes (admin-only via RBAC inside router)
  app.use('/api/officers', officerRoutes);

  // Protected Assignment Rules routes (admin-only via RBAC inside router)
  app.use('/api/assignment-rules', assignmentRuleRoutes);

  // Admin analytics (protected)
  app.use('/api/admin/analytics', authMiddleware, analyticsRoutes);

  // Protected Admin Management routes
  app.use('/api/admin', adminRoutes);

  // Officer Portal routes
  app.use('/api/officer', officerPortalRoutes);

  // -----------------------------------------------------------------------
  // 404 Handler
  // -----------------------------------------------------------------------

  app.use((req, res, next) => {
    next(
      new AppError(
        'NOT_FOUND',
        404,
        `Route ${req.method} ${req.originalUrl} not found`
      )
    );
  });

  // -----------------------------------------------------------------------
  // Centralized Error Handler
  // -----------------------------------------------------------------------

  app.use(errorHandler);

  return app;
}

module.exports = createApp;