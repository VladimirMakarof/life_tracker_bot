document.addEventListener('DOMContentLoaded', () => {
	const burgerMenu = document.querySelector('.burger-menu');
	const navLinks = document.querySelector('.nav-links');
	const dropZone = document.getElementById("dropZone");
	
	if (burgerMenu && navLinks) {
			burgerMenu.addEventListener('click', () => {
					navLinks.classList.toggle('show');
			});
	}

	// Функция для обработки перетаскиваемого JSON-файла
	dropZone.addEventListener("dragover", (event) => {
			event.preventDefault();
			dropZone.classList.add("dragover");
	});

	dropZone.addEventListener("dragleave", () => {
			dropZone.classList.remove("dragover");
	});

	dropZone.addEventListener("drop", (event) => {
			event.preventDefault();
			dropZone.classList.remove("dragover");
			const file = event.dataTransfer.files[0];
			
			if (!file || !file.name.endsWith(".json")) {
					alert("Пожалуйста, перетащите JSON-файл.");
					return;
			}

			const reader = new FileReader();
			reader.onload = function (event) {
					try {
							const data = JSON.parse(event.target.result);
							document.getElementById("name").value = data.name || "";
							document.getElementById("goal").value = data.goal || "";
							document.getElementById("reminders").value = data.reminders ? "true" : "false";
							document.getElementById("daily_limit").value = data.daily_limit || 1;

							const taskContainer = document.getElementById("taskContainer");
							taskContainer.innerHTML = "";
							if (data.tasks) {
									data.tasks.forEach(task => {
											const taskInput = document.createElement("input");
											taskInput.type = "text";
											taskInput.classList.add("task-item");
											taskInput.value = task;
											taskContainer.appendChild(taskInput);
									});
							}
					} catch (error) {
							alert("Ошибка загрузки JSON-файла. Проверьте его структуру.");
					}
			};
			reader.readAsText(file);
	});

	// Функция для сохранения данных анкеты в JSON-файл
	document.querySelector("button[onclick='saveToJson()']").addEventListener('click', () => {
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

			const jsonString = JSON.stringify(formData, null, 4);
			const blob = new Blob([jsonString], { type: "application/json" });
			const url = URL.createObjectURL(blob);

			const downloadLink = document.getElementById("downloadLink");
			downloadLink.href = url;
			downloadLink.download = "survey.json";
			downloadLink.style.display = "block";
			downloadLink.innerText = "📥 Скачать JSON";
	});

	// Функция для отправки данных в Telegram
	document.querySelector("button[onclick='sendToTelegram()']").addEventListener('click', async () => {
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

			const jsonString = JSON.stringify(formData, null, 4);
			const TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN";
			const TELEGRAM_CHAT_ID = "YOUR_CHAT_ID";
			const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

			try {
					const response = await fetch(TELEGRAM_API_URL, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
									chat_id: TELEGRAM_CHAT_ID,
									text: `📄 Новая анкета:
\`\`\`${jsonString}\`\`\``,
									parse_mode: "Markdown"
							})
					});

					const result = await response.json();
					if (result.ok) {
							alert("Файл успешно отправлен в Telegram!");
					} else {
							alert("Ошибка при отправке!");
					}
			} catch (error) {
					console.error("Ошибка:", error);
					alert("Не удалось отправить данные.");
			}
	});
});
