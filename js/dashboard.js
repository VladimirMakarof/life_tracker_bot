// document.addEventListener('DOMContentLoaded', async () => {
// 	const userInfo = document.getElementById('userInfo');
// 	const goalList = document.getElementById('goalList');
// 	const diaryList = document.getElementById('diaryList');
// 	const logoutBtn = document.getElementById('logout');

// 	// 📌 Получение данных пользователя
// 	async function fetchUserData() {
// 			const response = await fetch('/api/user');
// 			const data = await response.json();
// 			if (data.success) {
// 					userInfo.innerHTML = `
// 							<strong>${data.user.name}</strong> (${data.user.username})<br>
// 							Осталось времени: ${data.user.yearsLeft} лет
// 					`;
// 			} else {
// 					userInfo.textContent = 'Ошибка загрузки данных';
// 			}
// 	}

// 	// 📌 Загрузка целей
// 	async function fetchGoals() {
// 			const response = await fetch('/api/goals');
// 			const data = await response.json();
// 			goalList.innerHTML = '';
// 			if (data.success) {
// 					data.goals.forEach(goal => {
// 							const li = document.createElement('li');
// 							li.textContent = goal.description;
// 							goalList.appendChild(li);
// 					});
// 			} else {
// 					goalList.innerHTML = '<li>Нет целей</li>';
// 			}
// 	}

// 	// 📌 Загрузка дневника
// 	async function fetchDiary() {
// 			const response = await fetch('/api/diary');
// 			const data = await response.json();
// 			diaryList.innerHTML = '';
// 			if (data.success) {
// 					data.entries.forEach(entry => {
// 							const li = document.createElement('li');
// 							li.textContent = `${entry.date}: ${entry.text}`;
// 							diaryList.appendChild(li);
// 					});
// 			} else {
// 					diaryList.innerHTML = '<li>Нет записей</li>';
// 			}
// 	}

// 	// 📌 Добавить цель
// 	document.getElementById('addGoalBtn').addEventListener('click', async () => {
// 			const newGoal = prompt('Введите новую цель:');
// 			if (newGoal) {
// 					await fetch('/api/goals', {
// 							method: 'POST',
// 							headers: { 'Content-Type': 'application/json' },
// 							body: JSON.stringify({ description: newGoal })
// 					});
// 					fetchGoals();
// 			}
// 	});

// 	// 📌 Сохранение дневника
// 	document.getElementById('saveDiary').addEventListener('click', async () => {
// 			const entry = document.getElementById('diaryEntry').value;
// 			if (entry) {
// 					await fetch('/api/diary', {
// 							method: 'POST',
// 							headers: { 'Content-Type': 'application/json' },
// 							body: JSON.stringify({ text: entry })
// 					});
// 					document.getElementById('diaryEntry').value = '';
// 					fetchDiary();
// 			}
// 	});

// 	// 📌 Выход
// 	logoutBtn.addEventListener('click', () => {
// 			fetch('/api/logout', { method: 'POST' }).then(() => {
// 					window.location.href = 'index.html';
// 			});
// 	});

// 	fetchUserData();
// 	fetchGoals();
// 	fetchDiary();
// });


document.addEventListener('DOMContentLoaded', async () => {
  const profileForm = document.getElementById('profileForm');
  const deleteButton = document.getElementById('deleteAccountBtn');
  const profileInfo = document.getElementById('profileInfo');

  // Функция для загрузки данных профиля
  async function fetchUserData() {
    const response = await fetch('/api/user');
    const data = await response.json();
    if (data.success) {
      document.getElementById('name').value = data.user.name || '';
      document.getElementById('birthdate').value = data.user.birthdate || '';
      document.getElementById('target_age').value = data.user.target_age || '';
      document.getElementById('language').value = data.user.language || 'en';
      document.getElementById('morning_time').value = data.user.morning_time || '08:00';
      document.getElementById('evening_time').value = data.user.evening_time || '20:00';
    } else {
      profileInfo.textContent = 'Ошибка загрузки профиля';
    }
  }

  // Обработка отправки формы для обновления профиля
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedData = {
      name: document.getElementById('name').value,
      birthdate: document.getElementById('birthdate').value,
      target_age: parseInt(document.getElementById('target_age').value),
      language: document.getElementById('language').value,
      morning_time: document.getElementById('morning_time').value,
      evening_time: document.getElementById('evening_time').value
    };

    const response = await fetch('/api/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const data = await response.json();
    if (data.success) {
      profileInfo.textContent = 'Профиль обновлён';
    } else {
      profileInfo.textContent = data.error || 'Ошибка обновления';
    }
  });

  // Обработка удаления аккаунта
  deleteButton.addEventListener('click', async () => {
    if (confirm('Вы действительно хотите удалить аккаунт? Это действие необратимо.')) {
      const response = await fetch('/api/user', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        alert('Аккаунт удалён');
        window.location.href = '/'; // Перенаправление на главную страницу
      } else {
        alert(data.error || 'Ошибка удаления аккаунта');
      }
    }
  });

  fetchUserData();
});


document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const codeForm = document.getElementById('codeForm');
  const loginMessage = document.getElementById('loginMessage');

  // Обработка отправки формы с Chat ID
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chatId = document.getElementById('chatId').value.trim();
    if (!chatId) {
      loginMessage.textContent = "Пожалуйста, введите ваш Chat ID.";
      return;
    }
    
    try {
      const response = await fetch('/request-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });
      const data = await response.json();
      if (data.success) {
        loginMessage.textContent = "Код отправлен в Telegram. Проверьте ваш чат.";
        // Скрываем форму ввода Chat ID и показываем форму ввода кода
        loginForm.classList.add('login-section__form--hidden');
        codeForm.classList.remove('login-section__form--hidden');
      } else {
        loginMessage.textContent = data.error || "Ошибка при отправке кода.";
      }
    } catch (error) {
      console.error("Ошибка при запросе /request-login:", error);
      loginMessage.textContent = "Ошибка сети или сервера.";
    }
  });

  // Обработка отправки формы с кодом авторизации
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chatId = document.getElementById('chatId').value.trim();
    const authCode = document.getElementById('authCode').value.trim();
    if (!chatId || !authCode) {
      loginMessage.textContent = "Введите ваш Chat ID и код.";
      return;
    }
    
    try {
      const response = await fetch('/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, code: authCode })
      });
      const data = await response.json();
      if (data.success) {
        loginMessage.textContent = "Авторизация успешна!";
        // Перенаправляем пользователя на страницу личного кабинета
        window.location.href = '/dashboard';
      } else {
        loginMessage.textContent = data.error || "Ошибка авторизации.";
      }
    } catch (error) {
      console.error("Ошибка при запросе /verify-login:", error);
      loginMessage.textContent = "Ошибка сети или сервера.";
    }
  });
});
