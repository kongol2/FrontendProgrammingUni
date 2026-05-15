const api = {
    summary: '/api/summary',
    medicines: '/api/medicines',
    users: '/api/users',
    demands: '/api/demands',
};

const staticDataPath = 'data/pharmacy-data.json';
let useApiEndpoints = true;
let wsClient = null;

const state = {
    activeView: 'overview',
    search: '',
    summary: null,
    medicines: [],
    users: [],
    demands: [],
};

const content = document.querySelector('#content');
const metrics = document.querySelector('#metrics');
const statusLabel = document.querySelector('#service-status');
const notificationBox = document.querySelector('#notification');
const activeKicker = document.querySelector('#active-kicker');
const activeTitle = document.querySelector('#active-title');
const searchInput = document.querySelector('#search-input');
const searchForm = document.querySelector('#search-form');
const refreshButton = document.querySelector('#refresh-button');
const testWebSocketButton = document.querySelector('#test-websocket-button');
const addUserButton = document.querySelector('#add-user-button');
const addUserModal = document.querySelector('#add-user-modal');
const addUserForm = document.querySelector('#add-user-form');
const tabs = Array.from(document.querySelectorAll('[data-view]'));
const closeModalButtons = Array.from(document.querySelectorAll('[data-close-modal]'));

const setStatus = (text, modifier) => {
    statusLabel.textContent = text;
    statusLabel.className = `service-status service-status--${modifier}`;
};

let notificationTimer = null;

const showNotification = (message, modifier = 'success') => {
    notificationBox.textContent = message;
    notificationBox.className = `notification notification--${modifier}`;

    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => {
        notificationBox.className = 'notification notification--hidden';
    }, 5000);
};

const formatMoney = (value, currency) => `${value} ${currency}`;

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    if (!response.ok) {
        throw new Error('Request failed');
    }

    return response.json();
};

const getStoredDemands = () => {
    try {
        const data = window.localStorage.getItem('pharmacy-static-demands');
        return data ? JSON.parse(data) : [];
    } catch (error) {
        return [];
    }
};

const saveStoredDemands = (demands) => {
    try {
        window.localStorage.setItem('pharmacy-static-demands', JSON.stringify(demands));
    } catch (error) {
        // Ignore storage failures
    }
};

const addStoredDemand = (demand) => {
    const storedDemands = getStoredDemands();
    saveStoredDemands([...storedDemands, demand]);
};

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

const loadStaticStore = async () => {
    const response = await fetch(staticDataPath, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error('Static data failed to load');
    }

    const store = await response.json();
    const storedDemands = getStoredDemands();
    store.demands = [...store.demands, ...storedDemands];
    return store;
};

const card = (title, value, note) => `
    <article class="metric-card">
        <span>${title}</span>
        <strong>${value}</strong>
        <small>${note}</small>
    </article>
`;

const renderMetrics = () => {
    if (!state.summary) {
        metrics.innerHTML = '';
        return;
    }

    metrics.innerHTML = [
        card('Medicines', state.summary.totalMedicines, `${state.summary.totalStock} units in stock`),
        card('Unavailable', state.summary.unavailableCount, 'Need replenishment'),
        card('Team members', state.summary.activeUsers, 'Active accounts'),
        card('Demand requests', state.summary.activeDemands, `${state.summary.urgentDemands} urgent`),
    ].join('');
};

const renderMedicineCard = (medicine) => {
    const stockClass = medicine.stock === 0 ? 'pill--danger' : 'pill--success';
    const stockText = medicine.stock === 0 ? 'Out of stock' : `${medicine.stock} in stock`;
    const prescription = medicine.requiresPrescription ? 'Prescription' : 'OTC';

    return `
        <article class="data-card">
            <div class="data-card__head">
                <div>
                    <p class="eyebrow">${medicine.category}</p>
                    <h3>${medicine.name}</h3>
                </div>
                <span class="pill ${stockClass}">${stockText}</span>
            </div>
            <dl class="details">
                <div><dt>Dosage</dt><dd>${medicine.dosage}</dd></div>
                <div><dt>Price</dt><dd>${formatMoney(medicine.price, medicine.currency)}</dd></div>
                <div><dt>Maker</dt><dd>${medicine.manufacturer}</dd></div>
                <div><dt>Location</dt><dd>${medicine.location}</dd></div>
                <div><dt>Type</dt><dd>${prescription}</dd></div>
                <div><dt>Expiry</dt><dd>${medicine.expiryDate}</dd></div>
            </dl>
            <button class="button button--soft" type="button" data-demand="${medicine.name}">
                Add demand request
            </button>
        </article>
    `;
};

const renderUserCard = (user) => `
    <article class="data-card data-card--compact">
        <div class="avatar">${user.name.slice(0, 1)}</div>
        <div>
            <p class="eyebrow">${user.role}</p>
            <h3>${user.name}</h3>
            <p>${user.department}</p>
            <dl class="details details--inline">
                <div><dt>Shift</dt><dd>${user.shift}</dd></div>
                <div><dt>Orders</dt><dd>${user.completedOrders}</dd></div>
                <div><dt>Email</dt><dd>${user.email}</dd></div>
            </dl>
        </div>
    </article>
`;

const renderDemandCard = (demand) => `
    <article class="data-card">
        <div class="data-card__head">
            <div>
                <p class="eyebrow">${demand.status}</p>
                <h3>${demand.medicineName}</h3>
            </div>
            <span class="pill">${demand.priority}</span>
        </div>
        <dl class="details">
            <div><dt>Requested by</dt><dd>${demand.requestedBy}</dd></div>
            <div><dt>Quantity</dt><dd>${demand.quantity}</dd></div>
            <div><dt>Created</dt><dd>${demand.createdAt}</dd></div>
        </dl>
    </article>
`;

const renderOverview = () => {
    const announcements = state.summary.announcements.map((item) => `
        <article class="notice">
            <p class="eyebrow">${item.title}</p>
            <h3>${item.message}</h3>
        </article>
    `);

    const lowStock = state.medicines
        .filter((medicine) => medicine.stock < 10)
        .map(renderMedicineCard);

    activeKicker.textContent = 'Overview';
    activeTitle.textContent = 'Today at the pharmacy';
    content.innerHTML = announcements.concat(lowStock).join('');
};

const renderMedicines = () => {
    const term = state.search.toLowerCase();
    const filtered = state.medicines.filter((medicine) => (
        medicine.name.toLowerCase().includes(term)
        || medicine.category.toLowerCase().includes(term)
    ));

    activeKicker.textContent = 'Inventory';
    activeTitle.textContent = 'Medicine catalogue';
    content.innerHTML = filtered.map(renderMedicineCard).join('') || '<p class="empty">No medicines found.</p>';
};

const renderUsers = () => {
    activeKicker.textContent = 'Accounts';
    activeTitle.textContent = 'Team members';
    content.innerHTML = state.users.map(renderUserCard).join('');
};

const renderDemands = () => {
    activeKicker.textContent = 'Requests';
    activeTitle.textContent = 'Demand list';
    content.innerHTML = state.demands.map(renderDemandCard).join('');
};

const render = () => {
    renderMetrics();

    const renderers = {
        overview: renderOverview,
        medicines: renderMedicines,
        users: renderUsers,
        demands: renderDemands,
    };

    renderers[state.activeView]();
};

let loadData;

function initWebSocket() {
    if (wsClient) {
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsClient = new WebSocket(`${protocol}//${window.location.host}`);

    wsClient.addEventListener('open', () => {
        setStatus('Connected', 'active');
    });

    wsClient.addEventListener('message', (event) => {
        const notification = JSON.parse(event.data);

        if (notification.type === 'connected') {
            // Notification service connected
        } else if (notification.type === 'new-demand') {
            state.demands.push(notification.data);
            state.summary = notification.summary;

            setStatus(`New demand: ${notification.data.medicineName}`, 'active');
            showNotification(`New demand request: ${notification.data.medicineName}`);
            renderMetrics();

            if (state.activeView === 'demands') {
                render();
            }

            setTimeout(() => {
                setStatus('Connected', 'active');
            }, 3000);
        } else if (notification.type === 'new-user') {
            state.users.push(notification.data);
            state.summary = notification.summary;

            setStatus(`New user: ${notification.data.name}`, 'active');
            showNotification(`New user created: ${notification.data.name}`);
            renderMetrics();

            if (state.activeView === 'users') {
                render();
            }

            setTimeout(() => {
                setStatus('Connected', 'active');
            }, 3000);
        } else if (notification.type === 'test-message') {
            setStatus(notification.message, 'active');
            showNotification(notification.message);

            setTimeout(() => {
                setStatus('Connected', 'active');
            }, 5000);
        }
    });

    wsClient.addEventListener('close', () => {
        setStatus('Disconnected', 'inactive');
        wsClient = null;
        setTimeout(() => {
            if (useApiEndpoints) {
                initWebSocket();
            }
        }, 3000);
    });

    wsClient.addEventListener('error', () => {
        setStatus('Connection error', 'error');
        showNotification('WebSocket connection error', 'error');
    });
}

loadData = async () => {
    setStatus('Loading', 'loading');
    content.innerHTML = '<p class="empty">Loading data...</p>';

    try {
        const [summary, medicines, users, demands] = await Promise.all([
            requestJson(api.summary),
            requestJson(api.medicines),
            requestJson(api.users),
            requestJson(api.demands),
        ]);

        state.summary = summary;
        state.medicines = medicines;
        state.users = users;
        state.demands = demands;
        useApiEndpoints = true;
        setStatus('Online', 'online');

        if (!wsClient) {
            initWebSocket();
        }
    } catch (error) {
        try {
            const store = await loadStaticStore();
            state.summary = buildSummary(store);
            state.medicines = store.medicines;
            state.users = store.users;
            state.demands = store.demands;
            useApiEndpoints = false;
            setStatus('Static preview', 'offline');
        } catch (staticError) {
            setStatus('Offline', 'offline');
            content.innerHTML = `<p class="empty">Unable to load data. ${staticError.message}</p>`;
            return;
        }
    }

    render();
};

const createDemand = async (medicineName) => {
    setStatus('Saving', 'loading');

    try {
        if (useApiEndpoints) {
            await requestJson(api.demands, {
                method: 'POST',
                body: JSON.stringify({
                    medicineName,
                    quantity: 10,
                    requestedBy: 'SPA dashboard',
                    priority: 'Medium',
                }),
            });
            await loadData();
        } else {
            const nextId = state.demands.reduce((max, item) => Math.max(max, item.id), 0) + 1;
            const demand = {
                id: nextId,
                medicineName,
                requestedBy: 'SPA dashboard',
                quantity: 10,
                priority: 'Medium',
                status: 'Queued',
                createdAt: new Date().toISOString().slice(0, 10),
            };
            state.demands.push(demand);
            addStoredDemand(demand);
            state.summary = buildSummary({
                medicines: state.medicines,
                users: state.users,
                demands: state.demands,
                announcements: state.summary?.announcements || [],
            });
        }

        state.activeView = 'demands';
        tabs.forEach((tab) => {
            tab.classList.toggle('tabs__button--active', tab.dataset.view === state.activeView);
        });
        render();
    } catch (error) {
        setStatus('Offline', 'offline');
        content.innerHTML = `<p class="empty">Unable to save demand request. ${error.message}</p>`;
    }
};

const createUser = async (formData) => {
    setStatus('Saving', 'loading');

    try {
        if (useApiEndpoints) {
            const userData = {
                name: formData.get('name'),
                role: formData.get('role'),
                department: formData.get('department'),
                shift: formData.get('shift'),
                email: formData.get('email'),
            };

            const response = await fetch(api.users, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            addUserModal.close();
            addUserForm.reset();

            state.activeView = 'users';
            tabs.forEach((tab) => {
                tab.classList.toggle('tabs__button--active', tab.dataset.view === state.activeView);
            });
            addUserButton.style.display = 'block';

            await loadData();
            setStatus('Connected', 'active');
        }
    } catch (error) {
        setStatus('Error', 'error');
        addUserModal.close();
        content.innerHTML = `<p class="empty">Unable to create user. ${error.message}</p>`;
    }
};

const closeModal = () => {
    addUserModal.close();
    addUserForm.reset();
};

tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        state.activeView = tab.dataset.view;
        tabs.forEach((item) => {
            item.classList.toggle('tabs__button--active', item === tab);
        });
        addUserButton.style.display = state.activeView === 'users' ? 'block' : 'none';
        render();
    });
});

searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.activeView = 'medicines';
    state.search = searchInput.value.trim();
    tabs.forEach((tab) => {
        tab.classList.toggle('tabs__button--active', tab.dataset.view === state.activeView);
    });
    addUserButton.style.display = 'none';
    render();
});

searchInput.addEventListener('input', () => {
    state.search = searchInput.value.trim();

    if (state.activeView === 'medicines') {
        render();
    }
});

content.addEventListener('click', (event) => {
    const demandButton = event.target.closest('[data-demand]');

    if (demandButton) {
        createDemand(demandButton.dataset.demand);
    }
});

addUserButton.addEventListener('click', () => {
    addUserModal.showModal();
});

addUserForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createUser(new FormData(addUserForm));
});

closeModalButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
});

addUserModal.addEventListener('click', (event) => {
    if (event.target === addUserModal) {
        closeModal();
    }
});

refreshButton.addEventListener('click', loadData);

testWebSocketButton.addEventListener('click', async () => {
    try {
        await fetch('/api/test');
    } catch (error) {
        setStatus('Test failed', 'error');
        showNotification('WebSocket test failed', 'error');
    }
});

loadData();
