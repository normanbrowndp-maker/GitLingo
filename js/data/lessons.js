window.GitLingo = window.GitLingo || {};

window.GitLingo.data = {
  config: {
    LIVES: 5,
    TEST_LENGTH: 5,
    PASS_RATIO: 0.8,
    XP_FIRST_TRY: 10,
    XP_RETRY: 5,
    XP_PERFECT_BONUS: 20,
    XP_TEST_PASS: 30
  },
  lessons: [
    {
      id: 1,
      accent: "var(--lesson-terminal)",
      title: "Основы терминала",
      description: "Команды для навигации и работы в терминале.",
      goals: ["Узнавать текущую папку и её содержимое", "Переходить между папками", "Создавать папки и пустые файлы"],
      why: "Терминал помогает быстро ориентироваться в проекте и выполнять повторяющиеся действия. Эти команды пригодятся при работе с файлами и Git.",
      theory: [
        { title: "Узнай, где ты находишься", text: "pwd показывает путь к текущей папке, а ls выводит её содержимое. Эти команды доступны и в PowerShell, и в Git Bash.", code: "pwd\nls" },
        { title: "Перейди в другую папку", text: "Команда cd меняет текущую папку. Две точки означают переход на уровень выше.", code: "cd ..\ncd .." },
        { title: "Создай папку и файл", text: "mkdir создаёт папку, а touch notes.txt создаёт файл в Git Bash. В PowerShell для файла используй New-Item -ItemType File notes.txt. Пример ниже работает в обеих оболочках.", code: "mkdir demo\necho \"\" > notes.txt" }
      ],
      tasks: [
        {
          type: "choice",
          question: "Какая команда показывает путь к текущей папке?",
          options: [
            { id: "a", text: "Показать текущий путь", code: "pwd" },
            { id: "b", text: "Показать файлы", code: "ls" },
            { id: "c", text: "Очистить экран", code: "clear" },
            { id: "d", text: "Перейти в родительскую папку", code: "cd .." }
          ],
          answer: "a",
          explain: "pwd выводит путь к текущей рабочей папке.",
          hint: "Название команды сокращает фразу «рабочая папка» на английском."
        },
        {
          type: "choice",
          question: "Чем посмотреть файлы и папки в текущем каталоге?",
          options: [
            { id: "a", text: "Перейти в папку", code: "cd" },
            { id: "b", text: "Показать содержимое", code: "ls" },
            { id: "c", text: "Показать текущий путь", code: "pwd" },
            { id: "d", text: "Перейти в родительскую папку", code: "cd .." }
          ],
          answer: "b",
          explain: "ls выводит содержимое текущего каталога.",
          hint: "Команда состоит из двух букв и означает «список»."
        },
        {
          type: "choice",
          question: "Как перейти на уровень выше в структуре папок?",
          options: [
            { id: "a", text: "Перейти на уровень выше", code: "cd .." },
            { id: "b", text: "Очистить терминал", code: "clear" },
            { id: "c", text: "Показать текущий путь", code: "pwd" },
            { id: "d", text: "Показать содержимое родительской папки", code: "ls .." }
          ],
          answer: "a",
          explain: "Две точки обозначают родительскую папку, а cd меняет каталог.",
          hint: "Используй cd и две точки через пробел."
        },
        {
          type: "choice",
          question: "Какая команда очищает содержимое окна терминала?",
          options: [
            { id: "a", text: "Перейти в папку", code: "cd" },
            { id: "b", text: "Создать файл", code: "touch" },
            { id: "c", text: "Очистить экран", code: "clear" },
            { id: "d", text: "Показать текущий путь", code: "pwd" }
          ],
          answer: "c",
          explain: "clear очищает видимый экран терминала.",
          hint: "Команда совпадает с английским словом «очистить»."
        },
        {
          type: "builder",
          question: "Собери команду, которая создаёт папку project.",
          blocks: ["project", "touch", "mkdir", "clear", "notes.txt"],
          answer: ["mkdir", "project"],
          explain: "mkdir создаёт новый каталог с указанным именем.",
          hint: "Сначала команда создания каталога, затем его имя."
        },
        {
          type: "builder",
          question: "Собери команду для создания пустого файла notes.txt.",
          blocks: ["ls", "notes.txt", "touch", "project", "pwd"],
          answer: ["touch", "notes.txt"],
          explain: "touch создаёт пустой файл, если его ещё нет.",
          hint: "Поставь touch перед именем файла."
        },
        {
          type: "builder",
          question: "Собери команду, чтобы перейти в папку projects.",
          blocks: ["projects", "cd", "mkdir", "..", "clear"],
          answer: ["cd", "projects"],
          explain: "cd меняет текущий каталог на указанный.",
          hint: "Команда перехода идёт перед названием каталога."
        },
        {
          type: "matching",
          question: "Соедини команду с её назначением.",
          pairs: [
            { term: "pwd", def: "Показать путь к текущей папке" },
            { term: "ls", def: "Показать содержимое папки" },
            { term: "mkdir", def: "Создать папку" },
            { term: "touch", def: "Создать пустой файл" }
          ],
          explain: "Команды помогают узнать текущую папку, увидеть содержимое, создать папку или пустой файл.",
          hint: "Сначала подумай, что именно нужно узнать или создать."
        },
        {
          type: "matching",
          question: "Соедини команду с действием.",
          pairs: [
            { term: "cd папка", def: "Перейти в указанную папку" },
            { term: "cd ..", def: "Перейти в родительскую папку" },
            { term: "clear", def: "Очистить экран терминала" },
            { term: "Tab", def: "Дополнить имя файла или команды" }
          ],
          explain: "cd меняет каталог, clear очищает экран, а Tab предлагает автодополнение.",
          hint: "Сопоставь название команды с действием, которое она выполняет."
        },
        {
          type: "hotkeys",
          question: "Какой клавишей прервать выполняющуюся команду в терминале?",
          app: "terminal",
          options: [
            { id: "a", keys: ["Ctrl", "C"] },
            { id: "b", keys: ["Ctrl", "L"] },
            { id: "c", keys: ["Tab"] },
            { id: "d", keys: ["↑"] }
          ],
          answer: "a",
          explain: "Ctrl+C отправляет прерывание текущему процессу в терминале.",
          hint: "Это сочетание также часто используют для остановки команды."
        }
      ],
      test: [
        {
          type: "choice",
          question: "Как проверить состояние рабочей папки Git?",
          options: [
            { id: "a", text: "Проверить состояние", code: "git status" },
            { id: "b", text: "Показать историю", code: "git log" },
            { id: "c", text: "Показать различия", code: "git diff" },
            { id: "d", text: "Показать последний коммит", code: "git show HEAD" }
          ],
          answer: "a",
          explain: "git status показывает состояние рабочей папки и индекса.",
          hint: "Вторая часть команды означает «состояние»."
        },
        {
          type: "choice",
          question: "Как увидеть незаписанные в индекс изменения файлов?",
          options: [
            { id: "a", text: "Посмотреть различия", code: "git diff" },
            { id: "b", text: "Посмотреть состояние", code: "git status" },
            { id: "c", text: "Посмотреть историю", code: "git log" },
            { id: "d", text: "Посмотреть последний коммит", code: "git show HEAD" }
          ],
          answer: "a",
          explain: "git diff показывает различия между изменёнными версиями файлов.",
          hint: "Название команды означает «разница»."
        },
        {
          type: "builder",
          question: "Собери команду, чтобы добавить README.md в индекс Git.",
          blocks: ["README.md", "git", "commit", "add", "push"],
          answer: ["git", "add", "README.md"],
          explain: "git add добавляет указанный файл в индекс для будущего коммита.",
          hint: "После git add укажи имя файла."
        },
        {
          type: "choice",
          question: "Какая команда показывает историю коммитов?",
          options: [
            { id: "a", text: "Показать список веток", code: "git branch" },
            { id: "b", text: "Показать историю коммитов", code: "git log" },
            { id: "c", text: "Проверить состояние", code: "git status" },
            { id: "d", text: "Показать последний коммит", code: "git show HEAD" }
          ],
          answer: "b",
          explain: "git log выводит список коммитов в истории.",
          hint: "Команда связана с журналом событий."
        },
        {
          type: "builder",
          question: "Собери команду коммита с сообщением start.",
          blocks: ["-m", "git", '"start"', "add", "commit"],
          answer: ["git", "commit", "-m", '"start"'],
          explain: "Флаг -m задаёт сообщение коммита прямо в команде.",
          hint: "Порядок: git, commit, -m, затем сообщение в кавычках."
        }
      ]
    },
    {
      id: 2,
      accent: "var(--lesson-commits)",
      title: "Первый коммит",
      description: "Добавь изменения в индекс и создай коммит.",
      goals: ["Проверять состояние репозитория", "Добавлять файлы в индекс", "Создавать коммит с сообщением"],
      why: "Коммиты сохраняют понятные этапы работы над проектом. Индекс позволяет выбрать, какие именно изменения попадут в следующий снимок.",
      theory: [
        { title: "Проверь изменения", text: "Перед сохранением посмотри, какие файлы изменились и готовы ли они к коммиту.", code: "git status" },
        { title: "Подготовь и сохрани", text: "Сначала добавь файл в индекс, затем создай коммит с коротким сообщением.", code: "git add README.md\ngit commit -m \"Обновить README\"" }
      ],
      tasks: [
        { type: "choice", question: "Как проверить, какие файлы изменились?", options: [{ id: "a", text: "Проверить состояние", code: "git status" }, { id: "b", text: "Показать список веток", code: "git branch --list" }, { id: "c", text: "Посмотреть статистику истории", code: "git log --stat" }, { id: "d", text: "Посмотреть адреса remote", code: "git remote -v" }], answer: "a", explain: "git status показывает изменения и состояние индекса.", hint: "Выбери команду для проверки состояния." },
        { type: "builder", question: "Собери команду для добавления README.md в индекс.", blocks: ["git", "README.md", "add", "commit"], answer: ["git", "add", "README.md"], explain: "git add добавляет файл в индекс.", hint: "Укажи git add и имя файла." },
        { type: "choice", question: "Какая команда создаёт коммит с сообщением?", options: [{ id: "a", text: "Сохранить снимок изменений", code: "git commit -m \"start\"" }, { id: "b", text: "Показать файлы", code: "git ls-files" }, { id: "c", text: "Добавить README в индекс", code: "git add README.md" }, { id: "d", text: "Проверить состояние", code: "git status" }], answer: "a", explain: "git commit -m создаёт коммит с сообщением.", hint: "Для сообщения используется флаг -m." }
      ],
      test: [
        { type: "choice", question: "Куда git add помещает подготовленные изменения?", options: [{ id: "a", text: "В индекс Git" }, { id: "b", text: "Сразу на сервер" }], answer: "a", explain: "git add подготавливает изменения в индексе, но не отправляет их на сервер.", hint: "Следующий шаг после индекса — коммит." },
        { type: "builder", question: "Собери команду создания коммита с сообщением fix.", blocks: ["git", "commit", "-m", '"fix"', "push"], answer: ["git", "commit", "-m", '"fix"'], explain: "git commit -m записывает подготовленные изменения с сообщением.", hint: "Сообщение поставь после -m." }
      ]
    },
    {
      id: 3,
      accent: "var(--lesson-branches)",
      title: "Ветки",
      description: "Создавай отдельные ветки для изменений.",
      goals: ["Просматривать локальные ветки", "Создавать ветку для отдельной задачи", "Переключаться между ветками и объединять их"],
      why: "Ветки позволяют вести работу над задачами отдельно от основной версии проекта. Так изменения проще проверять и объединять.",
      theory: [
        { title: "Создай отдельную ветку", text: "Новая ветка отделяет работу над задачей от текущей ветки.", code: "git switch -c feature" },
        { title: "Переключись и объедини", text: "Переключайся на существующую ветку, а после проверки объединяй её в текущую.", code: "git switch main\ngit merge feature" }
      ],
      tasks: [
        { type: "choice", question: "Как посмотреть список локальных веток?", options: [{ id: "a", text: "Показать ветки", code: "git branch" }, { id: "b", text: "Проверить состояние", code: "git status" }, { id: "c", text: "Посмотреть историю коммитов", code: "git log --oneline" }, { id: "d", text: "Посмотреть адреса remote", code: "git remote -v" }], answer: "a", explain: "git branch без аргументов показывает локальные ветки.", hint: "Используй подкоманду branch." },
        { type: "builder", question: "Собери команду переключения на ветку feature.", blocks: ["feature", "git", "switch", "merge"], answer: ["git", "switch", "feature"], explain: "git switch переключает рабочую копию на существующую ветку.", hint: "После git switch напиши имя ветки." },
        { type: "choice", question: "Как объединить ветку feature в текущую?", options: [{ id: "a", text: "Объединить ветку", code: "git merge feature" }, { id: "b", text: "Переименовать файл", code: "git mv" }, { id: "c", text: "Переключиться на feature", code: "git switch feature" }, { id: "d", text: "Посмотреть историю", code: "git log --oneline" }], answer: "a", explain: "git merge включает изменения указанной ветки в текущую.", hint: "Команда называется merge." }
      ],
      test: [
        { type: "choice", question: "Как создать и сразу выбрать новую ветку feature?", options: [{ id: "a", text: "Создать и переключиться", code: "git switch -c feature" }, { id: "b", text: "Показать историю", code: "git log" }, { id: "c", text: "Создать ветку без переключения", code: "git branch feature" }, { id: "d", text: "Переключиться на существующую ветку", code: "git checkout feature" }], answer: "a", explain: "Флаг -c у git switch создаёт новую ветку и переключает на неё.", hint: "Используй git switch с флагом -c." },
        { type: "builder", question: "Собери команду просмотра веток.", blocks: ["branch", "git", "status", "switch"], answer: ["git", "branch"], explain: "git branch выводит локальные ветки.", hint: "Подкоманда branch идёт после git." }
      ]
    },
    {
      id: 4,
      accent: "var(--lesson-remote)",
      title: "Удалённый репозиторий",
      description: "Свяжи проект с удалённым репозиторием и отправь изменения.",
      goals: ["Просматривать адреса удалённых репозиториев", "Отправлять ветку на сервер", "Получать изменения из удалённой ветки"],
      why: "Удалённый репозиторий помогает синхронизировать проект между компьютерами и делиться изменениями с командой.",
      theory: [
        { title: "Посмотри подключённые репозитории", text: "Команда покажет имена удалённых репозиториев и их адреса.", code: "git remote -v" },
        { title: "Синхронизируй ветку", text: "Отправляй свои коммиты командой push, а новые изменения получай командой pull.", code: "git push origin main\ngit pull" }
      ],
      tasks: [
        { type: "choice", question: "Как посмотреть настроенные удалённые репозитории?", options: [{ id: "a", text: "Посмотреть адреса", code: "git remote -v" }, { id: "b", text: "Посмотреть коммиты", code: "git log" }, { id: "c", text: "Показать имена remote", code: "git remote" }, { id: "d", text: "Показать локальные и удалённые ветки", code: "git branch -a" }], answer: "a", explain: "git remote -v показывает имена и адреса удалённых репозиториев.", hint: "Для подробного списка используется -v." },
        { type: "builder", question: "Собери команду отправки ветки main на origin.", blocks: ["origin", "git", "main", "push", "pull"], answer: ["git", "push", "origin", "main"], explain: "git push отправляет коммиты выбранной ветки в удалённый репозиторий.", hint: "Сначала git push, затем имя remote и ветки." },
        { type: "choice", question: "Какая команда копирует удалённый репозиторий на компьютер?", options: [{ id: "a", text: "Клонировать репозиторий", code: "git clone URL" }, { id: "b", text: "Создать коммит", code: "git commit" }, { id: "c", text: "Получить данные без рабочей копии", code: "git fetch URL" }, { id: "d", text: "Добавить адрес remote", code: "git remote add origin URL" }], answer: "a", explain: "git clone создаёт локальную копию удалённого репозитория.", hint: "Используй команду clone и адрес репозитория." }
      ],
      test: [
        { type: "choice", question: "Как получить новые коммиты с удалённого репозитория и объединить их?", options: [{ id: "a", text: "Получить изменения", code: "git pull" }, { id: "b", text: "Отправить изменения", code: "git push" }, { id: "c", text: "Получить данные без слияния", code: "git fetch origin" }, { id: "d", text: "Создать локальную копию", code: "git clone URL" }], answer: "a", explain: "git pull получает изменения с remote и объединяет их с текущей веткой.", hint: "Это команда для получения изменений." },
        { type: "builder", question: "Собери команду просмотра адресов remote.", blocks: ["-v", "git", "remote", "push"], answer: ["git", "remote", "-v"], explain: "Флаг -v показывает адреса удалённых репозиториев.", hint: "Сначала git remote, затем -v." }
      ]
    },
    {
      id: 5,
      accent: "var(--lesson-pr)",
      title: "Pull request и работа в команде",
      description: "Подготовь ветку для совместной проверки изменений.",
      goals: ["Подготавливать ветку к проверке", "Понимать назначение pull request", "Обсуждать изменения перед слиянием"],
      why: "Pull request даёт команде место для проверки и обсуждения изменений до их включения в основную ветку.",
      theory: [
        { title: "Отправь ветку", text: "После коммитов отправь свою ветку в удалённый репозиторий, чтобы команда могла её увидеть.", code: "git push -u origin feature" },
        { title: "Предложи изменения", text: "Создай pull request на платформе репозитория и укажи ветку, в которую нужно внести изменения." }
      ],
      tasks: [
        { type: "choice", question: "Где обычно создают pull request для репозитория на GitHub?", options: [{ id: "a", text: "На вкладке Pull requests репозитория" }, { id: "b", text: "В настройках локального терминала" }], answer: "a", explain: "Pull request создают на странице репозитория GitHub после отправки ветки.", hint: "Ищи вкладку с названием Pull requests." },
        { type: "builder", question: "Собери команду отправки ветки feature на origin.", blocks: ["git", "push", "origin", "feature", "merge"], answer: ["git", "push", "origin", "feature"], explain: "Перед созданием PR ветку нужно отправить на удалённый репозиторий.", hint: "Укажи git push, remote origin и имя feature." },
        { type: "choice", question: "Что позволяет сделать pull request?", options: [{ id: "a", text: "Обсудить и проверить изменения перед слиянием" }, { id: "b", text: "Очистить историю коммитов автоматически" }], answer: "a", explain: "Pull request помогает команде обсудить изменения и предложить их к слиянию.", hint: "Это запрос на проверку и слияние изменений." }
      ],
      test: [
        { type: "choice", question: "Что обычно нужно сделать со своей веткой перед созданием PR?", options: [{ id: "a", text: "Отправить её на GitHub", code: "git push" }, { id: "b", text: "Удалить локальный репозиторий", code: "git clean" }], answer: "a", explain: "Ветка должна быть доступна на GitHub, чтобы открыть pull request.", hint: "Используй команду отправки изменений." },
        { type: "choice", question: "Для чего команда обсуждает pull request?", options: [{ id: "a", text: "Чтобы проверить и обсудить предлагаемые изменения" }, { id: "b", text: "Чтобы сменить тему терминала" }], answer: "a", explain: "Обсуждение PR помогает проверить изменения перед слиянием.", hint: "PR относится к совместной проверке кода." }
      ]
    }
  ],
  bonuses: [
    {
      id: "b1",
      accent: "var(--bonus-figma)",
      title: "Горячие клавиши Figma",
      description: "Быстрее выбирай инструменты в редакторе макетов.",
      goals: ["Находить команды через сочетания клавиш", "Выбирать инструменты для макета", "Быстрее переключаться между инструментами"],
      why: "Сочетания клавиш ускоряют работу с макетами и помогают реже отвлекаться на поиск нужной команды.",
      theory: [
        { title: "Инструменты и клавиши", text: "В Figma отдельные клавиши быстро включают инструменты выделения, текста и рамки.", code: "V — перемещение\nT — текст\nF — рамка" },
        { title: "Проверь активный инструмент", text: "Перед изменением объекта убедись, что выбран подходящий инструмент. Нажми клавишу инструмента, чтобы переключиться.", code: "Нажми V, чтобы выбрать инструмент перемещения" }
      ],
      tasks: [
        { type: "hotkeys", question: "Какая клавиша включает инструмент «Рамка» в Figma?", app: "figma", options: [{ id: "a", keys: ["F"] }, { id: "b", keys: ["V"] }, { id: "c", keys: ["R"] }, { id: "d", keys: ["T"] }], answer: "a", explain: "В Figma клавиша F включает инструмент «Рамка».", hint: "Для рамки используется первая буква слова Frame." },
        { type: "choice", question: "Какая клавиша выбирает инструмент текста в Figma?", options: [{ id: "a", text: "Текст", code: "T" }, { id: "b", text: "Рамка", code: "F" }, { id: "c", text: "Прямоугольник", code: "R" }], answer: "a", explain: "Клавиша T включает инструмент текста.", hint: "Используй первую букву слова Text." },
        { type: "hotkeys", question: "Какая клавиша включает инструмент «Перемещение» в Figma?", app: "figma", options: [{ id: "a", keys: ["V"] }, { id: "b", keys: ["F"] }, { id: "c", keys: ["R"] }, { id: "d", keys: ["T"] }], answer: "a", explain: "В Figma клавиша V включает инструмент «Перемещение».", hint: "Это основная клавиша выбора и перемещения объектов." }
      ]
    },
    {
      id: "b2",
      accent: "var(--bonus-vscode)",
      title: "Горячие клавиши VS Code",
      description: "Используй сочетания клавиш для навигации и команд редактора.",
      goals: ["Открывать файл по имени", "Вызывать палитру команд", "Показывать встроенный терминал"],
      why: "Горячие клавиши помогают перемещаться по проекту и запускать команды, не отвлекаясь от редактора.",
      theory: [
        { title: "Быстро найди файл", text: "Открой быстрый переход и введи часть имени файла.", code: "Ctrl + P" },
        { title: "Открой команды и терминал", text: "Палитра команд ищет действия редактора, а встроенный терминал открывается отдельным сочетанием.", code: "Ctrl + Shift + P\nCtrl + `" }
      ],
      tasks: [
        { type: "hotkeys", question: "Как открыть палитру команд в VS Code?", app: "vscode", options: [{ id: "a", keys: ["Ctrl", "Shift", "P"] }, { id: "b", keys: ["Ctrl", "P"] }, { id: "c", keys: ["Ctrl", "B"] }, { id: "d", keys: ["Ctrl", "`"] }], answer: "a", explain: "Ctrl+Shift+P открывает палитру команд VS Code.", hint: "К сочетанию Ctrl+P добавь Shift." },
        { type: "choice", question: "Как быстро открыть файл по имени в VS Code?", options: [{ id: "a", text: "Быстрый переход к файлу", code: "Ctrl + P" }, { id: "b", text: "Палитра команд", code: "Ctrl + Shift + P" }, { id: "c", text: "Переключить боковую панель", code: "Ctrl + B" }], answer: "a", explain: "Ctrl+P открывает быстрый переход к файлу.", hint: "Нажми Ctrl и букву P." },
        { type: "hotkeys", question: "Как открыть или скрыть встроенный терминал VS Code?", app: "vscode", options: [{ id: "a", keys: ["Ctrl", "`"] }, { id: "b", keys: ["Ctrl", "P"] }, { id: "c", keys: ["Ctrl", "B"] }, { id: "d", keys: ["Ctrl", "Shift", "P"] }], answer: "a", explain: "Ctrl+` переключает встроенный терминал VS Code.", hint: "Последняя клавиша — обратная кавычка рядом с цифрой 1 на многих раскладках." }
      ]
    }
  ]
};

window.GitLingo.validateBank = function () {
  const errors = [];
  const config = window.GitLingo.data.config;

  function validateTask(task, label) {
    if (!task || typeof task.question !== "string" || !task.question.trim()) errors.push(`${label}: нет вопроса`);
    if (!task || typeof task.explain !== "string" || !task.explain.trim()) errors.push(`${label}: нет объяснения`);
    if (!task) return;

    if (task.type === "choice" || task.type === "hotkeys") {
      if (!Array.isArray(task.options) || task.options.length < 2 || task.options.length > 4) {
        errors.push(`${label}: должно быть от 2 до 4 вариантов`);
      } else if (!task.options.some((option) => option.id === task.answer)) {
        errors.push(`${label}: ответ не найден среди вариантов`);
      }
    }

    if (task.type === "output-reading") {
      if (typeof task.id !== "string" || !task.id || typeof task.environment !== "string" || !task.environment
        || typeof task.command !== "string" || !task.command || typeof task.output !== "string" || !task.output || !Array.isArray(task.records)
        || !Array.isArray(task.answer) || !Array.isArray(task.options) || task.options.length !== 3) {
        errors.push(`${label}: неполная структура чтения вывода`);
      } else {
        const validKinds = new Set(["file", "directory", "current-directory"]);
        const paths = task.records.map((record) => record && record.path);
        if (!task.records.length || new Set(paths).size !== paths.length
          || task.records.some((record) => !record || typeof record.path !== "string" || !record.path.trim() || !validKinds.has(record.kind))) {
          errors.push(`${label}: неверные или повторные записи вывода`);
        }
        const matchingOptions = task.options.filter((option) => option && option.id && Array.isArray(option.records)
          && JSON.stringify(option.records) === JSON.stringify(task.answer));
        if (JSON.stringify(task.answer) !== JSON.stringify(task.records) || matchingOptions.length !== 1
          || task.options.some((option) => !option || !option.id || typeof option.text !== "string" || !Array.isArray(option.records))) {
          errors.push(`${label}: ответ не покрывает записи вывода`);
        }
        if (task.environment.length > 120 || task.command.length > 240 || task.output.length > 2000) errors.push(`${label}: контекст или вывод слишком длинный`);
        for (const option of task.options) {
          if (!option || !Array.isArray(option.records)
            || option.records.some((record) => !record || typeof record.path !== "string" || !validKinds.has(record.kind))) {
            errors.push(`${label}: вариант содержит невалидную запись`);
          }
        }
      }
    }

    if (task.type === "builder") {
      const available = new Map();
      for (const block of task.blocks || []) available.set(block, (available.get(block) || 0) + 1);
      const needed = new Map();
      for (const block of task.answer || []) needed.set(block, (needed.get(block) || 0) + 1);
      for (const [block, count] of needed) {
        if ((available.get(block) || 0) < count) errors.push(`${label}: блок ответа отсутствует в банке`);
      }
    }

    if (task.type === "matching" && (!Array.isArray(task.pairs) || task.pairs.length !== 4)) {
      errors.push(`${label}: для сопоставления нужны 4 пары`);
    }
  }

  for (const lesson of window.GitLingo.data.lessons) {
    if (!Array.isArray(lesson.goals) || lesson.goals.length !== 3 || lesson.goals.some((goal) => typeof goal !== "string" || !goal.trim())) {
      errors.push(`Урок ${lesson.id}: нужно указать 3 цели`);
    }
    if (typeof lesson.why !== "string" || !lesson.why.trim()) errors.push(`Урок ${lesson.id}: не указано, зачем это нужно`);
    if (!Array.isArray(lesson.theory) || lesson.theory.length < 2 || lesson.theory.length > 4
      || lesson.theory.some((card) => !card || typeof card.title !== "string" || !card.title.trim() || typeof card.text !== "string" || !card.text.trim())) {
      errors.push(`Урок ${lesson.id}: теория должна содержать от 2 до 4 карточек`);
    }
    lesson.tasks.forEach((task, index) => validateTask(task, `Урок ${lesson.id}, задание ${index + 1}`));
    lesson.test.forEach((task, index) => validateTask(task, `Урок ${lesson.id}, тест ${index + 1}`));
    // Уроки 2–5 оставлены короткими заглушками с двумя вопросами.
    if (lesson.id === 1 && lesson.test.length < config.TEST_LENGTH) {
      errors.push(`Урок ${lesson.id}: в тесте меньше ${config.TEST_LENGTH} заданий`);
    }
  }

  for (const bonus of window.GitLingo.data.bonuses) {
    if (!Array.isArray(bonus.goals) || bonus.goals.length !== 3 || bonus.goals.some((goal) => typeof goal !== "string" || !goal.trim())) {
      errors.push(`Бонус ${bonus.id}: нужно указать 3 цели`);
    }
    if (typeof bonus.why !== "string" || !bonus.why.trim()) errors.push(`Бонус ${bonus.id}: не указано, зачем это нужно`);
    if (!Array.isArray(bonus.theory) || bonus.theory.length < 2 || bonus.theory.length > 4
      || bonus.theory.some((card) => !card || typeof card.title !== "string" || !card.title.trim() || typeof card.text !== "string" || !card.text.trim())) {
      errors.push(`Бонус ${bonus.id}: теория должна содержать от 2 до 4 карточек`);
    }
    bonus.tasks.forEach((task, index) => validateTask(task, `Бонус ${bonus.id}, задание ${index + 1}`));
  }

  const courseUnit = window.GitLingo.data.courseUnits?.find((unit) => unit.id === "terminal-paths-v1");
  if (!courseUnit || !Array.isArray(window.GitLingo.data.curriculumNodes)
    || new Set(window.GitLingo.data.curriculumNodes.map((node) => node.nodeId)).size !== window.GitLingo.data.curriculumNodes.length) {
    errors.push("Курс: отсутствует содержимое или есть повтор ID узлов");
  } else {
    const nodesById = new Map(window.GitLingo.data.curriculumNodes.map((node) => [node.nodeId, node]));
    const visiting = new Set();
    const visited = new Set();
    function visitNode(nodeId) {
      if (visiting.has(nodeId)) return false;
      if (visited.has(nodeId)) return true;
      visiting.add(nodeId);
      const node = nodesById.get(nodeId);
      const valid = node && ["study", "practice", "check"].includes(node.kind)
        && node.unitId === courseUnit.id && Array.isArray(node.requires)
        && node.requires.every((required) => nodesById.has(required) && visitNode(required));
      visiting.delete(nodeId);
      if (valid) visited.add(nodeId);
      return Boolean(valid);
    }
    for (const node of window.GitLingo.data.curriculumNodes) {
      if (!node.nodeId || !visitNode(node.nodeId)) errors.push(`Карта курса: неверный узел или зависимость ${node.nodeId || ""}`);
    }
    const taskIds = new Set();
    for (const task of [...courseUnit.tasks, ...courseUnit.test]) {
      if (typeof task.id !== "string" || taskIds.has(task.id)) errors.push(`Курс: пустой или повторный ID задания ${task.id || ""}`);
      taskIds.add(task.id);
    }
    courseUnit.tasks.forEach((task, index) => validateTask(task, `Курс terminal-paths-v1, практика ${index + 1}`));
    courseUnit.test.forEach((task, index) => validateTask(task, `Курс terminal-paths-v1, тест ${index + 1}`));
    if (courseUnit.test.length !== 5 || !courseUnit.tasks.some((task) => task.type === "output-reading")) errors.push("Курс: ожидаются 5 контрольных вопросов и чтение вывода");
  }

  if (errors.length) {
    for (const error of errors) console.error(`[GitLingo.validateBank] ${error}`);
  }
  return errors.length === 0;
};
