# Sesión 14 · TV Hub V5 · Gestión y almacenamiento de archivos

Rama: `tv-hub-v5` (base: `upstream/tv-hub-v5-base`). Commits: sección 1 (TODO 1-6) y secciones 2-4 (TODO 7-16).

## Sección 1 · Una evidencia (TODO 1-6)
- **TODO 1** (`report.routes.ts`): `upload.single('evidence')` para que Multer procese la imagen antes del Controller y la deje en `request.file`.
- **TODO 2** (`report.controller.ts`): `file.filename` para armar `/uploads/reports/<uuid>.png`.
- **TODO 3**: `Report.create({...})` guarda el reporte con estado `OPEN` y la referencia a la imagen.
- **TODO 4-5** (`reports.js`): `formData.append('evidence', ...)` y `body: formData` (sin `Content-Type` manual, el navegador genera el boundary).
- **TODO 6**: `Report.find({ userId })` con `.populate` y `.sort('-createdAt')`, para que cada usuario vea solo sus reportes.
- 📸 *Screenshots a tomar:* mensaje "Report saved.", archivo en `uploads/reports`, documento en MongoDB con la URL, lista de Reports con "View evidence image".

## Sección 2 · Varias imágenes (TODO 7-10)
- Route: `upload.array('evidence', 5)`. Model: `evidenceUrl` pasa a `evidenceUrls: [String]`.
- Controller: `request.files` se convierte en un arreglo de URLs. Si la validación falla, se borran los archivos ya subidos para no dejar basura.
- Frontend: el input es `multiple` y un `for` agrega cada archivo con el mismo nombre `evidence`; la lista muestra un enlace por imagen.
- 📸 *Screenshot:* un Report con 2 o más evidencias.

## Sección 3 · Modificar (TODO 11-13)
- `PATCH /api/reports/:id` con `findOneAndUpdate({ _id, userId }, cambios, { new: true, runValidators: true })`. Solo cambia `reason`, `description` y `status`; valida cada campo y responde 404 si el reporte es de otro usuario.
- El enum de `status` del Model se amplió a `OPEN`, `IN_PROGRESS` y `RESOLVED`, porque el starter solo permitía `OPEN` y el PATCH no habría podido cambiarlo.
- La vista tiene botón **Edit** (formulario en línea) que envía el PATCH con JSON.
- 📸 *Screenshot:* un Report modificado (el mismo documento, sin duplicarse).

## Sección 4 · Borrar (TODO 14-16)
- `DELETE /api/reports/:id` con `findOneAndDelete({ _id, userId })`, respuesta 204.
- Además de borrar el documento, se eliminan los archivos de `uploads/reports` (el reto adicional del enunciado), usando `path.basename` para no salir de esa carpeta.
- La vista tiene botón **Delete** con `confirm()`.
- 📸 *Screenshot:* la lista sin el Report y la carpeta `uploads/reports` vacía.

## Qué guarda MongoDB y qué guarda el storage local
MongoDB guarda solo la metadata del Report (usuario, canal, motivo, descripción, estado, fechas) y las referencias a las imágenes como rutas (`evidenceUrls`), no los bytes. El storage local (`uploads/reports`) guarda los archivos físicos con nombre UUID, que Express expone por la ruta estática `/uploads`. Así la base de datos se mantiene ligera y la URL guardada permite recuperar la imagen. Como son dos sistemas distintos, al borrar un Report hay que borrar también los archivos manualmente.

## Validación realizada
- `npx jest tests/reports.test.ts`: 8 pruebas pasan (crear, listar, imagen servida, varias imágenes, rechazo de `.txt` y de más de 2 MB, PATCH solo del dueño, DELETE solo del dueño y limpieza de archivos).
- Prueba manual contra MongoDB real: POST con 2 imágenes, PATCH, consulta del documento en MongoDB y DELETE (204), con `uploads/reports` vacío al final.
- Nota: `tests/channels.test.ts` falla con 501 en `GET /api/channels/:id`; son TODOs de una sesión anterior que ya venían sin resolver en la base y no forman parte de esta actividad.

## Sección 5 · Evidencias de validación

Pruebas hechas en el navegador contra la app local (`http://localhost:3100/reports.html`) con MongoDB en Docker (`tvhub-mongo`). Las capturas están en `capturas/`.

### 1. Report guardado
![Report saved](capturas/01-report-guardado.png)

Al enviar el formulario (motivo, descripción e imagen) con `FormData`, la página muestra **"Report saved."** debajo del botón *Submit report*. Esto confirma que el `POST /api/reports` respondió con éxito y que el formulario se reinició.

### 2. Archivo guardado en `uploads/reports`
![ls uploads/reports](capturas/02-uploads-reports.png)

`ls -la uploads/reports` muestra el archivo `d379d3be-f0ad-4f2d-92d9-f54c3e62b330.png` (80,346 bytes). Multer lo guardó con un nombre UUID, así que no choca con otros archivos. `.gitkeep` solo mantiene la carpeta en Git.

### 3. Documento en MongoDB con `evidenceUrls`
![db.reports.find()](capturas/03-mongodb-evidenceurls.png)

`db.reports.find().pretty()` devuelve dos documentos del mismo `userId` y `channelId`:
- El primero (`STREAM_DOES_NOT_LOAD`) se creó sin imagen, por eso `evidenceUrls: []`. La imagen es opcional.
- El segundo (`WRONG_CHANNEL`) guarda `evidenceUrls: [ '/uploads/reports/d379d3be-f0ad-4f2d-92d9-f54c3e62b330.png' ]`, la misma ruta del archivo del punto 2. Mongo guarda solo la referencia; el archivo vive en disco.
- Ambos tienen `status: 'OPEN'` y `createdAt` / `updatedAt` generados por `timestamps`.

### 5. Varias evidencias
![Reporte con 3 imágenes](capturas/05-varias-evidencias.png)

Un reporte con 3 imágenes (`upload.array('evidence', 5)`) muestra un enlace por archivo: **View evidence image 1, 2 y 3**. La lista indica 4 reportes en total.

### 6. Reporte modificado
![Reporte editado](capturas/06-modificado.png)

Con *Edit* y *Save* (`PATCH /api/reports/:id`), la descripción pasó de `aaa` a **"Comentario actualizado"**. Es el mismo reporte (misma fecha de creación, 3:41:52 p. m.) y conserva sus 3 evidencias.

### 7. Reporte eliminado
![Lista vacía](capturas/07-eliminado.png)

Tras *Delete* (`DELETE /api/reports/:id`, respuesta 204), la vista muestra **"0 reports"** y "You have not reported a channel yet.". El Controller también borra de `uploads/reports` los archivos del reporte.

## Conclusión

En esta actividad logré que TV Hub permitiera crear Reports, adjuntar una o varias imágenes como evidencia, consultarlos, modificarlos y eliminarlos.
MongoDB guarda la información del Report y la ruta de las evidencias, mientras que `uploads/reports` almacena físicamente las imágenes. Se mantienen separados para que la base de datos maneje la información y el almacenamiento se encargue de los archivos.
Lo que más aprendí fue cómo funciona el envío de archivos con `FormData` y cómo Multer recibe y almacena las imágenes para después relacionarlas con MongoDB.
