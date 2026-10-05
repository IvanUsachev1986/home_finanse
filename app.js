// --- 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ССЫЛКИ ---
let prices = { subs: {}, rates: {} };
let tableData_train = [];
let tableData_buy = [];
let tableData_income = [];

// ВАШИ ССЫЛКИ
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbytSEPE3gzyU3WFipJxXne2DsWmseweZ50Ldg8QYA9l3yj6zr_exX6kDoxILxEk1Vzh/exec";
// output information buy and train
// https://script.google.com/home/projects/1pt6A8JFJcnjNrhwa4JYx5DBbmHVCm7pJUvGwZKrCyih09w10KHQUcJSg/edit
const URL_TRAIN =
  "https://script.google.com/macros/s/AKfycbzDz29LT58KLm-oNDBh-hN2C6SKiee3Pqn6h2f7rtrUlv9P_1dBe-WJTLGN0g94NwUp/exec";
// СОХРАНЕНИЕ ТРЕНИРОВОК
// https://script.google.com/home/projects/1CU_4kgjPg0Bh-tH7zCJtK1c5iZCnDrm0li62IJst_YKEfoDS8RXL3Mqp/edit
const URL_BUY =
  "https://script.google.com/macros/s/AKfycbzu9dortwjTo4DpRyZILrZ5yEfbvrymy0vjzh2EE98bUI6Bzv_v4d22Rwd6bUitFneA/exec";
// record_buy
// https://script.google.com/u/0/home/projects/1sqP0HIBeO-pgAmhAIqB7VpIYsSOoN9saPSkmIZPhokcXt8bBPgeRV2cN/edit
const URL_EXTRA_INCOME =
  "https://script.google.com/macros/s/AKfycbzbHTfrJ7VcZ-sIMLci27DuLk8d2BCICxgtxh0gP_30QT4ypaeuN3hiWdS-xbqzFsQawQ/exec";

const months = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

// --- 2. ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener("DOMContentLoaded", fetchData);
// --- ПОДГРУЗКА ИКОНОК (Один раз при старте) ---
fetch("icons.svg")
  .then((res) => res.text())
  .then((svg) => {
    document.body.insertAdjacentHTML("afterbegin", svg);
  })
  .catch((e) => console.log("Иконки не загружены", e));
// --- 1. ОФЛАЙН КЭШ ПРИ ЗАПУСКЕ ---
async function fetchData() {
  // 1. Мгновенно достаем старые данные из памяти (если есть)
  const cachedData = localStorage.getItem("appDataCache");
  if (cachedData) {
    try {
      processFetchedData(JSON.parse(cachedData));
    } catch (e) {
      console.warn("Кэш поврежден");
    }
  } else {
    // Лоадер показываем ТОЛЬКО если телефон открыл приложение впервые в жизни
    showLoader("Загрузка данных...");
  }

  // 2. Тихо стучимся на сервер за свежими данными в фоне
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Даем Гуглу максимум 10 сек

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const combinedData = await response.json();

    // Сохраняем свежие данные в память телефона
    localStorage.setItem("appDataCache", JSON.stringify(combinedData));

    // Обновляем интерфейс незаметно для пользователя
    processFetchedData(combinedData);

    // Проверяем, не накопились ли офлайн-отправки
    syncOfflineQueue();
  } catch (error) {
    console.warn("Работаем в офлайн-режиме (нет связи с сервером)");
  } finally {
    hideLoader();
  }
}

// Вспомогательная функция, чтобы не дублировать код распределения данных
function processFetchedData(combinedData) {
  window.appData = combinedData;
  if (combinedData.settings) updateInterfaceWithSettings(combinedData.settings);

  if (combinedData.buyCategoriesRaw)
    renderBuyCategories(combinedData.buyCategoriesRaw);

  // ... дальше идет обработка table1, table2 и т.д.

  tableData_train = (combinedData.table1 || []).map((row) => {
    if (row.Дата) {
      row.formattedMonth = !isNaN(new Date(row.Дата))
        ? months[new Date(row.Дата).getMonth()]
        : "Неизвестно";
    }
    return row;
  });

  tableData_buy = (combinedData.table2 || []).map((row) => {
    if (row.Дата) {
      row.formattedMonth = !isNaN(new Date(row.Дата))
        ? months[new Date(row.Дата).getMonth()]
        : "Неизвестно";
    }
    return row;
  });

  tableData_income = (combinedData.table3 || []).map((row) => {
    if (row.Дата) {
      row.formattedMonth = !isNaN(new Date(row.Дата))
        ? months[new Date(row.Дата).getMonth()]
        : "Неизвестно";
    }
    row.Категория =
      row.Категория || row.category || row.Category || "Не указано";
    row.Сумма =
      Number(row.Сумма) ||
      Number(row.Cумма) ||
      Number(row.amount) ||
      Number(row.Amount) ||
      0;
    return row;
  });

  initFilters();
  calculate();
}

window.studentsDatabase = {};
function updateInterfaceWithSettings(settings) {
  window.elementsDatabase = settings.elements || [];

  // Отрисовка списка учениц в разделе "Элементы"
  const elementsStudentsContainer = document.getElementById(
    "elements-students-list",
  );
  if (elementsStudentsContainer) {
    elementsStudentsContainer.innerHTML = "";
    let studentsProgressArray = settings.clients.map((client) => {
      const name = typeof client === "object" ? client.name : client;
      const photoUrl =
        typeof client === "object" && client.photo ? client.photo : "";
      const progressStr =
        typeof client === "object" && client.progress ? client.progress : "";
      const completedCount = progressStr
        ? progressStr.split(",").filter((e) => e.trim() !== "").length
        : 0;
      return { name, photoUrl, completedCount };
    });

    studentsProgressArray.sort((a, b) => b.completedCount - a.completedCount);

    studentsProgressArray.forEach((student) => {
      let finalPhotoUrl = getSafePhotoUrl(student.photoUrl);
      const initials = student.name
        ? student.name.substring(0, 1).toUpperCase()
        : "👤";
      const avatarContent = finalPhotoUrl
        ? `<img src="${finalPhotoUrl}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`
        : initials;

      elementsStudentsContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="ios-list-item" style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 16px; padding: 12px 16px; cursor: pointer;" onclick="openProgressModal('${student.name}')">
              <div class="student-avatar" style="border: 1px solid #e5e5ea;">${avatarContent}</div>
              <span class="student-name-large" style="flex: 1; text-align: left; margin: 0;">${student.name}</span>
              <span style="background: var(--ios-blue); color: white; border-radius: 12px; padding: 2px 10px; font-size: 14px; font-weight: bold;">${student.completedCount}</span>
              <span style="color: #c7c7cc; font-size: 20px; font-weight: bold;">›</span>
            </div>
          `,
      );
    });
  }

  // Обновляем списки для форм записи
  const dl = document.getElementById("names");
  if (dl) {
    dl.innerHTML = "";
    settings.clients.forEach((client) => {
      const name = typeof client === "object" ? client.name : client;
      dl.appendChild(new Option(name, name));
    });
  }

  // А) Ученицы (Настройки - с алфавитной сортировкой, фото, возрастом и иконками направлений)
  const studentsContainer = document.getElementById("students-list-container");
  if (studentsContainer) {
    studentsContainer.innerHTML = "";

    let sortedClients = [...settings.clients].sort((a, b) => {
      const nameA = (typeof a === "object" ? a.name : a).toLowerCase();
      const nameB = (typeof b === "object" ? b.name : b).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    sortedClients.forEach((client) => {
      const name = typeof client === "object" ? client.name : client;
      const photoUrl =
        typeof client === "object" && client.photo ? client.photo : "";
      const dob = typeof client === "object" && client.dob ? client.dob : "";

      window.studentsDatabase[name] =
        typeof client === "object" ? client : { name: name };

      let finalPhotoUrl = getSafePhotoUrl(photoUrl);
      const initials = name ? name.substring(0, 1).toUpperCase() : "👤";
      const avatarContent = finalPhotoUrl
        ? `<img src="${finalPhotoUrl}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">`
        : initials;

      let ageHtml = "";
      if (dob) {
        let birthDate;
        if (dob.includes(".")) {
          let parts = dob.split(".");
          birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          birthDate = new Date(dob);
        }
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          let txt = "лет";
          let count = age % 100;
          if (count >= 5 && count <= 20) {
            txt = "лет";
          } else {
            count = count % 10;
            if (count === 1) txt = "год";
            else if (count >= 2 && count <= 4) txt = "года";
          }
          ageHtml = `<span style="color: var(--text-muted); font-size: 15px; font-weight: normal; margin-left: 8px;">${age} ${txt}</span>`;
        }
      }

      // --- ГЕНЕРАЦИЯ SVG-ИКОНОК НАПРАВЛЕНИЙ ВНУТРИ ЦИКЛА ---
      const dirsStr =
        typeof client === "object" && client.directions
          ? client.directions
          : "";
      let dirsHtml =
        '<div style="display: flex; gap: 4px; margin-left: auto; margin-right: 10px;">';

      if (dirsStr.includes("Pole dance")) {
        dirsHtml += `
              <div style="width:28px; height:28px; border: 1px solid #ff9500; border-radius:50%; background-color: rgba(255, 149, 0, 0.2); display:flex; align-items:center; justify-content:center; color:#ff9500;" title="Pole dance">
                <svg style="width:16px; height:16px; fill:currentColor;"><use href="#icon-train"></use></svg>
              </div>`;
      }
      if (dirsStr.includes("Pole Exotic")) {
        dirsHtml += `
              <div style="width:28px; height:28px; border: 1px solid #ff2d55; border-radius:50%; background-color: rgba(255, 45, 85, 0.15); display:flex; align-items:center; justify-content:center; color:#ff2d55;" title="Pole Exotic">
                <svg style="width:16px; height:16px; fill:currentColor;"><use href="#icon-exotic"></use></svg>
              </div>`;
      }
      if (dirsStr.includes("Stretching")) {
        dirsHtml += `
              <div style="width:28px; height:28px; border: 1px solid #5ac8fa; border-radius:50%; background-color: rgba(90, 200, 250, 0.15); display:flex; align-items:center; justify-content:center; color:#5ac8fa;" title="Stretching">
                <svg style="width:16px; height:16px; fill:currentColor;"><use href="#icon-stretch"></use></svg>
              </div>`;
      }
      dirsHtml += "</div>";

      studentsContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="ios-list-item" style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 16px; padding: 12px 16px; cursor: pointer;" onclick="openStudentModal('${name}')">
              <div class="student-avatar" style="border: 1px solid #e5e5ea;">${avatarContent}</div>
              <div style="display: flex; flex-direction: column; align-items: flex-start;">
                <span class="student-name-large" style="margin: 0;">${name} ${ageHtml}</span>
              </div>
              ${dirsHtml}
              <span style="color: #c7c7cc; font-size: 20px; font-weight: bold;">›</span>
            </div>
          `,
      );
    });
  }

  // Б) Абонементы
  const subsContainer = document.getElementById("subs-list-container");
  const subSelect = document.getElementById("sub-select"); // <-- Находим наш пустующий список в форме

  if (subSelect) subSelect.innerHTML = ""; // Очищаем список перед новым заполнением

  if (subsContainer) {
    subsContainer.innerHTML = "";
    settings.subs.forEach((item) => {
      const [name, price] = item;
      prices.subs[name] = price;

      // НОВАЯ СТРОКА: Добавляем название абонемента в выпадающий список формы!
      if (subSelect) {
        subSelect.appendChild(new Option(name, name));
      }

      subsContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="ios-list-item" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 14px 16px;">
              <span style="font-size: 16px; font-weight: 500; color: var(--text-main);">${name}</span>
              <div style="display: flex; align-items: center; background: var(--ios-bg); padding: 6px 12px; border-radius: 10px; border: 1px solid #d1d1d6;">
                <input type="number" data-price-name="${name}" value="${price}" style="width: 60px; text-align: right; border: none; background: transparent; font-size: 16px; font-weight: bold; color: var(--ios-blue); padding: 0;">
                <span style="color: var(--text-muted); margin-left: 4px; font-weight: 600;">₪</span>
              </div>
            </div>
          `,
      );
    });
  }

  // В) Разовые занятия
  const ratesContainer = document.getElementById("rates-list-container");
  if (ratesContainer) {
    ratesContainer.innerHTML = "";
    settings.rates.forEach((item) => {
      const [name, price] = item;
      prices.rates[name] = price;
      ratesContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="ios-list-item" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 14px 16px;">
              <span style="font-size: 16px; font-weight: 500; color: var(--text-main);">${name}</span>
              <div style="display: flex; align-items: center; background: var(--ios-bg); padding: 6px 12px; border-radius: 10px; border: 1px solid #d1d1d6;">
                <input type="number" data-price-name="${name}" value="${price}" style="width: 60px; text-align: right; border: none; background: transparent; font-size: 16px; font-weight: bold; color: var(--ios-blue); padding: 0;">
                <span style="color: var(--text-muted); margin-left: 4px; font-weight: 600;">₪</span>
              </div>
            </div>
          `,
      );
    });
  }
  updatePrice();
}

// Открытие модального окна (пока с тестовыми данными или тем, что есть)

////////
// --- 3. ЛОГИКА НАВИГАЦИИ (ВЫПАДАЮЩЕЕ МЕНЮ) ---
const sectionsMap = {
  trainings: {
    // ... ваши старые строчки ...
    elements: "elements",
    nameElements: "Элементы",
  },
  "seg-train": {
    record: "train",
    analytics: "info_train",
    settings: "settings_train",
    elements: "elements", // <-- исправлено на 'elements'
    nameRecord: "Запись",
    nameAnalytics: "Аналитика",
    nameSettings: "Настройки",
    nameElements: "Элементы",
  },
  // ... buy и income оставляем без изменений
  "seg-buy": {
    record: "buy",
    analytics: "info_buy",
    settings: "settings_buy",
    nameRecord: "Запись трат",
    nameAnalytics: "Аналитика трат",
    nameSettings: "Настройки трат",
  },
  "seg-income": {
    record: "extra_income",
    analytics: "info_extra_income",
    settings: "settings_income",
    nameRecord: "Запись дохода",
    nameAnalytics: "Аналитика дохода",
    nameSettings: "Настройки доходов",
  },
};

const iconsMap = {
  record: "#icon-edit",
  analytics: "#icon-chart",
  settings: "#icon-gear",
  elements: "#icon-train", // <-- Новая строка
};

let currentGroup = "seg-buy"; // Стартовая группа (из data-group нижних кнопок)
let currentMode = "record"; // Стартовый режим

const menuTrigger = document.getElementById("menu-trigger-btn");
const dropdownMenu = document.getElementById("dropdown-menu");
const overlay = document.getElementById("dropdown-overlay");
const currentModeIcon = document.getElementById("current-mode-icon");
const titleEl = document.getElementById("header-title");

function updateUI() {
  // Фильтруем пункты меню по текущей вкладке
  document.querySelectorAll(".dropdown-item").forEach((item) => {
    const allowedGroup = item.getAttribute("data-only");
    // Если метки нет ИЛИ метка совпадает с текущей группой — показываем
    if (!allowedGroup || allowedGroup === currentGroup) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
  // Скрываем все секции
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));

  const map = sectionsMap[currentGroup];
  let targetId, targetTitle;

  if (currentMode === "record") {
    targetId = map.record;
    targetTitle = map.nameRecord;
  } else if (currentMode === "analytics") {
    targetId = map.analytics;
    targetTitle = map.nameAnalytics;
  } else if (currentMode === "settings") {
    targetId = map.settings;
    targetTitle = map.nameSettings;
  } else if (currentMode === "elements") {
    targetId = map.elements;
    targetTitle = map.nameElements;
  } // <-- Новая строка

  // Обновляем заголовок и показываем секцию
  titleEl.textContent = targetTitle;
  // Безопасный вызов (если элемент null, код просто пропустит это без ошибки)
  document.getElementById(targetId)?.classList.add("active");
  if (
    currentMode === "elements" &&
    typeof renderElementsSection === "function"
  ) {
    renderElementsSection();
  }

  // Обновляем иконку в шапке
  currentModeIcon.innerHTML = `<use href="${iconsMap[currentMode]}"></use>`;

  // Подсвечиваем активный пункт меню
  document.querySelectorAll(".dropdown-item").forEach((item) => {
    item.classList.remove("active-item");
    if (item.getAttribute("data-mode") === currentMode)
      item.classList.add("active-item");
  });
}

// Открытие/закрытие меню
function toggleMenu() {
  dropdownMenu.classList.toggle("active");
  overlay.classList.toggle("active");
}
menuTrigger.addEventListener("click", toggleMenu);
overlay.addEventListener("click", toggleMenu);

// Клик по пункту меню (Запись / Аналитика / Настройки)
document.querySelectorAll(".dropdown-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    currentMode = e.currentTarget.getAttribute("data-mode");
    toggleMenu();
    updateUI();
  });
});

// Клик по нижней панели
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentGroup = btn.getAttribute("data-group");
    currentMode = "record"; // При смене таба всегда возвращаем на форму записи
    updateUI();
  });
});

// Запускаем отрисовку при старте
updateUI();

// --- 4. ЛОГИКА ФОРМ ---
const orderType = document.getElementById("order_type");
orderType.addEventListener("change", function () {
  document
    .querySelectorAll(".section_train")
    .forEach((s) => s.classList.remove("active"));
  if (this.value === "Абонемент") {
    document.getElementById("section-Абонемент").classList.add("active");
  } else if (this.value) {
    document.getElementById("section-Single").classList.add("active");
    document.getElementById("qty_single").value = 1;
  }
  updatePrice();
});

document.getElementById("sub-select").addEventListener("change", updatePrice);

document.querySelectorAll(".stepper-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    const input = this.parentElement.querySelector('input[type="number"]');
    let val = parseInt(input.value) || 1;
    if (this.classList.contains("plus-btn")) val++;
    if (this.classList.contains("minus-btn") && val > 1) val--;
    input.value = val;
    updatePrice();
  });
});

function updatePrice() {
  const type = document.getElementById("order_type").value;
  if (type === "Абонемент") {
    const subType = document.getElementById("sub-select").value;
    document.getElementById("sum_subscription").value =
      prices.subs[subType] || 0;
  } else if (type) {
    const rate = prices.rates[type] || 0;
    const qty = parseInt(document.getElementById("qty_single").value) || 1;
    document.getElementById("sum_single").value = rate * qty;
  }
}
// --- АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ ГРУППЫ ТРАТ ---
document
  .getElementById("dropdown-select")
  .addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];
    const optGroup = selectedOption.parentElement;
    if (optGroup && optGroup.tagName === "OPTGROUP") {
      document.getElementById("data_groupLabel").value = optGroup.label;
    } else {
      document.getElementById("data_groupLabel").value = "";
    }
  });

// --- 2. ОЧЕРЕДЬ ОТПРАВКИ И УМНЫЙ sendFormData ---
async function sendFormData(e, url) {
  e.preventDefault();

  // Вытаскиваем данные из формы в массив, чтобы их можно было сохранить в память телефона
  const formData = new FormData(e.target);
  formData.append("source", window.location.href);
  const dataEntries = Array.from(formData.entries());

  e.target.reset(); // Мгновенно очищаем форму
  showToast(); // Мгновенно радуем жену плашкой "Сохранено"

  if (navigator.onLine) {
    // Пробуем отправить сразу (в фоне)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 сек ждем максимум

      await fetch(url, {
        method: "POST",
        body: formData,
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Если прошло успешно, тихо обновляем базу через 1 сек
      setTimeout(() => fetchData(), 1000);
      return;
    } catch (error) {
      console.warn("Слабый интернет, кидаем в офлайн-очередь", error);
    }
  }

  // Если интернета нет вообще или сервер завис — кидаем в скрытую очередь
  saveToQueue(url, dataEntries);
}

// Сохранение зависших отправок в локальную базу
function saveToQueue(url, dataEntries) {
  let queue = JSON.parse(localStorage.getItem("offlineQueue")) || [];
  queue.push({ url: url, data: dataEntries, time: Date.now() });
  localStorage.setItem("offlineQueue", JSON.stringify(queue));
  console.log("Запись сохранена в телефоне. Ждем интернет...");
}

// Фоновая отправка накопившихся данных при появлении сети
async function syncOfflineQueue() {
  if (!navigator.onLine) return;

  let queue = JSON.parse(localStorage.getItem("offlineQueue")) || [];
  if (queue.length === 0) return;

  console.log(`Отправляем зависшие записи (${queue.length} шт)...`);
  let failedQueue = [];

  for (let item of queue) {
    // Восстанавливаем объект FormData из памяти
    const formData = new FormData();
    item.data.forEach(([key, val]) => formData.append(key, val));

    try {
      await fetch(item.url, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });
    } catch (err) {
      // Если опять не вышло (интернет мигнул) — оставляем на следующий раз
      failedQueue.push(item);
    }
  }

  // Обновляем очередь (оставляем только те, что снова не отправились)
  localStorage.setItem("offlineQueue", JSON.stringify(failedQueue));

  // Если хоть что-то успешно пробилось на сервер, подтягиваем свежие графики
  if (queue.length > failedQueue.length) {
    setTimeout(() => fetchData(), 1500);
  }
}

// Даем команду браузеру: "Как только поймаешь сеть - сразу прогоняй очередь!"
window.addEventListener("online", syncOfflineQueue);

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("submit", (e) => {
    // 🛑 НОВАЯ СТРОКА: Игнорируем формы, у которых есть свои функции сохранения
    if (
      form.id === "element-form" ||
      form.id === "student-form" ||
      form.id === "prices-form"
    )
      return;
    const type = orderType.value;
    const typeRes = document.getElementById("data_type_result");
    const lessRes = document.getElementById("sum_lessons_result");
    const monRes = document.getElementById("sum_money_result");

    if (type === "Абонемент") {
      typeRes.value = "Абонемент";
      monRes.value = document.getElementById("sum_subscription").value;
      const subType = document.getElementById("sub-select").value;
      const match = subType.match(/\d+/);
      lessRes.value = match ? parseInt(match[0], 10) : 1;
    } else {
      typeRes.value = type;
      lessRes.value = document.getElementById("qty_single").value;
      monRes.value = document.getElementById("sum_single").value;
    }

    // Определяем URL в зависимости от ID формы
    const url =
      form.id === "contact-form"
        ? URL_TRAIN
        : form.id === "contact-form_buy"
          ? URL_BUY
          : URL_EXTRA_INCOME;

    sendFormData(e, url);
  });
});

// --- 5. АНАЛИТИКА ---
function fillSelect(selectId, data, key, defaultLabel) {
  const select = document.getElementById(selectId);
  const currentVal = select.value;
  const counts = data.reduce((acc, row) => {
    if (row[key]) acc[row[key]] = (acc[row[key]] || 0) + 1;
    return acc;
  }, {});
  let html = `<option value="all">${defaultLabel}</option>`;
  let sortedKeys = Object.keys(counts);
  if (key === "formattedMonth")
    sortedKeys.sort((a, b) => months.indexOf(a) - months.indexOf(b));
  else sortedKeys.sort();
  sortedKeys.forEach((val) => {
    html += `<option value="${val}" ${val === currentVal ? "selected" : ""}>${val}</option>`;
  });
  select.innerHTML = html;
}

function initFilters() {
  fillSelect("month-filter", tableData_train, "formattedMonth", "Все месяцы");
  fillSelect("type-filter", tableData_train, "Тип", "Все типы");
  fillSelect("payment-filter", tableData_train, "Оплата", "Все виды");
  fillSelect("month-filter_buy", tableData_buy, "formattedMonth", "Все месяцы");
  fillSelect("type-filter_buy", tableData_buy, "Категория", "Все категории");
  fillSelect("payment-filter_buy", tableData_buy, "Вид трат", "Все виды");
  fillSelect(
    "month-filter_income",
    tableData_income,
    "formattedMonth",
    "Все месяцы",
  );
  fillSelect(
    "type-filter_income",
    tableData_income,
    "Категория",
    "Все категории",
  );

  // Добавляем опцию "Тренировки" в выпадающий список фильтра доходов, если её там еще нет
  const incSelect = document.getElementById("type-filter_income");
  if (!Array.from(incSelect.options).some((o) => o.value === "Тренировки")) {
    incSelect.insertAdjacentHTML(
      "beforeend",
      `<option value="Тренировки">Тренировки</option>`,
    );
  }

  document
    .querySelectorAll(
      "select[id$='-filter'], select[id$='-filter_buy'], select[id$='-filter_income']",
    )
    .forEach((s) => (s.onchange = calculate));
}
// --- УМНЫЕ ФИЛЬТРЫ ДЛЯ ТРАТ ---
function updateBuyFilters() {
  const mVal = document.getElementById("month-filter_buy").value;
  const cVal = document.getElementById("type-filter_buy").value;
  const pVal = document.getElementById("payment-filter_buy").value;

  // 1. Ищем валидные месяцы (где есть выбранная категория и оплата)
  const validMonths = new Set(
    tableData_buy
      .filter(
        (r) =>
          (cVal === "all" || String(r.Категория) === cVal) &&
          (pVal === "all" || String(r["Вид трат"]) === pVal),
      )
      .map((r) => r.formattedMonth),
  );

  // 2. Ищем валидные категории
  const validCats = new Set(
    tableData_buy
      .filter(
        (r) =>
          (mVal === "all" || r.formattedMonth === mVal) &&
          (pVal === "all" || String(r["Вид трат"]) === pVal),
      )
      .map((r) => r.Категория || "Не указано"),
  );

  // 3. Ищем валидные виды оплат
  const validPays = new Set(
    tableData_buy
      .filter(
        (r) =>
          (mVal === "all" || r.formattedMonth === mVal) &&
          (cVal === "all" || String(r.Категория) === cVal),
      )
      .map((r) => r["Вид трат"] || "Не указано"),
  );

  rebuildSelect("month-filter_buy", validMonths, mVal, "Все месяцы", months);
  rebuildSelect("type-filter_buy", validCats, cVal, "Все категории");
  rebuildSelect("payment-filter_buy", validPays, pVal, "Все виды");
}
// --- УМНЫЕ ФИЛЬТРЫ ДЛЯ ДОХОДОВ ---
function updateIncomeFilters() {
  const miVal = document.getElementById("month-filter_income").value;
  const ciVal = document.getElementById("type-filter_income").value;

  // Объединяем доходы и тренировки для фильтров
  let combinedIncome = [...tableData_income];
  tableData_train.forEach((r) => {
    combinedIncome.push({
      formattedMonth: r.formattedMonth,
      Категория: "Тренировки",
    });
  });

  // 1. Ищем валидные месяцы
  const validMonths = new Set(
    combinedIncome
      .filter((r) => ciVal === "all" || String(r.Категория) === ciVal)
      .map((r) => r.formattedMonth),
  );

  // 2. Ищем валидные категории
  const validCats = new Set(
    combinedIncome
      .filter((r) => miVal === "all" || r.formattedMonth === miVal)
      .map((r) => r.Категория || "Не указано"),
  );

  rebuildSelect(
    "month-filter_income",
    validMonths,
    miVal,
    "Все месяцы",
    months,
  );
  rebuildSelect("type-filter_income", validCats, ciVal, "Все категории");
}
// Вспомогательная функция для перестройки выпадающего списка
function rebuildSelect(
  id,
  validSet,
  currentVal,
  defaultText,
  sortOrderArr = null,
) {
  const select = document.getElementById(id);
  let arr = Array.from(validSet);

  // Сортируем: либо по массиву месяцев, либо по алфавиту
  if (sortOrderArr)
    arr.sort((a, b) => sortOrderArr.indexOf(a) - sortOrderArr.indexOf(b));
  else arr.sort();

  let html = `<option value="all">${defaultText}</option>`;
  arr.forEach((val) => {
    const selected = val === currentVal ? "selected" : "";
    html += `<option value="${val}" ${selected}>${val}</option>`;
  });
  select.innerHTML = html;

  // Если текущий выбор стал невалиден из-за другого фильтра - сбрасываем
  if (currentVal !== "all" && !validSet.has(currentVal)) select.value = "all";
}
function renderBreakdown(containerId, dataObj, totalAmount, colorClass) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (totalAmount === 0 || Object.keys(dataObj).length === 0) return;
  let html = `<div class="breakdown-title">Детализация:</div>`;
  const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([key, val]) => {
    if (val === 0) return;
    const percent = Math.round((val / totalAmount) * 100);
    html += `<div class="breakdown-item"><span>${key}</span><span><b>${val.toLocaleString()} ₪</b> (${percent}%)</span></div>
                 <div class="breakdown-bar-bg"><div class="breakdown-bar-fill ${colorClass}" style="width: ${percent}%;"></div></div>`;
  });
  container.innerHTML = html;
}

function renderClientBreakdown(containerId, dataObj, totalLessons) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (totalLessons === 0 || Object.keys(dataObj).length === 0) return;
  let html = `<div class="breakdown-title" style="margin-top: 25px;">Посещения (ученицы):</div>`;
  const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([key, val]) => {
    if (val === 0) return;
    const percent = Math.round((val / totalLessons) * 100);
    html += `<div class="breakdown-item"><span>${key}</span><span><b>${val}</b> занятий</span></div>
                 <div class="breakdown-bar-bg" style="height: 6px; margin-bottom: 14px;"><div class="breakdown-bar-fill fill-blue" style="width: ${percent}%;"></div></div>`;
  });
  container.innerHTML = html;
}

function calculate() {
  // Тренировки
  const mVal = document.getElementById("month-filter").value;
  const tVal = document.getElementById("type-filter").value;
  const tpVal = document.getElementById("payment-filter").value;
  const filteredTrain = tableData_train.filter(
    (r) =>
      (mVal === "all" || r.formattedMonth === mVal) &&
      (tVal === "all" || String(r.Тип) === tVal) &&
      (tpVal === "all" || String(r.Оплата) === tpVal),
  );

  const totalTrainAmount = filteredTrain.reduce(
    (sum, r) => sum + (Number(r.Cумма) || 0),
    0,
  );
  const totalLessons = filteredTrain.reduce(
    (sum, r) => sum + (Number(r.Количество) || 0),
    0,
  );
  document.getElementById("total-qty").textContent = totalLessons;
  document.getElementById("total-amount").textContent =
    totalTrainAmount.toLocaleString() + " ₪";

  const trainBreakdown = {};
  const clientBreakdown = {};
  filteredTrain.forEach((r) => {
    const type = r.Тип || "Не указано";
    trainBreakdown[type] = (trainBreakdown[type] || 0) + (Number(r.Cумма) || 0);
    const clientName = r.Имя || "Без имени";
    clientBreakdown[clientName] =
      (clientBreakdown[clientName] || 0) + (Number(r.Количество) || 0);
  });
  renderBreakdown(
    "breakdown-train",
    trainBreakdown,
    totalTrainAmount,
    "fill-green",
  );
  renderClientBreakdown("breakdown-clients", clientBreakdown, totalLessons);

  // --- ПРОДВИНУТАЯ АНАЛИТИКА ПОКУПОК ---
  updateBuyFilters(); // Обновляем списки перед расчетом

  const mbVal = document.getElementById("month-filter_buy").value;
  const cbVal = document.getElementById("type-filter_buy").value;
  const pbVal = document.getElementById("payment-filter_buy").value;

  const filteredBuy = tableData_buy.filter(
    (r) =>
      (mbVal === "all" || r.formattedMonth === mbVal) &&
      (cbVal === "all" || String(r.Категория) === cbVal) &&
      (pbVal === "all" || String(r["Вид трат"]) === pbVal),
  );

  const totalBuyAmount = filteredBuy.reduce(
    (sum, r) =>
      sum + (Number(r.Cумма) || Number(r.Сумма) || Number(r.rating) || 0),
    0,
  );
  document.getElementById("total-amount_buy").textContent =
    totalBuyAmount.toLocaleString() + " ₪";

  const buyBreakdown = {};
  const detailedBreakdown = {};

  filteredBuy.forEach((r) => {
    const category = r.Категория || r.groupLabel || "Не указано";
    const expenseType = r["Вид трат"] || r.optone || "Без названия";

    // Оборачиваем в String(), чтобы числа тоже стали текстом и не ломали .trim()
    const comment = String(r.Комментарий || r.message || "");

    let subCategory = expenseType;
    if (comment.trim() !== "") {
      subCategory += ` (${comment.trim()})`;
    }

    const cost = Number(r.Cумма) || Number(r.Сумма) || Number(r.rating) || 0;

    buyBreakdown[category] = (buyBreakdown[category] || 0) + cost;

    if (!detailedBreakdown[category]) detailedBreakdown[category] = {};
    detailedBreakdown[category][subCategory] =
      (detailedBreakdown[category][subCategory] || 0) + cost;
  });

  // Отрисовка детализации
  const buyContainer = document.getElementById("breakdown-buy");
  buyContainer.innerHTML = "";
  if (totalBuyAmount > 0 && Object.keys(buyBreakdown).length > 0) {
    let buyHtml = `<div class="breakdown-title">Расширенная детализация трат:</div>`;
    const sortedCats = Object.entries(buyBreakdown).sort((a, b) => b[1] - a[1]);

    sortedCats.forEach(([cat, val]) => {
      const percent = Math.round((val / totalBuyAmount) * 100);
      buyHtml += `
            <div class="breakdown-item" style="margin-top: 15px;">
              <span style="font-size: 16px;"><b>${cat}</b></span>
              <span style="font-size: 16px;"><b>${val.toLocaleString()} ₪</b> (${percent}%)</span>
            </div>
            <div class="breakdown-bar-bg" style="margin-bottom: 8px;">
              <div class="breakdown-bar-fill fill-red" style="width: ${percent}%;"></div>
            </div>
          `;

      // Выводим вложенные комментарии-траты под категорией
      const sortedSubs = Object.entries(detailedBreakdown[cat]).sort(
        (a, b) => b[1] - a[1],
      );
      sortedSubs.forEach(([sub, subVal]) => {
        buyHtml += `
              <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); margin-left: 10px; margin-bottom: 6px; border-bottom: 1px dashed #e5e5ea; padding-bottom: 4px;">
                <span style="flex: 1; padding-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">↳ ${sub}</span>
                <span style="font-weight: 500;">${subVal.toLocaleString()} ₪</span>
              </div>
            `;
      });
    });
    buyContainer.innerHTML = buyHtml;
  }
  // --- КОНЕЦ БЛОКА ПОКУПОК ---

  // ==========================================
  // 3. ДОХОДЫ (С УМНЫМ ФИЛЬТРОМ И ЕДИНОЙ ШКАЛОЙ БАЛАНСА)
  // ==========================================
  updateIncomeFilters();

  const miVal = document.getElementById("month-filter_income").value;
  const ciVal = document.getElementById("type-filter_income").value;

  let combinedIncomeData = [];
  tableData_income.forEach((r) => combinedIncomeData.push({ ...r }));

  tableData_train.forEach((r) => {
    combinedIncomeData.push({
      formattedMonth: r.formattedMonth,
      Категория: "Тренировки",
      Сумма: Number(r.Cумма) || Number(r.Сумма) || 0,
      Комментарий: "",
    });
  });

  const filteredIncome = combinedIncomeData.filter(
    (r) =>
      (miVal === "all" || r.formattedMonth === miVal) &&
      (ciVal === "all" || String(r.Категория) === ciVal),
  );

  let totalIncomeAmount = 0;
  const incomeBreakdown = {};
  const detailedIncomeBreakdown = {};

  filteredIncome.forEach((r) => {
    const category = r.Категория || "Не указано";
    const cost = Number(r.Сумма) || 0;
    const comment = String(r.Комментарий || r.message || "");

    let subCategory = comment.trim() !== "" ? comment.trim() : "Без описания";

    totalIncomeAmount += cost;
    incomeBreakdown[category] = (incomeBreakdown[category] || 0) + cost;

    if (!detailedIncomeBreakdown[category])
      detailedIncomeBreakdown[category] = {};
    detailedIncomeBreakdown[category][subCategory] =
      (detailedIncomeBreakdown[category][subCategory] || 0) + cost;
  });

  document.getElementById("total-amount_income").textContent =
    totalIncomeAmount.toLocaleString() + " ₪";

  const incomeContainer = document.getElementById("breakdown-income");
  incomeContainer.innerHTML = "";

  if (totalIncomeAmount > 0 && Object.keys(incomeBreakdown).length > 0) {
    let incHtml = `<div class="breakdown-title">Расширенная детализация доходов:</div>`;
    const sortedCats = Object.entries(incomeBreakdown).sort(
      (a, b) => b[1] - a[1],
    );

    sortedCats.forEach(([cat, val]) => {
      const percent = Math.round((val / totalIncomeAmount) * 100);
      incHtml += `
            <div class="breakdown-item" style="margin-top: 15px;">
              <span style="font-size: 16px;"><b>${cat}</b></span>
              <span style="font-size: 16px;"><b>${val.toLocaleString()} ₪</b> (${percent}%)</span>
            </div>
            <div class="breakdown-bar-bg" style="margin-bottom: 8px;">
              <div class="breakdown-bar-fill fill-blue" style="width: ${percent}%;"></div>
            </div>
          `;

      const sortedSubs = Object.entries(detailedIncomeBreakdown[cat]).sort(
        (a, b) => b[1] - a[1],
      );
      if (!(sortedSubs.length === 1 && sortedSubs[0][0] === "Без описания")) {
        sortedSubs.forEach(([sub, subVal]) => {
          incHtml += `
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); margin-left: 10px; margin-bottom: 6px; border-bottom: 1px dashed #e5e5ea; padding-bottom: 4px;">
                  <span style="flex: 1; padding-right: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">↳ ${sub}</span>
                  <span style="font-weight: 500;">${subVal.toLocaleString()} ₪</span>
                </div>
              `;
        });
      }
    });
    incomeContainer.innerHTML = incHtml;
  }

  // ==========================================
  // --- НАГЛЯДНАЯ ШКАЛА БАЛАНСА ---
  // ==========================================
  const expensesForPeriod = tableData_buy
    .filter((r) => miVal === "all" || r.formattedMonth === miVal)
    .reduce(
      (sum, r) =>
        sum + (Number(r.Cумма) || Number(r.Сумма) || Number(r.rating) || 0),
      0,
    );

  const incomeForPeriod = combinedIncomeData
    .filter((r) => miVal === "all" || r.formattedMonth === miVal)
    .reduce((sum, r) => sum + (Number(r.Сумма) || 0), 0);

  if (incomeForPeriod > 0 || expensesForPeriod > 0) {
    const maxVal = Math.max(incomeForPeriod, expensesForPeriod);
    const incPercent =
      maxVal === 0 ? 0 : Math.round((incomeForPeriod / maxVal) * 100);
    const expPercent =
      maxVal === 0 ? 0 : Math.round((expensesForPeriod / maxVal) * 100);

    const balanceVal = incomeForPeriod - expensesForPeriod;
    const isPositive = balanceVal >= 0;
    const sign = balanceVal > 0 ? "+" : "";

    const expColor =
      expensesForPeriod > incomeForPeriod
        ? "linear-gradient(90deg, #ff3b30, #ff453a)"
        : "linear-gradient(90deg, #ff9500, #ffcc00)";

    let balanceHtml = `
          <div class="breakdown-title" style="margin-top: 35px; border-top: 2px dashed #d1d1d6; padding-top: 20px;">
            Сводка за период:
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
            <span style="color: #34c759;">Доход: ${incomeForPeriod.toLocaleString()} ₪</span>
            <span style="color: ${!isPositive ? "#ff3b30" : "#ff9500"};">Расход: ${expensesForPeriod.toLocaleString()} ₪</span>
          </div>

          <div style="position: relative; height: 16px; border-radius: 8px; background: #e5e5ea; margin-bottom: 15px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
            <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${incPercent}%; background: linear-gradient(90deg, #34c759, #30d158); border-radius: 8px;"></div>
            <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${expPercent}%; background: ${expColor}; border-radius: 8px; opacity: 0.9;"></div>
          </div>
          
          <div style="text-align: center; font-size: 17px; font-weight: bold; color: ${isPositive ? "#34c759" : "#ff3b30"};">
            Баланс: ${sign}${balanceVal.toLocaleString()} ₪
          </div>
        `;

    incomeContainer.insertAdjacentHTML("beforeend", balanceHtml);
  }
} // <-- Это должна быть последняя закрывающая скобка функции calculate()

// --- 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UX) ---
const showLoader = (text) => {
  document.getElementById("loader-text").innerText = text;
  document.getElementById("global-loader").classList.add("active");
};
const hideLoader = () =>
  document.getElementById("global-loader").classList.remove("active");
const showToast = () => {
  const toast = document.getElementById("toast");
  toast.classList.add("show");
  if (navigator.vibrate) navigator.vibrate(50);
  setTimeout(() => toast.classList.remove("show"), 3000);
};

if (
  "serviceWorker" in navigator &&
  window.location.protocol.startsWith("http")
) {
  navigator.serviceWorker
    .register("sw.js")
    .catch((err) => console.warn("SW reg failed", err));
}

// --- ФУНКЦИИ УПРАВЛЕНИЯ НАСТРОЙКАМИ CRM ---

// --- РЕАЛЬНЫЕ ЗАПРОСЫ К СЕРВЕРУ ---

function promptAddStudent() {
  const newName = prompt("Введите имя и фамилию новой ученицы:");
  if (newName && newName.trim() !== "") {
    showLoader("Добавление...");

    const formData = new FormData();
    formData.append("action", "add_student");
    formData.append("name", newName.trim());

    fetch(URL_TRAIN, { method: "POST", body: formData })
      .then((response) => response.json())
      .then((result) => {
        hideLoader();
        showToast();
        fetchData(); // Перезагружаем данные, чтобы список обновился
      })
      .catch((error) => {
        hideLoader();
        alert("❌ Ошибка при добавлении ученицы.");
      });
  }
}

// Удаление из модального окна
function deleteStudentFromModal() {
  const name = document.getElementById("edit-original-name").value;
  if (confirm(`Вы действительно хотите удалить ученицу: ${name}?`)) {
    showLoader("Удаление...");
    closeStudentModal();

    const formData = new FormData();
    formData.append("action", "delete_student");
    formData.append("name", name);

    fetch(URL_TRAIN, { method: "POST", body: formData })
      .then((response) => response.json())
      .then((result) => {
        hideLoader();
        showToast();
        fetchData(); // Перезагружаем данные
      })
      .catch((error) => {
        hideLoader();
        alert("❌ Ошибка при удалении.");
      });
  }
}

// Функция раскрытия списков
window.toggleAccordion = function (contentId, headerElement) {
  const content = document.getElementById(contentId);
  content.classList.toggle("active");
  headerElement.classList.toggle("active");
};

// Надежно объявляем переменные для нового фото
window.currentPhotoBase64 = null;
window.currentPhotoName = null;

// Предпросмотр загруженного фото + сохранение в память для отправки
window.previewPhoto = function (event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Сжимаем картинку до максимум 400px по ширине/высоте для аватара
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Получаем легкую сжатую картинку в base64
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

        document.getElementById("modal-avatar-preview").innerHTML =
          `<img src="${compressedBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
        window.currentPhotoBase64 = compressedBase64;
        window.currentPhotoName = file.name;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

// Функция закрытия модального окна ученицы
window.closeStudentModal = function () {
  const modal = document.getElementById("student-modal");
  if (modal) {
    modal.classList.remove("active");
  }
};

// Функция удаления (на всякий случай проверим, что она тоже на месте)
window.deleteStudentFromModal = function () {
  const name = document.getElementById("edit-original-name").value;
  if (confirm(`Вы действительно хотите удалить ученицу: ${name}?`)) {
    showLoader("Удаление...");
    window.closeStudentModal();

    const payload = { action: "delete_student", name: name };
    fetch(URL_TRAIN, { method: "POST", body: JSON.stringify(payload) })
      .then((response) => response.json())
      .then((result) => {
        hideLoader();
        showToast();
        fetchData();
      })
      .catch((error) => {
        hideLoader();
        alert("Ошибка при удалении.");
      });
  }
};

window.openStudentModal = function (name) {
  const student = window.studentsDatabase[name] || {};
  document.getElementById("edit-original-name").value = name;
  document.getElementById("edit-name").value = name;

  document.getElementById("edit-email").value = student.email || "";
  document.getElementById("edit-hebrew-name").value = student.hebrewName || "";
  document.getElementById("edit-phone").value = student.phone || "";
  document.getElementById("edit-health").value = student.health || "";
  updateHealthIcon();
  document.getElementById("edit-info").value = student.info || "";

  // Подставляем дату рождения
  if (student.dob && student.dob.includes(".")) {
    let parts = student.dob.split(".");
    document.getElementById("edit-dob").value =
      `${parts[2]}-${parts[1]}-${parts[0]}`;
  } else {
    document.getElementById("edit-dob").value = student.dob || "";
  }

  // Расставляем галочки направлений
  const dirs = student.directions
    ? student.directions.split(",").map((s) => s.trim())
    : [];
  document.querySelectorAll(".dir-checkbox").forEach((cb) => {
    cb.checked = dirs.includes(cb.value);
  });

  // Очищаем переменные при новом открытии модалки
  window.currentPhotoBase64 = null;
  window.currentPhotoName = null;

  let finalPhotoUrl = student.photo || "";
  if (finalPhotoUrl && !finalPhotoUrl.startsWith("http")) {
    finalPhotoUrl = `https://drive.google.com/thumbnail?id=${finalPhotoUrl}&sz=w200`;
  } else if (finalPhotoUrl) {
    const driveMatch = finalPhotoUrl.match(/(?:id=|folders\/|d\/)([\w-]+)/);
    if (driveMatch) {
      finalPhotoUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w200`;
    }
  }

  // Объявляем инициалы для генерации заглушки аватарки
  const initials = name ? name.substring(0, 1).toUpperCase() : "👤";

  document.getElementById("modal-avatar-preview").innerHTML = finalPhotoUrl
    ? `<img src="${finalPhotoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
    : initials;

  document.getElementById("student-modal").classList.add("active");
};
window.updateHealthIcon = function () {
  const val = document.getElementById("edit-health").value.trim();
  const btn = document.getElementById("health-link-btn");
  const iconEmpty = document.getElementById("health-icon-empty");
  const iconActive = document.getElementById("health-icon-active");

  if (val) {
    btn.href = val;
    btn.style.pointerEvents = "auto";
    btn.style.background = "rgba(52, 199, 89, 0.15)"; // Подсветка фона зеленым
    iconEmpty.style.display = "none";
    iconActive.style.display = "block";
  } else {
    btn.href = "#";
    btn.style.pointerEvents = "none"; // Делаем кнопку некликабельной
    btn.style.background = "var(--ios-gray)";
    iconEmpty.style.display = "block";
    iconActive.style.display = "none";
  }
};
window.saveStudentData = function (event) {
  event.preventDefault();

  try {
    const originalNameEl = document.getElementById("edit-original-name");
    const nameEl = document.getElementById("edit-name");
    const emailEl = document.getElementById("edit-email");
    const hebrewNameEl = document.getElementById("edit-hebrew-name");
    const phoneEl = document.getElementById("edit-phone");
    const healthEl = document.getElementById("edit-health");
    const infoEl = document.getElementById("edit-info");
    const dobEl = document.getElementById("edit-dob");

    const originalName = originalNameEl ? originalNameEl.value : "";
    const student = window.studentsDatabase[originalName] || {};
    const existingPhoto = student.photo || "";

    const checkedDirs = Array.from(
      document.querySelectorAll(".dir-checkbox:checked"),
    )
      .map((cb) => cb.value)
      .join(", ");

    const formData = new FormData();
    formData.append("action", "update_student");
    formData.append("originalName", originalName);
    formData.append("name", nameEl ? nameEl.value.trim() : "");
    formData.append("email", emailEl ? emailEl.value.trim() : "");
    formData.append(
      "hebrewName",
      hebrewNameEl ? hebrewNameEl.value.trim() : "",
    );
    formData.append("phone", phoneEl ? phoneEl.value.trim() : "");
    formData.append("health", healthEl ? healthEl.value.trim() : "");
    formData.append("info", infoEl ? infoEl.value.trim() : "");
    formData.append("dob", dobEl ? dobEl.value : "");
    formData.append("directions", checkedDirs);
    formData.append("existingPhoto", existingPhoto);

    if (window.currentPhotoBase64) {
      formData.append("photoBase64", window.currentPhotoBase64);
      formData.append("photoName", window.currentPhotoName || "avatar.jpg");
    }

    // Сразу закрываем модалку для плавной работы интерфейса
    closeStudentModal();
    showLoader("Сохранение...");

    // Отправка на сервер в фоновом режиме

    fetch(URL_TRAIN, {
      method: "POST",
      body: formData,
      mode: "no-cors", // <-- Оставляем только это! redirect: "manual" УДАЛИТЬ
    })
      .then(() => {
        hideLoader();
        showToast();
        setTimeout(() => {
          fetchData();
        }, 800);
      })
      .catch((error) => {
        // Эта часть перехватит неизбежный "баг" Google (404),
        // скроет лоадер и всё равно красиво обновит страницу!
        console.log("Данные сохранены! (Игнорируем системный редирект Google)");
        hideLoader();
        setTimeout(() => {
          fetchData();
        }, 800);
      });
  } catch (err) {
    hideLoader();
    alert("❌ Ошибка в приложении (HTML): " + err.message);
  }
};
function openProgressModal(name) {
  const student = window.studentsDatabase[name] || {};
  document.getElementById("progress-student-name").value = name;
  document.getElementById("progress-modal-title").textContent = name;

  const completedElements = student.progress
    ? student.progress.split(",").map((e) => e.trim())
    : [];
  const container = document.getElementById("progress-elements-container");
  container.innerHTML = "";

  // 1. Группируем элементы по категориям
  const groupedElements = {};
  window.elementsDatabase.forEach((el) => {
    const cat = el.category || "Разное";
    if (!groupedElements[cat]) groupedElements[cat] = [];
    groupedElements[cat].push(el);
  });

  // 2. Генерируем HTML для каждой категории
  for (const category in groupedElements) {
    // Безопасный ID для аккордеона
    const catId =
      "cat-" + category.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

    // Считаем прогресс внутри категории
    const totalInCategory = groupedElements[category].length;
    const completedInCategory = groupedElements[category].filter((el) =>
      completedElements.includes(el.name),
    ).length;

    let categoryHTML = `
      <div class="accordion-header" onclick="toggleAccordion('${catId}', this)" style="background: var(--ios-bg); margin-top: 10px; border-radius: 10px; border: 1px solid #d1d1d6;">
        <span style="font-weight: 600;">${category} <span style="color: var(--text-muted); font-weight: normal; font-size: 14px;">(${completedInCategory}/${totalInCategory})</span></span>
        <svg class="accordion-icon"><use href="#icon-chevron-down"></use></svg>
      </div>
      <div id="${catId}" class="accordion-content" style="padding: 0;">
        <div class="ios-list" style="margin-bottom: 0;">
    `;

    // Рисуем каждый элемент внутри категории
    groupedElements[category].forEach((el) => {
      const isChecked = completedElements.includes(el.name) ? "checked" : "";
      const descHTML = el.description
        ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; line-height: 1.2;">${el.description}</div>`
        : "";

      // --- УМНЫЙ ФИКС ДЛЯ ФОТО ИЗ GOOGLE DRIVE ---
      let finalPhotoUrl = el.photo;
      // Если это ссылка на Google Диск, вытаскиваем её ID и делаем ссылку на миниатюру
      const driveMatch = finalPhotoUrl
        ? finalPhotoUrl.match(/(?:id=|folders\/|d\/)([\w-]+)/)
        : null;
      if (driveMatch && finalPhotoUrl.includes("drive.google.com")) {
        finalPhotoUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w400`;
      }

      const photoHTML = finalPhotoUrl
        ? `<img src="${finalPhotoUrl}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: #e5e5ea; border: 1px solid #e5e5ea;">`
        : `<div style="width: 50px; height: 50px; border-radius: 10px; background: #e5e5ea; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 24px;">🤸‍♀️</div>`;

      categoryHTML += `
        <div class="ios-list-item" style="display: flex; gap: 14px; align-items: center; padding: 12px 16px;">
          ${photoHTML}
          <div style="flex: 1; text-align: left;">
            <div style="font-size: 16px; font-weight: 600; color: var(--text-main);">${el.name}</div>
            ${descHTML}
          </div>
          <input type="checkbox" class="ios-toggle" value="${el.name}" ${isChecked}>
        </div>
      `;
    });

    categoryHTML += `</div></div>`;
    container.insertAdjacentHTML("beforeend", categoryHTML);
  }

  document.getElementById("progress-modal").classList.add("active");
}

function closeProgressModal() {
  document.getElementById("progress-modal").classList.remove("active");
}

function saveStudentProgress() {
  const name = document.getElementById("progress-student-name").value;

  // Собираем все включенные тумблеры
  const checkboxes = document.querySelectorAll(
    "#progress-elements-container .ios-toggle:checked",
  );
  const completedArray = Array.from(checkboxes).map((cb) => cb.value);
  const progressString = completedArray.join(", "); // склеиваем в строку

  showLoader("Сохранение прогресса...");
  closeProgressModal();

  const formData = new FormData();
  formData.append("action", "update_progress");
  formData.append("name", name);
  formData.append("progress", progressString);

  fetch(URL_TRAIN, { method: "POST", body: formData })
    .then((response) => response.json())
    .then((result) => {
      hideLoader();
      showToast();
      fetchData(); // перезагружаем данные, чтобы обновить локальную базу
    })
    .catch((error) => {
      hideLoader();
      alert("❌ Ошибка сохранения прогресса.");
    });
}
function getSafePhotoUrl(rawUrl) {
  if (!rawUrl) return "";
  let cleanUrl = rawUrl.toString().trim();
  // Если это чистый ID (без http)
  if (!cleanUrl.startsWith("http")) {
    return `https://drive.google.com/thumbnail?id=${cleanUrl}&sz=w200`;
  }
  // Если это полная ссылка на Диск
  const driveMatch = cleanUrl.match(/(?:id=|folders\/|d\/)([\w-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w200`;
  }
  return cleanUrl;
}

// Отрисовка аккордеонов по категориям (уровням) элементов из Google Таблицы
// Отрисовка аккордеонов по категориям (уровням) элементов из Google Таблицы
function renderElementsSection() {
  const container = document.getElementById("dynamic-elements-accordions");
  if (!container) return;

  container.innerHTML = ""; // Очищаем контейнер перед отрисовкой

  const elements = window.appData?.settings?.elements || [];

  if (elements.length === 0) {
    container.innerHTML =
      '<div style="color: #888; text-align: center; padding: 20px;">Элементы не найдены</div>';
    return;
  }

  // 1. Группируем элементы по уровням (категориям)
  const categories = {};
  elements.forEach((el) => {
    const catName = el.category || "Без уровня";
    if (!categories[catName]) {
      categories[catName] = [];
    }
    categories[catName].push(el);
  });

  // 2. Генерируем HTML для каждого уровня
  let htmlString = "";
  let catIndex = 0;

  for (const catName in categories) {
    const catId = "acc-dynamic-elem-" + catIndex; // Уникальный ID для аккордеона
    catIndex++;

    // Собираем карточки элементов внутри этого уровня
    let itemsHtml = "";
    categories[catName].forEach((el) => {
      // --- ЗАЩИТА ОТ КАВЫЧЕК ---
      const safeName = el.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");

      const finalPhotoUrl = getSafePhotoUrl(el.photo);
      const photoHTML = finalPhotoUrl
        ? `<img src="${finalPhotoUrl}" loading="lazy" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid #e5e5ea;">`
        : `<div style="width: 48px; height: 48px; border-radius: 10px; background: #e5e5ea; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 24px;">🤸‍♀️</div>`;

      const completedCount = el.completedStudents
        ? el.completedStudents.length
        : 0;

      // ВАЖНО: здесь теперь передается ${safeName} вместо ${el.name}
      itemsHtml += `
            <div class="ios-list-item" style="display: flex; gap: 14px; align-items: center; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0;" onclick="openElementModal('${safeName}')">
              <!-- Фотография слева -->
              ${photoHTML}
              
              <!-- Название и описание по центру -->
              <div style="flex: 1; text-align: left; min-width: 0;">
                <div style="font-size: 16px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${el.name}</div>
                ${el.shortDesc ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${el.shortDesc}</div>` : ""}
              </div>

              <!-- Цифра с количеством выполнивших и стрелочка справа -->
              <span style="background: var(--ios-blue); color: white; border-radius: 12px; padding: 2px 10px; font-size: 14px; font-weight: bold; margin-right: 4px;">${completedCount}</span>
              <span style="color: #c7c7cc; font-size: 20px; font-weight: bold;">›</span>
            </div>
          `;
    });

    // Рисуем сам раскрывающийся список (аккордеон) для категории
    htmlString += `
          <div class="accordion-header" onclick="toggleAccordion('${catId}', this)">
            <span style="display: flex; align-items: center; gap: 10px;">🔹 ${catName}</span>
            <svg class="accordion-icon"><use href="#icon-chevron-down"></use></svg>
          </div>
          <div id="${catId}" class="accordion-content">
            <div class="ios-list" style="margin-bottom: 15px;">
              ${itemsHtml}
            </div>
          </div>
        `;
  }

  // 3. Вставляем всё разом на страницу
  container.innerHTML = htmlString;
}

function closeElementModal() {
  document.getElementById("element-modal").style.display = "none";
}

// Предпросмотр фото элемента
function previewElementPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("element-photo-preview").style.backgroundImage =
        `url('${e.target.result}')`;
      document.getElementById("elem-photo-base64").value = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Сохранение элемента на сервер
function saveElementData(event) {
  event.preventDefault();

  const name = document.getElementById("elem-name").value.trim();
  const category = document.getElementById("elem-category").value.trim();
  const shortDesc = document.getElementById("elem-short-desc").value.trim();
  const fullDesc = document.getElementById("elem-full-desc").value.trim();
  const video = document.getElementById("elem-video").value.trim();
  const photoBase64 = document.getElementById("elem-photo-base64").value;

  const checkboxes = document.querySelectorAll(
    'input[name="completed_student"]:checked',
  );
  const completedStudents = Array.from(checkboxes)
    .map((cb) => cb.value)
    .join(", ");

  // Собираем всё в чистый JSON объект
  const payload = {
    action: "save_element",
    name: name,
    category: category,
    shortDesc: shortDesc,
    fullDesc: fullDesc,
    video: video,
    photo: photoBase64 ? photoBase64 : window.currentElementPhotoUrl || "",
    completedStudents: completedStudents,
  };

  // Отправляем как JSON
  fetch(URL_TRAIN, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8", // Обход CORS-ограничений для Google Apps Script
    },
    body: JSON.stringify(payload),
  }).catch((err) => {});

  // Закрываем модалку и тихо обновляем данные без перезагрузки страницы
  setTimeout(() => {
    if (typeof closeElementModal === "function") {
      closeElementModal();
    }
    showToast(); // Показываем зеленую плашку "Сохранено"
    fetchData(); // Подтягиваем свежие данные из базы в фоне
  }, 400);
}

window.openElementModal = function (elementName) {
  const modal = document.getElementById("element-modal");
  const checkboxesContainer = document.getElementById(
    "elem-students-checkboxes",
  );
  checkboxesContainer.innerHTML = ""; // Очищаем старый список учениц

  // Достаем всех учениц из базы для создания списка
  const allStudents = window.appData?.settings?.clients || [];

  // Вспомогательная функция отрисовки тумблеров учениц
  function drawCheckboxes(completedArray) {
    const sorted = [...allStudents]
      .map((s) => (typeof s === "object" ? s.name : s))
      .sort();
    let html = "";
    sorted.forEach((studentName) => {
      const isChecked = completedArray.includes(studentName) ? "checked" : "";
      html += `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer;">
              <span style="font-size: 15px; color: var(--text-main); font-weight: 500;">${studentName}</span>
              <input type="checkbox" name="completed_student" value="${studentName}" class="ios-toggle" ${isChecked}>
            </label>
          `;
    });
    checkboxesContainer.innerHTML = html;
  }

  if (elementName) {
    // Режим РЕДАКТИРОВАНИЯ
    const elements = window.appData?.settings?.elements || [];
    const elData = elements.find((e) => e.name === elementName);

    if (elData) {
      document.getElementById("elem-name").value = elData.name || "";
      document.getElementById("elem-category").value = elData.category || "";
      document.getElementById("elem-short-desc").value = elData.shortDesc || "";
      document.getElementById("elem-full-desc").value = elData.fullDesc || "";

      // --- ОБРАБОТКА И ПОКАЗ ВИДЕО ---
      const videoInput = document.getElementById("elem-video");
      const videoPreview = document.getElementById("elem-video-preview");
      const videoUrl = elData.video ? elData.video.trim() : "";
      videoInput.value = videoUrl;

      if (videoUrl) {
        videoPreview.style.display = "block";

        if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
          // --- ИДЕАЛЬНЫЙ ВАРИАНТ: YOUTUBE ---
          let ytId = "";
          if (videoUrl.includes("youtu.be/"))
            ytId = videoUrl.split("youtu.be/")[1].split(/[?#]/)[0];
          else if (videoUrl.includes("v="))
            ytId = videoUrl.split("v=")[1].split(/[&#]/)[0];

          videoPreview.innerHTML = `
                <div style="width: 100%; height: 500px; border-radius: 12px; overflow: hidden; background: #000; position: relative;">
                  <iframe src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" style="border: none;"></iframe>
                </div>
              `;
        } else if (videoUrl.includes("drive.google.com")) {
          // --- GOOGLE ДИСК С ХАКОМ МАСШТАБА ---
          const driveMatch = videoUrl.match(/(?:id=|folders\/|d\/)([\w-]+)/);

          if (driveMatch && driveMatch[1]) {
            const fileId = driveMatch[1];
            const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

            // ХАК: Делаем окно в 2 раза больше (200%), чтобы Гугл включил мелкие кнопки,
            // и сжимаем его в 2 раза (scale: 0.5) для нашего экрана телефона.
            videoPreview.innerHTML = `
                  <div style="width: 100%; height: 500px; border-radius: 12px; overflow: hidden; background: #000; position: relative;">
                    <iframe src="${embedUrl}" allow="autoplay; fullscreen" 
                      style="position: absolute; top: 0; left: 0; width: 200%; height: 200%; transform: scale(0.5); transform-origin: top left; border: none;">
                    </iframe>
                  </div>
                `;
          } else {
            videoPreview.innerHTML = `<div style="padding: 10px; color: #ff3b30; text-align: center;">Не удалось распознать ссылку Google Drive</div>`;
          }
        } else {
          // Прямая ссылка (на всякий случай)
          videoPreview.innerHTML = `
                <video controls playsinline style="width: 100%; height: 500px; object-fit: cover; border-radius: 12px; background: #000;">
                  <source src="${videoUrl}">
                </video>
              `;
        }
      } else {
        // Ссылки нет - прячем блок
        videoPreview.innerHTML = "";
        videoPreview.style.display = "none";
      }
      const photoPreview = document.getElementById("element-photo-preview");
      if (elData.photo) {
        let photoUrl = elData.photo.startsWith("http")
          ? elData.photo
          : `https://drive.google.com/thumbnail?id=${elData.photo}&sz=w200`;
        photoPreview.style.backgroundImage = `url('${photoUrl}')`;
        document.getElementById("elem-photo-base64").value = elData.photo;
      } else {
        photoPreview.style.backgroundImage = "";
        document.getElementById("elem-photo-base64").value = "";
      }

      // Рисуем тумблеры и отмечаем выполнивших
      drawCheckboxes(elData.completedStudents || []);
    }
  } else {
    // Режим СОЗДАНИЯ
    document.getElementById("element-form").reset();
    document.getElementById("element-photo-preview").style.backgroundImage = "";
    document.getElementById("elem-photo-base64").value = "";
    document.getElementById("elem-video").value = "";
    document.getElementById("elem-video-preview").innerHTML = "";
    document.getElementById("elem-video-preview").style.display = "none";

    // Рисуем тумблеры (пока никто не выполнил)
    drawCheckboxes([]);
  }

  if (modal) modal.classList.add("active"); // Открываем красиво
};

window.closeElementModal = function () {
  const modal = document.getElementById("element-modal");
  if (modal) modal.classList.remove("active"); // <-- Правильное закрытие
};
// --- ГЕНЕРАЦИЯ КАТЕГОРИЙ ТРАТ ---
function renderBuyCategories(categoriesArray) {
  const select = document.getElementById("dropdown-select");
  const container = document.getElementById("buy-categories-container");

  if (!select || !container) return;

  // Очищаем текущие значения
  select.innerHTML =
    '<option value="" selected disabled hidden>Выберите категорию...</option>';
  container.innerHTML = "";

  if (!categoriesArray || categoriesArray.length === 0) return;

  // Группируем данные: { "Обязательные": ["Продукты", ...], "Передвижение": ["Бензин", ...] }
  const grouped = {};
  categoriesArray.forEach((row) => {
    const group = row[0] || "Разное";
    const name = row[1];
    if (name) {
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(name);
    }
  });

  // Генерируем HTML для выпадающего списка и для страницы настроек
  for (const group in grouped) {
    // 1. Для выпадающего списка в форме записи трат
    const optgroup = document.createElement("optgroup");
    optgroup.label = group;

    // 2. Для раздела "Настройки трат"
    let groupHtml = `<div class="ios-list-title" style="text-align: left; margin: 15px 0 5px 10px; font-size: 14px; color: var(--text-muted);">${group}</div>`;

    grouped[group].forEach((name) => {
      // Добавляем в <select>
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      optgroup.appendChild(option);

      // Добавляем в настройки (с возможностью кликнуть и редактировать)
      const safeGroup = group.replace(/'/g, "\\'");
      const safeName = name.replace(/'/g, "\\'");
      groupHtml += `
        <div class="ios-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="openBuyCategoryModal('${safeGroup}', '${safeName}')">
          <span style="font-size: 16px; font-weight: 500; color: var(--text-main);">${name}</span>
          <span style="color: #c7c7cc; font-size: 20px; font-weight: bold;">›</span>
        </div>
      `;
    });

    select.appendChild(optgroup);
    container.insertAdjacentHTML("beforeend", groupHtml);
  }
}

// --- УПРАВЛЕНИЕ МОДАЛКОЙ КАТЕГОРИЙ ТРАТ ---
window.openBuyCategoryModal = function (group = "", name = "") {
  document.getElementById("edit-buy-group").value = group;
  document.getElementById("edit-buy-name").value = name;
  document.getElementById("edit-buy-original-name").value = name; // Запоминаем старое имя, чтобы знать, что перезаписывать

  const title = name ? "Редактировать категорию" : "Добавить категорию";
  document.getElementById("buy-cat-modal-title").textContent = title;

  // Прячем кнопку "Удалить" при создании новой категории
  document.getElementById("btn-delete-buy-cat").style.display = name
    ? "block"
    : "none";
  document.getElementById("buy-category-modal").classList.add("active");
};

window.closeBuyCategoryModal = function () {
  document.getElementById("buy-category-modal").classList.remove("active");
};

window.saveBuyCategory = async function (e) {
  e.preventDefault();

  const newGroup = document.getElementById("edit-buy-group").value.trim();
  const newName = document.getElementById("edit-buy-name").value.trim();

  if (!newGroup || !newName) {
    alert("Заполните группу и название категории!");
    return;
  }

  // 1. Упаковываем данные
  const params = new URLSearchParams();
  params.append("action", "manage_buy_categories");
  params.append("type", "add");
  params.append("group", newGroup);
  params.append("item", newName);

  // --- МГНОВЕННОЕ ЗАКРЫТИЕ ---
  closeBuyCategoryModal(); // Твоя родная функция, она корректно убирает блокировку экрана
  showToast(); // Радуем мгновенно

  // Очищаем поля на будущее
  document.getElementById("edit-buy-group").value = "";
  document.getElementById("edit-buy-name").value = "";

  try {
    // 2. Фоновая отправка в Google (БЕЗ await, чтобы не тормозить интерфейс)
    fetch(URL_BUY, {
      method: "POST",
      body: params,
      mode: "no-cors",
    });
    console.log("Отправлено на сервер:", { newGroup, newName });
  } catch (error) {
    console.error("Ошибка при сохранении:", error);
  }
};

window.deleteBuyCategory = async function () {
  const group = document.getElementById("edit-buy-group").value.trim();
  const name =
    document.getElementById("edit-buy-original-name").value ||
    document.getElementById("edit-buy-name").value;

  if (confirm(`Вы действительно хотите удалить категорию "${name}"?`)) {
    // 1. Упаковываем данные
    const params = new URLSearchParams();
    params.append("action", "manage_buy_categories");
    params.append("type", "delete");
    params.append("group", group);
    params.append("item", name);

    // --- МГНОВЕННОЕ ЗАКРЫТИЕ ---
    closeBuyCategoryModal();
    showToast();

    // Очищаем поля
    document.getElementById("edit-buy-group").value = "";
    document.getElementById("edit-buy-name").value = "";

    try {
      // 2. Фоновая отправка в Google
      fetch(URL_BUY, {
        method: "POST",
        body: params,
        mode: "no-cors",
      });
      console.log("Удаляем на сервере:", { group, name });
    } catch (error) {
      console.error("Ошибка при удалении:", error);
    }
  }
};
