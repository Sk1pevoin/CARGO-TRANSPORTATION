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
            const stats = await transportDBCompat.getStats();
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
            const bids = await transportDBCompat.getAllBids();
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
            console.log('🔄 Загрузка предложений...');
            const suggestions = await transportDBCompat.getSuggestions();
            console.log('📋 Получено предложений:', suggestions);
            
            const container = document.getElementById('suggestionsList');
            if (!container) {
                console.error('❌ Контейнер suggestionsList не найден');
                return;
            }

            if (!suggestions || suggestions.length === 0) {
                container.innerHTML = '<p class="muted">Нет новых заявок для распределения</p>';
                console.log('ℹ️ Нет предложений для отображения');
                return;
            }

            let html = '';
            suggestions.forEach(item => {
                const bid = item.bid;
                const trucks = item.trucks || [];
                const bidWeight = parseFloat(bid.weight) || 0;
                
                let statusBadge = '';
                let canDistribute = item.canDistribute !== false;
                
                if (trucks.length === 0) {
                    statusBadge = '<span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Нет свободного транспорта</span>';
                    canDistribute = false;
                } else if (item.needsMultiple) {
                    statusBadge = '<span style="background: #ffc107; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Требуется разделение груза</span>';
                } else {
                    statusBadge = `<span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${trucks.length} ТС доступно</span>`;
                }
                
                html += `
                    <div style="border:1px solid #e5e7eb; border-radius:10px; padding:15px; margin-bottom:12px; background:#fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:15px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <div style="margin-bottom: 8px;">
                                    <strong style="font-size: 16px;">#${bid.id}</strong> • 
                                    <strong>${bid.wherefrom}</strong> → <strong>${bid.towhere}</strong>
                                </div>
                                <div style="color: #666; font-size: 14px; margin-bottom: 4px;">
                                    Вес: <strong>${bidWeight > 0 ? bidWeight + ' кг' : 'не указан'}</strong>
                                </div>
                                <div style="color: #666; font-size: 14px;">
                                    Тип: ${bid.type || 'Обычный'} • Дата: ${bid.date || 'не указана'}
                                </div>
                            </div>
                            <div style="display:flex; flex-direction: column; align-items:flex-end; gap:10px;">
                                ${statusBadge}
                                ${canDistribute ? 
                                    `<button class="btn-primary" onclick="if(window.adminPanel) adminPanel.openAssignModal(${bid.id})" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Распределить</button>` :
                                    `<button disabled style="padding: 8px 16px; background: #ccc; color: #666; border: none; border-radius: 6px; cursor: not-allowed; font-weight: 500;">Нет транспорта</button>`
                                }
                            </div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        } catch (e) {
            console.error('Ошибка при загрузке предложений:', e);
            const container = document.getElementById('suggestionsList');
            if (container) container.innerHTML = '<p class="muted" style="color: #dc3545;">Ошибка загрузки предложений: ' + e.message + '</p>';
        }
    }

    async loadBids() {
        try {
            const bids = await transportDBCompat.getAllBids();
            this.bidsCache = bids || [];
            this.applyBidFilters();
        } catch (error) {
            console.error('Ошибка при загрузке заявок:', error);
            this.bidsCache = [];
            this.applyBidFilters();
        }
    }

    async displayBids(bids) {
        const bidsList = document.getElementById('zayavkiList');
        if (!bidsList) {
            console.error('Элемент zayavkiList не найден');
            return;
        }
        
        if (!bids || bids.length === 0) {
            bidsList.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">Нет заявок</p>';
            return;
        }

        // Загружаем информацию о распределениях
        const assignments = JSON.parse(localStorage.getItem('cargo_assignments') || '[]');
        const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');

        let html = `
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Маршрут</th>
                            <th>Вес</th>
                            <th>Дата создания</th>
                            <th>Статус</th>
                            <th>Транспорт</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const bid of bids) {
            const statusColor = this.getStatusColor(bid.status);
            
            // Получаем информацию о распределении для этой заявки
            const assignment = assignments.find(a => a.bidId === bid.id);
            let transportInfo = '<span class="muted">не назначен</span>';
            
            if (assignment && assignment.trucks && assignment.trucks.length > 0) {
                // Груз распределен между несколькими транспортными средствами
                const truckDetails = assignment.trucks.map(ta => {
                    const truck = trucks.find(t => t.id === ta.truckId);
                    const truckLabel = truck ? `#${truck.id} (${truck.model})` : `#${ta.truckId}`;
                    return `${truckLabel}: ${ta.assignedWeight} кг`;
                }).join('<br>');
                
                transportInfo = `
                    <div style="font-size: 12px;">
                        <strong style="color: #28a745;">${assignment.trucks.length} ТС:</strong><br>
                        ${truckDetails}
                    </div>
                `;
            } else if (bid.assigned_truck_id) {
                // Один транспорт (старый формат)
                const truck = trucks.find(t => t.id === bid.assigned_truck_id);
                transportInfo = truck ? `#${truck.id} (${truck.model})` : `#${bid.assigned_truck_id}`;
            }
            
            html += `
                <tr>
                    <td>${bid.id}</td>
                    <td><strong>${bid.wherefrom}</strong> → <strong>${bid.towhere}</strong></td>
                    <td>${bid.weight || 0} кг</td>
                    <td>${bid.date || bid.created_at ? (bid.date || bid.created_at.split('T')[0]) : '—'}</td>
                    <td><span class="badge ${statusColor.cls}">${bid.status}</span></td>
                    <td>${transportInfo}</td>
                    <td>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <select id="statusSelect_${bid.id}" onchange="if(window.adminPanel) adminPanel.updateBidStatus(${bid.id}, this.value)" class="btn-secondary">
                                <option value="новая" ${bid.status === 'новая' ? 'selected' : ''}>Новая</option>
                                <option value="в работе" ${bid.status === 'в работе' ? 'selected' : ''}>В работе</option>
                                <option value="выполнена" ${bid.status === 'выполнена' ? 'selected' : ''}>Выполнена</option>
                                <option value="отменена" ${bid.status === 'отменена' ? 'selected' : ''}>Отменена</option>
                            </select>
                            <button class="btn-primary" onclick="if(window.adminPanel) adminPanel.openAssignModal(${bid.id})">Распределить</button>
                        </div>
                    </td>
                </tr>
            `;
        }

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
            console.log('🔄 Обновление статуса заявки', bidId, 'на', newStatus);
            
            // Если пытаемся взять заявку в работу, проверяем наличие транспорта
            if (newStatus === 'в работе') {
                const bid = await transportDBCompat.getBidById(bidId);
                if (!bid) {
                    alert('Заявка не найдена');
                    return;
                }
                
                console.log('📋 Заявка:', bid);
                
                // Проверяем, назначен ли уже транспорт
                const assignments = JSON.parse(localStorage.getItem('cargo_assignments') || '[]');
                const assignment = assignments.find(a => a.bidId === bidId);
                
                console.log('🚛 Назначения:', assignment, 'assigned_truck_id:', bid.assigned_truck_id);
                
                if (!assignment && !bid.assigned_truck_id) {
                    // Транспорт не назначен, проверяем наличие свободного транспорта
                    const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
                    const availableTrucks = trucks.filter(t => t.status === 'available');
                    console.log('🚛 Доступно транспорта:', availableTrucks.length);
                    
                    if (availableTrucks.length === 0) {
                        alert('⚠️ Невозможно взять заявку в работу: нет свободного транспорта!\n\nПожалуйста, сначала распределите груз на транспортные средства.');
                        // Сбрасываем выбор обратно
                        setTimeout(() => {
                            const select = document.getElementById(`statusSelect_${bidId}`);
                            if (select) {
                                select.value = bid.status;
                            }
                        }, 100);
                        return;
                    }
                    
                    // Проверяем, можно ли перевезти груз имеющимся транспортом
                    const bidWeight = parseFloat(bid.weight) || 0;
                    if (bidWeight > 0) {
                        const maxCapacity = Math.max(...availableTrucks.map(t => parseFloat(t.capacity_kg) || 0));
                        const totalCapacity = availableTrucks.reduce((sum, t) => sum + (parseFloat(t.capacity_kg) || 0), 0);
                        
                        console.log('⚖️ Вес груза:', bidWeight, 'Макс. грузоподъемность:', maxCapacity, 'Общая:', totalCapacity);
                        
                        if (bidWeight > maxCapacity && bidWeight > totalCapacity) {
                            alert('⚠️ Невозможно взять заявку в работу: недостаточно грузоподъемности транспорта!\n\nВес груза: ' + bidWeight + ' кг\nМаксимальная грузоподъемность одного ТС: ' + maxCapacity + ' кг\nОбщая грузоподъемность: ' + totalCapacity + ' кг\n\nПожалуйста, сначала распределите груз на транспортные средства.');
                            // Сбрасываем выбор обратно
                            setTimeout(() => {
                                const select = document.getElementById(`statusSelect_${bidId}`);
                                if (select) {
                                    select.value = bid.status;
                                }
                            }, 100);
                            return;
                        }
                        
                        // Если груз слишком большой для одного ТС, предлагаем распределение
                        if (bidWeight > maxCapacity) {
                            const confirmDistribute = confirm(
                                '⚠️ Груз слишком большой для одного транспортного средства!\n\n' +
                                'Вес груза: ' + bidWeight + ' кг\n' +
                                'Максимальная грузоподъемность одного ТС: ' + maxCapacity + ' кг\n\n' +
                                'Необходимо распределить груз между несколькими транспортными средствами.\n\n' +
                                'Открыть окно распределения?'
                            );
                            
                            if (confirmDistribute) {
                                // Сбрасываем выбор обратно
                                setTimeout(() => {
                                    const select = document.getElementById(`statusSelect_${bidId}`);
                                    if (select) {
                                        select.value = bid.status;
                                    }
                                }, 100);
                                // Открываем модальное окно распределения
                                this.openAssignModal(bidId);
                                return;
                            } else {
                                // Сбрасываем выбор обратно
                                setTimeout(() => {
                                    const select = document.getElementById(`statusSelect_${bidId}`);
                                    if (select) {
                                        select.value = bid.status;
                                    }
                                }, 100);
                                return;
                            }
                        }
                    }
                }
            }
            
            // Если статус меняется на "выполнена" или "отменена", освобождаем транспорт
            if (newStatus === 'выполнена' || newStatus === 'отменена') {
                await this.freeTransportForBid(bidId);
            }
            
            // Обновляем статус
            await transportDBCompat.updateBidStatus(bidId, newStatus);
            this.loadBids();
            this.loadStats();
            this.loadSuggestions();
            this.loadTransport(); // Обновляем список транспорта
            
            // Обновляем очередь если она открыта
            if (document.getElementById('queueSection')?.style.display !== 'none') {
                this.loadQueueBids();
            }
            
            if (newStatus === 'в работе') {
                showSuccess('Заявка взята в работу');
            } else if (newStatus === 'выполнена') {
                showSuccess('Заявка выполнена. Транспорт освобожден.');
            } else if (newStatus === 'отменена') {
                showSuccess('Заявка отменена. Транспорт освобожден.');
            }
        } catch (error) {
            console.error('Ошибка при обновлении статуса:', error);
            alert('Ошибка при обновлении статуса: ' + error.message);
        }
    }

    // ===================== TRANSPORT MANAGEMENT =====================
    async addTruck(truckData) {
        // Валидация данных
        const validationErrors = this.validateTruckData(truckData);
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join('\n'));
        }
        
        try {
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            
            // Проверка на уникальность гос. номера
            const normalizedPlate = truckData.license_plate.trim().toUpperCase().replace(/\s+/g, ' ');
            const existingTruck = trucks.find(t => 
                t.license_plate.trim().toUpperCase().replace(/\s+/g, ' ') === normalizedPlate
            );
            
            if (existingTruck) {
                throw new Error('Транспортное средство с таким государственным номером уже существует');
            }
            
            const newTruck = {
                id: Date.now(),
                model: truckData.model.trim(),
                license_plate: normalizedPlate,
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
    
    // Валидация данных транспорта
    validateTruckData(truckData) {
        const errors = [];
        
        // Проверка модели
        if (!truckData.model || !truckData.model.trim()) {
            errors.push('Модель транспортного средства обязательна для заполнения');
        } else if (truckData.model.trim().length < 2) {
            errors.push('Модель должна содержать минимум 2 символа');
        } else if (truckData.model.trim().length > 50) {
            errors.push('Модель не должна превышать 50 символов');
        }
        
        // Проверка гос. номера
        if (!truckData.license_plate || !truckData.license_plate.trim()) {
            errors.push('Государственный номер обязателен для заполнения');
        } else {
            const plate = truckData.license_plate.trim();
            if (plate.length < 4) {
                errors.push('Государственный номер должен содержать минимум 4 символа');
            } else if (plate.length > 15) {
                errors.push('Государственный номер не должен превышать 15 символов');
            } else if (!/^[A-ZА-Я0-9\s-]+$/i.test(plate)) {
                errors.push('Государственный номер может содержать только буквы, цифры, пробелы и дефисы');
            }
        }
        
        // Проверка грузоподъемности
        const capacity = parseFloat(truckData.capacity_kg);
        if (isNaN(capacity) || capacity <= 0) {
            errors.push('Грузоподъемность должна быть положительным числом');
        } else if (capacity < 100) {
            errors.push('Грузоподъемность должна быть не менее 100 кг');
        } else if (capacity > 100000) {
            errors.push('Грузоподъемность не должна превышать 100000 кг');
        }
        
        return errors;
    }

    async loadTransport() {
        try {
            // Загружаем транспорт из localStorage
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            console.log('🚛 Загружено транспорта:', trucks.length);
            this.displayTransport(trucks);
        } catch (error) {
            console.error('Ошибка при загрузке транспорта:', error);
            this.displayTransport([]);
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
                        <button onclick="if(window.adminPanel) adminPanel.deleteTruck(${truck.id})" 
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

    filterBids() {
        const statusSelect = document.getElementById('bidStatus');
        const searchInput = document.getElementById('bidSearch');
        
        if (statusSelect) {
            this.filters.status = statusSelect.value;
        }
        
        if (searchInput) {
            this.filters.search = searchInput.value.trim().toLowerCase();
        }
        
        this.applyBidFilters();
    }

    applyStatusFilter(status) {
        this.filters.status = status;
        this.applyBidFilters();
    }

    handleGlobalSearch(value) {
        this.filters.search = value.trim().toLowerCase();
        this.applyBidFilters();
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
                transportDBCompat.getBidById(bidId),
                this.loadTransportData()
            ]);
            const available = trucks.filter(t => t.status === 'available');

            if (available.length === 0) {
                content.innerHTML = '<p>Нет доступного транспорта</p>';
                document.getElementById('assignSubmitBtn').onclick = () => {};
                return;
            }

            const bidWeight = bid && bid.weight ? parseFloat(bid.weight) : 0;
            
            // Проверяем, нужен ли раздел груза
            const maxCapacity = Math.max(...available.map(t => parseFloat(t.capacity_kg) || 0));
            const needsSplit = bidWeight > maxCapacity;
            
            let html = '';
            
            if (needsSplit) {
                // Режим разделения груза между несколькими транспортными средствами
                html += `
                    <div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <strong>⚠️ Груз слишком большой для одного транспортного средства</strong>
                        <p style="margin: 5px 0 0 0; font-size: 14px;">
                            Вес груза: <strong>${bidWeight} кг</strong><br>
                            Максимальная грузоподъемность одного ТС: <strong>${maxCapacity} кг</strong>
                        </p>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #856404;">
                            Выберите несколько транспортных средств для распределения груза
                        </p>
                    </div>
                `;
                
                // Автоматический расчет распределения
                const distribution = this.calculateCargoDistribution(bidWeight, available);
                
                html += '<label style="display: block; margin-top: 15px; margin-bottom: 8px; font-weight: bold;">Распределение груза:</label>';
                html += '<div id="cargoDistribution" style="margin-bottom: 15px;">';
                
                distribution.forEach((item, index) => {
                    html += `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                            <input type="checkbox" id="truck_${item.truck.id}" value="${item.truck.id}" 
                                   checked style="width: 20px; height: 20px; cursor: pointer;">
                            <label for="truck_${item.truck.id}" style="flex: 1; cursor: pointer; margin: 0;">
                                <strong>#${item.truck.id}</strong> • ${item.truck.model} • ${item.truck.license_plate}<br>
                                <span style="font-size: 12px; color: #666;">
                                    Грузоподъемность: ${item.truck.capacity_kg} кг → 
                                    <strong style="color: #28a745;">Назначено: ${item.assignedWeight} кг</strong>
                                </span>
                            </label>
                        </div>
                    `;
                });
                
                html += '</div>';
                
                html += `
                    <div style="margin-top: 15px; padding: 10px; background: #e7f3ff; border-radius: 8px;">
                        <strong>Итого:</strong>
                        <div id="distributionSummary" style="margin-top: 5px; font-size: 14px;"></div>
                    </div>
                `;
                
                // Добавляем обработчик для пересчета при изменении выбора
                setTimeout(() => {
                    distribution.forEach(item => {
                        const checkbox = document.getElementById(`truck_${item.truck.id}`);
                        if (checkbox) {
                            checkbox.addEventListener('change', () => this.updateDistributionSummary(bidWeight, available));
                        }
                    });
                    this.updateDistributionSummary(bidWeight, available);
                }, 100);
                
            } else {
                // Обычный режим - один транспорт
                html += '<label>Выберите транспорт:</label>';
                html += '<select id="assignTruckSelect" style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; margin-top:6px;">';
                available.forEach(t => {
                    const insufficient = bidWeight > 0 && t.capacity_kg && Number(t.capacity_kg) < bidWeight;
                    const label = `#${t.id} • ${t.model} • ${t.license_plate} • ${t.capacity_kg || ''} кг`;
                    html += `<option value="${t.id}" ${insufficient ? 'disabled' : ''} title="${insufficient ? 'Недостаточная грузоподъёмность' : ''}">${label}${insufficient ? ' (недостаточно)' : ''}</option>`;
                });
                html += '</select>';
            }
            
            content.innerHTML = html;

            document.getElementById('assignSubmitBtn').onclick = async () => {
                if (needsSplit) {
                    // Режим разделения
                    const selectedTrucks = [];
                    distribution.forEach(item => {
                        const checkbox = document.getElementById(`truck_${item.truck.id}`);
                        if (checkbox && checkbox.checked) {
                            selectedTrucks.push({
                                truckId: item.truck.id,
                                assignedWeight: item.assignedWeight
                            });
                        }
                    });
                    
                    if (selectedTrucks.length === 0) {
                        alert('Выберите хотя бы одно транспортное средство');
                        return;
                    }
                    
                    const totalAssigned = selectedTrucks.reduce((sum, item) => sum + item.assignedWeight, 0);
                    if (totalAssigned < bidWeight * 0.99) { // Допускаем небольшую погрешность
                        if (!confirm(`Внимание! Распределено только ${totalAssigned.toFixed(2)} кг из ${bidWeight} кг. Продолжить?`)) {
                            return;
                        }
                    }
                    
                    try {
                        await this.assignMultipleTrucksToBid(bidId, selectedTrucks);
                        this.loadBids();
                        this.loadStats();
                        this.loadSuggestions();
                        closeAssignModal();
                        showSuccess('Груз успешно распределен между транспортными средствами');
                    } catch (e) {
                        alert('Ошибка: ' + (e.message || 'не удалось назначить транспорт'));
                    }
                } else {
                    // Обычный режим
                    const select = document.getElementById('assignTruckSelect');
                    const truckId = parseInt(select.value, 10);
                    const chosen = available.find(t => t.id === truckId);
                    if (bidWeight > 0 && chosen && chosen.capacity_kg && Number(chosen.capacity_kg) < bidWeight) {
                        alert('Нельзя назначить: вес груза превышает грузоподъёмность транспорта');
                        return;
                    }
                    try {
                        await transportDBCompat.assignTruckToBid(bidId, truckId);
                        this.loadBids();
                        this.loadStats();
                        this.loadSuggestions();
                        closeAssignModal();
                        showSuccess('Транспорт успешно назначен на заявку');
                    } catch (e) {
                        alert('Ошибка: ' + (e.message || 'не удалось назначить транспорт'));
                    }
                }
            };
        } catch (error) {
            alert('Ошибка загрузки транспорта: ' + error.message);
        }
    }

    // Расчет распределения груза между транспортными средствами
    calculateCargoDistribution(totalWeight, availableTrucks) {
        // Сортируем транспорт по грузоподъемности (от большего к меньшему)
        const sortedTrucks = [...availableTrucks].sort((a, b) => 
            (parseFloat(b.capacity_kg) || 0) - (parseFloat(a.capacity_kg) || 0)
        );
        
        const distribution = [];
        let remainingWeight = totalWeight;
        
        for (const truck of sortedTrucks) {
            if (remainingWeight <= 0) break;
            
            const capacity = parseFloat(truck.capacity_kg) || 0;
            const assignedWeight = Math.min(remainingWeight, capacity);
            
            distribution.push({
                truck: truck,
                assignedWeight: Math.round(assignedWeight * 100) / 100 // Округляем до 2 знаков
            });
            
            remainingWeight -= assignedWeight;
        }
        
        // Если груз не поместился, добавляем оставшийся вес к последнему транспорту
        if (remainingWeight > 0 && distribution.length > 0) {
            distribution[distribution.length - 1].assignedWeight += remainingWeight;
            distribution[distribution.length - 1].assignedWeight = Math.round(distribution[distribution.length - 1].assignedWeight * 100) / 100;
        }
        
        return distribution;
    }

    // Обновление сводки распределения
    updateDistributionSummary(totalWeight, availableTrucks) {
        const summaryDiv = document.getElementById('distributionSummary');
        if (!summaryDiv) return;
        
        const selectedTrucks = [];
        availableTrucks.forEach(truck => {
            const checkbox = document.getElementById(`truck_${truck.id}`);
            if (checkbox && checkbox.checked) {
                selectedTrucks.push(truck);
            }
        });
        
        if (selectedTrucks.length === 0) {
            summaryDiv.innerHTML = '<span style="color: #dc3545;">Не выбрано ни одного транспортного средства</span>';
            return;
        }
        
        const distribution = this.calculateCargoDistribution(totalWeight, selectedTrucks);
        const totalAssigned = distribution.reduce((sum, item) => sum + item.assignedWeight, 0);
        const coverage = ((totalAssigned / totalWeight) * 100).toFixed(1);
        
        let summaryHtml = `
            <div>Выбрано ТС: <strong>${selectedTrucks.length}</strong></div>
            <div>Распределено: <strong>${totalAssigned.toFixed(2)} кг</strong> из ${totalWeight} кг (${coverage}%)</div>
        `;
        
        if (totalAssigned < totalWeight * 0.99) {
            summaryHtml += `<div style="color: #dc3545; margin-top: 5px;">⚠️ Не весь груз распределен! Осталось: ${(totalWeight - totalAssigned).toFixed(2)} кг</div>`;
        } else {
            summaryHtml += `<div style="color: #28a745; margin-top: 5px;">✅ Весь груз распределен</div>`;
        }
        
        summaryDiv.innerHTML = summaryHtml;
    }

    // Назначение нескольких транспортных средств на заявку
    async assignMultipleTrucksToBid(bidId, truckAssignments) {
        try {
            // Сохраняем информацию о распределении в заявку
            const bid = await transportDBCompat.getBidById(bidId);
            if (!bid) {
                throw new Error('Заявка не найдена');
            }
            
            // Сохраняем распределение в localStorage
            const assignments = {
                bidId: bidId,
                trucks: truckAssignments,
                totalWeight: bid.weight,
                assignedAt: new Date().toISOString()
            };
            
            // Получаем существующие распределения
            const allAssignments = JSON.parse(localStorage.getItem('cargo_assignments') || '[]');
            
            // Удаляем старое распределение для этой заявки, если есть
            const filteredAssignments = allAssignments.filter(a => a.bidId !== bidId);
            filteredAssignments.push(assignments);
            
            localStorage.setItem('cargo_assignments', JSON.stringify(filteredAssignments));
            
            // Обновляем статус транспорта на "занят"
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            truckAssignments.forEach(assignment => {
                const truck = trucks.find(t => t.id === assignment.truckId);
                if (truck) {
                    truck.status = 'busy';
                }
            });
            localStorage.setItem('trucks', JSON.stringify(trucks));
            
            // Обновляем статус заявки на "в работе"
            await transportDBCompat.updateBidStatus(bidId, 'в работе');
            
            console.log('Груз распределен:', assignments);
        } catch (error) {
            console.error('Ошибка при распределении груза:', error);
            throw error;
        }
    }

    async loadTransportData() {
        // Загружаем транспорт из localStorage
        return JSON.parse(localStorage.getItem('trucks') || '[]');
    }

    // Освобождение транспорта для заявки
    async freeTransportForBid(bidId) {
        try {
            // Получаем информацию о распределении транспорта
            const assignments = JSON.parse(localStorage.getItem('cargo_assignments') || '[]');
            const assignment = assignments.find(a => a.bidId === bidId);
            
            if (!assignment || !assignment.trucks || assignment.trucks.length === 0) {
                // Проверяем старый формат (один транспорт)
                const bid = await transportDBCompat.getBidById(bidId);
                if (bid && bid.assigned_truck_id) {
                    const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
                    const truck = trucks.find(t => t.id === bid.assigned_truck_id);
                    if (truck) {
                        truck.status = 'available';
                        localStorage.setItem('trucks', JSON.stringify(trucks));
                        console.log('✅ Транспорт #' + truck.id + ' освобожден (старый формат)');
                    }
                }
                return;
            }
            
            // Освобождаем все транспортные средства, назначенные на эту заявку
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            let freedCount = 0;
            
            assignment.trucks.forEach(truckAssignment => {
                const truck = trucks.find(t => t.id === truckAssignment.truckId);
                if (truck && truck.status === 'busy') {
                    truck.status = 'available';
                    freedCount++;
                    console.log('✅ Транспорт #' + truck.id + ' (' + truck.model + ') освобожден');
                }
            });
            
            if (freedCount > 0) {
                localStorage.setItem('trucks', JSON.stringify(trucks));
                console.log(`✅ Освобождено транспорта: ${freedCount}`);
            }
            
            // Удаляем информацию о распределении (опционально, можно оставить для истории)
            // const filteredAssignments = assignments.filter(a => a.bidId !== bidId);
            // localStorage.setItem('cargo_assignments', JSON.stringify(filteredAssignments));
            
        } catch (error) {
            console.error('Ошибка при освобождении транспорта:', error);
        }
    }

    // Загрузка заявок в очереди
    async loadQueueBids() {
        try {
            // Загружаем все заявки
            await this.loadBids();
            const bids = this.bidsCache || [];
            const queueBids = bids.filter(bid => bid.status === 'новая');
            const queueList = document.getElementById('queueList');
            
            if (!queueList) {
                console.error('Элемент queueList не найден');
                return;
            }
            
            if (queueBids.length === 0) {
                queueList.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">Нет заявок в очереди</p>';
                return;
            }
            
            let html = '<h3 style="margin-bottom: 20px; color: #0a1a33;">Заявки в очереди на обработку</h3>';
            html += '<div class="queue-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">';
            
            queueBids.forEach(bid => {
                const bidWeight = parseFloat(bid.weight) || 0;
                html += `
                    <div class="queue-card" style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div class="queue-card-header" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                            <h4 style="margin: 0 0 8px 0; color: #0a1a33; font-size: 18px;">#${bid.id} ${bid.wherefrom || ''} → ${bid.towhere || ''}</h4>
                            <span class="queue-badge" style="background: #007bff; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">Новая заявка</span>
                        </div>
                        
                        <div class="queue-row" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0;">
                            <span class="queue-label" style="color: #666; font-weight: 500;">Вес:</span>
                            <span class="queue-value" style="color: #0a1a33; font-weight: bold;">${bidWeight > 0 ? bidWeight + ' кг' : 'не указан'}</span>
                        </div>
                        <div class="queue-row" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0;">
                            <span class="queue-label" style="color: #666; font-weight: 500;">Тип груза:</span>
                            <span class="queue-value" style="color: #0a1a33;">${bid.type || 'Обычный'}</span>
                        </div>
                        <div class="queue-row" style="display: flex; justify-content: space-between; margin-bottom: 15px; padding: 8px 0;">
                            <span class="queue-label" style="color: #666; font-weight: 500;">Дата:</span>
                            <span class="queue-value" style="color: #0a1a33;">${bid.date || bid.created_at ? (bid.date || bid.created_at.split('T')[0]) : 'Не указана'}</span>
                        </div>
                        
                        <div class="queue-assign" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                            <button class="btn-assign" onclick="if(window.adminPanel) adminPanel.openAssignModal(${bid.id})" 
                                    style="padding: 10px 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; width: 100%;">
                                Распределить
                            </button>
                            <button class="btn-secondary" onclick="if(window.adminPanel) adminPanel.takeBidInWork(${bid.id})" 
                                    style="padding: 10px 16px; background: #ffc107; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; width: 100%;">
                                Взять в работу
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            queueList.innerHTML = html;
        } catch (error) {
            console.error('Ошибка при загрузке очереди:', error);
            const queueList = document.getElementById('queueList');
            if (queueList) {
                queueList.innerHTML = '<p style="text-align: center; padding: 20px; color: #dc3545;">Ошибка загрузки очереди: ' + error.message + '</p>';
            }
        }
    }

    // Взять заявку в работу из очереди (с проверкой транспорта)
    async takeBidInWork(bidId) {
        try {
            const bid = await transportDBCompat.getBidById(bidId);
            if (!bid) {
                alert('Заявка не найдена');
                return;
            }

            // Проверяем, назначен ли уже транспорт
            const assignments = JSON.parse(localStorage.getItem('cargo_assignments') || '[]');
            const assignment = assignments.find(a => a.bidId === bidId);
            
            if (!assignment && !bid.assigned_truck_id) {
                // Транспорт не назначен
                const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
                const availableTrucks = trucks.filter(t => t.status === 'available');
                
                if (availableTrucks.length === 0) {
                    alert('⚠️ Невозможно взять заявку в работу: нет свободного транспорта!\n\nПожалуйста, сначала распределите груз на транспортные средства.');
                    return;
                }
                
                // Предлагаем распределить
                const confirmDistribute = confirm(
                    '⚠️ Для заявки не назначен транспорт!\n\n' +
                    'Необходимо сначала распределить груз на транспортные средства.\n\n' +
                    'Открыть окно распределения?'
                );
                
                if (confirmDistribute) {
                    this.openAssignModal(bidId);
                }
                return;
            }

            // Транспорт назначен, можно взять в работу
            await transportDBCompat.updateBidStatus(bidId, 'в работе');
            this.loadBids();
            this.loadStats();
            this.loadSuggestions();
            
            // Обновляем очередь если она открыта
            if (document.getElementById('queueSection')?.style.display !== 'none') {
                this.loadQueueBids();
            }
            
            showSuccess('Заявка взята в работу');
        } catch (error) {
            console.error('Ошибка при взятии заявки в работу:', error);
            alert('Ошибка: ' + error.message);
        }
    }
}

// Создаем глобальный экземпляр adminPanel
let adminPanel;
if (typeof window !== 'undefined') {
    window.adminPanel = new AdminPanel();
    adminPanel = window.adminPanel;
} else {
    adminPanel = new AdminPanel();
}

// Функции для показа/скрытия разделов
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'none';
    // Обновляем статистику и предложения при показе dashboard
    if (window.adminPanel) {
        adminPanel.loadStats();
        adminPanel.loadSuggestions();
    }
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
    if (window.adminPanel) {
        adminPanel.loadTransport();
    }
}

function showQueue() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'block';
    // Загружаем заявки в очереди
    if (typeof loadQueueBids === 'function') {
        loadQueueBids();
    } else if (window.adminPanel) {
        // Альтернативный способ загрузки очереди
        adminPanel.loadBids().then(() => {
            const bids = adminPanel.bidsCache || [];
            const queueBids = bids.filter(bid => bid.status === 'новая');
            const queueList = document.getElementById('queueList');
            
            if (!queueList) return;
            
            if (queueBids.length === 0) {
                queueList.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">Нет заявок в очереди</p>';
                return;
            }
            
            let html = '<h3 style="margin-bottom: 20px;">Заявки в очереди на обработку</h3>';
            html += '<div class="queue-grid">';
            
            queueBids.forEach(bid => {
                html += `
                    <div class="queue-card">
                        <div class="queue-card-header">
                            <h4>#${bid.id} ${bid.wherefrom} → ${bid.towhere}</h4>
                            <span class="queue-badge">Новая заявка</span>
                        </div>
                        
                        <div class="queue-row">
                            <span class="queue-label">Вес</span>
                            <span class="queue-value">${bid.weight || '0'} кг</span>
                        </div>
                        <div class="queue-row">
                            <span class="queue-label">Тип груза</span>
                            <span class="queue-value">${bid.type || 'Обычный'}</span>
                        </div>
                        <div class="queue-row">
                            <span class="queue-label">Дата</span>
                            <span class="queue-value">${bid.date || 'Не указана'}</span>
                        </div>
                        
                        <div class="queue-assign">
                            <button class="btn-assign" onclick="if(window.adminPanel) adminPanel.openAssignModal(${bid.id})">
                                Распределить
                            </button>
                            <button class="btn-secondary" onclick="if(window.adminPanel) adminPanel.takeBidInWork(${bid.id})" 
                                    style="margin-top: 8px; padding: 6px 12px; background: #ffc107; color: #000; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;">
                                Взять в работу
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            queueList.innerHTML = html;
        });
    }
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
    const form = document.getElementById('addTransportForm');
    if (form) {
        form.reset();
        hideTransportFormErrors();
        
        // Убираем подсветку полей
        ['truckModel', 'truckPlate', 'truckCapacity'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.style.borderColor = '';
            }
        });
    }
}

// Обработчик формы транспорта
document.addEventListener('DOMContentLoaded', function() {
    const transportForm = document.getElementById('addTransportForm');
    if (transportForm) {
        // Валидация в реальном времени
        const modelInput = document.getElementById('truckModel');
        const plateInput = document.getElementById('truckPlate');
        const capacityInput = document.getElementById('truckCapacity');
        
        // Проверка на отрицательные значения для грузоподъемности
        if (capacityInput) {
            capacityInput.addEventListener('input', function() {
                if (this.value < 0) {
                    this.value = 0;
                }
                if (this.value > 100000) {
                    this.value = 100000;
                }
            });
        }
        
        // Очистка ошибок при вводе
        [modelInput, plateInput, capacityInput].forEach(input => {
            if (input) {
                input.addEventListener('input', function() {
                    hideTransportFormErrors();
                    this.style.borderColor = '';
                });
            }
        });
        
        transportForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Скрываем предыдущие ошибки
            hideTransportFormErrors();
            
            const truckData = {
                model: document.getElementById('truckModel').value.trim(),
                license_plate: document.getElementById('truckPlate').value.trim(),
                capacity_kg: document.getElementById('truckCapacity').value
            };
            
            // Валидация перед отправкой
            const validationErrors = adminPanel.validateTruckData(truckData);
            if (validationErrors.length > 0) {
                showTransportFormErrors(validationErrors);
                highlightInvalidFields(validationErrors, truckData);
                return;
            }
            
            try {
                await adminPanel.addTruck(truckData);
                closeAddTransportModal();
                showSuccess('Транспорт успешно добавлен!');
            } catch (error) {
                const errorMessage = error.message || 'Неизвестная ошибка';
                showTransportFormErrors([errorMessage]);
                showError('Ошибка при добавлении транспорта: ' + errorMessage);
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

// Функции для отображения ошибок формы транспорта
function showTransportFormErrors(errors) {
    const errorContainer = document.getElementById('transportFormErrors');
    const errorList = document.getElementById('transportErrorList');
    
    if (errorContainer && errorList) {
        errorList.innerHTML = '';
        errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errorList.appendChild(li);
        });
        errorContainer.style.display = 'block';
    }
}

function hideTransportFormErrors() {
    const errorContainer = document.getElementById('transportFormErrors');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
    
    // Убираем подсветку полей
    ['truckModel', 'truckPlate', 'truckCapacity'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.style.borderColor = '';
        }
    });
}

function highlightInvalidFields(errors, truckData) {
    // Подсвечиваем поля с ошибками
    if (errors.some(e => e.includes('Модель'))) {
        const input = document.getElementById('truckModel');
        if (input) input.style.borderColor = '#dc3545';
    }
    
    if (errors.some(e => e.includes('номер') || e.includes('Государственный'))) {
        const input = document.getElementById('truckPlate');
        if (input) input.style.borderColor = '#dc3545';
    }
    
    if (errors.some(e => e.includes('Грузоподъемность') || e.includes('грузоподъемность'))) {
        const input = document.getElementById('truckCapacity');
        if (input) input.style.borderColor = '#dc3545';
    }
}

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