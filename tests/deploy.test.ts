import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { Channel } from '../src/models/channel.model.js';

// Pruebas mínimas de la Práctica Integradora 3 (CI/CD). Usan MongoDB en memoria:
// nunca se conectan a Atlas ni necesitan secretos en GitHub Actions.
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Channel.create({
    name: 'Canal CI',
    logoUrl: 'https://example.com/ci.png',
    streamUrl: 'https://example.com/ci.m3u8',
    country: 'Mexico',
    categories: ['News']
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('GET /api/channels responde 200 con JSON y un arreglo de canales', async () => {
  const response = await request(app).get('/api/channels').expect('Content-Type', /json/).expect(200);

  expect(Array.isArray(response.body.channels)).toBe(true);
  expect(response.body.channels[0]).toEqual(
    expect.objectContaining({ name: 'Canal CI', country: 'Mexico', streamUrl: expect.any(String) })
  );
});

test('una ruta inexistente responde 404 con el error JSON del proyecto', async () => {
  await request(app)
    .get('/api/ruta-que-no-existe')
    .expect('Content-Type', /json/)
    .expect(404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

test('GET /health responde 200 para el monitoreo de Render', async () => {
  await request(app).get('/health').expect(200, { status: 'ok' });
});

test('en producción la configuración falla si falta MONGODB_URI', () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  delete process.env.MONGO_URI;
  try {
    jest.isolateModules(() => {
      expect(() => require('../src/config/env.js')).toThrow('Missing required environment variable: MONGODB_URI');
    });
  } finally {
    process.env = saved;
  }
});
