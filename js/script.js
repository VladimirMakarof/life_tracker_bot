document.addEventListener('DOMContentLoaded', () => {
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
});