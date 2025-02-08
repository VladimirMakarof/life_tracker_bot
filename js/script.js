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
				// Вместо автоматического редиректа выводим сообщение с ссылкой
				loginMessage.innerHTML = "Авторизация успешна! <a href='/dashboard'>Перейти в Личный Кабинет</a>";
			} else {
				loginMessage.textContent = data.error || "Ошибка авторизации.";
			}
		} catch (error) {
			console.error("Ошибка при запросе /verify-deep-link:", error);
			loginMessage.textContent = "Ошибка сети или сервера.";
		}
	});



		
// Эта функция будет вызвана автоматически после авторизации через Telegram Login Widget
function onTelegramAuth(user) {
  console.log("Пользователь авторизовался через Telegram:", user);
  fetch('/telegram-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      window.location.href = '/dashboard';
    } else {
      document.getElementById('loginMessage').textContent = "Ошибка авторизации: " + (data.error || "неизвестная ошибка");
    }
  })
  .catch(error => {
    console.error("Ошибка:", error);
    document.getElementById('loginMessage').textContent = "Ошибка сети или сервера.";
  });
}


// Другой код (например, для меню, прокрутки, аккордеона и т.д.)
document.addEventListener('DOMContentLoaded', () => {
  // Пример: бургер-меню, плавная прокрутка, аккордеон, ленивая загрузка изображений
  const burgerMenu = document.querySelector('.burger-menu');
  const navLinks = document.querySelector('.nav-links');
  
  burgerMenu.addEventListener('click', () => {
    navLinks.classList.toggle('show');
    burgerMenu.classList.toggle('active');
  });

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
      if (window.innerWidth <= 768) {
        navLinks.classList.remove('show');
        burgerMenu.classList.remove('active');
      }
    });
  });

  // Другой вспомогательный функционал (аккордеон, ленивые изображения и т.д.)
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
