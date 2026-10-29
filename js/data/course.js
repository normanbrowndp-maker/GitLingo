window.MEGA = window.MEGA || {};
window.MEGA.data = window.MEGA.data || {};

(() => {
  const option = (id, text) => ({ id, text });
  const read = (id, question, command, output, records, answer, explain, hint) => ({
    id, type: "output-reading", question,
    environment: "Git Bash для Windows (Git for Windows)",
    command, output, records,
    answer: records,
    options: [
      { id: "a", text: "Все строки относятся к файлам", records: answer === "a" ? records : [] },
      { id: "b", text: "Суффикс / обозначает каталог; остальные строки — файлы", records: answer === "b" ? records : [] },
      { id: "c", text: "Вывод не показывает содержимое текущей папки", records: answer === "c" ? records : [] }
    ], explain, hint
  });

  const practice = [
    { id: "paths-p01", type: "choice", question: "В Git Bash выполнена команда pwd. Какую информацию она показывает?", options: [option("a", "Текущую рабочую папку"), option("b", "Список файлов"), option("c", "Последний коммит")], answer: "a", explain: "pwd печатает абсолютный путь текущей рабочей папки.", hint: "Название команды — print working directory." },
    read("paths-p02", "Текущая папка /c/course. Какие элементы являются каталогами?", "ls -F", "assets/\nnotes.txt\npractice/", [{ path: "assets", kind: "directory" }, { path: "notes.txt", kind: "file" }, { path: "practice", kind: "directory" }], "b", "В Git Bash ключ -F добавляет / к именам каталогов. Имена без этого суффикса здесь обозначают файлы.", "Ищите суффикс / после имени."),
    { id: "paths-p03", type: "choice", question: "Вы находитесь в /c/course. Где окажетесь после cd ..?", options: [option("a", "/c"), option("b", "/c/course"), option("c", "/")], answer: "a", explain: ".. обозначает родительский каталог текущей папки.", hint: "Поднимитесь ровно на один уровень." },
    { id: "paths-p04", type: "builder", question: "Текущая папка /c/course. Соберите команду перехода в существующую папку practice внутри неё.", blocks: ["cd", "practice", "..", "/c/course"], answer: ["cd", "practice"], explain: "Относительный путь practice отсчитывается от текущей папки.", hint: "Нужны команда перехода и имя дочернего каталога." },
    { id: "paths-p05", type: "choice", question: "Какой путь начинается от корня диска C в Git Bash?", options: [option("a", "/c/Users/learner/project"), option("b", "project/README.md"), option("c", "../project")], answer: "a", explain: "Путь, начинающийся с /, абсолютный. В Git Bash диск C обозначается /c.", hint: "Абсолютный путь начинается с /." },
    read("paths-p06", "Текущая папка /c/course. Что показывает вывод команды?", "pwd", "/c/course", [{ path: "/c/course", kind: "current-directory" }], "c", "pwd показывает абсолютный путь текущей папки; вывод не перечисляет её содержимое.", "Различайте путь текущей папки и список ls."),
    { id: "paths-p07", type: "choice", question: "В /c/course уже есть папка practice. Как создать внутри неё папку drafts?", options: [option("a", "mkdir practice/drafts"), option("b", "cd practice/drafts"), option("c", "touch practice/drafts")], answer: "a", explain: "mkdir создаёт каталог по указанному пути; родитель practice уже существует.", hint: "Нужна команда создания каталога." },
    { id: "paths-p08", type: "builder", question: "Вы в /c/course/practice. Соберите команду, которая поднимет вас в /c/course.", blocks: ["cd", "..", ".", "practice"], answer: ["cd", ".."], explain: "Из practice команда cd .. переходит в родительскую папку course.", hint: "Для родительской папки используется .." },
    { id: "paths-p09", type: "choice", question: "В /c/course нужно создать пустой файл README.md. Папка существует. Какое действие подходит в Git Bash?", options: [option("a", "touch README.md"), option("b", "mkdir README.md"), option("c", "cd README.md")], answer: "a", explain: "touch создаёт пустой файл, если его ещё нет.", hint: "mkdir создаёт каталог, не файл." },
    { id: "paths-p10", type: "choice", question: "В /c/course/practice уже есть README.md. Как записать относительный путь, явно указывающий на файл в текущей папке?", options: [option("a", "./README.md"), option("b", "../README.md"), option("c", "practice/README.md")], answer: "a", explain: ". обозначает текущую папку; поэтому ./README.md выбирает файл README.md здесь.", hint: "Точка в начале пути обозначает текущую папку." },
    { id: "paths-p11", type: "builder", scenarioStep: 1, question: "Самостоятельная практика. Исходно: /c/course; папки practice ещё нет. Подготовьте каталог для заметок.", blocks: ["mkdir", "practice", "cd", "notes"], answer: ["mkdir", "practice"], explain: "Сначала создайте каталог practice. Это учебная модель: команды на компьютере не запускаются.", hint: "На этом шаге создаётся каталог." },
    { id: "paths-p12", type: "builder", scenarioStep: 2, question: "Продолжение задачи: каталог /c/course/practice только что создан; текущая папка всё ещё /c/course. Перейдите в него.", blocks: ["cd", "practice", "mkdir", ".."], answer: ["cd", "practice"], explain: "Теперь текущая папка — practice. Состояние учебной ситуации изменилось после прошлого шага.", hint: "Используйте cd и имя созданного каталога." },
    { id: "paths-p13", type: "builder", scenarioStep: 3, question: "Вы в /c/course/practice. Создайте в этой папке пустой файл README.md.", blocks: ["touch", "README.md", "mkdir", "../README.md"], answer: ["touch", "README.md"], explain: "touch создаёт пустой файл в текущем каталоге. Учебная практика не изменяет файловую систему компьютера.", hint: "Имя файла указывается относительно текущей папки." }
  ];

  const tests = [
    { id: "paths-t01", type: "choice", question: "Вы находитесь в /c/work/app. Какая команда покажет этот текущий путь?", options: [option("a", "pwd"), option("b", "ls"), option("c", "mkdir")], answer: "a", explain: "pwd печатает путь текущей рабочей папки.", hint: "Подсказки в контрольном тесте отключены." },
    read("paths-t02", "Текущая папка /c/work. Какой элемент вывода является каталогом?", "ls -F", "docs/\nplan.md\n", [{ path: "docs", kind: "directory" }, { path: "plan.md", kind: "file" }], "b", "Суффикс / помечает каталог; plan.md без суффикса — файл.", "Подсказки в контрольном тесте отключены."),
    { id: "paths-t03", type: "choice", question: "В /c/work/app нужно перейти к соседней папке /c/work/docs. Какой относительный путь передать cd?", options: [option("a", "../docs"), option("b", "./docs"), option("c", "../../docs")], answer: "a", explain: "Один .. поднимает из app в work, затем docs выбирает соседний каталог.", hint: "Подсказки в контрольном тесте отключены." },
    { id: "paths-t04", type: "builder", question: "Текущая папка /c/work. Соберите команду создания каталога drafts.", blocks: ["mkdir", "drafts", "touch", "cd"], answer: ["mkdir", "drafts"], explain: "mkdir создаёт каталог с указанным именем.", hint: "Подсказки в контрольном тесте отключены." },
    { id: "paths-t05", type: "choice", question: "В текущей папке /c/work/app уже есть файл config.txt. Какой относительный путь явно выбирает его в текущей папке?", options: [option("a", "./config.txt"), option("b", "../config.txt"), option("c", "app/config.txt")], answer: "a", explain: ". обозначает текущую папку; ./config.txt указывает на файл в ней.", hint: "Подсказки в контрольном тесте отключены." }
  ];

  window.MEGA.data.courseUnits = [{
    id: "terminal-paths-v1",
    title: "Терминал и файловые пути",
    accent: "#6558c9",
    description: "Научитесь ориентироваться в папках и безопасно готовить структуру учебного проекта.",
    why: "Понимание рабочей папки и путей помогает выполнять последующие команды там, где вы ожидаете.",
    goals: ["Определять текущую папку и читать простой список файлов", "Различать абсолютные и относительные пути, . и ..", "Создавать каталоги и пустые файлы в нужном месте"],
    theory: [
      { title: "Рабочая папка", text: "Терминал хранит текущую рабочую папку. Относительный путь считается от неё. В курсе используется Git Bash из Git for Windows; команды не запускаются браузером.", code: "pwd\n/c/course" },
      { title: "Читаем содержимое", text: "ls показывает элементы текущей папки. С ключом -F Git Bash добавляет / к именам каталогов. Файл и каталог — разные объекты: папка может содержать файлы и другие папки.", code: "ls -F\nassets/\nREADME.md" },
      { title: "Пути и переходы", text: "Путь с / в начале абсолютный. Иначе он относительный. Точка . означает текущую папку, .. — родительскую. cd меняет рабочую папку.", code: "cd practice\ncd ..\ncd /c/course" },
      { title: "Создание", text: "mkdir создаёт каталог. touch создаёт пустой файл. Родительская папка должна уже существовать. Перед командой проверьте pwd, чтобы не создать объект не там.", code: "mkdir practice\ncd practice\ntouch README.md" }
    ],
    tasks: practice,
    test: tests
  }];

  window.MEGA.data.curriculumNodes = [
    { nodeId: "course-terminal-study", title: "Теория", kind: "study", unitId: "terminal-paths-v1", requires: [] },
    { nodeId: "course-terminal-practice", title: "Практика", kind: "practice", unitId: "terminal-paths-v1", requires: ["course-terminal-study"] },
    { nodeId: "course-terminal-check", title: "Контроль", kind: "check", unitId: "terminal-paths-v1", requires: ["course-terminal-practice"] }
  ];
})();
