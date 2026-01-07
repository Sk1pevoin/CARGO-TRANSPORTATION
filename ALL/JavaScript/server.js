const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Определяем корневую директорию проекта (на уровень выше папки JavaScript)
const rootDir = path.join(__dirname, '..');

// Middleware - ВАЖНО: cors должен быть первым
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());

// Статические файлы из корня проекта
app.use(express.static(rootDir));
// Статические файлы из папки Styles
app.use('/Styles', express.static(path.join(rootDir, 'Styles')));
// Статические файлы из папки JavaScript
app.use('/JavaScript', express.static(path.join(rootDir, 'JavaScript')));
// Статические файлы из папки Photos (если существует)
app.use('/Photos', express.static(path.join(rootDir, 'Photos')));

// Инициализация базы данных
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
        initializeDatabase();
    }
});

// Маршруты для HTML страниц
app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'Web.html'));
});

app.get('/Web.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'Web.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'register.html'));
});

app.get('/cabinet.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'cabinet.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('/Bid.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'Bid.html'));
});

app.get('/Calc.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'Calc.html'));
});

app.get('/About.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'About.html'));
});

app.get('/services.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'services.html'));
});

app.get('/Contacts.html', (req, res) => {
    res.sendFile(path.join(rootDir, 'Contacts.html'));
});

// Простой маршрут для проверки работы сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Сервер работает',
        timestamp: new Date().toISOString()
    });
});

// Инициализация таблиц
function initializeDatabase() {
    const sqlPath = path.join(rootDir, 'CARGO-TRANSPORTATION.db.sql');
    let sql = '';
    
    try {
        sql = fs.readFileSync(sqlPath, 'utf8');
    } catch (error) {
        console.log('Файл SQL схемы не найден, создаем таблицы по умолчанию');
        sql = `
            CREATE TABLE IF NOT EXISTS "bid" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "name" TEXT NOT NULL,
                "wherefrom" TEXT,
                "towhere" TEXT,
                "status" TEXT DEFAULT 'новая',
                "user_id" INTEGER,
                "weight" REAL,
                "type" TEXT,
                "date" TEXT,
                "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "client_auth" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "login" TEXT NOT NULL UNIQUE,
                "password" TEXT NOT NULL,
                "name" TEXT,
                "email" TEXT,
                "phone" TEXT,
                "role" TEXT DEFAULT 'user',
                "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS "contacts" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "phone" TEXT NOT NULL,
                "email" TEXT NOT NULL,
                "name" TEXT,
                "subject" TEXT,
                "message" TEXT,
                "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `;
    }
    
    // Убираем BEGIN TRANSACTION и COMMIT
    sql = sql.replace(/BEGIN TRANSACTION;/gi, '');
    sql = sql.replace(/COMMIT;/gi, '');
    
    db.serialize(() => {
        // Разбиваем на отдельные запросы
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        
        statements.forEach((statement, index) => {
            if (statement.trim()) {
                db.run(statement.trim(), (err) => {
                    if (err && !err.message.includes('already exists')) {
                        console.error(`Ошибка при выполнении запроса ${index + 1}:`, err.message);
                    }
                });
            }
        });
        
        // Создаем тестового пользователя и админа после инициализации
        setTimeout(() => {
            createTestUser();
            createAdminUser();
            // Добавляем поле role если его нет
            addRoleColumnIfNotExists();
        }, 1000);
    });
}

// Добавление поля role в таблицу если его нет
function addRoleColumnIfNotExists() {
    db.all("PRAGMA table_info(client_auth)", [], (err, rows) => {
        if (err) {
            console.log('Ошибка при проверке структуры таблицы:', err.message);
            return;
        }
        
        const hasRoleColumn = rows && rows.some(row => row.name === 'role');
        if (!hasRoleColumn) {
            db.run("ALTER TABLE client_auth ADD COLUMN role TEXT DEFAULT 'user'", (err) => {
                if (err) {
                    // Игнорируем ошибку если колонка уже существует
                    if (!err.message.includes('duplicate column')) {
                        console.log('Ошибка при добавлении поля role:', err.message);
                    }
                } else {
                    console.log('✅ Поле role добавлено в таблицу client_auth');
                    // Обновляем существующих пользователей
                    db.run("UPDATE client_auth SET role = 'user' WHERE role IS NULL", (err) => {
                        if (err) {
                            console.log('Ошибка при обновлении ролей:', err.message);
                        }
                    });
                }
            });
        }
    });
}

// Создание тестового пользователя если его нет
function createTestUser() {
    db.get('SELECT * FROM client_auth WHERE login = ?', ['test'], (err, user) => {
        if (err) {
            console.log('Ошибка при проверке тестового пользователя:', err.message);
            return;
        }
        
        if (!user) {
            const testPassword = bcrypt.hashSync('123456', 10);
            db.run(
                'INSERT INTO client_auth (login, password, role) VALUES (?, ?, ?)',
                ['test', testPassword, 'user'],
                function(err) {
                    if (err) {
                        console.log('Не удалось создать тестового пользователя:', err.message);
                    } else {
                        console.log('✅ Создан тестовый пользователь: login=test, password=123456');
                    }
                }
            );
        }
    });
}

// Создание администратора если его нет
function createAdminUser() {
    db.get('SELECT * FROM client_auth WHERE login = ?', ['admin'], (err, user) => {
        if (err) {
            console.log('Ошибка при проверке администратора:', err.message);
            return;
        }
        
        if (!user) {
            const adminPassword = bcrypt.hashSync('admin123', 10);
            db.run(
                'INSERT INTO client_auth (login, password, role, name, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin', adminPassword, 'admin', 'Администратор', 'admin@cargo.ru', '+375 (29) 000-00-00'],
                function(err) {
                    if (err) {
                        console.log('Не удалось создать администратора:', err.message);
                    } else {
                        console.log('✅ Создан администратор: login=admin, password=admin123');
                    }
                }
            );
        } else {
            // Обновляем роль существующего админа если нужно
            if (user.role !== 'admin') {
                db.run('UPDATE client_auth SET role = ? WHERE login = ?', ['admin', 'admin'], (err) => {
                    if (err) {
                        console.log('Ошибка при обновлении роли администратора:', err.message);
                    } else {
                        console.log('✅ Роль администратора обновлена для пользователя admin');
                    }
                });
            }
        }
    });
}

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    // Для регистрации, входа и публичных контактов не требуется токен
    if (req.path === '/api/register' || req.path === '/api/login' || 
        (req.path === '/api/contacts' && req.method === 'POST')) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
}

// Применяем middleware аутентификации только к защищенным маршрутам
// Регистрация, вход и публичные контакты не требуют токена

// ==================== РЕГИСТРАЦИЯ И ВХОД ====================

// Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { login, password } = req.body;

        console.log('Регистрация пользователя:', { login });

        if (!login || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        if (login.length < 3) {
            return res.status(400).json({ error: 'Логин должен содержать минимум 3 символа' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        // Проверяем, существует ли пользователь
        db.get('SELECT * FROM client_auth WHERE login = ?', [login], async (err, user) => {
            if (err) {
                console.error('Ошибка БД при проверке пользователя:', err);
                return res.status(500).json({ error: 'Ошибка базы данных' });
            }

            if (user) {
                return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
            }

            try {
                // Хешируем пароль
                const hashedPassword = await bcrypt.hash(password, 10);

                // Сохраняем пользователя
                db.run(
                    'INSERT INTO client_auth (login, password) VALUES (?, ?)',
                    [login, hashedPassword],
                    function(err) {
                        if (err) {
                            console.error('Ошибка при сохранении пользователя:', err);
                            return res.status(500).json({ error: 'Ошибка при регистрации' });
                        }

                        // Создаем JWT токен
                        const token = jwt.sign({ 
                            id: this.lastID, 
                            login: login,
                            role: 'user'
                        }, JWT_SECRET, { expiresIn: '24h' });

                        console.log('Пользователь успешно зарегистрирован:', { id: this.lastID, login });

                        res.json({
                            success: true,
                            user: { 
                                id: this.lastID, 
                                login: login,
                                role: 'user'
                            },
                            token: token
                        });
                    }
                );
            } catch (hashError) {
                console.error('Ошибка при хешировании пароля:', hashError);
                return res.status(500).json({ error: 'Ошибка при регистрации' });
            }
        });
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;

    console.log('Вход пользователя:', { login });

    if (!login || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    db.get('SELECT * FROM client_auth WHERE login = ?', [login], async (err, user) => {
        if (err) {
            console.error('Ошибка БД при входе:', err);
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }

        if (!user) {
            console.log('Пользователь не найден:', login);
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        try {
            // Проверяем пароль
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log('Неверный пароль для пользователя:', login);
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            // Создаем JWT токен
            const token = jwt.sign({ 
                id: user.id, 
                login: user.login,
                role: user.role || 'user'
            }, JWT_SECRET, { expiresIn: '24h' });

            console.log('Пользователь успешно вошел:', { id: user.id, login, role: user.role || 'user' });

            res.json({
                success: true,
                user: { 
                    id: user.id, 
                    login: user.login,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role || 'user'
                },
                token: token
            });
        } catch (compareError) {
            console.error('Ошибка при проверке пароля:', compareError);
            return res.status(500).json({ error: 'Ошибка при входе' });
        }
    });
});

// ==================== ЗАЯВКИ (BIDS) ====================

// Получить заявки (все или только текущего пользователя при mine=true)
app.get('/api/bids', authenticateToken, (req, res) => {
    const onlyMine = String(req.query.mine || '').toLowerCase() === 'true';
    
    let sql, params;
    
    if (onlyMine && req.user) {
        sql = 'SELECT * FROM bid WHERE user_id = ? ORDER BY id DESC';
        params = [req.user.id];
    } else {
        sql = 'SELECT * FROM bid ORDER BY id DESC';
        params = [];
    }

    db.all(sql, params, (err, bids) => {
        if (err) {
            console.error('Ошибка при получении заявок:', err);
            return res.status(500).json({ error: 'Ошибка при получении заявок' });
        }
        res.json(bids);
    });
});

// Создать заявку
app.post('/api/bids', authenticateToken, (req, res) => {
    const { name, wherefrom, towhere, weight, type, date } = req.body;

    console.log('Создание заявки:', { name, wherefrom, towhere, weight, type, date, user: req.user });

    if (!wherefrom || !towhere) {
        return res.status(400).json({ error: 'Пункты отправления и назначения обязательны' });
    }

    const bidName = name || 'Заявка на перевозку';
    const bidStatus = 'новая';

    db.run(
        'INSERT INTO bid (name, wherefrom, towhere, status, user_id, weight, type, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [bidName, wherefrom, towhere, bidStatus, req.user?.id || null, weight || null, type || null, date || null],
        function(err) {
            if (err) {
                console.error('Ошибка при создании заявки:', err);
                return res.status(500).json({ error: 'Ошибка при создании заявки' });
            }
            
            const newBid = {
                id: this.lastID,
                name: bidName,
                wherefrom,
                towhere,
                status: bidStatus,
                user_id: req.user?.id || null,
                weight: weight || null,
                type: type || null,
                date: date || null
            };
            
            console.log('Заявка успешно создана:', newBid);
            res.json(newBid);
        }
    );
});

// Обновить статус заявки
app.patch('/api/bids/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Статус обязателен' });
    }

    db.run(
        'UPDATE bid SET status = ? WHERE id = ?',
        [status, id],
        function(err) {
            if (err) {
                console.error('Ошибка при обновлении заявки:', err);
                return res.status(500).json({ error: 'Ошибка при обновлении заявки' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Заявка не найдена' });
            }
            res.json({ success: true, message: 'Статус обновлен' });
        }
    );
});

// ==================== КОНТАКТЫ (CONTACTS) ====================

// Получить все контакты (требует аутентификации для админов)
app.get('/api/contacts', authenticateToken, (req, res) => {
    db.all('SELECT * FROM contacts ORDER BY id DESC', [], (err, contacts) => {
        if (err) {
            console.error('Ошибка при получении контактов:', err);
            return res.status(500).json({ error: 'Ошибка при получении контактов' });
        }
        res.json(contacts);
    });
});

// Добавить контакт
app.post('/api/contacts', (req, res) => {
    const { phone, email, name, subject, message } = req.body;

    console.log('Добавление контакта:', { phone, email, name, subject });

    if (!phone || !email) {
        return res.status(400).json({ error: 'Телефон и email обязательны' });
    }

    db.run(
        'INSERT INTO contacts (phone, email, name, subject, message) VALUES (?, ?, ?, ?, ?)',
        [phone, email, name || null, subject || null, message || null],
        function(err) {
            if (err) {
                console.error('Ошибка при добавлении контакта:', err);
                return res.status(500).json({ error: 'Ошибка при добавлении контакта' });
            }
            res.json({
                id: this.lastID,
                phone,
                email,
                name: name || null,
                subject: subject || null,
                message: message || null
            });
        }
    );
});

// ==================== АДМИН ПАНЕЛЬ - СТАТИСТИКА ====================

// Получить статистику
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    const stats = {};

    // Статистика заявок
    db.get('SELECT COUNT(*) as total FROM bid', [], (err, row) => {
        if (err) {
            console.error('Ошибка при получении статистики заявок:', err);
            return res.status(500).json({ error: 'Ошибка при получении статистики' });
        }
        
        stats.totalBids = row.total;

        db.get('SELECT COUNT(*) as count FROM bid WHERE status = ?', ['новая'], (err, row) => {
            if (!err && row) stats.newBids = row.count;
            
            db.get('SELECT COUNT(*) as count FROM bid WHERE status = ?', ['в работе'], (err, row) => {
                if (!err && row) stats.activeBids = row.count;
                
                db.get('SELECT COUNT(*) as count FROM bid WHERE status = ?', ['выполнена'], (err, row) => {
                    if (!err && row) stats.completedBids = row.count;
                    
                    // Статистика пользователей
                    db.get('SELECT COUNT(*) as count FROM client_auth', [], (err, row) => {
                        if (!err && row) stats.totalUsers = row.count;
                        
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// Обновление профиля пользователя
app.patch('/api/user/profile', authenticateToken, (req, res) => {
    const { name, email, phone } = req.body;
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (phone) { updates.push('phone = ?'); values.push(phone); }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    values.push(req.user.id);
    const sql = `UPDATE client_auth SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, values, function(err) {
        if (err) {
            console.error('Ошибка при обновлении профиля:', err);
            return res.status(500).json({ error: 'Ошибка при обновлении профиля' });
        }
        
        // Получаем обновленные данные пользователя
        db.get('SELECT * FROM client_auth WHERE id = ?', [req.user.id], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка при получении обновленного профиля' });
            }
            
            const userResponse = {
                id: user.id,
                login: user.login,
                name: user.name,
                email: user.email,
                phone: user.phone
            };
            
            res.json({
                success: true,
                user: userResponse
            });
        });
    });
});

// Запуск сервера
function startServer(startPort, attempt = 0) {
    const server = app.listen(startPort, () => {
        console.log(`🚀 Сервер запущен на http://localhost:${startPort}`);
        console.log(`📊 API доступно по адресу http://localhost:${startPort}/api`);
    });

    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && attempt < 10) {
            const nextPort = startPort + 1;
            console.warn(`⚠️ Порт ${startPort} уже используется. Пытаюсь запустить на порту ${nextPort}...`);
            setTimeout(() => startServer(nextPort, attempt + 1), 500);
        } else {
            console.error('Ошибка при запуске сервера:', err);
            process.exit(1);
        }
    });
}

startServer(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Остановка сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка при закрытии БД:', err.message);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});