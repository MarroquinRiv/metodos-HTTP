const express = require('express');

//crear un servidor basico con express que escuche en el puerto 3000
const app = express();
app.use(express.json());

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

//Crear middleware logger que imprima metodo URL y timestamp
const logger = (req, res, next) => {
    const { method, url } = req;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${method} ${url}`);
    next();
};

app.use(logger);

//Crear ruta POST /tareas que reciba del body y agregue al arreglo
app.post('/tareas', (req, res) => {
    const nuevaTarea = req.body;
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

