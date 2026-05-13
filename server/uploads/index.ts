import express from 'express';
import path from 'path';

export function setupUploads(app: express.Express) {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'client/public/uploads')));
}
