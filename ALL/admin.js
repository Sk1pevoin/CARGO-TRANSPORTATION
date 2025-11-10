class AdminPanel {
    constructor() {
        this.bidsCache = [];
        this.filters = { status: 'all', search: '' };
        this.autoRefreshInterval = null;
        this.init();
    }

    init() {
        this.loadStats();
        this.loadSuggestions();
        this.loadBids();
        this.setupUI();
        this.enableAutoRefresh();
    }

    async loadStats() {
        try {
            const stats = await transportDB.getStats();
            this.displayStats(stats);
            
            if (document.getElementById('totalBids')) {
                document.getElementById('totalBids').textContent = stats.totalBids || 0;
            }
            if (document.getElementById('queueBids')) {
                document.getElementById('queueBids').textContent = stats.newBids || 0;
            }
            if (document.getElementById('activeBids')) {
                document.getElementById('activeBids').textContent = stats.activeBids || 0;
            }
            if (document.getElementById('availableTransport')) {
                // Загружаем транспорт для статистики
                const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
                const availableTrucks = trucks.filter(truck => truck.status === 'available').length;
                document.getElementById('availableTransport').textContent = availableTrucks;
            }
        } catch (error) {
            console.error('Ошибка при загрузке статистики:', error);
            const bids = await transportDB.getAllBids();
            const stats = {
                totalBids: bids.length,
                newBids: bids.filter(bid => bid.status === 'новая').length,
                activeBids: bids.filter(bid => bid.status === 'в работе').length,
                availableTrucks: 0
            };
            this.displayStats(stats);
        }
    }

    displayStats(stats) {
        console.log('Статистика:', stats);
    }

    async loadSuggestions() {
        try {
            const suggestions = await transportDB.getSuggestions();
            const container = document.getElementById('suggestionsList');
            if (!container) return;

            if (!suggestions || suggestions.length === 0) {
                container.innerHTML = '<p class="muted">Нет предложений</p>';
                return;
            }

            let html = '';
            suggestions.forEach(item => {
                const bid = item.bid;
                const trucks = item.trucks || [];
                html += `
                    <div style="border:1px solid #e5e7eb; border-radius:10px; padding:12px; margin-bottom:10px; background:#fff; display:flex; align-items:center; justify-content:space-between; gap:12px;">
                        <div>
                            <div><strong>#${bid.id}</strong> • ${bid.wherefrom} → ${bid.towhere}</div>
                            <div class="muted">Вес: ${bid.weight ? bid.weight + ' кг' : 'нет данных'}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="muted">Подходит: ${trucks.length}</span>
                            <button class="btn-primary" onclick="adminPanel.openAssignModal(${bid.id})">Распределить</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        } catch (e) {
            const container = document.getElementById('suggestionsList');
            if (container) container.innerHTML = '<p class="muted">Ошибка загрузки предложений</p>';
        }
    }

    async loadBids() {
        const bids = await transportDB.getAllBids();
        this.bidsCache = bids;
        this.applyBidFilters();
    }

    displayBids(bids) {
        const bidsList = document.getElementById('zayavkiList');
        
        if (bids.length === 0) {
            bidsList.innerHTML = '<p>Нет заявок</p>';
            return;
        }

        let html = `
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Маршрут</th>
                            <th>Дата создания</th>
                            <th>Статус</th>
                            <th>Транспорт</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        bids.forEach(bid => {
            const statusColor = this.getStatusColor(bid.status);
            html += `
                <tr>
                    <td>${bid.id}</td>
                    <td><strong>${bid.wherefrom}</strong> → <strong>${bid.towhere}</strong></td>
                    <td>${bid.date}</td>
                    <td><span class="badge ${statusColor.cls}">${bid.status}</span></td>
                    <td>${bid.assigned_truck_id ? `#${bid.assigned_truck_id}` : '<span class="muted">не назначен</span>'}</td>
                    <td>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <select onchange="adminPanel.updateBidStatus(${bid.id}, this.value)" class="btn-secondary">
                                <option value="новая" ${bid.status === 'новая' ? 'selected' : ''}>Новая</option>
                                <option value="в работе" ${bid.status === 'в работе' ? 'selected' : ''}>В работе</option>
                                <option value="выполнена" ${bid.status === 'выполнена' ? 'selected' : ''}>Выполнена</option>
                                <option value="отменена" ${bid.status === 'отменена' ? 'selected' : ''}>Отменена</option>
                            </select>
                            <button class="btn-primary" onclick="adminPanel.openAssignModal(${bid.id})">Распределить</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        bidsList.innerHTML = html;

        const meta = document.getElementById('bidsMeta');
        if (meta) {
            meta.textContent = `Показано: ${bids.length}`;
        }
    }

    getStatusColor(status) {
        const map = {
            'новая': { color: '#007bff', cls: 'blue' },
            'в работе': { color: '#ffc107', cls: 'amber' },
            'выполнена': { color: '#28a745', cls: 'green' },
            'отменена': { color: '#dc3545', cls: 'red' }
        };
        return map[status] || { color: '#6c757d', cls: 'blue' };
    }

    async updateBidStatus(bidId, newStatus) {
        try {
            await transportDB.updateBidStatus(bidId, newStatus);
            this.loadBids();
            this.loadStats();
        } catch (error) {
            alert('Ошибка при обновлении статуса: ' + error.message);
        }
    }

    // ===================== TRANSPORT MANAGEMENT =====================
    async addTruck(truckData) {
        try {
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            const newTruck = {
                id: Date.now(),
                model: truckData.model,
                license_plate: truckData.license_plate,
                capacity_kg: parseFloat(truckData.capacity_kg),
                status: 'available',
                created_at: new Date().toISOString()
            };
            
            trucks.push(newTruck);
            localStorage.setItem('trucks', JSON.stringify(trucks));
            
            this.loadTransport();
            this.loadStats();
            
            return newTruck;
        } catch (error) {
            console.error('Ошибка при добавлении транспорта:', error);
            throw error;
        }
    }

    async loadTransport() {
        try {
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            this.displayTransport(trucks);
        } catch (error) {
            console.error('Ошибка при загрузке транспорта:', error);
        }
    }

    displayTransport(trucks) {
        const transportList = document.getElementById('transportList');
        if (!transportList) return;

        if (trucks.length === 0) {
            transportList.innerHTML = '<p style="text-align: center; color: #666;">Нет добавленного транспорта</p>';
            return;
        }

        let html = `
            <div class="table-wrap">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 12px; border: 1px solid #ddd;">ID</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Модель</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Гос. номер</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Грузоподъемность</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Статус</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        trucks.forEach(truck => {
            const statusColor = truck.status === 'available' ? '#28a745' : '#dc3545';
            const statusText = truck.status === 'available' ? 'Доступен' : 'Занят';
            
            html += `
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd;">${truck.id}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${truck.model}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${truck.license_plate}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${truck.capacity_kg} кг</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">
                        <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                            ${statusText}
                        </span>
                    </td>
                    <td style="padding: 12px; border: 1px solid #ddd;">
                        <button onclick="adminPanel.deleteTruck(${truck.id})" 
                                style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Удалить
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        transportList.innerHTML = html;
    }

    async deleteTruck(truckId) {
        if (!confirm('Вы уверены, что хотите удалить этот транспорт?')) {
            return;
        }
        
        try {
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            const updatedTrucks = trucks.filter(truck => truck.id !== truckId);
            localStorage.setItem('trucks', JSON.stringify(updatedTrucks));
            
            this.loadTransport();
            this.loadStats();
            
            alert('Транспорт успешно удален!');
        } catch (error) {
            alert('Ошибка при удалении транспорта: ' + error.message);
        }
    }

    // ===================== BIDS: FILTERS/SEARCH =====================
    setupUI() {
        const statusSelect = document.getElementById('bidStatusFilter');
        const searchInput = document.getElementById('bidSearch');

        if (statusSelect) {
            statusSelect.addEventListener('change', () => {
                this.filters.status = statusSelect.value;
                this.applyBidFilters();
            });
        }

        if (searchInput) {
            const debounced = this.debounce((value) => {
                this.filters.search = value.trim().toLowerCase();
                this.applyBidFilters();
            }, 250);
            searchInput.addEventListener('input', (e) => debounced(e.target.value));
        }
    }

    applyBidFilters() {
        let list = [...this.bidsCache];

        if (this.filters.status && this.filters.status !== 'all') {
            list = list.filter(b => b.status === this.filters.status);
        }

        if (this.filters.search) {
            const q = this.filters.search;
            list = list.filter(b =>
                String(b.id).includes(q) ||
                (b.wherefrom && b.wherefrom.toLowerCase().includes(q)) ||
                (b.towhere && b.towhere.toLowerCase().includes(q))
            );
        }

        this.displayBids(list);
    }

    refreshBids() {
        this.loadBids();
    }

    debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    enableAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            const bidsVisible = document.getElementById('bidsSection')?.style.display !== 'none';
            const dashVisible = document.getElementById('dashboard')?.style.display !== 'none';
            if (bidsVisible) this.loadBids();
            if (dashVisible) this.loadStats();
        }, 15000);
    }

    async openAssignModal(bidId) {
        try {
            const modal = document.getElementById('assignModal');
            const content = document.getElementById('assignContent');
            content.innerHTML = '<p class="muted">Загрузка доступного транспорта...</p>';
            modal.style.display = 'block';

            const [bid, trucks] = await Promise.all([
                transportDB.getBidById(bidId),
                this.loadTransportData()
            ]);
            const available = trucks.filter(t => t.status === 'available');

            if (available.length === 0) {
                content.innerHTML = '<p>Нет доступного транспорта</p>';
                document.getElementById('assignSubmitBtn').onclick = () => {};
                return;
            }

            let html = '<label>Выберите транспорт:</label><select id="assignTruckSelect" style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; margin-top:6px;">';
            available.forEach(t => {
                const insufficient = bid && bid.weight && t.capacity_kg && Number(t.capacity_kg) < Number(bid.weight);
                const label = `#${t.id} • ${t.model} • ${t.license_plate} • ${t.capacity_kg || ''} кг`;
                html += `<option value="${t.id}" ${insufficient ? 'disabled' : ''} title="${insufficient ? 'Недостаточная грузоподъёмность' : ''}">${label}${insufficient ? ' (недостаточно)' : ''}</option>`;
            });
            html += '</select>';
            content.innerHTML = html;

            document.getElementById('assignSubmitBtn').onclick = async () => {
                const select = document.getElementById('assignTruckSelect');
                const truckId = parseInt(select.value, 10);
                const chosen = available.find(t => t.id === truckId);
                if (bid && bid.weight && chosen && chosen.capacity_kg && Number(chosen.capacity_kg) < Number(bid.weight)) {
                    alert('Нельзя назначить: вес груза превышает грузоподъёмность транспорта');
                    return;
                }
                try {
                    await transportDB.assignTruckToBid(bidId, truckId);
                    this.refreshBids();
                    this.loadSuggestions();
                    closeAssignModal();
                } catch (e) {
                    alert('Ошибка: ' + (e.message || 'не удалось назначить транспорт'));
                }
            };
        } catch (error) {
            alert('Ошибка загрузки транспорта: ' + error.message);
        }
    }

    async loadTransportData() {
        return JSON.parse(localStorage.getItem('trucks') || '[]');
    }
}

const adminPanel = new AdminPanel();

// Функции для показа/скрытия разделов
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'none';
}

function showBids() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'block';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'none';
    adminPanel.loadBids();
}

function showTransport() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'block';
    document.getElementById('queueSection').style.display = 'none';
    adminPanel.loadTransport();
}

function showQueue() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'block';
}

function closeAssignModal() {
    const modal = document.getElementById('assignModal');
    if (modal) modal.style.display = 'none';
}

// Функции для модального окна транспорта
function showAddTransportModal() {
    document.getElementById('addTransportModal').style.display = 'block';
}

function closeAddTransportModal() {
    document.getElementById('addTransportModal').style.display = 'none';
    document.getElementById('addTransportForm').reset();
}

// Обработчик формы транспорта
document.addEventListener('DOMContentLoaded', function() {
    const transportForm = document.getElementById('addTransportForm');
    if (transportForm) {
        transportForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const truckData = {
                model: document.getElementById('truckModel').value,
                license_plate: document.getElementById('truckPlate').value,
                capacity_kg: parseFloat(document.getElementById('truckCapacity').value)
            };
            
            try {
                await adminPanel.addTruck(truckData);
                closeAddTransportModal();
                showSuccess('Транспорт успешно добавлен!');
            } catch (error) {
                showError('Ошибка при добавлении транспорта: ' + error.message);
            }
        });
    }
    
    // Закрытие модальных окон по клику вне их
    window.onclick = function(event) {
        const transportModal = document.getElementById('addTransportModal');
        if (event.target === transportModal) {
            closeAddTransportModal();
        }
        
        const assignModal = document.getElementById('assignModal');
        if (event.target === assignModal) {
            closeAssignModal();
        }
    }
});

// Вспомогательные функции уведомлений
function showSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-weight: bold;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-weight: bold;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}