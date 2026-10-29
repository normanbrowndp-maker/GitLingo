window.GitLingo = window.GitLingo || {};

(() => {
  const recoveryMarkerKey = "mega-auth-recovery-pending";
  const currentUrl = new URL(window.location.href);
  const callbackCodePresent = currentUrl.searchParams.has("code");
  const callbackErrorPresent = currentUrl.searchParams.has("error") || currentUrl.searchParams.has("error_code");
  const callbackErrorText = [
    currentUrl.searchParams.get("error_code"),
    currentUrl.searchParams.get("error_description"),
    currentUrl.searchParams.get("error")
  ].filter(Boolean).join(" ").toLowerCase();

  let client = null;
  let subscription = null;
  let operationInProgress = false;
  let progressSaveInProgress = false;
  let recoveryMarkerWasSet = false;
  let state = {
    ready: false,
    status: "guest",
    userId: "",
    email: "",
    recovery: false,
    connection: "initializing",
    callback: ""
  };

  function snapshot() {
    return { ...state };
  }

  function publish() {
    window.dispatchEvent(new CustomEvent("mega-auth-state", { detail: snapshot() }));
  }

  function publishReadyDefaults(connection) {
    state = {
      ready: true,
      status: "guest",
      userId: "",
      email: "",
      recovery: false,
      connection,
      callback: ""
    };
    publish();
  }

  function callbackResultFromError() {
    if (/expired|otp_expired|flow_state_not_found/.test(callbackErrorText)) return "expired";
    return "invalid";
  }

  function clearCallbackAddress() {
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = "";
      cleanUrl.hash = "";
      window.history.replaceState(window.history.state, document.title, cleanUrl.pathname);
    } catch {
      // Callback tokens are never copied elsewhere; leave navigation usable if history is unavailable.
    }
  }

  function setRecoveryMarker() {
    try {
      window.sessionStorage.setItem(recoveryMarkerKey, "1");
      recoveryMarkerWasSet = true;
    } catch {
      recoveryMarkerWasSet = false;
    }
  }

  function clearRecoveryMarker() {
    try {
      window.sessionStorage.removeItem(recoveryMarkerKey);
    } catch {
      // Recovery remains limited to this page lifetime when session storage is unavailable.
    }
    recoveryMarkerWasSet = false;
  }

  function hasRecoveryMarker() {
    try {
      return window.sessionStorage.getItem(recoveryMarkerKey) === "1";
    } catch {
      return false;
    }
  }

  function updateUser(session) {
    const user = session && session.user;
    state.status = user ? "authenticated" : "guest";
    state.userId = user && typeof user.id === "string" ? user.id : "";
    state.email = user && typeof user.email === "string" ? user.email : "";
  }

  function onAuthStateChange(event, session) {
    // Keep this callback synchronous. Do not call Supabase Auth methods from here.
    updateUser(session);

    if (event === "PASSWORD_RECOVERY") {
      state.recovery = Boolean(session && session.user);
      if (state.recovery) setRecoveryMarker();
      state.callback = state.recovery ? "recovery" : "invalid";
      state.ready = true;
      clearCallbackAddress();
    } else if (event === "SIGNED_OUT") {
      state.recovery = false;
      state.callback = "";
      clearRecoveryMarker();
    } else if (event === "SIGNED_IN" && !callbackCodePresent && !callbackErrorPresent) {
      state.callback = "";
    } else if (event === "INITIAL_SESSION") {
      state.ready = true;
      state.recovery = Boolean(session && session.user && (recoveryMarkerWasSet || hasRecoveryMarker()));

      if (callbackErrorPresent) {
        state.callback = callbackResultFromError();
        state.recovery = false;
        clearRecoveryMarker();
      } else if (callbackCodePresent) {
        if (state.recovery) state.callback = "recovery";
        else if (session && session.user) state.callback = "confirmed";
        else state.callback = "invalid";
      } else if (!session) {
        state.recovery = false;
        clearRecoveryMarker();
      }

      if (callbackCodePresent || callbackErrorPresent) clearCallbackAddress();
    }

    publish();
  }

  function validProjectConfig(config) {
    if (!config || typeof config.projectUrl !== "string" || typeof config.publishableKey !== "string") return false;
    try {
      const projectUrl = new URL(config.projectUrl);
      return projectUrl.protocol === "https:"
        && /^[a-z0-9-]+\.supabase\.co$/i.test(projectUrl.hostname)
        && projectUrl.pathname === "/"
        && !projectUrl.search
        && !projectUrl.hash
        && !projectUrl.username
        && !projectUrl.password
        && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
    } catch {
      return false;
    }
  }

  function classifyError(error, operation) {
    const code = String(error && error.code || "").toLowerCase();
    const name = String(error && error.name || "").toLowerCase();
    const message = String(error && error.message || "").toLowerCase();
    const combined = `${code} ${name} ${message}`;

    if (/rate|too many|429|over_email_send/.test(combined) || Number(error && error.status) === 429) return "rate-limit";
    if (/email_not_confirmed|email not confirmed/.test(combined)) return "email-not-confirmed";
    if (/otp_expired|token has expired|expired.*token|flow_state_not_found/.test(combined)) return "expired-link";
    if (/invalid_credentials|invalid login credentials|invalid.*password/.test(combined)) return "invalid-credentials";
    if (/weak_password|password.*(short|weak|at least|minimum|characters)/.test(combined)) return "password-policy";
    if (name === "typeerror" || /failed to fetch|network|fetch failed|load failed/.test(combined)) return "network";
    if (operation === "sign-in") return "invalid-credentials";
    if (operation === "callback") return "invalid-link";
    return "request-failed";
  }

  function unavailableReason() {
    if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return "local-server-required";
    if (state.connection === "unconfigured") return "unconfigured";
    if (state.connection === "invalid-config") return "invalid-config";
    if (state.connection === "sdk-missing") return "sdk-missing";
    return "unavailable";
  }

  async function runOperation(operation, callback) {
    if (!client) return { ok: false, reason: unavailableReason() };
    if (operationInProgress) return { ok: false, reason: "busy" };
    operationInProgress = true;
    try {
      return await callback();
    } catch (error) {
      return { ok: false, reason: classifyError(error, operation) };
    } finally {
      operationInProgress = false;
    }
  }

  function authReturnUrl() {
    const url = new URL("auth.html", window.location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  }

  async function signUp(email, password) {
    return runOperation("sign-up", async () => {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: authReturnUrl() }
      });
      if (error) return { ok: false, reason: classifyError(error, "sign-up") };
      return { ok: true, confirmationRequired: !data.session };
    });
  }

  async function signIn(email, password) {
    return runOperation("sign-in", async () => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, reason: classifyError(error, "sign-in") };
      return { ok: true };
    });
  }

  async function requestPasswordReset(email) {
    return runOperation("reset", async () => {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: authReturnUrl() });
      if (error) return { ok: false, reason: classifyError(error, "reset") };
      return { ok: true };
    });
  }

  async function updatePassword(password) {
    if (!state.recovery || state.status !== "authenticated") return { ok: false, reason: "recovery-required" };
    return runOperation("update-password", async () => {
      const { error } = await client.auth.updateUser({ password });
      if (error) return { ok: false, reason: classifyError(error, "update-password") };
      state.recovery = false;
      state.callback = "password-updated";
      clearRecoveryMarker();
      publish();
      return { ok: true };
    });
  }

  async function signOut() {
    return runOperation("sign-out", async () => {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) return { ok: false, reason: classifyError(error, "sign-out") };
      return { ok: true };
    });
  }

  function normalizeDisplayName(value) {
    if (typeof value !== "string") return { ok: false, reason: "invalid-name" };
    const displayName = value.replace(/^ +| +$/g, "");
    const length = Array.from(displayName).length;
    if (length < 1 || length > 40) return { ok: false, reason: "invalid-name" };
    return { ok: true, displayName };
  }

  function currentProfileOwner() {
    if (!client) return { ok: false, reason: unavailableReason() };
    if (state.status !== "authenticated" || !state.userId) return { ok: false, reason: "not-authenticated" };
    if (state.recovery) return { ok: false, reason: "recovery-active" };
    return { ok: true, userId: state.userId };
  }

  function isCurrentProfileOwner(userId) {
    return state.status === "authenticated" && !state.recovery && state.userId === userId;
  }

  async function currentProgressOwner() {
    const owner = currentProfileOwner();
    if (!owner.ok) return owner;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) return { ok: false, reason: classifyError(error, "progress") };
      const sessionUserId = data && data.session && data.session.user && data.session.user.id;
      if (sessionUserId !== owner.userId || !isCurrentProfileOwner(owner.userId)) {
        return { ok: false, reason: "stale-session" };
      }
      return owner;
    } catch (error) {
      return { ok: false, reason: classifyError(error, "progress") };
    }
  }

  function classifyProgressError(error) {
    if (String(error && error.code || "") === "23505") return "primary-conflict";
    return classifyError(error, "progress");
  }

  async function getUserProgress() {
    const owner = await currentProgressOwner();
    if (!owner.ok) return owner;
    try {
      const { data, error } = await client
        .from("user_progress")
        .select("user_id,state,schema_version,revision,updated_at")
        .eq("user_id", owner.userId)
        .maybeSingle();
      if (error) return { ok: false, reason: classifyProgressError(error) };
      if (!isCurrentProfileOwner(owner.userId)) return { ok: false, reason: "stale-session" };
      return { ok: true, row: data };
    } catch (error) {
      return { ok: false, reason: classifyProgressError(error) };
    }
  }

  async function saveUserProgress(snapshot, schemaVersion, expectedRevision, expectedFingerprint) {
    if (progressSaveInProgress) return { ok: false, reason: "busy" };
    progressSaveInProgress = true;
    try {
      const inspected = window.GitLingo.state && window.GitLingo.state.inspectCloudSnapshot(snapshot, schemaVersion);
      if (!inspected || !inspected.ok) return { ok: false, reason: "invalid-local-state" };
      const owner = await currentProgressOwner();
      if (!owner.ok) return owner;
      const latestLocal = window.GitLingo.state.getCloudSnapshot();
      if (!latestLocal.ok) return { ok: false, reason: "invalid-local-state" };
      if (typeof expectedFingerprint === "string" && latestLocal.fingerprint !== expectedFingerprint) {
        return { ok: false, reason: "local-changed" };
      }

      let query = client.from("user_progress");
      if (expectedRevision === null) {
        query = query.insert({ user_id: owner.userId, state: inspected.state, schema_version: schemaVersion });
      } else {
        const validRevision = (Number.isSafeInteger(expectedRevision) && expectedRevision > 0)
          || (typeof expectedRevision === "string" && /^[1-9][0-9]*$/.test(expectedRevision));
        if (!validRevision) return { ok: false, reason: "invalid-cloud-state" };
        query = query.update({ state: inspected.state, schema_version: schemaVersion })
          .eq("user_id", owner.userId)
          .eq("revision", expectedRevision);
      }

      const { data, error } = await query
        .select("user_id,state,schema_version,revision,updated_at")
        .maybeSingle();
      if (error) return { ok: false, reason: classifyProgressError(error) };
      if (!isCurrentProfileOwner(owner.userId)) return { ok: false, reason: "stale-session" };
      if (!data) return { ok: false, reason: "conflict" };
      return { ok: true, row: data };
    } catch (error) {
      return { ok: false, reason: classifyProgressError(error) };
    } finally {
      progressSaveInProgress = false;
    }
  }

  async function loadProfileFor(userId) {
    try {
      const { data, error } = await client
        .from("profiles")
        .select("id,display_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) return { ok: false, reason: classifyProfileError(error) };
      if (!isCurrentProfileOwner(userId)) return { ok: false, reason: "stale-session" };
      return { ok: true, profile: data ? { id: data.id, display_name: data.display_name } : null };
    } catch (error) {
      return { ok: false, reason: classifyProfileError(error) };
    }
  }

  function classifyProfileError(error) {
    if (String(error && error.code || "") === "23505") return "profile-conflict";
    if (String(error && error.code || "") === "23514") return "invalid-name";
    return classifyError(error, "profile");
  }

  async function getProfile() {
    const owner = currentProfileOwner();
    if (!owner.ok) return owner;
    return loadProfileFor(owner.userId);
  }

  async function createProfile(value) {
    const name = normalizeDisplayName(value);
    if (!name.ok) return name;
    const owner = currentProfileOwner();
    if (!owner.ok) return owner;

    try {
      const { data, error } = await client
        .from("profiles")
        .insert({ id: owner.userId, display_name: name.displayName })
        .select("id,display_name")
        .single();
      if (error) {
        if (String(error.code || "") === "23505" && isCurrentProfileOwner(owner.userId)) {
          const latest = await loadProfileFor(owner.userId);
          return { ok: false, reason: "profile-conflict", profile: latest.ok ? latest.profile : null };
        }
        return { ok: false, reason: classifyProfileError(error) };
      }
      if (!isCurrentProfileOwner(owner.userId)) return { ok: false, reason: "stale-session" };
      return { ok: true, profile: { id: data.id, display_name: data.display_name } };
    } catch (error) {
      return { ok: false, reason: classifyProfileError(error) };
    }
  }

  async function updateProfile(value) {
    const name = normalizeDisplayName(value);
    if (!name.ok) return name;
    const owner = currentProfileOwner();
    if (!owner.ok) return owner;

    try {
      const { data, error } = await client
        .from("profiles")
        .update({ display_name: name.displayName })
        .eq("id", owner.userId)
        .select("id,display_name")
        .maybeSingle();
      if (error) return { ok: false, reason: classifyProfileError(error) };
      if (!isCurrentProfileOwner(owner.userId)) return { ok: false, reason: "stale-session" };
      if (!data) return { ok: false, reason: "profile-not-updated" };
      return { ok: true, profile: { id: data.id, display_name: data.display_name } };
    } catch (error) {
      return { ok: false, reason: classifyProfileError(error) };
    }
  }

  function getState() {
    return snapshot();
  }

  function initialize() {
    if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
      publishReadyDefaults("local-server-required");
      return;
    }

    const config = window.GitLingo.supabaseConfig;
    const hasAnyConfig = Boolean(config && (config.projectUrl || config.publishableKey));
    if (!hasAnyConfig) {
      publishReadyDefaults("unconfigured");
      return;
    }
    if (!validProjectConfig(config)) {
      publishReadyDefaults("invalid-config");
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      publishReadyDefaults("sdk-missing");
      return;
    }

    try {
      client = window.supabase.createClient(config.projectUrl, config.publishableKey, {
        auth: {
          flowType: "pkce",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      // Set this before subscribing: the SDK may publish its initial state immediately.
      state.connection = "configured";
      const result = client.auth.onAuthStateChange(onAuthStateChange);
      subscription = result && result.data && result.data.subscription;
    } catch {
      client = null;
      publishReadyDefaults("initialization-error");
    }
  }

  window.GitLingo.auth = Object.freeze({
    getState,
    signUp,
    signIn,
    requestPasswordReset,
    updatePassword,
    signOut,
    getProfile,
    createProfile,
    updateProfile,
    getUserProgress,
    saveUserProgress,
    getAvailability() {
      if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return "local-server-required";
      if (state.connection === "unconfigured") return "unconfigured";
      if (state.connection === "invalid-config") return "invalid-config";
      if (state.connection === "sdk-missing") return "sdk-missing";
      if (state.connection === "initialization-error") return "initialization-error";
      return client ? "available" : "unavailable";
    },
    dispose() {
      if (subscription) subscription.unsubscribe();
      subscription = null;
    }
  });

  initialize();
})();
