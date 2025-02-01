document.addEventListener('DOMContentLoaded', async () => {
	const userInfo = document.getElementById('userInfo');
	const goalList = document.getElementById('goalList');
	const diaryList = document.getElementById('diaryList');
	const logoutBtn = document.getElementById('logout');

	// 📌 Получение данных пользователя
	async function fetchUserData() {
			const response = await fetch('/api/user');
			const data = await response.json();
			if (data.success) {
					userInfo.innerHTML = `
							<strong>${data.user.name}</strong> (${data.user.username})<br>
							Осталось времени: ${data.user.yearsLeft} лет
					`;
			} else {
					userInfo.textContent = 'Ошибка загрузки данных';
			}
	}

	// 📌 Загрузка целей
	async function fetchGoals() {
			const response = await fetch('/api/goals');
			const data = await response.json();
			goalList.innerHTML = '';
			if (data.success) {
					data.goals.forEach(goal => {
							const li = document.createElement('li');
							li.textContent = goal.description;
							goalList.appendChild(li);
					});
			} else {
					goalList.innerHTML = '<li>Нет целей</li>';
			}
	}

	// 📌 Загрузка дневника
	async function fetchDiary() {
			const response = await fetch('/api/diary');
			const data = await response.json();
			diaryList.innerHTML = '';
			if (data.success) {
					data.entries.forEach(entry => {
							const li = document.createElement('li');
							li.textContent = `${entry.date}: ${entry.text}`;
							diaryList.appendChild(li);
					});
			} else {
					diaryList.innerHTML = '<li>Нет записей</li>';
			}
	}

	// 📌 Добавить цель
	document.getElementById('addGoalBtn').addEventListener('click', async () => {
			const newGoal = prompt('Введите новую цель:');
			if (newGoal) {
					await fetch('/api/goals', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ description: newGoal })
					});
					fetchGoals();
			}
	});

	// 📌 Сохранение дневника
	document.getElementById('saveDiary').addEventListener('click', async () => {
			const entry = document.getElementById('diaryEntry').value;
			if (entry) {
					await fetch('/api/diary', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ text: entry })
					});
					document.getElementById('diaryEntry').value = '';
					fetchDiary();
			}
	});

	// 📌 Выход
	logoutBtn.addEventListener('click', () => {
			fetch('/api/logout', { method: 'POST' }).then(() => {
					window.location.href = 'index.html';
			});
	});

	fetchUserData();
	fetchGoals();
	fetchDiary();
});
