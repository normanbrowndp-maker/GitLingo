window.GitLingo = window.GitLingo || {};

// Доступ к черновикам (только свои, решает RLS) и к публикациям (общая таблица
// снимков) через текущую Supabase-сессию. publishable-ключ, без секретов.
(() => {
  const FIELDS = "id,owner_user_id,title,description,content,status,created_at,updated_at,published_at";

  function client() {
    const availability = window.GitLingo.auth && window.GitLingo.auth.getAvailability();
    if (availability !== "available") return null;
    const authState = window.GitLingo.auth.getState();
    if (authState.status !== "authenticated") return null;
    // sdk доступен через глобальную переменную после загрузки vendor-скрипта.
    const factory = window.supabase;
    if (!factory || typeof factory.createClient !== "function") return null;
    const config = window.GitLingo.supabaseConfig;
    if (!config) return null;
    return factory.createClient(config.projectUrl, config.publishableKey, {
      auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    });
  }

  function classifyError(error) {
    return {
      ok: false,
      reason: String(error && error.message || error || "request-failed")
    };
  }

  async function requireClient() {
    const active = client();
    if (!active) return { ok: false, reason: "Требуется вход в аккаунт." };
    return { ok: true, client: active };
  }

  // visibleContent больше не нужен: published_content недоступен клиентам,
  // чужие курсы читаются из таблицы публикаций через getPublished().

  // Опубликованный снимок для всех пользователей, включая автора.
  async function getPublished(courseId) {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    try {
      const { data, error } = await ready.client
        .from("custom_course_publications")
        .select("course_id,title,description,snapshot,published_at")
        .eq("course_id", courseId)
        .maybeSingle();
      if (error) return classifyError(error);
      if (!data) return { ok: false, reason: "Курс ещё не опубликован." };
      return { ok: true, publication: data };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function listPublished() {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    try {
      const { data, error } = await ready.client
        .from("custom_course_publications")
        .select("course_id,title,description,published_at")
        .order("published_at", { ascending: false });
      if (error) return classifyError(error);
      return { ok: true, rows: data || [] };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function listOwn() {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    try {
      const { data, error } = await ready.client
        .from("custom_courses")
        .select(FIELDS)
        .order("updated_at", { ascending: false });
      if (error) return classifyError(error);
      return { ok: true, rows: data || [] };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function getCourse(id) {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    try {
      const { data, error } = await ready.client
        .from("custom_courses")
        .select(FIELDS)
        .eq("id", id)
        .maybeSingle();
      if (error) return classifyError(error);
      if (!data) return { ok: false, reason: "Курс не найден или недоступен." };
      return { ok: true, row: data };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function createCourse(title, description, content) {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    try {
      const authState = window.GitLingo.auth.getState();
      const { data, error } = await ready.client
        .from("custom_courses")
        .insert({
          owner_user_id: authState.userId,
          title,
          description,
          content,
          status: "draft"
        })
        .select(FIELDS)
        .single();
      if (error) return classifyError(error);
      return { ok: true, row: data };
    } catch (error) {
      return classifyError(error);
    }
  }

  async function updateDraft(id, fields) {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    const patch = {};
    for (const key of ["title", "description", "content"]) {
      if (key in fields) patch[key] = fields[key];
    }
    try {
      const { data, error } = await ready.client
        .from("custom_courses")
        .update(patch)
        .eq("id", id)
        .select(FIELDS)
        .maybeSingle();
      if (error) return classifyError(error);
      if (!data) return { ok: false, reason: "Черновик не найден или недоступен." };
      return { ok: true, row: data };
    } catch (error) {
      return classifyError(error);
    }
  }

  // Публикация: атомарная серверная RPC (владелец + валидация + снимок + даты).
  async function publishCourse(id, content) {
    const ready = await requireClient();
    if (!ready.ok) return ready;
    try {
      const { data, error } = await ready.client
        .rpc("gl_publish_custom_course", { p_course_id: id, p_content: content });
      if (error) return classifyError(error);
      if (!data || data.ok === false) {
        return { ok: false, reason: String((data && data.error) || "Публикация отклонена сервером.") };
      }
      const refreshed = await getCourse(id);
      if (!refreshed.ok) return refreshed;
      return { ok: true, row: refreshed.row };
    } catch (error) {
      return classifyError(error);
    }
  }

  window.GitLingo.customCourseApi = Object.freeze({
    listOwn,
    listPublished,
    getCourse,
    createCourse,
    updateDraft,
    publishCourse,
    getPublished
  });
})();
