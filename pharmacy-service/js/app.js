const api = {
    summary: '/api/summary',
    medicines: '/api/medicines',
    users: '/api/users',
    demands: '/api/demands',
};

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
const activeKicker = document.querySelector('#active-kicker');
const activeTitle = document.querySelector('#active-title');
const searchInput = document.querySelector('#search-input');
const searchForm = document.querySelector('#search-form');
const refreshButton = document.querySelector('#refresh-button');
const tabs = Array.from(document.querySelectorAll('[data-view]'));

const setStatus = (text, modifier) => {
    statusLabel.textContent = text;
    statusLabel.className = `service-status service-status--${modifier}`;
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

const loadData = async () => {
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
        setStatus('Online', 'online');
        render();
    } catch (error) {
        setStatus('Offline', 'offline');
        content.innerHTML = `<p class="empty">Unable to load data from the API. ${error.message}</p>`;
    }
};

const createDemand = async (medicineName) => {
    setStatus('Saving', 'loading');

    try {
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

tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        state.activeView = tab.dataset.view;
        tabs.forEach((item) => {
            item.classList.toggle('tabs__button--active', item === tab);
        });
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

refreshButton.addEventListener('click', loadData);

// WebSocket connection for real-time notifications
const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.addEventListener('open', () => {
        setStatus('Connected', 'active');
    });

    ws.addEventListener('message', (event) => {
        const notification = JSON.parse(event.data);

        if (notification.type === 'connected') {
            // Notification service connected
        } else if (notification.type === 'new-demand') {
            // Update state with new notification
            state.demands = notification.data.demands || state.demands;
            state.summary = notification.summary;

            // Show visual feedback
            setStatus(`New demand: ${notification.data.data.medicineName}`, 'active');
            renderMetrics();

            // Auto-refresh demands view if active
            if (state.activeView === 'demands') {
                loadData();
            }

            // Reset status after 3 seconds
            setTimeout(() => {
                setStatus('Connected', 'active');
            }, 3000);
        }
    });

    ws.addEventListener('close', () => {
        setStatus('Disconnected', 'inactive');
        // Attempt to reconnect after 3 seconds
        setTimeout(initWebSocket, 3000);
    });

    ws.addEventListener('error', () => {
        setStatus('Connection error', 'error');
    });
};

loadData();
initWebSocket();
