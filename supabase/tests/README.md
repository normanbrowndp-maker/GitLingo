# Проверка изоляции аккаунтов

Проводите проверки только в отдельном тестовом Supabase-проекте. Миграция не создаёт Auth-пользователей и не добавляет тестовые строки. Сначала примените её и запустите [`access_checks.sql`](access_checks.sql) как read-only проверку каталогов. Это проверяет фактические grants, включённый RLS, политики, клиентские права на столбцы, trigger-функции и зависимости views. Административный запуск этой проверки не является доказательством пользовательской изоляции.

## Проверка реальных пользовательских JWT через REST

1. Создайте в тестовом проекте два отдельные тестовые Auth-аккаунта A и B через Supabase Auth. Запишите их UUID. Не используйте аккаунты или данные production. Сохраните пароли и полученные access token только локально; не вставляйте их в репозиторий или чат.
2. Получите access token каждого тестового пользователя через обычный email/password sign-in. Все дальнейшие запросы выполняйте через Data API с публичным publishable-ключом в `apikey` и токеном пользователя в `Authorization: Bearer ...`. Не используйте SQL Editor, `service_role` или secret key для этих проверок.
3. Для тела progress используйте синтетический объект формы локального `mega-state`, не реальный экспорт пользователя. Пример полного пустого снимка:

```json
{
  "v": 1,
  "xp": 0,
  "streak": 0,
  "lastActiveDate": null,
  "profile": { "level": null },
  "lessons": {
    "1": { "completed": false, "bestAccuracy": 0, "testPassed": false },
    "2": { "completed": false, "bestAccuracy": 0, "testPassed": false },
    "3": { "completed": false, "bestAccuracy": 0, "testPassed": false },
    "4": { "completed": false, "bestAccuracy": 0, "testPassed": false },
    "5": { "completed": false, "bestAccuracy": 0, "testPassed": false }
  },
  "bonuses": {
    "b1": { "completed": false },
    "b2": { "completed": false }
  }
}
```

4. Через REST от A вставьте `profiles` с `id=A_UUID` и тестовым `display_name`, затем `user_progress` с `user_id=A_UUID`, снимком выше и `schema_version=1`. Оба INSERT должны пройти, а возвращённая прогресс-строка должна иметь `revision=1` и серверные timestamps.
5. От A прочитайте обе строки и обновите `display_name`, затем JSON-снимок с фильтром `user_id=eq.A_UUID&revision=eq.1`. Запросы должны вернуть собственные данные; после обновления прогресса `revision` должен стать `2`, а `updated_at` — более новым. Используйте `Prefer: return=representation`, чтобы видеть количество/содержимое затронутых строк.
6. От B выполните SELECT по UUID A: ответ не должен содержать строк. Попробуйте INSERT профиля и прогресса с владельцем A: запрос должен быть запрещён. Попробуйте PATCH и DELETE строк A: ответ может быть пустым массивом/нулём строк, это считается отказом; проверьте от A, что строки остались.
7. От A попробуйте PATCH `id` профиля или `user_id` прогресса на UUID B. Запрос должен завершиться ошибкой прав на столбец либо ограничением RLS; владелец не должен измениться.
8. Выполните GET с publishable `apikey`, но без пользовательского Bearer JWT. Роль будет `anon`; API не должен вернуть строк аккаунта. Проверяйте ответ и статус, не только сообщение интерфейса.
9. Для авторизованного A попробуйте INSERT progress с `state: []`, затем с `state: null`. Оба INSERT должны быть отклонены ограничениями БД.
10. Сохраните текущую ревизию 2. Повторите PATCH с фильтром `revision=eq.1`: обновление должно затронуть ноль строк. Не повторяйте запись безусловно; это сценарий конфликта.
11. Удалите через Auth только два созданных тестовых аккаунта A и B. FK `ON DELETE CASCADE` удалит только их профиль и прогресс. Убедитесь, что проверки не затрагивали другие строки.

Пример запроса от A в PowerShell (значения окружения задайте только в локальном терминале; реальные токены не записывайте в файл):

```powershell
$profileBody = @{ id = $env:TEST_USER_A_ID; display_name = 'GitLingo test A' } | ConvertTo-Json -Compress
curl.exe -i -X POST "$($env:SUPABASE_URL)/rest/v1/profiles?select=id,display_name" `
  -H "apikey: $env:SUPABASE_PUBLISHABLE_KEY" `
  -H "Authorization: Bearer $env:TEST_USER_A_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Prefer: return=representation" `
  --data-binary $profileBody

curl.exe -i "$($env:SUPABASE_URL)/rest/v1/profiles?select=id,display_name&id=eq.$($env:TEST_USER_A_ID)" `
  -H "apikey: $env:SUPABASE_PUBLISHABLE_KEY" `
  -H "Authorization: Bearer $env:TEST_USER_A_TOKEN"
```

Для B повторите GET, заменив ID на A и токен на B: ожидается `[]`. Для отрицательных PATCH/DELETE запросов используйте `Prefer: return=representation` и проверяйте пустой результат плюс сохранность строки чтением от A.

URL Data API, publishable key, тестовые email/пароли и JWT подставляйте локально из Dashboard и ответа Auth. Не сохраняйте реальные значения в этом файле. Supabase Dashboard встроенная почта ограничена для тестирования; следуйте актуальной инструкции Supabase по [тестированию Auth-потоков](https://supabase.com/docs/guides/auth/testing-auth-flows).
