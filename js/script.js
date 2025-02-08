document.addEventListener('DOMContentLoaded', () => {

	const loginForm = document.getElementById('loginForm');
	const codeForm = document.getElementById('codeForm');
	const loginMessage = document.getElementById('loginMessage');
	// Бургер-меню
	const burgerMenu = document.querySelector('.burger-menu');
	const navLinks = document.querySelector('.nav-links');
	
	burgerMenu.addEventListener('click', () => {
			navLinks.classList.toggle('show');
			burgerMenu.classList.toggle('active');
	});

	// Плавная прокрутка
	document.querySelectorAll('a[href^="#"]').forEach(anchor => {
			anchor.addEventListener('click', function(e) {
					e.preventDefault();
					const target = document.querySelector(this.getAttribute('href'));
					if (target) {
							target.scrollIntoView({
									behavior: 'smooth',
									block: 'start'
							});
					}
					
					// Закрытие меню на мобильных
					if (window.innerWidth <= 768) {
							navLinks.classList.remove('show');
							burgerMenu.classList.remove('active');
					}
			});
	});

	// Подсветка активного раздела
	const sections = document.querySelectorAll('section');
	const navItems = document.querySelectorAll('.nav-links a');

	window.addEventListener('scroll', () => {
			let current = '';
			sections.forEach(section => {
					const sectionTop = section.offsetTop;
					const sectionHeight = section.clientHeight;
					if (window.scrollY >= sectionTop - sectionHeight / 3) {
							current = section.getAttribute('id');
					}
			});

			navItems.forEach(item => {
					item.classList.remove('active');
					if (item.getAttribute('href').includes(current)) {
							item.classList.add('active');
					}
			});
	});

	// Аккордеон
	const accordionItems = document.querySelectorAll('.accordion-item');
	accordionItems.forEach(item => {
			const header = item.querySelector('.accordion-header');
			header.addEventListener('click', () => {
					item.classList.toggle('active');
			});
	});

	// Ленивая загрузка изображений
	const lazyImages = document.querySelectorAll('img[loading="lazy"]');
	const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
					if (entry.isIntersecting) {
							const img = entry.target;
							img.src = img.dataset.src;
							observer.unobserve(img);
					}
			});
	});

	lazyImages.forEach(img => {
			observer.observe(img);
	});


	loginForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const chatId = document.getElementById('chatId').value;

			// Отправляем запрос на сервер
			const response = await fetch('/request-login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ chatId })
			});

			const data = await response.json();
			if (data.success) {
					loginMessage.textContent = 'Код отправлен в Telegram!';
					loginForm.classList.add('hidden');
					codeForm.classList.remove('hidden');
			} else {
					loginMessage.textContent = data.error;
			}
	});

	codeForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const chatId = document.getElementById('chatId').value;
			const authCode = document.getElementById('authCode').value;

			// Отправляем код на сервер
			const verifyResponse = await fetch('/verify-login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ chatId, code: authCode })
			});

			const verifyData = await verifyResponse.json();
			if (verifyData.success) {
					loginMessage.textContent = 'Авторизация успешна!';
					window.location.href = '/dashboard'; // Переход в ЛК
			} else {
					loginMessage.textContent = 'Неверный код!';
			}
	});


	
		
	
		// Обработка отправки формы с Chat ID (если требуется)
		loginForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const chatId = document.getElementById('chatId').value.trim();
			if (!chatId) {
				loginMessage.textContent = "Пожалуйста, введите ваш Chat ID.";
				return;
			}
			
			// Здесь можно отправить запрос, если хотите инициировать отправку кода через API
			// Но в deep linking код отправляется автоматически ботом при команде /start.
			loginMessage.textContent = "Пожалуйста, перейдите по ссылке для авторизации через Telegram.";
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
				const response = await fetch('/verify-deep-link', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ chatId, code: authCode })
				});
				const data = await response.json();
				if (data.success) {
					loginMessage.textContent = "Авторизация успешна!";
					// Перенаправляем пользователя, например, на личный кабинет
					window.location.href = '/dashboard';
				} else {
					loginMessage.textContent = data.error || "Ошибка авторизации.";
				}
			} catch (error) {
				console.error("Ошибка при запросе /verify-deep-link:", error);
				loginMessage.textContent = "Ошибка сети или сервера.";
			}
		});

	

	// Обновление профиля пользователя
// app.put('/api/user', authenticateToken, (req, res) => {
//   const { name, birthdate, target_age, language, morning_time, evening_time } = req.body;
  
//   const result = db.prepare(`
//     UPDATE users 
//     SET name = ?, birthdate = ?, target_age = ?, language = ?, morning_time = ?, evening_time = ?
//     WHERE chat_id = ?
//   `).run(name, birthdate, target_age, language, morning_time, evening_time, req.user.chatId);
  
//   if (result.changes > 0) {
//     res.json({ success: true, message: 'Профиль обновлён' });
//   } else {
//     res.status(400).json({ success: false, error: 'Ошибка обновления профиля' });
//   }
// });

// Удаление аккаунта пользователя
// app.delete('/api/user', authenticateToken, (req, res) => {
//   const chatId = req.user.chatId;
//   const userId = db.prepare('SELECT id FROM users WHERE chat_id = ?')
//                    .pluck().get(chatId);
//   if (!userId) {
//     return res.status(404).json({ success: false, error: 'Пользователь не найден' });
//   }
  
//   const deleteUser = db.transaction(() => {
//     db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
//     db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
//     db.prepare('DELETE FROM daily_logs WHERE user_id = ?').run(userId);
//     db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
//     db.prepare('DELETE FROM users WHERE id = ?').run(userId);
//   });
  
//   try {
//     deleteUser();
//     res.json({ success: true, message: 'Пользователь удалён' });
//   } catch (e) {
//     res.status(500).json({ success: false, error: 'Ошибка при удалении пользователя' });
//   }
// });


});
