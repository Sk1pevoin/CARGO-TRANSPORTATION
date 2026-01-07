
class IndexedDBManager {
    constructor() {
        this.dbName = 'CargoTransportationDB';
        this.version = 2;
        this.db = null;
        this.init();
    }

    async init() {
        await this.openDatabase();
        await this.initializeDefaultData();
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ IndexedDB не доступен');
                reject(new Error('IndexedDB не доступен'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB инициализирован');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    usersStore.createIndex('login', 'login', { unique: true });
                    usersStore.createIndex('email', 'email', { unique: false });
                }

                if (!db.objectStoreNames.contains('bids')) {
                    const bidsStore = db.createObjectStore('bids', { keyPath: 'id', autoIncrement: true });
                    bidsStore.createIndex('user_id', 'user_id');
                    bidsStore.createIndex('status', 'status');
                    bidsStore.createIndex('date', 'date');
                }

                if (!db.objectStoreNames.contains('contacts')) {
                    db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('trucks')) {
                    const trucksStore = db.createObjectStore('trucks', { keyPath: 'id', autoIncrement: true });
                    trucksStore.createIndex('status', 'status');
                    trucksStore.createIndex('license_plate', 'license_plate', { unique: true });
                }

                if (!db.objectStoreNames.contains('calculations')) {
                    const calculationsStore = db.createObjectStore('calculations', { keyPath: 'id', autoIncrement: true });
                    calculationsStore.createIndex('user_id', 'user_id');
                    calculationsStore.createIndex('timestamp', 'timestamp');
                }

                console.log('✅ Структура IndexedDB создана/обновлена');
            };
        });
    }

    async initializeDefaultData() {
        
        const testUser = await this.getUserByLogin('test');
        if (!testUser) {
            await this.createUser('test', '123456');
            console.log('✅ Создан тестовый пользователь: test/123456');
        }

        
        const adminUser = await this.getUserByLogin('admin');
        if (!adminUser) {
            await this.createAdminUser();
            console.log('✅ Создан администратор: admin/admin123');
        }
    }

    async createAdminUser() {
        const adminUser = {
            login: 'admin',
            password: 'admin123',
            name: 'Администратор',
            email: 'admin@cargo.ru',
            phone: '+375 (29) 000-00-00',
            role: 'admin',
            created_at: new Date().toISOString()
        };

        return this.addItem('users', adminUser);
    }

    
    async createUser(login, password) {
        const user = {
            login,
            password, 
            name: '',
            email: '',
            phone: '',
            role: 'user',
            created_at: new Date().toISOString()
        };

        return this.addItem('users', user);
    }

    async getUserByLogin(login) {
        return this.getByIndex('users', 'login', login);
    }

    async getUserById(id) {
        return this.getItem('users', id);
    }

    async updateUser(userId, updates) {
        return this.updateItem('users', userId, updates);
    }

    
    async createBid(bidData) {
        const bid = {
            name: bidData.name || 'Заявка на перевозку',
            wherefrom: bidData.wherefrom,
            towhere: bidData.towhere,
            status: 'новая',
            user_id: bidData.user_id,
            weight: bidData.weight || null,
            type: bidData.type || null,
            date: bidData.date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };

        return this.addItem('bids', bid);
    }

    async getBids(userId = null) {
        const bids = await this.getAll('bids');
        
        if (userId) {
            return bids.filter(bid => bid.user_id === userId)
                      .sort((a, b) => b.id - a.id);
        }
        
        return bids.sort((a, b) => b.id - a.id);
    }

    async getBidById(id) {
        return this.getItem('bids', id);
    }

    async updateBidStatus(bidId, newStatus) {
        return this.updateItem('bids', bidId, { status: newStatus });
    }

    async assignTruckToBid(bidId, truckId) {
        const bid = await this.getItem('bids', bidId);
        if (!bid) {
            throw new Error('Заявка не найдена');
        }
        
        const truck = await this.getItem('trucks', truckId);
        if (truck) {
            await this.updateItem('trucks', truckId, { status: 'busy' });
        }
        
        return this.updateItem('bids', bidId, { 
            assigned_truck_id: truckId,
            status: 'в работе'
        });
    }

    async createTruck(truckData) {
        const truck = {
            model: truckData.model,
            license_plate: truckData.license_plate,
            capacity_kg: parseFloat(truckData.capacity_kg),
            status: 'available',
            created_at: new Date().toISOString()
        };

        return this.addItem('trucks', truck);
    }

    async getAllTrucks() {
        return this.getAll('trucks');
    }

    async getAvailableTrucks() {
        try {
            const trucksFromLS = JSON.parse(localStorage.getItem('trucks') || '[]');
            if (trucksFromLS && trucksFromLS.length > 0) {
                const available = trucksFromLS.filter(truck => truck.status === 'available');
                console.log('🚛 Транспорт из localStorage:', trucksFromLS.length, 'всего,', available.length, 'доступно');
                return available;
            }
        } catch (error) {
            console.error('Ошибка при загрузке транспорта из localStorage:', error);
        }
        
        try {
            const trucks = await this.getAll('trucks');
            if (trucks && trucks.length > 0) {
                const available = trucks.filter(truck => truck.status === 'available');
                console.log('🚛 Транспорт из IndexedDB:', trucks.length, 'всего,', available.length, 'доступно');
                return available;
            }
        } catch (error) {
            console.log('Не удалось загрузить транспорт из IndexedDB:', error);
        }
        
        console.log('⚠️ Транспорт не найден ни в localStorage, ни в IndexedDB');
        return [];
    }

    async deleteTruck(truckId) {
        return this.deleteItem('trucks', truckId);
    }

    async updateTruckStatus(truckId, newStatus) {
        return this.updateItem('trucks', truckId, { status: newStatus });
    }

    
    async createContact(contactData) {
        const contact = {
            phone: contactData.phone,
            email: contactData.email,
            name: contactData.name || null,
            subject: contactData.subject || null,
            message: contactData.message || null,
            created_at: new Date().toISOString()
        };

        return this.addItem('contacts', contact);
    }

    async getContacts() {
        return this.getAll('contacts');
    }

    
    async getStats() {
        const [bids, users, trucks] = await Promise.all([
            this.getAll('bids'),
            this.getAll('users'),
            this.getAll('trucks')
        ]);

        return {
            totalBids: bids.length,
            newBids: bids.filter(b => b.status === 'новая').length,
            activeBids: bids.filter(b => b.status === 'в работе').length,
            completedBids: bids.filter(b => b.status === 'выполнена').length,
            totalUsers: users.length,
            availableTrucks: trucks.filter(t => t.status === 'available').length
        };
    }

    
    async saveCalculation(calcData) {
        const calculation = {
            user_id: calcData.user_id,
            from: calcData.from,
            to: calcData.to,
            distance: calcData.distance,
            weight: calcData.weight,
            type: calcData.type,
            typeName: calcData.typeName,
            cost: calcData.cost,
            date: calcData.date,
            timestamp: new Date().toISOString()
        };

        return this.addItem('calculations', calculation);
    }

    async getUserCalculations(userId) {
        const calculations = await this.getAll('calculations');
        return calculations
            .filter(calc => calc.user_id === userId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    
    addItem(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);

            request.onsuccess = () => {
                item.id = request.result;
                resolve(item);
            };
            request.onerror = () => reject(request.error);
        });
    }

    getItem(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.get(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    updateItem(storeName, id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                const item = request.result;
                if (item) {
                    Object.assign(item, updates);
                    store.put(item);
                    resolve(item);
                } else {
                    reject(new Error('Элемент не найден'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    deleteItem(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}


const transportDB = new IndexedDBManager();


// Вспомогательная функция для работы с API
const API_BASE_URL = window.location.origin;

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API request error (${endpoint}):`, error);
        throw error;
    }
}

class TransportDatabase {
    constructor() {
        console.log('✅ TransportDatabase инициализирован (API версия)');
    }

    
    async registerUser(authData) {
        try {
            const result = await apiRequest('/api/register', {
                method: 'POST',
                body: JSON.stringify({
                    login: authData.login,
                    password: authData.password
                })
            });
            
            return result;
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
            throw error;
        }
    }

    async loginUser(login, password) {
        try {
            const result = await apiRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify({ login, password })
            });
            
            return result;
        } catch (error) {
            console.error('Ошибка при входе:', error);
            throw error;
        }
    }

    
    async addBid(bidData) {
        try {
            const result = await apiRequest('/api/bids', {
                method: 'POST',
                body: JSON.stringify(bidData)
            });
            
            return result;
        } catch (error) {
            console.error('Ошибка при добавлении заявки:', error);
            throw error;
        }
    }

    async getAllBids() {
        try {
            return await apiRequest('/api/bids');
        } catch (error) {
            console.error('Ошибка при получении заявок:', error);
            return [];
        }
    }

    async getBidById(id) {
        try {
            const bids = await apiRequest('/api/bids');
            return bids.find(bid => bid.id === parseInt(id, 10)) || null;
        } catch (error) {
            console.error('Ошибка при получении заявки:', error);
            return null;
        }
    }

    async getMyBids() {
        try {
            return await apiRequest('/api/bids?mine=true');
        } catch (error) {
            console.error('Ошибка при получении заявок пользователя:', error);
            return [];
        }
    }

    async updateBidStatus(id, newStatus) {
        try {
            return await apiRequest(`/api/bids/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
        } catch (error) {
            console.error('Ошибка при обновлении статуса заявки:', error);
            throw error;
        }
    }

    async assignTruckToBid(bidId, truckId) {
        try {
            // Обновляем статус заявки на "в работе"
            await this.updateBidStatus(bidId, 'в работе');
            // Сохраняем информацию о назначении транспорта в localStorage
            // (так как в текущей схеме БД нет поля assigned_truck_id в API)
            const assignments = JSON.parse(localStorage.getItem('cargo_assignments') || '[]');
            const existingIndex = assignments.findIndex(a => a.bidId === bidId);
            
            if (existingIndex >= 0) {
                assignments[existingIndex].trucks = [{ truckId: truckId, assignedWeight: null }];
            } else {
                assignments.push({
                    bidId: bidId,
                    trucks: [{ truckId: truckId, assignedWeight: null }],
                    assignedAt: new Date().toISOString()
                });
            }
            
            localStorage.setItem('cargo_assignments', JSON.stringify(assignments));
            
            // Обновляем статус транспорта
            const trucks = JSON.parse(localStorage.getItem('trucks') || '[]');
            const truck = trucks.find(t => t.id === truckId);
            if (truck) {
                truck.status = 'busy';
                localStorage.setItem('trucks', JSON.stringify(trucks));
            }
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка при назначении транспорта:', error);
            throw error;
        }
    }

    
    async addTruck(truckData) {
        try {
            return await transportDB.createTruck(truckData);
        } catch (error) {
            console.error('Ошибка при добавлении транспорта:', error);
            throw error;
        }
    }

    async getAllTrucks() {
        try {
            return await transportDB.getAllTrucks();
        } catch (error) {
            console.error('Ошибка при получении транспорта:', error);
            return [];
        }
    }

    async deleteTruck(id) {
        try {
            await transportDB.deleteTruck(id);
            return { success: true };
        } catch (error) {
            console.error('Ошибка при удалении транспорта:', error);
            throw error;
        }
    }

    
    async addContact(contactData) {
        try {
            return await apiRequest('/api/contacts', {
                method: 'POST',
                body: JSON.stringify(contactData)
            });
        } catch (error) {
            console.error('Ошибка при добавлении контакта:', error);
            throw error;
        }
    }

    async getAllContacts() {
        try {
            return await apiRequest('/api/contacts');
        } catch (error) {
            console.error('Ошибка при получении контактов:', error);
            return [];
        }
    }

    
    async getStats() {
        try {
            return await apiRequest('/api/admin/stats');
        } catch (error) {
            console.error('Ошибка при получении статистики:', error);
            return {
                totalBids: 0,
                newBids: 0,
                activeBids: 0,
                completedBids: 0,
                totalUsers: 0,
                availableTrucks: 0
            };
        }
    }

    
    async updateUserProfile(profileData) {
        try {
            const result = await apiRequest('/api/user/profile', {
                method: 'PATCH',
                body: JSON.stringify(profileData)
            });
            
            // Обновляем пользователя в localStorage
            if (result.success && result.user) {
                localStorage.setItem('current_user', JSON.stringify(result.user));
            }
            
            return result;
        } catch (error) {
            console.error('Ошибка при обновлении профиля:', error);
            throw error;
        }
    }

    
    async saveCalculation(calcData) {
        try {
            const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
            return await transportDB.saveCalculation({
                ...calcData,
                user_id: currentUser.id
            });
        } catch (error) {
            console.error('Ошибка при сохранении расчета:', error);
            throw error;
        }
    }

    async getUserCalculations() {
        try {
            const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
            return await transportDB.getUserCalculations(currentUser.id);
        } catch (error) {
            console.error('Ошибка при получении расчетов:', error);
            return [];
        }
    }

    
    getData(tableName) {
        return Promise.resolve([]);
    }

    async getSuggestions() {
        try {
            console.log('🔍 Поиск предложений...');
            const allBids = await this.getAllBids();
            console.log('📝 Всего заявок:', allBids.length);
            
            const newBids = allBids.filter(b => b.status === 'новая');
            console.log('🆕 Новых заявок:', newBids.length);
            
            if (newBids.length === 0) {
                console.log('ℹ️ Нет новых заявок');
                return [];
            }
            
            // Для транспорта используем IndexedDB как fallback, так как API для транспорта может быть не реализовано
            let availableTrucks = [];
            try {
                availableTrucks = await transportDB.getAvailableTrucks();
            } catch (error) {
                console.log('Транспорт из IndexedDB недоступен, используем пустой список');
            }
            
            console.log('🚛 Доступно транспорта:', availableTrucks.length);
            
            if (availableTrucks.length === 0) {
                console.log('⚠️ Нет свободного транспорта, но показываем заявки');
                return newBids.map(bid => ({
                    bid: bid,
                    trucks: [],
                    canDistribute: false,
                    needsMultiple: false
                }));
            }
            
            return newBids.map(bid => {
                const bidWeight = parseFloat(bid.weight) || 0;
                
                const suitableSingleTrucks = availableTrucks.filter(truck => {
                    const capacity = parseFloat(truck.capacity_kg) || 0;
                    return capacity >= bidWeight;
                });
                
                const totalCapacity = availableTrucks.reduce((sum, truck) => {
                    return sum + (parseFloat(truck.capacity_kg) || 0);
                }, 0);
                
                const canDistribute = totalCapacity >= bidWeight;
                const needsMultiple = bidWeight > 0 && suitableSingleTrucks.length === 0 && canDistribute;
                
                return {
                    bid: bid,
                    trucks: suitableSingleTrucks.length > 0 ? suitableSingleTrucks : availableTrucks,
                    canDistribute: canDistribute,
                    needsMultiple: needsMultiple,
                    totalCapacity: totalCapacity
                };
            });
        } catch (error) {
            console.error('Ошибка при получении предложений:', error);
            return [];
        }
    }
}


const transportDBCompat = new TransportDatabase();