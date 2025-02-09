document.addEventListener('DOMContentLoaded', () => {

  function checkCookiesEnabled() {
    // Устанавливаем тестовую куку
    document.cookie = "testcookie=1; SameSite=Strict";
    // Проверяем, появилась ли она в document.cookie
    if (document.cookie.indexOf("testcookie") === -1) {
      // Если тестовая кука не найдена, куки отключены
      displayCookiesDisabledMessage();
    } else {
      // Если куки включены, удаляем тестовую куку
      document.cookie = "testcookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    }
  }

  // Функция для отображения уведомления о необходимости включить куки
  function displayCookiesDisabledMessage() {
    const notificationDiv = document.createElement('div');
    notificationDiv.style.position = 'fixed';
    notificationDiv.style.top = '0';
    notificationDiv.style.left = '0';
    notificationDiv.style.right = '0';
    notificationDiv.style.backgroundColor = '#ffcc00';
    notificationDiv.style.color = '#000';
    notificationDiv.style.padding = '1rem';
    notificationDiv.style.textAlign = 'center';
    notificationDiv.style.zIndex = '10000';
    notificationDiv.textContent = 'Для корректной работы сайта, пожалуйста, включите куки в настройках вашего браузера.';
    document.body.prepend(notificationDiv);
  }

  // Вызываем проверку при загрузке страницы
  checkCookiesEnabled();

  // Функция обновления интерфейса в зависимости от авторизации
  function updateAuthUI() {
    const authContainer = document.getElementById('authContainer'); // контейнер для информации "Войти как {Имя}"
    const logoutContainer = document.getElementById('logoutContainer'); // контейнер для кнопки "Выйти"
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    
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
	window.onTelegramAuth = function(user) {
		console.log("Пользователь авторизовался через Telegram:", user);
	
		fetch('/telegram-auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			// Передаём user, а не userFromTelegram
			body: JSON.stringify(user)
		})
		.then(response => response.json())
		.then(data => {
			console.log("Ответ от /telegram-auth:", data);
			if (data.success) {
				// Сохраняем токен
				localStorage.setItem('auth_token', data.token);
	
				// Флаг, что мы авторизованы
				localStorage.setItem('isAuthenticated', 'true');
				// Если хотим сохранить имя пользователя
				localStorage.setItem('userName', user.first_name);
	
				// Обновляем UI (например, чтобы скрыть кнопку авторизации)
				updateAuthUI();
	
				// Переходим в личный кабинет
				window.location.href = '/dashboard';
			} else {
				document.getElementById('loginMessage').textContent =
					"Ошибка авторизации: " + (data.error || "неизвестная ошибка");
			}
		})
		.catch(error => {
			console.error("Ошибка при запросе /telegram-auth:", error);
			document.getElementById('loginMessage').textContent = "Ошибка сети или сервера.";
		});
	};
	
	

  // Обработчик для кнопки "Выйти"
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
          // Сбрасываем флаги авторизации
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('userName');
          updateAuthUI();
          // Перенаправляем пользователя на страницу входа (или на главную)
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

  // --- Функции для навигации и прочего UI ---

  // Бургер-меню: открытие/закрытие меню
  const burgerMenu = document.querySelector('.burger-menu');
  const navLinks = document.querySelector('.nav-links');
  if (burgerMenu && navLinks) {
    burgerMenu.addEventListener('click', () => {
      navLinks.classList.toggle('show');
      burgerMenu.classList.toggle('active');
    });
  }

  // Плавная прокрутка для якорных ссылок
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Если экран мал, закрываем меню
      if (window.innerWidth <= 768 && navLinks && burgerMenu) {
        navLinks.classList.remove('show');
        burgerMenu.classList.remove('active');
      }
    });
  });

  // Функция для аккордеона
  const accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        item.classList.toggle('active');
      });
    }
  });

  // Ленивое (lazy) загрузка изображений
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
});
