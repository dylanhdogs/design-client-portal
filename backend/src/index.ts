import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import consultationRoutes from './routes/consultations';
import documentRoutes from './routes/documents';
import communicationRoutes from './routes/communications';
import poolProjectRoutes from './routes/poolProject';
import myProjectRoutes from './routes/myProject';
import phaseRoutes from './routes/phases';
import poolNotesRoutes from './routes/poolNotes';
import clientUserRoutes from './routes/clientUsers';
import notificationRoutes from './routes/notifications';
import fileRoutes from './routes/files';
import { errorHandler } from './utils/errors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(cors());
app.use(express.json());

app.use('/api/files', fileRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/clients/:clientId/consultations', consultationRoutes);
app.use('/api/clients/:clientId/documents', documentRoutes);
app.use('/api/clients/:clientId/communications', communicationRoutes);
app.use('/api/clients/:clientId/project', poolProjectRoutes);
app.use('/api/clients/:clientId/project/phases', phaseRoutes);
app.use('/api/clients/:clientId/project/notes', poolNotesRoutes);
app.use('/api/clients/:clientId', clientUserRoutes);
app.use('/api/my-project', myProjectRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), '..', 'frontend', 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), '..', 'frontend', 'dist', 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
