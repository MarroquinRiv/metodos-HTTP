const express = require('express');

//crear un servidor basico con express que escuche en el puerto 3000
const app = express();
app.use(express.json());

// Middleware para permitir solo peticiones desde 127.0.0.1 o desde un puerto específico
// Si la petición viene de otra IP, responde con error 403 Forbidden
const permitirSoloLocalhostOPuerto = (req, res, next) => {
    // Obtener la IP remota (puede venir como ::1 en IPv6 para localhost)
    const ip = req.ip || req.connection.remoteAddress;
    // Obtener el puerto remoto
    const remotePort = req.connection.remotePort;
    // Permitir solo si la IP es localhost o el puerto es 3001
    if (ip === '127.0.0.1' || ip === '::1' || remotePort === 3001) {
        return next();
    }
    return res.status(403).json({ error: 'Acceso solo permitido desde 127.0.0.1 o puerto 3001' });
};

// Usar el middleware antes de las rutas protegidas
app.use(permitirSoloLocalhostOPuerto);

// Middleware para validar la existencia y validez de x-api-key en los headers
// Si la clave no está o es incorrecta, devuelve un error JSON
const validarApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const CLAVE_CORRECTA = '12345'; // Cambiar la clave según necesidad
    if (!apiKey) {
        return res.status(401).json({ error: 'Falta la clave x-api-key en los headers' });
    }
    if (apiKey !== CLAVE_CORRECTA) {
        return res.status(403).json({ error: 'Clave x-api-key incorrecta' });
    }
    next();
};

// Usar el middleware de validación de API Key en todas las rutas
app.use(validarApiKey);

// crear un array de tareas de ejemplo:
const tareas = [
    { id: 1, titulo: 'Tarea 1', completada: false },
    { id: 2, titulo: 'Tarea 2', completada: true },
    { id: 3, titulo: 'Tarea 3', completada: false },
    //Tareas completadas
    { id: 4, titulo: 'Tarea 4', completada: true },
    { id: 5, titulo: 'Tarea 5', completada: true }
];

// Variable para el próximo id disponible
let nextId = Math.max(...tareas.map(t => t.id), 0) + 1;

app.get('/', (req, res) => {
    res.send('Esta es la API de tareas');
});

// crear una ruta GET para /tareas que retorne el array de tareas en formato json
app.get('/tareas', (req, res) => {
    res.json(tareas);
});

//Crear el middleware que valide que el id sea numerico y existente, si no retorna un error 404 en formato JSON
const validarId = (req, res, next) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
        return res.status(404).json({ error: 'ID no válido' });
    }
    const tarea = tareas.find(t => t.id === parseInt(id));
    if (!tarea) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    next();
};

//Crear middleware logger que imprima metodo, URL y fecha/hora
// Ejemplo: POST /tareas - 2025-08-29 21:15:33
const logger = (req, res, next) => {
    const { method, url } = req;
    const now = new Date();
    // Formatear fecha/hora como YYYY-MM-DD HH:mm:ss
    const fechaHora = now.toISOString().replace('T', ' ').substring(0, 19);
    console.log(`${method} ${url} - ${fechaHora}`);
    next();
};

app.use(logger);

// Middleware para limitar a 5 peticiones por minuto desde la misma IP
// Si se excede, devuelve { "error": "Demasiadas peticiones, intente más tarde" }
const rateLimitMap = new Map();

const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = 5;

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }
    const timestamps = rateLimitMap.get(ip);

    // Eliminar timestamps fuera de la ventana de 1 minuto
    while (timestamps.length && (now - timestamps[0]) > windowMs) {
        timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
        return res.status(429).json({ error: 'Demasiadas peticiones, intente más tarde' });
    }

    timestamps.push(now);
    next();
};

// Usar el middleware de rate limiting en todas las rutas
app.use(rateLimiter);

//Crear ruta POST /tareas que reciba del body y agregue al arreglo
app.post('/tareas', (req, res) => {
    const nuevaTarea = req.body;
    // Validar que el título tenga al menos 5 caracteres
    if (!nuevaTarea.titulo || nuevaTarea.titulo.length < 5) {
        return res.status(400).json({ error: 'El titulo debe tener al menos 5 caracteres' });
    }
    // Convertir el título a minúsculas y eliminar espacios extras antes de guardar
    // Ejemplo: " Estudiar Node " -> "estudiar node"
    nuevaTarea.titulo = nuevaTarea.titulo.trim().toLowerCase().replace(/\s+/g, ' ');

    // Verificar si ya existe una tarea con el mismo título
    const existe = tareas.some(t => t.titulo === nuevaTarea.titulo);
    if (existe) {
        return res.status(409).json({ error: 'Ya existe una tarea con ese título' });
    }
    nuevaTarea.id = nextId++; // Asignar id único e incremental
    tareas.push(nuevaTarea);
    res.status(201).json(nuevaTarea);
});

// Eliminar todas las tareas completadas
app.delete('/tareas/completed', (req, res) => {
    const tareasCompletadas = tareas.filter(t => t.completada);
    const cantidadEliminadas = tareasCompletadas.length;
    // Mantener solo las tareas no completadas
    for (let i = tareas.length - 1; i >= 0; i--) {
        if (tareas[i].completada) {
            tareas.splice(i, 1);
        }
    }
    res.json({ eliminadas: cantidadEliminadas });
});

//Crear ruta PUT /tareas que actualice título y completada
app.put('/tareas/:id', validarId, (req, res) => {
    const { id } = req.params;
    const { titulo, completada } = req.body;
    const tarea = tareas.find(t => t.id === parseInt(id));
    if (!tarea) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    // Validar que el nuevo título no esté repetido (excepto en la misma tarea)
    if (titulo !== undefined && titulo !== tarea.titulo) {
        const existe = tareas.some(t => t.titulo === titulo);
        if (existe) {
            return res.status(409).json({ error: 'Ya existe una tarea con ese título' });
        }
        tarea.titulo = titulo;
    }
    if (completada !== undefined) tarea.completada = completada;
    res.json(tarea); // Responder con la tarea actualizada
});

//Crear ruta DELETE /tareas/:id que elimine una tarea por su id
app.delete('/tareas/:id', validarId, (req, res) => {
    const { id } = req.params;
    const index = tareas.findIndex(t => t.id === parseInt(id));
    if (index === -1) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    tareas.splice(index, 1);
    res.status(204).send(); // Responder con un 204 No Content
});

// Middleware para bloquear cualquier petición PATCH u OPTIONS
// Responde con { "error": "Método no permitido" }
app.use((req, res, next) => {
    if (req.method === 'PATCH' || req.method === 'OPTIONS') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    next();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

