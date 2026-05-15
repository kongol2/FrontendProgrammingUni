const fs = require('fs').promises;
const http = require('http');
const path = require('path');
const { URL } = require('url');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// WebSocket notification emitter
const notificationEmitter = new EventEmitter();
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'pharmacy-data.json');

// In-memory storage for new users (to demonstrate WebSocket)
const memoryUsers = [];

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
};

const sendJson = (response, statusCode, payload) => {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(payload));
};

const readStore = async () => {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(content);
};

const writeStore = async (store) => {
    await fs.writeFile(DATA_FILE, `${JSON.stringify(store, null, 4)}\n`);
};

const collectBody = (request) => new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => {
        chunks.push(chunk);
    });

    request.on('end', () => {
        const text = Buffer.concat(chunks).toString();

        if (!text) {
            resolve({});
            return;
        }

        try {
            resolve(JSON.parse(text));
        } catch (error) {
            reject(error);
        }
    });

    request.on('error', reject);
});

const buildSummary = (store) => {
    const totalStock = store.medicines.reduce((sum, medicine) => sum + medicine.stock, 0);
    const lowStock = store.medicines.filter((medicine) => medicine.stock > 0 && medicine.stock < 10);
    const unavailable = store.medicines.filter((medicine) => medicine.stock === 0);
    const urgentDemands = store.demands.filter((demand) => demand.priority === 'Urgent');

    return {
        totalMedicines: store.medicines.length,
        totalStock,
        lowStockCount: lowStock.length,
        unavailableCount: unavailable.length,
        activeUsers: store.users.length,
        activeDemands: store.demands.length,
        urgentDemands: urgentDemands.length,
        announcements: store.announcements,
    };
};

const handleApi = async (request, response, pathname) => {
    const store = await readStore();

    if (request.method === 'GET' && pathname === '/api/summary') {
        sendJson(response, 200, buildSummary(store));
        return;
    }

    if (request.method === 'GET' && pathname === '/api/medicines') {
        sendJson(response, 200, store.medicines);
        return;
    }

    if (request.method === 'GET' && pathname === '/api/users') {
        const allUsers = [...store.users, ...memoryUsers];
        sendJson(response, 200, allUsers);
        return;
    }

    if (request.method === 'GET' && pathname === '/api/demands') {
        sendJson(response, 200, store.demands);
        return;
    }

    if (request.method === 'GET' && pathname === '/api/test') {
        // Broadcast WebSocket test message to all connected clients
        notificationEmitter.emit('test', {
            type: 'test-message',
            message: 'WebSocket is working! Check other browser tabs.',
            timestamp: new Date().toISOString(),
        });

        sendJson(response, 200, { message: 'Test message broadcasted to all connected clients' });
        return;
    }

    if (request.method === 'POST' && pathname === '/api/demands') {
        const body = await collectBody(request);
        const medicineName = String(body.medicineName || '').trim();
        const quantity = Number(body.quantity || 1);

        if (!medicineName || Number.isNaN(quantity) || quantity < 1) {
            sendJson(response, 400, { message: 'Medicine name and positive quantity are required.' });
            return;
        }

        const demand = {
            id: store.demands.reduce((max, item) => Math.max(max, item.id), 0) + 1,
            medicineName,
            requestedBy: String(body.requestedBy || 'SPA dashboard'),
            quantity,
            priority: String(body.priority || 'Medium'),
            status: 'Queued',
            createdAt: new Date().toISOString().slice(0, 10),
        };

        store.demands.push(demand);
        await writeStore(store);

        // Broadcast notification to all connected WebSocket clients
        notificationEmitter.emit('demand', {
            type: 'new-demand',
            data: demand,
            summary: buildSummary(store),
        });

        sendJson(response, 201, demand);
        return;
    }

    if (request.method === 'POST' && pathname === '/api/users') {
        const body = await collectBody(request);
        const name = String(body.name || '').trim();
        const role = String(body.role || '').trim();
        const department = String(body.department || '').trim();
        const shift = String(body.shift || '').trim();
        const email = String(body.email || '').trim();

        if (!name || !role || !department || !shift || !email) {
            sendJson(response, 400, { message: 'Name, role, department, shift, and email are required.' });
            return;
        }

        const allExisting = [...store.users, ...memoryUsers];
        const user = {
            id: allExisting.reduce((max, item) => Math.max(max, item.id), 0) + 1,
            name,
            role,
            department,
            shift,
            email,
            completedOrders: 0,
        };

        // Save to memory (in-memory storage for demo)
        memoryUsers.push(user);

        // Broadcast notification to all connected WebSocket clients
        notificationEmitter.emit('user', {
            type: 'new-user',
            data: user,
            summary: buildSummary(store),
        });

        sendJson(response, 201, user);
        return;
    }

    sendJson(response, 404, { message: 'API endpoint not found.' });
};

const sendStatic = async (response, pathname) => {
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(ROOT_DIR, requestedPath));

    if (!filePath.startsWith(ROOT_DIR)) {
        response.writeHead(403);
        response.end();
        return;
    }

    try {
        const file = await fs.readFile(filePath);
        const extension = path.extname(filePath);

        response.writeHead(200, {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
        });
        response.end(file);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            sendJson(response, 500, { message: 'Static file error.' });
            return;
        }

        response.writeHead(404, {
            'Content-Type': 'text/html; charset=utf-8',
        });
        response.end(await fs.readFile(path.join(ROOT_DIR, 'index.html'), 'utf8'));
    }
};

const server = http.createServer(async (request, response) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    try {
        if (pathname.startsWith('/api/')) {
            await handleApi(request, response, pathname);
            return;
        }

        await sendStatic(response, pathname);
    } catch (error) {
        sendJson(response, 500, { message: error.message || 'Server error.' });
    }
});

// WebSocket server for real-time notifications
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    // Send initial notification that client is connected
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to pharmacy notification service',
    }));

    // Handle incoming messages from client
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            // Ignore malformed messages
        }
    });

    ws.on('close', () => {
        // Client disconnected
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Emit notifications to all connected WebSocket clients
notificationEmitter.on('demand', (notification) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(notification));
        }
    });
});

notificationEmitter.on('user', (notification) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(notification));
        }
    });
});

notificationEmitter.on('test', (notification) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(notification));
        }
    });
});

server.on('error', () => {
    process.exitCode = 1;
});

server.listen(PORT, HOST);
