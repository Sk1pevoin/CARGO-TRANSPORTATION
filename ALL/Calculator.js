// calculator.js - Функционал калькулятора стоимости перевозки с IndexedDB
document.addEventListener('DOMContentLoaded', function() {
    const calculatorForm = document.getElementById('calculatorForm');
    const calculationResult = document.getElementById('calculationResult');
    
    if (calculatorForm) {
        calculatorForm.addEventListener('submit', handleCalculatorSubmit);
        
        // Устанавливаем минимальную дату как сегодня
        const dateInput = document.getElementById('date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
        }
        
        // Автоматический расчет расстояния при изменении городов
        const fromInput = document.getElementById('from');
        const toInput = document.getElementById('to');
        const distanceInput = document.getElementById('distance');
        
        if (fromInput && toInput && distanceInput) {
            let timeout;
            
            function calculateDistance() {
                clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    const from = fromInput.value.trim();
                    const to = toInput.value.trim();
                    
                    if (from && to && from !== to) {
                        try {
                            const distance = await calculateRouteDistance(from, to);
                            if (distance) {
                                distanceInput.value = distance;
                            }
                        } catch (error) {
                            console.log('Не удалось рассчитать расстояние автоматически');
                        }
                    }
                }, 1000);
            }
            
            fromInput.addEventListener('input', calculateDistance);
            toInput.addEventListener('input', calculateDistance);
        }
    }
});

// Расчет расстояния между городами
async function calculateRouteDistance(from, to) {
    // Фиксированные расстояния между основными городами Беларуси
    const cityDistances = {
        'минск': {
            'гомель': 310,
            'брест': 350,
            'гродно': 280,
            'могилев': 200,
            'витебск': 250,
            'минск': 0
        },
        'гомель': {
            'минск': 310,
            'брест': 400,
            'гродно': 450,
            'могилев': 180,
            'витебск': 320,
            'гомель': 0
        },
        'брест': {
            'минск': 350,
            'гомель': 400,
            'гродно': 230,
            'могилев': 420,
            'витебск': 480,
            'брест': 0
        },
        'гродно': {
            'минск': 280,
            'гомель': 450,
            'брест': 230,
            'могилев': 430,
            'витебск': 380,
            'гродно': 0
        },
        'могилев': {
            'минск': 200,
            'гомель': 180,
            'брест': 420,
            'гродно': 430,
            'витебск': 170,
            'могилев': 0
        },
        'витебск': {
            'минск': 250,
            'гомель': 320,
            'брест': 480,
            'гродно': 380,
            'могилев': 170,
            'витебск': 0
        }
    };
    
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    
    // Ищем расстояние в матрице
    if (cityDistances[fromLower] && cityDistances[fromLower][toLower] !== undefined) {
        return cityDistances[fromLower][toLower];
    }
    
    // Если города не найдены, используем среднее расстояние
    return 250;
}

// Обработка формы калькулятора
async function handleCalculatorSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const calculationData = {
        from: formData.get('from'),
        to: formData.get('to'),
        weight: parseFloat(formData.get('weight')) || 0,
        type: formData.get('type'),
        date: formData.get('date'),
        distance: parseFloat(formData.get('distance')) || 0
    };
    
    // Валидация
    if (!calculationData.from || !calculationData.to) {
        alert('Пожалуйста, заполните пункты отправления и назначения');
        return;
    }
    
    if (calculationData.weight <= 0) {
        alert('Пожалуйста, укажите вес груза');
        return;
    }
    
    if (calculationData.distance <= 0) {
        alert('Пожалуйста, укажите расстояние');
        return;
    }
    
    // Расчет стоимости
    const cost = calculateTransportCost(calculationData);
    
    // Отображение результата
    displayCalculationResult(cost, calculationData);
    
    // Сохранение расчета в IndexedDB
    await saveCalculationToDB(calculationData, cost);
}

// Расчет стоимости перевозки
function calculateTransportCost(data) {
    const baseRatePerKm = 2.5; // руб за км
    const weightRatePerKgKm = 0.15; // руб за кг за км
    const minCost = 500; // минимальная стоимость
    
    let baseCost = data.distance * baseRatePerKm;
    let weightCost = data.weight * weightRatePerKgKm;
    
    // Надбавки за тип груза
    let typeMultiplier = 1;
    let typeName = '';
    
    switch(data.type) {
        case 'fragile':
            typeMultiplier = 1.8;
            typeName = 'Хрупкий';
            break;
        case 'dangerous':
            typeMultiplier = 2.2;
            typeName = 'Опасный';
            break;
        case 'oversized':
            typeMultiplier = 2.0;
            typeName = 'Негабаритный';
            break;
        default:
            typeMultiplier = 1.0;
            typeName = 'Обычный';
    }
    
    const typeCost = (baseCost + weightCost) * (typeMultiplier - 1);
    let totalCost = baseCost + weightCost + typeCost;
    
    // Применяем минимальную стоимость
    if (totalCost < minCost) {
        totalCost = minCost;
    }
    
    return {
        baseCost: Math.round(baseCost),
        weightCost: Math.round(weightCost),
        typeCost: Math.round(typeCost),
        totalCost: Math.round(totalCost),
        typeMultiplier: typeMultiplier,
        typeName: typeName,
        distance: data.distance,
        weight: data.weight
    };
}

// Отображение результата расчета
function displayCalculationResult(cost, data) {
    const resultElement = document.getElementById('calculationResult');
    const baseCostElement = document.getElementById('baseCost');
    const typeCostElement = document.getElementById('typeCost');
    const totalCostElement = document.getElementById('totalCost');
    
    if (baseCostElement) baseCostElement.textContent = `${cost.baseCost} руб.`;
    if (typeCostElement) typeCostElement.textContent = `${cost.typeCost} руб. (${cost.typeName})`;
    if (totalCostElement) totalCostElement.textContent = `${cost.totalCost} руб.`;
    
    // Добавляем детальную информацию
    const resultContent = document.querySelector('.result-content');
    if (resultContent) {
        // Удаляем старую детальную информацию если есть
        const oldDetails = resultContent.querySelector('.calculation-details');
        if (oldDetails) {
            oldDetails.remove();
        }
        
        const detailsHtml = `
            <div class="calculation-details" style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Детали расчета:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
                    <div><strong>Маршрут:</strong></div>
                    <div>${data.from} → ${data.to}</div>
                    
                    <div><strong>Расстояние:</strong></div>
                    <div>${cost.distance} км</div>
                    
                    <div><strong>Вес груза:</strong></div>
                    <div>${cost.weight} кг</div>
                    
                    <div><strong>Тип груза:</strong></div>
                    <div>${cost.typeName}</div>
                    
                    <div><strong>Коэффициент типа:</strong></div>
                    <div>×${cost.typeMultiplier}</div>
                </div>
            </div>
        `;
        
        resultContent.insertAdjacentHTML('beforeend', detailsHtml);
    }
    
    if (resultElement) {
        resultElement.style.display = 'block';
        resultElement.scrollIntoView({ behavior: 'smooth' });
    }
}

// Сохранение расчета в IndexedDB
async function saveCalculationToDB(data, cost) {
    try {
        const calcData = {
            from: data.from,
            to: data.to,
            distance: data.distance,
            weight: data.weight,
            type: data.type,
            typeName: cost.typeName,
            cost: cost.totalCost,
            date: data.date
        };
        
        await transportDBCompat.saveCalculation(calcData);
        console.log('Расчет сохранен в IndexedDB:', calcData);
    } catch (error) {
        console.error('Ошибка при сохранении расчета в IndexedDB:', error);
        // Fallback: сохраняем в localStorage
        saveCalculationToLocalStorage(data, cost);
    }
}

// Fallback: сохранение в localStorage
function saveCalculationToLocalStorage(data, cost) {
    try {
        const user = JSON.parse(localStorage.getItem('current_user') || '{}');
        const calculations = JSON.parse(localStorage.getItem('calculation_history') || '[]');
        
        const calculationRecord = {
            id: Date.now(),
            userId: user.id || null,
            timestamp: new Date().toISOString(),
            from: data.from,
            to: data.to,
            distance: data.distance,
            weight: data.weight,
            type: data.type,
            typeName: cost.typeName,
            cost: cost.totalCost,
            date: data.date
        };
        
        calculations.unshift(calculationRecord);
        localStorage.setItem('calculation_history', JSON.stringify(calculations.slice(0, 20)));
        
        console.log('Расчет сохранен в localStorage:', calculationRecord);
    } catch (error) {
        console.error('Ошибка при сохранении расчета в localStorage:', error);
    }
}

// Создание заявки из калькулятора
function createOrderFromCalc() {
    const user = authManager.getCurrentUser();
    
    if (!user.id) {
        alert('Для создания заявки необходимо войти в систему');
        window.location.href = 'login.html';
        return;
    }
    
    const form = document.getElementById('calculatorForm');
    const formData = new FormData(form);
    
    const bidData = {
        from: formData.get('from'),
        to: formData.get('to'),
        weight: parseFloat(formData.get('weight')) || 0,
        type: getCargoTypeText(formData.get('type')),
        date: formData.get('date')
    };
    
    // Сохраняем данные для перенаправления
    sessionStorage.setItem('calculator_bid_data', JSON.stringify(bidData));
    window.location.href = 'Bid.html';
}

// Получение текстового описания типа груза
function getCargoTypeText(type) {
    const types = {
        'ordinary': 'Обычный',
        'fragile': 'Хрупкий',
        'dangerous': 'Опасный',
        'oversized': 'Негабаритный'
    };
    return types[type] || 'Обычный';
}

// Сброс калькулятора
function resetCalculator() {
    const form = document.getElementById('calculatorForm');
    const resultElement = document.getElementById('calculationResult');
    
    if (form) form.reset();
    if (resultElement) resultElement.style.display = 'none';
    
    // Очищаем детальную информацию
    const details = document.querySelector('.calculation-details');
    if (details) {
        details.remove();
    }
}