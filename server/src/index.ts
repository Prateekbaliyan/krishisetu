import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Production Security Validation: fail fast if JWT_SECRET is missing or insecure
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'krishisetu-dev-secret-key-32-chars-long') {
    console.error('FATAL: JWT_SECRET environment variable is missing, insecure, or using dev fallback in production mode.');
    process.exit(1);
  }
}

import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import farmerRoutes from './routes/farmer.routes';
import centreRoutes from './routes/centre.routes';
import priceRoutes from './routes/price.routes';
import purchaseRoutes from './routes/purchase.routes';
import syncRoutes from './routes/sync.routes';
import paymentRoutes from './routes/payment.routes';
import stockRoutes from './routes/stock.routes';
import auditRoutes from './routes/audit.routes';
import { authenticateToken } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static route for uploaded scale and moisture photos (protected with authentication)
const uploadDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', authenticateToken, express.static(uploadDir));

// Production health check endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'KrishiSetu API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/audit', auditRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start listening if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🌾 KrishiSetu Backend running on port ${PORT}`);
    console.log(`🌾 Health check available at http://localhost:${PORT}/api/health`);
  });
}

export default app;
