document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------
  // 1. Инициализация базового UI: бургер-меню, плавная прокрутка
  // ------------------------------
  const burgerMenu = document.querySelector('.burger-menu');
  const navLinks = document.querySelector('.nav-links');

  if (burgerMenu) {
    burgerMenu.addEventListener('click', () => {
      navLinks.classList.toggle('show');
      burgerMenu.classList.toggle('active');
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Если экран мал, закрываем меню
      if (window.innerWidth <= 768) {
        navLinks.classList.remove('show');
        burgerMenu.classList.remove('active');
      }
    });
  });

  // ------------------------------
  // 2. Функция обновления UI в зависимости от состояния авторизации
  // ------------------------------
  function updateAuthUI() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const authContainer = document.getElementById('authContainer'); // если есть контейнер для информации о пользователе
    const logoutContainer = document.getElementById('logoutContainer');
    if (isAuthenticated === 'true') {
      const userName = localStorage.getItem('userName') || '';
      if (authContainer) {
        authContainer.innerHTML = `<p class="auth-info">Войти как ${userName}</p>`;
      }
      if (logoutContainer) {
        logoutContainer.classList.remove('hidden');
      }
    } else {
      if (logoutContainer) {
        logoutContainer.classList.add('hidden');
      }
    }
  }

  // Вызываем обновление UI при загрузке страницы
  updateAuthUI();

  // ------------------------------
  // 3. Обработчик для кнопки "Выйти"
  // ------------------------------
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('userName');
          updateAuthUI();
          // Перенаправление (например, на страницу входа)
          window.location.href = '/login';
        } else {
          alert('Ошибка выхода: ' + (data.error || 'неизвестная ошибка'));
        }
      } catch (error) {
        console.error("Ошибка при запросе /logout:", error);
        alert("Ошибка сети или сервера при выходе.");
      }
    });
  }

  // ------------------------------
  // 4. Функция авторизации через Telegram Login Widget
  // ------------------------------
	window.onTelegramAuth = function(user) {
		console.log("Пользователь авторизовался через Telegram:", user);
		// Отправляем данные пользователя на сервер для обработки
		fetch('/telegram-auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(user)
		})
		.then(response => response.json())
		.then(data => {
			console.log("Ответ от /telegram-auth:", data);
			if (data.success) {
				// Сохраняем флаг авторизации и имя пользователя
				localStorage.setItem('isAuthenticated', 'true');
				localStorage.setItem('userName', user.first_name);
				// Обновляем UI (например, скрываем виджет, показываем кнопку "Выйти")
				updateAuthUI();
				// Перенаправляем пользователя в личный кабинет
				window.location.href = '/dashboard';
			} else {
				document.getElementById('loginMessage').textContent =
					"Ошибка авторизации: " + (data.error || "неизвестная ошибка");
			}
		})
		.catch(error => {
			console.error("Ошибка при запросе /telegram-auth:", error);
			document.getElementById('loginMessage').textContent =
				"Ошибка сети или сервера.";
		});
	};
	

  // ------------------------------
  // 5. Обработка аккордеона и ленивой загрузки изображений
  // ------------------------------
  const accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        item.classList.toggle('active');
      });
    }
  });

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
  lazyImages.forEach(img => observer.observe(img));

  // ------------------------------
  // 6. Дополнительный вспомогательный функционал (если требуется)
  // ------------------------------
  // Здесь можно добавить другие слушатели или функции
});
