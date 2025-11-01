class TransportDatabase {
    constructor() {
        this.dbName = 'CARGO-TRANSPORTATION.db';
        this.init();
    }

    init() {
        // Для браузера используем localStorage как временное хранилище
        if (!localStorage.getItem('transport_db_initialized')) {
            this.initializeData();
        }
    }

    initializeData() {
        // Инициализируем начальные данные если их нет
        const initialData = {
            bids: [],
            client_auth: [],
            contacts: [],
            drivers: [],
            trucks: []
        };
        
        localStorage.setItem('transport_data', JSON.stringify(initialData));
        localStorage.setItem('transport_db_initialized', 'true');
    }

    // Общие методы для работы с данными
    getData(tableName) {
        const data = JSON.parse(localStorage.getItem('transport_data') || '{}');
        return data[tableName] || [];
    }

    setData(tableName, data) {
        const allData = JSON.parse(localStorage.getItem('transport_data') || '{}');
        allData[tableName] = data;
        localStorage.setItem('transport_data', JSON.stringify(allData));
    }

    // 📝 МЕТОДЫ ДЛЯ РАБОТЫ С ЗАЯВКАМИ (bid)
    async addBid(bidData) {
        return new Promise((resolve) => {
            const bids = this.getData('bids');
            const newBid = {
                id: Date.now(), // Используем timestamp как ID
                name: bidData.name,
                wherefrom: bidData.wherefrom,
                towhere: bidData.towhere,
                status: 'новая',
                date: new Date().toLocaleDateString()
            };
            
            bids.push(newBid);
            this.setData('bids', bids);
            resolve(newBid);
        });
    }

    async getAllBids() {
        return new Promise((resolve) => {
            const bids = this.getData('bids');
            resolve(bids);
        });
    }

    async updateBidStatus(id, newStatus) {
        return new Promise((resolve) => {
            const bids = this.getData('bids');
            const bidIndex = bids.findIndex(bid => bid.id == id);
            
            if (bidIndex !== -1) {
                bids[bidIndex].status = newStatus;
                this.setData('bids', bids);
                resolve({ success: true });
            } else {
                resolve({ success: false });
            }
        });
    }

    // 🔐 МЕТОДЫ ДЛЯ АВТОРИЗАЦИИ (client_auth)
    async registerUser(authData) {
        return new Promise((resolve, reject) => {
            const users = this.getData('client_auth');
            
            // Проверяем, нет ли уже пользователя с таким логином
            const existingUser = users.find(user => user.login === authData.login);
            if (existingUser) {
                reject(new Error('Пользователь с таким логином уже существует'));
                return;
            }
            
            const newUser = {
                id: Date.now(),
                login: authData.login,
                password: authData.password
            };
            
            users.push(newUser);
            this.setData('client_auth', users);
            resolve(newUser);
        });
    }

    async loginUser(login, password) {
        return new Promise((resolve) => {
            const users = this.getData('client_auth');
            const user = users.find(u => u.login === login && u.password === password);
            resolve(user || null);
        });
    }

    // 📞 МЕТОДЫ ДЛЯ КОНТАКТОВ (contacts)
    async addContact(contactData) {
        return new Promise((resolve) => {
            const contacts = this.getData('contacts');
            const newContact = {
                id: Date.now(),
                phone: contactData.phone,
                email: contactData.email
            };
            
            contacts.push(newContact);
            this.setData('contacts', contacts);
            resolve(newContact);
        });
    }

    async getAllContacts() {
        return new Promise((resolve) => {
            const contacts = this.getData('contacts');
            resolve(contacts);
        });
    }

    // 🚛 МЕТОДЫ ДЛЯ ГРУЗОВИКОВ (trucks)
    async addTruck(truckData) {
        return new Promise((resolve) => {
            const trucks = this.getData('trucks');
            const newTruck = {
                id: Date.now(),
                model: truckData.model,
                license_plate: truckData.license_plate,
                capacity_kg: truckData.capacity_kg,
                status: 'available'
            };
            
            trucks.push(newTruck);
            this.setData('trucks', trucks);
            resolve(newTruck);
        });
    }

    async getAllTrucks() {
        return new Promise((resolve) => {
            const trucks = this.getData('trucks');
            resolve(trucks);
        });
    }

    // 👨‍💼 МЕТОДЫ ДЛЯ ВОДИТЕЛЕЙ (drivers)
    async addDriver(driverData) {
        return new Promise((resolve) => {
            const drivers = this.getData('drivers');
            const newDriver = {
                id: Date.now(),
                name: driverData.name,
                phone: driverData.phone,
                license_number: driverData.license_number,
                status: 'available'
            };
            
            drivers.push(newDriver);
            this.setData('drivers', drivers);
            resolve(newDriver);
        });
    }

    async getAllDrivers() {
        return new Promise((resolve) => {
            const drivers = this.getData('drivers');
            resolve(drivers);
        });
    }
}

// Создаем глобальный экземпляр базы данных
const transportDB = new TransportDatabase();