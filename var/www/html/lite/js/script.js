document.addEventListener('DOMContentLoaded', () => {
	const burgerMenu = document.querySelector('.burger-menu');
	const navLinks = document.querySelector('.nav-links');
	
	if (burgerMenu && navLinks) {
			burgerMenu.addEventListener('click', () => {
					navLinks.classList.toggle('show');
			});
	}
});