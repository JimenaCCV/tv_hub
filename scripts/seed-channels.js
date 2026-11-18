#!/usr/bin/env node
// Carga de canales de TV Hub en MongoDB (Atlas o local) — Práctica Integradora 3.
//
// - Reutiliza el modelo Channel y el parser M3U del proyecto (compilados en dist/
//   con `npm run build`) y las playlists versionadas en docs/*_playlist.m3u.
// - Lee la cadena de conexión SOLO de la variable de entorno MONGODB_URI; nunca la imprime.
// - Es idempotente: upsert por la misma identidad que usa import-m3u
//   (country + tvgId, o country + streamUrl si el canal no tiene tvgId).
//   Correrlo dos veces no duplica canales. No borra canales ni favoritos.
//
// Uso:  npm run build && npm run seed
'use strict';

const { readFile, readdir } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..');
const MODEL = path.join(ROOT, 'dist', 'models', 'channel.model.js');
const PARSER = path.join(ROOT, 'dist', 'utils', 'm3u-parser.js');
const PLAYLISTS = path.join(ROOT, 'docs');

// Mismo mapeo de países que src/scripts/import-all-m3u.ts.
const countriesByPlaylist = {
  argentina: 'Argentina',
  canada: 'Canada',
  japon: 'Japan',
  mexico: 'Mexico',
  usa: 'United States'
};

function fail(message) {
  console.error(`[seed] ERROR: ${message}`);
  process.exit(1);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    fail('Falta la variable de entorno MONGODB_URI. Expórtala en tu terminal (no la escribas en el repositorio) y vuelve a correr `npm run seed`.');
  }
  if (!existsSync(MODEL) || !existsSync(PARSER)) {
    fail('No existe dist/. Corre primero `npm run build` para compilar el modelo Channel y el parser M3U.');
  }

  const { Channel } = require(MODEL);
  const { parseM3u } = require(PARSER);

  const files = (await readdir(PLAYLISTS)).filter((file) => file.endsWith('_playlist.m3u')).sort();
  if (files.length === 0) fail('No se encontraron playlists docs/*_playlist.m3u.');

  const started = process.hrtime.bigint();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[seed] Conectado a la base "${mongoose.connection.name}" (host ${mongoose.connection.host}).`);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let processed = 0;

  for (const file of files) {
    const key = file.replace('_playlist.m3u', '');
    const country = countriesByPlaylist[key];
    if (!country) fail(`No hay país configurado para ${file}.`);

    const channels = parseM3u(await readFile(path.join(PLAYLISTS, file), 'utf8'), country);
    const operations = channels.map((channel) => ({
      updateOne: {
        filter: channel.tvgId
          ? { country: channel.country, tvgId: channel.tvgId }
          : { country: channel.country, streamUrl: channel.streamUrl },
        update: { $set: channel },
        upsert: true
      }
    }));

    // ordered: true -> si una playlist repite un canal, el segundo upsert encuentra al primero.
    const result = operations.length ? await Channel.bulkWrite(operations, { ordered: true }) : null;
    const fileInserted = result ? result.upsertedCount : 0;
    const fileUpdated = result ? result.modifiedCount : 0;
    const fileUnchanged = result ? result.matchedCount - result.modifiedCount : 0;
    inserted += fileInserted;
    updated += fileUpdated;
    unchanged += fileUnchanged;
    processed += channels.length;
    console.log(`[seed] ${file} (${country}): ${channels.length} leídos, ${fileInserted} insertados, ${fileUpdated} actualizados, ${fileUnchanged} sin cambios.`);
  }

  const total = await Channel.countDocuments();
  const active = await Channel.countDocuments({ isActive: true });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;

  console.log('[seed] ---------------- Resumen ----------------');
  console.log(`[seed] Playlists: ${files.length} | Canales procesados: ${processed}`);
  console.log(`[seed] Insertados: ${inserted} | Actualizados: ${updated} | Sin cambios: ${unchanged}`);
  console.log(`[seed] Total en la colección "${Channel.collection.name}": ${total} (activos: ${active})`);
  console.log(`[seed] Tiempo: ${seconds.toFixed(2)} s`);
}

main()
  .catch((error) => {
    // Solo el mensaje: nunca se imprime la cadena de conexión.
    console.error(`[seed] ERROR: ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
