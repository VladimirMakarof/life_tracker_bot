document.addEventListener('DOMContentLoaded', () => {
	const burgerMenu = document.querySelector('.burger-menu');
	const navLinks = document.querySelector('.nav-links');
	const addTaskButton = document.getElementById("addTask");
	const taskContainer = document.getElementById("taskContainer");

	if (burgerMenu && navLinks) {
			burgerMenu.addEventListener('click', () => {
					navLinks.classList.toggle('show');
			});
	}

	// Функция для добавления новой задачи
	addTaskButton.addEventListener("click", () => {
			const taskInput = document.createElement("input");
			taskInput.type = "text";
			taskInput.classList.add("task-item");
			taskInput.placeholder = "Введите задачу...";
			taskContainer.appendChild(taskInput);
	});

	// Функция генерации зашифрованной ссылки
	window.generateSecureLink = async function () {
    const tasks = Array.from(document.querySelectorAll('.task-item')).map(task => task.value);
    const formData = {
        name: document.getElementById("name").value,
        goal: document.getElementById("goal").value,
        reminders: document.getElementById("reminders").value === "true",
        daily_limit: parseInt(document.getElementById("daily_limit").value),
        tasks: tasks
    };

    if (!formData.name || !formData.goal || !formData.daily_limit) {
        alert("Пожалуйста, заполните все поля!");
        return;
    }

    try {
        const response = await fetch("/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        console.log("Ответ сервера:", result); // ✅ Проверяем ответ сервера

        if (result.success && result.link) {
            // ✅ Вставляем ссылку в input
            document.getElementById("secureLink").value = result.link;
            alert("Ссылка сгенерирована! Вы можете её скопировать.");
        } else {
            alert("Ошибка при генерации ссылки.");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        alert("Не удалось сохранить анкету.");
    }
};


	// Функция копирования ссылки в буфер обмена
	window.copyToClipboard = function () {
			const linkField = document.getElementById("secureLink");
			linkField.select();
			document.execCommand("copy");
			alert("Ссылка скопирована!");
	};
});
