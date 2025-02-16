document.addEventListener('DOMContentLoaded', () => {
    // --- Переключение табов ---
    const createTabBtn = document.getElementById('createTab');
    const editTabBtn = document.getElementById('editTab');
    const createSettings = document.getElementById('createSettings');
    const editSettings = document.getElementById('editSettings');
  
    createTabBtn.addEventListener('click', () => {
      createTabBtn.classList.add('active');
      editTabBtn.classList.remove('active');
      createSettings.classList.add('active');
      editSettings.classList.remove('active');
    });
  
    editTabBtn.addEventListener('click', () => {
      editTabBtn.classList.add('active');
      createTabBtn.classList.remove('active');
      editSettings.classList.add('active');
      createSettings.classList.remove('active');
    });
  
  
    // --- Функционал существующей формы создания настроек ---
    const burgerMenu = document.querySelector('.burger-menu');
    const navLinks = document.querySelector('.nav-links');
    const addTaskButton = document.getElementById("addTask");
    const taskContainer = document.getElementById("taskContainer");
  
    if (burgerMenu && navLinks) {
      burgerMenu.addEventListener('click', () => {
        navLinks.classList.toggle('show');
      });
    }
  
    addTaskButton.addEventListener("click", () => {
      const taskInput = document.createElement("input");
      taskInput.type = "text";
      taskInput.classList.add("task-item");
      taskInput.placeholder = "Введите задачу...";
      taskContainer.appendChild(taskInput);
    });
  
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
        console.log("Ответ сервера:", result);
  
        if (result.success && result.link) {
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
  
    window.copyToClipboard = function () {
      const linkField = document.getElementById("secureLink");
      linkField.select();
      document.execCommand("copy");
      alert("Ссылка скопирована!");
    };
  
  
    // --- Функционал для формы редактирования настроек ---
    const loadSettingsBtn = document.getElementById('loadSettings');
    const editFormFields = document.getElementById('editFormFields');
    const editTaskContainer = document.getElementById('editTaskContainer');
    const addEditTaskBtn = document.getElementById("addEditTask");
  
    // Функция для добавления новой задачи в режиме редактирования
    addEditTaskBtn.addEventListener("click", () => {
      const taskInput = document.createElement("input");
      taskInput.type = "text";
      taskInput.classList.add("task-item");
      taskInput.placeholder = "Введите задачу...";
      editTaskContainer.appendChild(taskInput);
    });
  
    // При нажатии "Загрузить настройки" получаем JSON по введённой ссылке и заполняем форму
    loadSettingsBtn.addEventListener('click', async () => {
      const editLink = document.getElementById('editLink').value.trim();
      if (!editLink) {
        alert("Введите ссылку для загрузки настроек!");
        return;
      }
      try {
        const response = await fetch(editLink);
        if (!response.ok) throw new Error("Не удалось загрузить данные");
        const data = await response.json();
        // Заполняем поля
        document.getElementById('editName').value = data.name || "";
        document.getElementById('editGoal').value = data.goal || "";
        document.getElementById('editReminders').value = data.reminders ? "true" : "false";
        document.getElementById('editDailyLimit').value = data.daily_limit || "";
        
        // Очищаем контейнер задач и заполняем его
        editTaskContainer.innerHTML = "";
        if (data.tasks && Array.isArray(data.tasks)) {
          data.tasks.forEach(task => {
            const taskInput = document.createElement("input");
            taskInput.type = "text";
            taskInput.classList.add("task-item");
            taskInput.value = task;
            taskInput.placeholder = "Введите задачу...";
            editTaskContainer.appendChild(taskInput);
          });
        }
        // Показываем блок с редактированием
        editFormFields.classList.remove('hidden');
      } catch (error) {
        console.error("Ошибка при загрузке настроек:", error);
        alert("Не удалось загрузить настройки по указанной ссылке.");
      }
    });
  
    // Обработчик для обновления настроек
    document.getElementById('updateSettings').addEventListener('click', async () => {
      const tasks = Array.from(editTaskContainer.querySelectorAll('.task-item')).map(task => task.value);
      const formData = {
        name: document.getElementById("editName").value,
        goal: document.getElementById("editGoal").value,
        reminders: document.getElementById("editReminders").value === "true",
        daily_limit: parseInt(document.getElementById("editDailyLimit").value),
        tasks: tasks
      };
  
      if (!formData.name || !formData.goal || !formData.daily_limit) {
        alert("Пожалуйста, заполните все поля!");
        return;
      }
  
      try {
        const response = await fetch("/update", { // Предполагаемый endpoint для обновления
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
  
        const result = await response.json();
        console.log("Ответ сервера на обновление:", result);
  
        if (result.success && result.link) {
          // Если необходимо – можно уведомить пользователя об успешном обновлении
          alert("Настройки обновлены! Новый JSON файл создан.");
          // При необходимости можно обновить отображение ссылки или автоматически уведомить бота.
        } else {
          alert("Ошибка при обновлении настроек.");
        }
      } catch (error) {
        console.error("Ошибка:", error);
        alert("Не удалось обновить настройки.");
      }
    });
  
  });
  