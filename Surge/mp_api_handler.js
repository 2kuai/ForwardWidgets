// =============================================
// MP API Handler - 纯Surge实现
// 域名: mp.2kuai.run
// 路径: /api/v1/...
// 版本: v6.0 - URL触发版
// =============================================

const VERSION = "2026.06.26-fw-mp-v6";

// =============================================
// 日志工具
// =============================================
const LOG = {
    debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString().split('T')[1].slice(0, 12)} | ${msg}`),
    info: (msg) => console.log(`[INFO]  ${new Date().toISOString().split('T')[1].slice(0, 12)} | ${msg}`),
    warn: (msg) => console.log(`[WARN]  ${new Date().toISOString().split('T')[1].slice(0, 12)} | ⚠️ ${msg}`),
    error: (msg) => console.log(`[ERROR] ${new Date().toISOString().split('T')[1].slice(0, 12)} | ❌ ${msg}`),
    success: (msg) => console.log(`[OK]    ${new Date().toISOString().split('T')[1].slice(0, 12)} | ✅ ${msg}`),
    section: (msg) => console.log(`\n${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}`)
};

// =============================================
// 参数解析
// =============================================
const ARGS = (() => {
    const params = new URLSearchParams($argument || "");
    return {
        USERNAME: params.get("username") || "admin",
        PASSWORD: params.get("password") || "admin123",
        TMDB_API_KEY: params.get("tmdb_api_key") || "",
        DEFAULT_CID: params.get("cid") || "",
        P115_COOKIE: params.get("p115_cookie") || "",
        TRIGGER_SCRIPT: params.get("trigger_script") || "p115-current",
        DOMAIN: "mp.2kuai.run"
    };
})();

const requestUrl = $request.url;
const method = $request.method;
let path = "";

try {
    path = new URL(requestUrl).pathname;
} catch (e) {
    path = requestUrl.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
}

if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
}

let queryParams = new URLSearchParams();
try {
    queryParams = new URL(requestUrl).searchParams;
} catch (e) {
    const query = requestUrl.split("?")[1] || "";
    queryParams = new URLSearchParams(query);
}

LOG.section(`MP API 请求 | ${method} ${path}`);

function parseBody(raw) {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        const obj = {};
        try {
            const params = new URLSearchParams(raw);
            for (const [k, v] of params.entries()) obj[k] = v;
            return obj;
        } catch (e2) {
            return {};
        }
    }
}
const body = parseBody($request.body || "");
LOG.debug(`Request body: ${JSON.stringify(body).slice(0, 200)}`);

// =============================================
// DB & JWT 工具集
// =============================================
const DB = {
    get(key) {
        try { 
            const v = $persistentStore.read(key); 
            LOG.debug(`DB.get(${key}): ${v ? 'found' : 'null'}`);
            return v ? JSON.parse(v) : null; 
        } catch (e) { 
            LOG.error(`DB.get(${key}) failed: ${e.message}`);
            return null; 
        }
    },
    set(key, value) { 
        try {
            $persistentStore.write(JSON.stringify(value), key); 
            LOG.debug(`DB.set(${key}): success`);
        } catch (e) {
            LOG.error(`DB.set(${key}) failed: ${e.message}`);
        }
    },
    getSubs() { return this.get("mp_subscriptions") || []; },
    saveSubs(v) { this.set("mp_subscriptions", v); },
    getHistory() { return this.get("mp_history") || []; },
    saveHistory(v) { this.set("mp_history", v); },
    getSettings() { return this.get("mp_settings") || {}; },
    saveSettings(v) { this.set("mp_settings", v); },
    getToken() { return this.get("mp_access_token") || ""; },
    saveToken(v) { this.set("mp_access_token", v); },
    getTransferRuns() {
        const data = this.get("115_transfer_logs");
        if (Array.isArray(data)) return data;
        return (data && data.runs) || [];
    },
    saveTransferRuns(v) { this.set("115_transfer_logs", v); }
};

const JWT = {
    secret: "mp-jwt-secret-2024",
    encode(str) { return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""); },
    decode(str) {
        str += new Array(5 - (str.length % 4)).join("=");
        return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    },
    sign(data) {
        let hash = 0;
        const str = String(data);
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return this.encode(String(hash));
    },
    create(payload) {
        const header = this.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const now = Math.floor(Date.now() / 1000);
        const body = this.encode(JSON.stringify({ ...payload, exp: now + 604800, iat: now }));
        const signature = this.sign(`${header}.${body}.${this.secret}`);
        return `${header}.${body}.${signature}`;
    },
    verify(token) {
        try {
            const [h, b, s] = token.split(".");
            if (!h || !b || !s) return null;
            const payload = JSON.parse(this.decode(b));
            if (payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        } catch (e) { return null; }
    }
};

// =============================================
// Response 构建
// =============================================
let DONE = false;

function jsonResponse(status, data) {
    if (DONE) return;
    DONE = true;
    LOG.success(`Response ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    $done({
        response: {
            status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Cache-Control": "no-store"
            },
            body: JSON.stringify(data)
        }
    });
}

function htmlResponse(status, html) {
    if (DONE) return;
    DONE = true;
    LOG.success(`HTML Response ${status}: ${html.length} bytes`);
    $done({
        response: {
            status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store"
            },
            body: html
        }
    });
}

function emptyResponse(status) {
    if (DONE) return;
    DONE = true;
    LOG.success(`Empty Response ${status}`);
    $done({ response: { status, headers: { "Cache-Control": "no-store" }, body: "" } });
}

function success(data) { jsonResponse(200, { code: 0, message: "success", data }); }
function mpSuccess(data) { jsonResponse(200, data); }
function opSuccess(data, message) { jsonResponse(200, { success: true, message: message || "success", data }); }
function opError(status, message) { jsonResponse(status || 400, { success: false, message: message || "error", data: null }); }
function error(code, message) { LOG.error(`API Error ${code}: ${message}`); jsonResponse(400, { code, message, data: null }); }
function unauthorized() { LOG.warn(`Unauthorized request`); jsonResponse(401, { code: 401, message: "Unauthorized", data: null }); }
function notFound() { LOG.error(`Route not matched: ${method} ${path}`); jsonResponse(404, { code: 404, message: "Not Found", data: null }); }

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function nowISO() { return new Date().toISOString(); }
function normalizeType(type) {
    const t = String(type || "").toLowerCase();
    if (t === "电视剧" || t === "剧集" || t === "tv" || t === "series") return "tv";
    return "movie";
}
function typeLabel(type) { return normalizeType(type) === "tv" ? "电视剧" : "电影"; }
function formatDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function getMoviePilotId(sub) {
    if (!sub) return 0;
    if (Number.isFinite(Number(sub.mp_id)) && Number(sub.mp_id) > 0) return Number(sub.mp_id);
    return 0;
}

function getSubSeason(sub) {
    return normalizeType(sub && sub.type) === "tv" ? (Number(sub && sub.season || 1) || 1) : 0;
}

function runMatchesSub(run, sub) {
    if (!run || !sub) return false;
    const subId = String(sub.id || "");
    if (subId && String(run.sub_id || "") === subId) return true;
    if (String(run.tmdbid || "") !== String(sub.tmdbid || "")) return false;
    if (normalizeType(run.type) !== normalizeType(sub.type)) return false;
    if (normalizeType(sub.type) !== "tv") return true;
    return String(run.season || "1") === String(getSubSeason(sub) || 1);
}

function deriveSubRuntimeState(sub) {
    const isTV = normalizeType(sub && sub.type) === "tv";
    const runs = DB.getTransferRuns()
        .filter(run => runMatchesSub(run, sub))
        .sort((a, b) => String(b.finished_at || b.started_at || "").localeCompare(String(a.finished_at || a.started_at || "")));
    const latestRun = runs[0] || null;
    const transferredRuns = runs.filter(run => Array.isArray(run.transferred_items) && run.transferred_items.length > 0);
    const latestTransferredRun = transferredRuns[0] || null;
    const episodeSet = new Set();

    if (isTV) {
        runs.forEach(run => {
            (run.transferred_items || []).forEach(item => {
                const season = Number(item.season || run.season || getSubSeason(sub) || 1) || 1;
                const episode = Number(item.episode || 0) || 0;
                if (season === getSubSeason(sub) && episode > 0) episodeSet.add(episode);
            });
        });
    }

    const totalEpisode = Number(sub.total_episode || sub.total_episodes || 0) || 0;
    const storedCompleted = Number(sub.completed_episode ?? sub.completed ?? 0) || 0;
    const completedEpisode = isTV ? Math.max(storedCompleted, episodeSet.size) : null;
    const lackEpisode = isTV ? Math.max(totalEpisode - completedEpisode, 0) : 0;
    const lastMessage = sub.message || latestRun?.summary?.message || "";

    let state = sub.state || "N";
    if (sub.status === "completed") state = "R";
    else if (sub.status === "running" || latestRun?.status === "running") state = "P";
    else if (sub.status === "error" || latestRun?.status === "error") state = "E";
    else if (isTV && totalEpisode > 0 && completedEpisode >= totalEpisode) state = "R";

    return {
        runs,
        latestRun,
        latestTransferredRun,
        totalEpisode,
        completedEpisode,
        lackEpisode,
        state,
        lastMessage,
        count: isTV ? completedEpisode : (latestTransferredRun ? (latestTransferredRun.transferred_items || []).length : Number(sub.transferred || 0) || 0)
    };
}

function allocateMoviePilotId(subs) {
    const settings = DB.getSettings();
    const usedIds = new Set((subs || []).map(getMoviePilotId).filter(id => id > 0));
    let nextId = Number(settings.nextMoviePilotSubId || 1);
    if (!Number.isFinite(nextId) || nextId < 1) nextId = 1;
    while (usedIds.has(nextId)) nextId++;
    settings.nextMoviePilotSubId = nextId + 1;
    DB.saveSettings(settings);
    return nextId;
}

function ensureMoviePilotIds() {
    const subs = DB.getSubs();
    const settings = DB.getSettings();
    let changed = false;
    let settingsChanged = false;
    const usedIds = new Set();
    let nextId = Number(settings.nextMoviePilotSubId || 1);
    if (!Number.isFinite(nextId) || nextId < 1) nextId = 1;

    subs.forEach(sub => {
        const currentId = getMoviePilotId(sub);
        if (currentId > 0 && !usedIds.has(currentId)) {
            usedIds.add(currentId);
            return;
        }
        while (usedIds.has(nextId)) nextId++;
        sub.mp_id = nextId;
        usedIds.add(nextId);
        nextId++;
        changed = true;
    });

    while (usedIds.has(nextId)) nextId++;
    if (Number(settings.nextMoviePilotSubId || 0) !== nextId) {
        settings.nextMoviePilotSubId = nextId;
        settingsChanged = true;
    }

    if (changed) DB.saveSubs(subs);
    if (settingsChanged) DB.saveSettings(settings);
    return subs;
}

function toMoviePilotSub(sub) {
    if (!sub) return null;
    const mediaType = normalizeType(sub.type);
    const isTV = mediaType === "tv";
    const runtime = deriveSubRuntimeState(sub);
    const totalEpisode = runtime.totalEpisode;
    const completedEpisode = isTV ? runtime.completedEpisode : null;
    const lackEpisode = isTV ? runtime.lackEpisode : 0;
    const latestRun = runtime.latestRun || {};
    const latestTransferredRun = runtime.latestTransferredRun || {};
    const latestItem = ((latestTransferredRun.transferred_items || [])[0]) || {};

    return {
        id: getMoviePilotId(sub),
        subscribe_id: getMoviePilotId(sub),
        share_title: sub.share_title || latestItem.share_title || latestRun.share_title || "",
        share_comment: sub.share_comment || latestItem.share_comment || "",
        share_user: sub.share_user || "",
        share_uid: sub.share_uid || "",
        name: sub.name || sub.title || "",
        year: sub.year || "",
        type: isTV ? "电视剧" : "电影",
        keyword: sub.keyword ?? null,
        tmdbid: /^\d+$/.test(String(sub.tmdbid || "")) ? Number(sub.tmdbid) : sub.tmdbid,
        doubanid: sub.doubanid ?? null,
        bangumiid: sub.bangumiid ?? null,
        mediaid: sub.mediaid ?? null,
        season: isTV ? (Number(sub.season || 1) || 1) : null,
        poster: sub.poster || "",
        backdrop: sub.backdrop || "",
        vote: toNumberOrNull(sub.vote ?? sub.vote_average) ?? 0,
        description: sub.description || sub.overview || "",
        filter: sub.filter ?? null,
        include: sub.include ?? null,
        exclude: sub.exclude ?? null,
        quality: sub.quality ?? null,
        resolution: sub.resolution ?? null,
        effect: sub.effect ?? null,
        total_episode: isTV ? totalEpisode : 0,
        start_episode: Number(sub.start_episode || 0) || 0,
        lack_episode: isTV ? lackEpisode : 0,
        completed_episode: isTV ? completedEpisode : null,
        note: sub.note ?? null,
        state: runtime.state,
        last_update: sub.last_update || formatDateTime(sub.last_run_at || sub.updated_at || latestRun.finished_at || latestRun.started_at) || null,
        username: sub.username || ARGS.USERNAME,
        sites: sub.sites ?? null,
        downloader: sub.downloader ?? null,
        best_version: Number(sub.best_version || 0) || 0,
        best_version_full: Number(sub.best_version_full || 0) || 0,
        current_priority: sub.current_priority ?? null,
        episode_priority: sub.episode_priority ?? null,
        save_path: sub.save_path ?? null,
        search_imdbid: Number(sub.search_imdbid || 0) || 0,
        date: sub.date || formatDateTime(sub.created_at) || formatDateTime(nowISO()),
        custom_words: sub.custom_words ?? null,
        media_category: sub.media_category ?? null,
        filter_groups: sub.filter_groups ?? null,
        episode_group: sub.episode_group ?? null,
        count: runtime.count,
        status: sub.status || (runtime.state === "R" ? "completed" : "pending"),
        progress: Number(sub.progress || 0) || 0,
        message: runtime.lastMessage || null
    };
}

function emptyMoviePilotSub() {
    const keys = [
        "filter_groups", "episode_priority", "id", "subscribe_id", "share_title", "share_comment",
        "share_user", "share_uid", "include", "last_update", "quality", "state",
        "completed_episode", "save_path", "exclude", "mediaid", "description", "year",
        "media_category", "vote", "type", "current_priority", "custom_words", "doubanid",
        "lack_episode", "best_version", "sites", "downloader", "name", "season", "backdrop",
        "episode_group", "date", "username", "filter", "tmdbid", "best_version_full",
        "keyword", "effect", "total_episode", "start_episode", "bangumiid", "search_imdbid",
        "resolution", "poster", "note", "count", "status", "progress", "message"
    ];
    const obj = {};
    keys.forEach(key => { obj[key] = null; });
    return obj;
}

function getAuthPayload(request) {
    const authHeader = request.headers["Authorization"] || request.headers["authorization"] || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
    return JWT.verify(authHeader.substring(7).trim());
}

function findSubByIdOrTmdb(id) {
    const subs = ensureMoviePilotIds();
    return subs.find(s => matchesSubId(s, id) || String(s.tmdbid) === String(id));
}

function matchesSubId(sub, id) {
    return String(sub.id) === String(id) || String(getMoviePilotId(sub)) === String(id);
}

function updateSubStatus(id, patch) {
    const subs = DB.getSubs();
    const idx = subs.findIndex(s => s.id === id);
    if (idx < 0) return null;
    subs[idx] = { ...subs[idx], ...patch, updated_at: nowISO() };
    DB.saveSubs(subs);
    LOG.debug(`Updated subscription ${id} status: ${patch.status || 'unknown'}`);
    return subs[idx];
}

function queueTask(sub) {
    const settings = DB.getSettings();
    if (!settings.taskQueue) settings.taskQueue = [];
    const exists = settings.taskQueue.find(t => t.id === sub.id);
    if (!exists) {
        settings.taskQueue.push({ id: sub.id, tmdbid: sub.tmdbid, type: sub.type, season: sub.season, cid: sub.cid, name: sub.name, added_at: nowISO() });
        DB.saveSettings(settings);
        LOG.info(`Task queued: ${sub.name} (id: ${sub.id})`);
    } else {
        LOG.warn(`Task already in queue: ${sub.name}`);
    }
}

function markImmediateTask(sub) {
    const settings = DB.getSettings();
    settings.immediateTaskId = sub.id;
    settings.immediateTask = {
        id: sub.id,
        tmdbid: sub.tmdbid,
        type: sub.type,
        season: sub.season,
        cid: sub.cid,
        name: sub.name,
        added_at: nowISO()
    };
    DB.saveSettings(settings);
    LOG.info(`Immediate task marked: ${sub.name} (id: ${sub.id})`);
}

function removeQueueTask(id) {
    const settings = DB.getSettings();
    settings.taskQueue = (settings.taskQueue || []).filter(t => String(t.id) !== String(id));
    DB.saveSettings(settings);
}

function triggerQueueProcessor(reason) {
    return new Promise((resolve) => {
        if (typeof $httpAPI !== "function") {
            LOG.warn("Surge $httpAPI 不可用，已跳过即时触发");
            return resolve(false);
        }
        if (!ARGS.TRIGGER_SCRIPT) {
            LOG.warn("未配置 trigger_script，已跳过即时触发");
            return resolve(false);
        }

        LOG.info(`触发即时任务脚本: ${ARGS.TRIGGER_SCRIPT} | ${reason || "manual"}`);
        try {
            $httpAPI("POST", "/v1/scripting/cron/evaluate", {
                script_name: ARGS.TRIGGER_SCRIPT
            }, (result) => {
                if (result && result.error) {
                    LOG.warn(`即时触发失败: ${JSON.stringify(result)}`);
                    return resolve(false);
                }
                LOG.success(`即时触发已提交: ${ARGS.TRIGGER_SCRIPT}`);
                resolve(true);
            });
        } catch (e) {
            LOG.warn(`即时触发异常: ${e.message}`);
            resolve(false);
        }
    });
}

function buildSubscriptionFromBody(rawBody, options) {
    const opts = options || {};
    const tmdbid = String(rawBody.tmdbid || rawBody.tmdb_id || rawBody.id || "").trim();
    if (!tmdbid || tmdbid === "-1") return null;

    const type = normalizeType(rawBody.type || rawBody.media_type);
    const name = rawBody.name || rawBody.title || rawBody.original_title || rawBody.original_name || `TMDB-${tmdbid}`;
    const defaultSeason = opts.defaultTvSeason !== undefined ? opts.defaultTvSeason : "0";
    const season = String(rawBody.season || (type === "tv" ? defaultSeason : "0"));

    return {
        tmdbid,
        type,
        type_name: typeLabel(type),
        season,
        name,
        title: name,
        year: rawBody.year || "",
        cid: rawBody.cid || ARGS.DEFAULT_CID,
        poster: rawBody.poster || rawBody.poster_url || "",
        backdrop: rawBody.backdrop || rawBody.backdrop_url || "",
        vote: rawBody.vote ?? rawBody.vote_average ?? 0,
        description: rawBody.description || rawBody.overview || "",
        total_episode: rawBody.total_episode ?? rawBody.total_episodes ?? 0
    };
}

function saveSubscriptionRecord(rawBody, options) {
    const opts = options || {};
    const input = buildSubscriptionFromBody(rawBody, opts);
    if (!input) {
        return {
            ignored: true,
            created: false,
            sub: { id: "probe", tmdbid: String(rawBody.tmdbid || rawBody.tmdb_id || rawBody.id || ""), status: "ignored", message: "probe ignored" }
        };
    }

    LOG.info(`Subscription details: name="${input.name}", type=${input.type}, season=${input.season}, tmdbid=${input.tmdbid}`);

    const subs = ensureMoviePilotIds();
    const existing = subs.find(s => String(s.tmdbid) === input.tmdbid && normalizeType(s.type) === input.type && String(s.season || "0") === input.season);
    if (existing) {
        LOG.warn(`Subscription already exists: ${existing.name} (id: ${existing.id})`);
        if (existing.status !== "completed") queueTask(existing);
        return { ignored: false, created: false, sub: existing };
    }

    const sub = {
        id: generateId(),
        mp_id: allocateMoviePilotId(subs),
        tmdbid: input.tmdbid,
        type: input.type,
        type_name: input.type_name,
        season: input.season,
        name: input.name,
        title: input.title,
        year: input.year,
        poster: input.poster,
        backdrop: input.backdrop,
        vote: input.vote,
        description: input.description,
        total_episode: input.total_episode,
        start_episode: 0,
        lack_episode: input.type === "tv" ? (Number(input.total_episode || 0) || 0) : 0,
        completed_episode: input.type === "tv" ? 0 : null,
        state: "N",
        username: ARGS.USERNAME,
        date: formatDateTime(nowISO()),
        status: "pending",
        progress: 0,
        found: 0,
        message: opts.web ? "网页订阅已创建，等待定时处理" : "订阅已创建，等待处理",
        cid: input.cid,
        created_at: nowISO(),
        updated_at: nowISO()
    };

    subs.push(sub);
    DB.saveSubs(subs);
    queueTask(sub);
    LOG.success(`Subscription created: ${sub.name} (id: ${sub.id})`);
    return { ignored: false, created: true, sub };
}

function tmdbImage(pathValue, size) {
    return pathValue ? `https://image.tmdb.org/t/p/${size || "w500"}${pathValue}` : "";
}

function tmdbGet(apiPath, params) {
    return new Promise((resolve, reject) => {
        if (!ARGS.TMDB_API_KEY) return reject(new Error("缺少 TMDB API Key"));

        const qs = new URLSearchParams({
            api_key: ARGS.TMDB_API_KEY,
            language: "zh-CN",
            ...(params || {})
        });

        $httpClient.get({
            url: `https://api.themoviedb.org/3${apiPath}?${qs.toString()}`,
            headers: { "accept": "application/json" },
            timeout: 8
        }, (err, resp, data) => {
            if (err) return reject(new Error(String(err)));
            try {
                const json = JSON.parse(data || "{}");
                if (json.status_message) return reject(new Error(json.status_message));
                resolve(json);
            } catch (e) {
                reject(new Error(`TMDB 响应解析失败: ${e.message}`));
            }
        });
    });
}

function mapTmdbResult(item) {
    if (!item || (item.media_type !== "movie" && item.media_type !== "tv")) return null;
    const type = item.media_type === "tv" ? "tv" : "movie";
    const name = type === "tv"
        ? (item.name || item.original_name || `TMDB-${item.id}`)
        : (item.title || item.original_title || `TMDB-${item.id}`);
    const dateValue = type === "tv" ? item.first_air_date : item.release_date;
    const year = dateValue ? String(dateValue).slice(0, 4) : "";

    return {
        id: String(item.id),
        tmdbid: String(item.id),
        type,
        media_type: type,
        type_name: typeLabel(type),
        name,
        title: name,
        year,
        season: type === "tv" ? "1" : "0",
        overview: item.overview || "",
        vote_average: item.vote_average || 0,
        poster_path: item.poster_path || "",
        backdrop_path: item.backdrop_path || "",
        poster: tmdbImage(item.poster_path, "w342"),
        backdrop: tmdbImage(item.backdrop_path, "w780")
    };
}

async function getRandomTmdbBackdrop() {
    const json = await tmdbGet("/trending/all/day", { page: "1" });
    const candidates = (json.results || [])
        .filter(item => (item.media_type === "movie" || item.media_type === "tv") && item.backdrop_path)
        .map(mapTmdbResult)
        .filter(Boolean);

    if (candidates.length === 0) return null;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return {
        ...picked,
        url: tmdbImage(picked.backdrop_path, "w1280"),
        full_url: tmdbImage(picked.backdrop_path, "original"),
        picked_at: nowISO()
    };
}

async function sendSubscriptionNotification(sub, body) {
    LOG.section(`发送订阅通知`);
    
    // 基础信息
    const isTV = sub.type === "tv";
    const mediaIcon = isTV ? "📺" : "🎥";
    const mediaType = isTV ? "电视剧" : "电影";
    const seasonTag = isTV && sub.season && sub.season !== "0" ? ` S${sub.season}` : "";
    const yearTag = sub.year ? ` (${sub.year})` : "";
    
    LOG.info(`媒体: ${sub.name}${seasonTag}${yearTag}`);
    LOG.info(`类型: ${mediaType}`);
    
    // 🎬 获取 TMDB 海报
    let posterUrl = "";
    if (body.poster_path) {
        posterUrl = `https://image.tmdb.org/t/p/w500${body.poster_path}`;
        LOG.info(`海报: ${posterUrl}`);
    } else if (body.backdrop_path) {
        posterUrl = `https://image.tmdb.org/t/p/w500${body.backdrop_path}`;
        LOG.info(`背景: ${posterUrl}`);
    } else {
        LOG.info(`请求未携带海报，跳过额外 TMDB 查询`);
    }
    
    // ⭐ 评分
    const rating = body.vote_average ? ` | ⭐ ${body.vote_average.toFixed(1)}` : "";
    
    // 📝 简介
    let overview = "";
    if (body.overview) {
        overview = body.overview.length > 60 
            ? body.overview.substring(0, 60) + "..." 
            : body.overview;
    }
    
    // 🏷️ 类型标签
    let genreTags = "";
    if (body.genres && body.genres.length > 0) {
        const genreNames = body.genres.slice(0, 3).map(g => g.name).join(" · ");
        genreTags = `\n🏷️ ${genreNames}`;
    }
    
    // 📅 上映日期
    let releaseInfo = "";
    if (isTV && body.first_air_date) {
        releaseInfo = `\n📅 首播: ${body.first_air_date}`;
    } else if (!isTV && body.release_date) {
        releaseInfo = `\n📅 上映: ${body.release_date}`;
    }
    
    // 📱 通知内容
    const notifTitle = "📥 新订阅已加入处理";
    const notifSubtitle = `${sub.name}${seasonTag}${yearTag}`;
    
    let notifBody = `${mediaIcon} ${mediaType} | TMDB ${sub.tmdbid}${rating}`;
    if (genreTags) notifBody += genreTags;
    if (releaseInfo) notifBody += releaseInfo;
    if (overview) notifBody += `\n\n${overview}`;
    
    LOG.info(`通知准备完成`);
    
    // 📤 发送通知
    try {
        const options = {
            "sound": false,
            "auto-dismiss": 3
        };
        
        if (posterUrl) {
            options["media-url"] = posterUrl;
            LOG.info(`发送通知（带海报）...`);
        } else {
            LOG.info(`发送通知（无海报）...`);
        }
        
        $notification.post(notifTitle, notifSubtitle, notifBody, options);
        LOG.success(`通知发送成功`);
        
    } catch (e) {
        LOG.error(`通知发送失败: ${e.message}`);
        
        // 降级：不带海报重试
        if (posterUrl) {
            LOG.warn(`重试（无海报）...`);
            try {
                $notification.post(notifTitle, notifSubtitle, notifBody, {
                    "sound": false,
                    "auto-dismiss": 3
                });
                LOG.success(`通知发送成功（无海报）`);
            } catch (e2) {
                LOG.error(`重试失败: ${e2.message}`);
            }
        }
    }
}

// =============================================
// Handlers (全部支持 Async)
// =============================================
async function handleLogin(params, body, authPayload) {
    LOG.info(`Login attempt: username=${body.username}`);
    const { username, password } = body;
    if (username !== ARGS.USERNAME || password !== ARGS.PASSWORD) {
        return error(1001, "用户名或密码错误");
    }
    const token = JWT.create({ sub: "1", username, super_user: true, level: 2 });
    DB.saveToken(token);
    LOG.success(`Login successful: ${username}`);
    jsonResponse(200, { avatar: "https://assets.vvebo.vip/scripts/icon.png", wizard: false, token_type: "bearer", super_user: true, level: 2, user_id: 1, user_name: username, access_token: token, permissions: {} });
}

async function handleGetUser() {
    LOG.info(`Get user info`);
    mpSuccess({ avatar: "https://assets.vvebo.vip/scripts/icon.png", wizard: false, token_type: "bearer", super_user: true, level: 2, user_id: 1, user_name: ARGS.USERNAME, access_token: DB.getToken(), permissions: {} });
}

async function handleGetSubs() { 
    const subs = ensureMoviePilotIds();
    LOG.info(`Get subscriptions: ${subs.length} items`);
    mpSuccess(subs.map(toMoviePilotSub)); 
}

async function handleAddSub(params, body, authPayload) {
    LOG.section(`添加新订阅`);
    LOG.info(`Request body: ${JSON.stringify(body)}`);

    const result = saveSubscriptionRecord(body, { web: false });
    const sub = result.sub;

    if (result.ignored) {
        LOG.warn(`Probe request ignored: tmdbid=${sub.tmdbid}`);
        return opSuccess(toMoviePilotSub(sub), "probe ignored");
    }

    markImmediateTask(sub);
    triggerQueueProcessor(`MoviePilot subscription: ${sub.name}`).then((ok) => {
        LOG.info(`即时触发结果: ${ok ? "已提交" : "未提交"}`);
    });

    // 发送通知
    sendSubscriptionNotification(sub, body).catch((e) => {
        LOG.warn(`订阅通知异步发送失败: ${e.message}`);
    });

    // 保存订阅后立即返回，避免等待 Surge API 回调或通知素材请求。
    opSuccess(toMoviePilotSub(sub), result.created ? "订阅已创建" : "订阅已存在");
}

async function handleGetSubByMedia(params) {
    const sub = ensureMoviePilotIds().find(s => String(s.tmdbid) === String(params.tmdbid));
    LOG.info(`Get subscription by TMDB ID ${params.tmdbid}: ${sub ? 'found' : 'not found'}`);
    mpSuccess(sub ? toMoviePilotSub(sub) : emptyMoviePilotSub());
}

async function handleGetSubByUser(params) { 
    const username = params && params.username ? decodeURIComponent(params.username) : ARGS.USERNAME;
    const subs = ensureMoviePilotIds().filter(sub => !sub.username || String(sub.username) === String(username));
    LOG.info(`Get subscriptions by user ${username}: ${subs.length} items`);
    mpSuccess(subs.map(toMoviePilotSub)); 
}

async function handleGetSub(params) {
    const sub = findSubByIdOrTmdb(params.id);
    if (!sub) {
        LOG.warn(`Subscription not found: ${params.id}`);
        return opError(404, "订阅不存在");
    }
    LOG.info(`Get subscription: ${sub.name} (id: ${sub.id})`);
    mpSuccess(toMoviePilotSub(sub));
}

async function handleDeleteSub(params) {
    const subs = ensureMoviePilotIds();
    const idx = params.tmdbid
        ? subs.findIndex(s => String(s.tmdbid) === String(params.tmdbid))
        : subs.findIndex(s => matchesSubId(s, params.id) || String(s.tmdbid) === String(params.id));
    if (idx >= 0) {
        const removed = subs.splice(idx, 1)[0];
        const history = DB.getHistory();
        history.push({ ...removed, deleted_at: nowISO() });
        DB.saveSubs(subs);
        DB.saveHistory(history);
        removeQueueTask(removed.id);
        LOG.success(`Deleted subscription: ${removed.name}`);
        return jsonResponse(200, { success: true, message: null, data: {} });
    } else {
        LOG.warn(`Subscription not found for deletion: ${params.tmdbid || params.id}`);
        return jsonResponse(200, { success: true, message: null, data: {} });
    }
}

async function handleUpdateSub(params, body) {
    const subs = ensureMoviePilotIds();
    const idx = subs.findIndex(s => matchesSubId(s, params.id));
    if (idx < 0) {
        LOG.warn(`Subscription not found for update: ${params.id}`);
        return opError(404, "订阅不存在");
    }
    subs[idx] = { ...subs[idx], ...body, type: normalizeType(body.type || subs[idx].type), updated_at: nowISO() };
    DB.saveSubs(subs);
    LOG.success(`Updated subscription: ${subs[idx].name}`);
    opSuccess(toMoviePilotSub(subs[idx]), "更新成功");
}

async function handleRefreshSub(params) {
    const sub = findSubByIdOrTmdb(params.id);
    if (!sub) {
        LOG.warn(`Subscription not found for refresh: ${params.id}`);
        return opError(404, "订阅不存在");
    }
    
    updateSubStatus(sub.id, { status: "pending", progress: 0, message: "手动刷新，重新处理" });
    queueTask(sub);
    LOG.info(`Subscription refreshed and re-queued: ${sub.name}`);
    
    opSuccess({ triggered: params.id }, "已加入刷新队列");
}

async function handleHistory() { 
    const history = DB.getHistory();
    LOG.info(`Get history: ${history.length} items`);
    success(history); 
}

async function handleQueue() {
    const s = DB.getSettings();
    const queue = s.taskQueue || [];
    LOG.info(`Get queue: ${queue.length} pending tasks`);
    success({ pending: queue, running: s.runningTask || null });
}

async function handleSite() { 
    LOG.info(`Get site info`);
    success({ name: "Surge MP Local", version: VERSION }); 
}

async function handleMessage() { 
    LOG.debug(`Get messages`);
    success({ unread: 0 }); 
}

async function handleDummy() { 
    LOG.debug(`Dummy endpoint`);
    success({}); 
}

function renderLogWebApp() {
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>115 转存日志</title>
<style>
:root{--text:#f4f6fb;--muted:#aeb8c8;--line:rgba(255,255,255,.14);--panel:rgba(10,15,25,.84);--panel2:rgba(16,24,36,.92);--ok:#51d394;--bad:#ff6b7a;--warn:#ffd166;--blue:#79b7ff}
*{box-sizing:border-box}html,body{min-height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#070b12;color:var(--text);letter-spacing:0}
body:before{content:"";position:fixed;inset:0;background:linear-gradient(120deg,rgba(5,9,15,.96),rgba(5,9,15,.78) 48%,rgba(5,9,15,.92)),url("https://image.tmdb.org/t/p/original/9PqD3wSIjntyJDBzMNuxuKHwpUD.jpg");background-size:cover;background-position:center;z-index:-2}
body:after{content:"";position:fixed;inset:0;background:rgba(3,6,12,.25);z-index:-1}
button,input{font:inherit}button{height:34px;border:1px solid var(--line);border-radius:7px;background:rgba(255,255,255,.08);color:var(--text);padding:0 11px;cursor:pointer}button:hover{background:rgba(255,255,255,.14)}button.active{border-color:rgba(81,211,148,.7);background:rgba(81,211,148,.16)}input{width:100%;height:34px;border:1px solid var(--line);border-radius:7px;background:rgba(0,0,0,.28);color:var(--text);padding:0 10px;outline:none}
.wrap{width:min(1320px,calc(100vw - 28px));margin:0 auto;padding:20px 0 30px}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px}.top h1{margin:0;font-size:25px;line-height:1.15}.top p{margin:6px 0 0;color:var(--muted);font-size:13px}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.stat{border:1px solid var(--line);background:rgba(255,255,255,.06);border-radius:8px;padding:10px}.stat b{display:block;font-size:20px}.stat span{display:block;color:var(--muted);font-size:12px;margin-top:3px}
.grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:12px}.panel{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(18px);border-radius:8px;overflow:hidden}.panel h2{font-size:14px;margin:0;padding:12px 13px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.04)}.body{padding:12px}.runs{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 205px);overflow:auto;padding-right:2px}.run{width:100%;height:auto;text-align:left;display:block;padding:10px;border-radius:8px;background:var(--panel2)}.run-title{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.run-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;color:var(--muted);font-size:12px}.badge{display:inline-flex;align-items:center;min-height:22px;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}.blue{color:var(--blue)}
.detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.detail-title h2{padding:0;border:0;background:transparent;font-size:21px;margin:0}.detail-title p{margin:6px 0 0;color:var(--muted);font-size:13px}.tabs{display:flex;gap:8px;margin-bottom:10px}.content-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:12px}.items{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 316px);overflow:auto;padding-right:2px}.item{border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.055);padding:9px;cursor:pointer}.item:hover,.item.active{border-color:rgba(81,211,148,.65);background:rgba(81,211,148,.1)}.item-name{font-weight:700;line-height:1.3;word-break:break-word}.item-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;color:var(--muted);font-size:12px}
.logs{height:calc(100vh - 316px);min-height:360px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:rgba(3,6,10,.82);padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.48}.log{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);white-space:pre-wrap;word-break:break-word}.log.focus{background:rgba(81,211,148,.14);outline:1px solid rgba(81,211,148,.35);border-radius:5px}.log .time{color:#8d98aa;margin-right:7px}.log.success{color:#b5f5d0}.log.error{color:#ffb1ba}.log.warn{color:#ffe09a}.log.step,.log.section{color:#a9d0ff}.empty{border:1px dashed var(--line);border-radius:8px;padding:28px;text-align:center;color:var(--muted);background:rgba(255,255,255,.04)}
.run-wrap{position:relative;overflow:hidden;border-radius:8px;touch-action:pan-y}.run-wrap .run{position:relative;z-index:2;transition:transform .18s ease}.run-wrap.open .run{transform:translateX(-96px)}.run-delete{position:absolute;right:0;top:0;bottom:0;width:92px;height:100%;border:0;border-radius:0 8px 8px 0;background:#9f1d2d;color:#fff;font-weight:700;z-index:1}.run-delete:hover{background:#b42335}.run-wrap.open .run-delete{background:#7f1422}.run-wrap.open .run-delete:hover{background:#9f1d2d}
@media(max-width:980px){.grid,.content-grid{grid-template-columns:1fr}.runs,.items,.logs{max-height:none;height:auto}.logs{min-height:320px}.stats{grid-template-columns:repeat(2,1fr)}.top,.detail-head{flex-direction:column;align-items:flex-start}}
</style>
</head>
<body>
<main class="wrap">
  <header class="top">
    <div>
      <h1>115 转存日志</h1>
      <p>查看运行记录、已转存文件/剧集，以及对应运行日志。</p>
    </div>
    <div class="toolbar">
      <input id="filter" placeholder="过滤标题 / TMDB / 文件名">
    </div>
  </header>
  <section class="stats" id="stats"></section>
  <div class="grid">
    <section class="panel">
      <h2>最近运行</h2>
      <div class="body">
        <div class="runs" id="runs"></div>
      </div>
    </section>
    <section class="panel">
      <div class="body">
        <div id="detail"></div>
      </div>
    </section>
  </div>
</main>
<script>
(function(){
  var state = { runs: [], selected: null, filter: "", focused: -1, loading: false, pendingLoad: false };
  var $ = function(id){ return document.getElementById(id); };
  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function withCacheBust(path){
    return path + (path.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
  }
  function api(path){ return fetch(withCacheBust(path),{cache:"no-store"}).then(function(r){ return r.json().then(function(j){ if(!r.ok || j.code){ throw new Error(j.message || "请求失败"); } return j.data; }); }); }
  function apiDelete(path){ return fetch(path,{method:"DELETE"}).then(function(r){ return r.json().then(function(j){ if(!r.ok || j.code){ throw new Error(j.message || "请求失败"); } return j.data; }); }); }
  function dt(v){ if(!v) return "-"; var d = new Date(v); return isNaN(d.getTime()) ? v : d.toLocaleString("zh-CN",{hour12:false}); }
  function badge(text, cls){ return '<span class="badge ' + (cls || "") + '">' + esc(text) + '</span>'; }
  function statusLabel(s){ return s === "completed" ? "完成" : s === "running" ? "运行中" : s === "error" ? "失败" : (s === "skipped" || s === "not_released") ? "跳过" : s === "no_resource" ? "无资源" : (s || "未知"); }
  function statusClass(s){ return s === "completed" ? "ok" : s === "running" ? "blue" : s === "error" ? "bad" : "warn"; }
  function mediaLabel(run){ return run && run.type === "tv" ? "电视剧 S" + (run.season || "1") : "电影"; }
  function titleOf(run){ return (run.title || "未知媒体") + (run.year ? " (" + run.year + ")" : ""); }
  function filteredRuns(){
    var q = state.filter.trim().toLowerCase();
    if(!q) return state.runs;
    return state.runs.filter(function(run){
      return [run.title, run.year, run.tmdbid, run.status, run.summary && run.summary.message].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderStats(){
    var done = state.runs.filter(function(r){ return r.status === "completed"; }).length;
    var files = state.runs.reduce(function(n,r){ return n + (r.transferred_count || 0); },0);
    var running = state.runs.filter(function(r){ return r.status === "running"; }).length;
    $("stats").innerHTML =
      '<div class="stat"><b>' + state.runs.length + '</b><span>运行记录</span></div>' +
      '<div class="stat"><b>' + done + '</b><span>完成</span></div>' +
      '<div class="stat"><b>' + files + '</b><span>转存条目</span></div>' +
      '<div class="stat"><b>' + running + '</b><span>运行中</span></div>';
  }
  function renderRuns(){
    var runs = filteredRuns();
    if(!runs.length){ $("runs").innerHTML = '<div class="empty">暂无运行记录</div>'; return; }
    $("runs").innerHTML = runs.map(function(run){
      var isActive = state.selected && state.selected.run_id === run.run_id;
      var active = isActive ? " active" : "";
      var msg = (run.summary && run.summary.message) || "";
      return '<div class="run-wrap"' + (isActive ? ' data-swipe-run="' + esc(run.run_id) + '"' : "") + '><button class="run' + active + '" data-run="' + esc(run.run_id) + '">' +
        '<div class="run-title">' + esc(titleOf(run)) + '</div>' +
        '<div class="run-meta">' + badge(statusLabel(run.status), statusClass(run.status)) + badge(mediaLabel(run)) + badge("TMDB " + (run.tmdbid || "-")) + badge((run.transferred_count || 0) + " 条") + '</div>' +
        '<div class="run-meta">' + esc(dt(run.started_at)) + (msg ? " · " + esc(msg) : "") + '</div>' +
      '</button>' + (isActive ? '<button class="run-delete" data-delete-run="' + esc(run.run_id) + '" type="button">侧滑删除</button>' : "") + '</div>';
    }).join("");
  }
  function renderDetail(){
    var run = state.selected;
    if(!run){ $("detail").innerHTML = '<div class="empty">选择一条运行记录查看详情</div>'; return; }
    var items = run.transferred_items || [];
    var logs = run.logs || [];
    var itemsHtml = items.length ? items.map(function(item, i){
      var active = Number(item.log_index || 0) === state.focused ? " active" : "";
      return '<article class="item' + active + '" data-log="' + esc(item.log_index || 0) + '">' +
        '<div class="item-name">' + esc(item.label || item.file_name || "文件") + '</div>' +
        '<div class="item-meta">' + badge(item.kind === "episode" ? "剧集" : "电影") + badge(item.file_name || "-") + badge(item.share_code || "-") + '</div>' +
      '</article>';
    }).join("") : '<div class="empty">本次没有新增转存条目</div>';
    var logsHtml = logs.length ? logs.map(function(log, i){
      var cls = "log " + esc(log.level || "");
      if(i === state.focused) cls += " focus";
      return '<div class="' + cls + '" data-log-row="' + i + '"><span class="time">' + esc(dt(log.time)) + '</span>' + esc(log.text || log.message || "") + '</div>';
    }).join("") : '<div class="empty">暂无运行日志</div>';
    $("detail").innerHTML =
      '<div class="detail-head"><div class="detail-title"><h2>' + esc(titleOf(run)) + '</h2><p>' + esc((run.summary && run.summary.message) || "") + '</p></div>' +
      '<div class="run-meta">' + badge(statusLabel(run.status), statusClass(run.status)) + badge(mediaLabel(run)) + badge("TMDB " + (run.tmdbid || "-")) + badge(dt(run.started_at)) + '</div></div>' +
      '<div class="content-grid"><div><h2>转存条目</h2><div class="items" id="items">' + itemsHtml + '</div></div><div><h2>运行日志</h2><div class="logs" id="logs">' + logsHtml + '</div></div></div>';
    if(state.focused >= 0){
      setTimeout(function(){
        var row = document.querySelector('[data-log-row="' + state.focused + '"]');
        if(row) row.scrollIntoView({block:"center"});
      }, 0);
    }
  }
  function render(){ renderStats(); renderRuns(); renderDetail(); }
  function selectRun(runId, focus){
    var run = state.runs.find(function(r){ return String(r.run_id) === String(runId); });
    if(!run) return;
    state.focused = Number.isFinite(Number(focus)) ? Number(focus) : -1;
    api("/api/v1/web/logs?run_id=" + encodeURIComponent(run.run_id)).then(function(data){
      state.selected = data.selected || run;
      history.replaceState(null, "", "#run=" + encodeURIComponent(run.run_id));
      render();
    }).catch(function(){ state.selected = run; render(); });
  }
  function deleteRun(runId){
    if(!runId) return;
    apiDelete("/api/v1/web/logs/" + encodeURIComponent(runId)).then(function(){
      state.runs = state.runs.filter(function(run){ return String(run.run_id) !== String(runId); });
      if(state.selected && String(state.selected.run_id) === String(runId)){
        state.selected = state.runs[0] || null;
        state.focused = -1;
      }
      render();
    }).catch(function(e){ alert(e.message || "删除失败"); });
  }
  function setRunOpen(wrap, open){
    if(!wrap) return;
    wrap.classList.toggle("open", !!open);
    var btn = wrap.querySelector("[data-delete-run]");
    if(btn) btn.textContent = open ? "确定删除" : "侧滑删除";
  }
  function scrollToLogs(){
    var logs = $("logs");
    if(logs) logs.scrollIntoView({block:"start", behavior:"smooth"});
  }
  function load(){
    if(state.loading){ state.pendingLoad = true; return Promise.resolve(); }
    state.loading = true;
    state.pendingLoad = false;
    var hash = new URLSearchParams(location.hash.replace(/^#/,""));
    var runId = hash.get("run") || "";
    return api("/api/v1/web/logs" + (runId ? "?run_id=" + encodeURIComponent(runId) : "")).then(function(data){
      state.runs = data.runs || [];
      state.selected = data.selected || (state.runs[0] || null);
      state.focused = -1;
      render();
    }).catch(function(e){
      $("runs").innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
    }).finally(function(){
      state.loading = false;
      if(state.pendingLoad){
        state.pendingLoad = false;
        setTimeout(load, 0);
      }
    });
  }
  $("filter").addEventListener("input", function(){ state.filter = this.value; renderRuns(); });
  var swipe = { el: null, x: 0, y: 0, moved: false };
  $("runs").addEventListener("touchstart", function(e){
    var wrap = e.target.closest("[data-swipe-run]");
    if(!wrap || !e.touches.length) return;
    swipe = { el: wrap, x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
  }, {passive:true});
  $("runs").addEventListener("touchmove", function(e){
    if(!swipe.el || !e.touches.length) return;
    var dx = e.touches[0].clientX - swipe.x;
    var dy = e.touches[0].clientY - swipe.y;
    if(Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)){
      swipe.moved = true;
    }
  }, {passive:true});
  $("runs").addEventListener("touchend", function(e){
    if(!swipe.el) return;
    var touch = e.changedTouches && e.changedTouches[0];
    var dx = touch ? touch.clientX - swipe.x : 0;
    document.querySelectorAll(".run-wrap.open").forEach(function(el){ if(el !== swipe.el) setRunOpen(el, false); });
    if(dx < -45) setRunOpen(swipe.el, true);
    if(dx > 35) setRunOpen(swipe.el, false);
    setTimeout(function(){ swipe = { el: null, x: 0, y: 0, moved: false }; }, 0);
  }, {passive:true});
  document.body.addEventListener("click", function(e){
    var del = e.target.closest("[data-delete-run]");
    if(del){ e.preventDefault(); e.stopPropagation(); deleteRun(del.getAttribute("data-delete-run")); return; }
    var runBtn = e.target.closest("[data-run]");
    if(runBtn){
      var wrap = runBtn.closest(".run-wrap");
      if(wrap && wrap.classList.contains("open")){ setRunOpen(wrap, false); return; }
      var runId = runBtn.getAttribute("data-run");
      if(state.selected && String(state.selected.run_id) === String(runId)){ scrollToLogs(); return; }
      selectRun(runId);
      return;
    }
    var item = e.target.closest(".item[data-log]");
    if(item){ state.focused = Number(item.getAttribute("data-log")); renderDetail(); }
  });
  function scheduleLoad(){ setTimeout(load, 80); }
  window.addEventListener("hashchange", function(){ load(); });
  window.addEventListener("pageshow", scheduleLoad);
  window.addEventListener("focus", scheduleLoad);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) scheduleLoad(); });
  load();
})();
</script>
</body>
</html>`;
}

async function handleWebApp() {
    htmlResponse(200, renderLogWebApp());
}

async function handleFavicon() {
    emptyResponse(204);
}

async function handleWebStatus() {
    const settings = DB.getSettings();
    const queue = settings.taskQueue || [];
    const subs = DB.getSubs().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    success({
        version: VERSION,
        subscriptions: subs,
        queue: {
            pending: queue,
            running: settings.runningTask || null
        },
        now: nowISO()
    });
}

function summarizeRun(run) {
    const items = run.transferred_items || [];
    return {
        run_id: run.run_id,
        started_at: run.started_at,
        finished_at: run.finished_at,
        status: run.status,
        tmdbid: run.tmdbid,
        type: run.type,
        season: run.season,
        title: run.title,
        year: run.year,
        sub_id: run.sub_id,
        run_mode: run.run_mode,
        duration_sec: run.duration_sec,
        transferred_count: items.length,
        summary: run.summary || {}
    };
}

async function handleWebLogs() {
    const runs = DB.getTransferRuns()
        .sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")));
    const runId = queryParams.get("run_id") || queryParams.get("id") || "";
    const selected = runId
        ? runs.find(run => String(run.run_id) === String(runId))
        : (runs[0] || null);

    success({
        version: VERSION,
        runs: runs.map(summarizeRun),
        selected: selected || null,
        now: nowISO()
    });
}

async function handleDeleteWebLog(params) {
    const runId = params.run_id || params.id || "";
    if (!runId) return error(1003, "缺少日志ID");

    const runs = DB.getTransferRuns();
    const nextRuns = runs.filter(run => String(run.run_id) !== String(runId));
    if (nextRuns.length === runs.length) {
        LOG.warn(`Transfer log not found: ${runId}`);
        return success({ deleted: false, run_id: runId });
    }

    DB.saveTransferRuns(nextRuns);
    LOG.success(`Deleted transfer log: ${runId}`);
    success({ deleted: true, run_id: runId });
}

async function handleWebBackground() {
    const bg = await getRandomTmdbBackdrop();
    if (!bg) return success(null);
    const settings = DB.getSettings();
    settings.webBackground = bg;
    DB.saveSettings(settings);
    success(bg);
}

// =============================================
// Routes Configuration
// =============================================
const STATIC_ROUTES = {
    "GET /": { handler: handleWebApp, needAuth: false },
    "GET /index.html": { handler: handleWebApp, needAuth: false },
    "GET /favicon.ico": { handler: handleFavicon, needAuth: false },
    "GET /api/v1/web/status": { handler: handleWebStatus, needAuth: false },
    "GET /api/v1/web/logs": { handler: handleWebLogs, needAuth: false },
    "GET /api/v1/web/background": { handler: handleWebBackground, needAuth: false },
    "POST /api/v1/login/access-token": { handler: handleLogin, needAuth: false },
    "GET /api/v1/user": { handler: handleGetUser, needAuth: true },
    "GET /api/v1/user/current": { handler: handleGetUser, needAuth: true },
    "GET /api/v1/users/me": { handler: handleGetUser, needAuth: true },
    "GET /api/v1/subscribe": { handler: handleGetSubs, needAuth: true },
    "GET /api/v1/subscribe/user": { handler: handleGetSubByUser, needAuth: true },
    "POST /api/v1/subscribe": { handler: handleAddSub, needAuth: true },
    "GET /api/v1/history": { handler: handleHistory, needAuth: true },
    "GET /api/v1/queue": { handler: handleQueue, needAuth: true },
    "GET /api/v1/site": { handler: handleSite, needAuth: true },
    "GET /api/v1/system/message": { handler: handleMessage, needAuth: true },
    "GET /api/v1/message": { handler: handleMessage, needAuth: true },
    "GET /api/v1/dashboard": { handler: handleDummy, needAuth: true },
    "GET /api/v1/plugin": { handler: async () => success([]), needAuth: true }
};

const DYNAMIC_PATTERNS = [
    {
        pattern: /^DELETE \/api\/v1\/web\/logs\/([^/]+)$/,
        handler: handleDeleteWebLog,
        needAuth: false,
        keys: ["run_id"]
    },
    {
        pattern: /^DELETE \/api\/v1\/subscribe\/media\/tmdb:(\d+)$/,
        handler: handleDeleteSub,
        needAuth: true,
        keys: ["tmdbid"]
    },
    { 
        pattern: /^GET \/api\/v1\/subscribe\/media\/tmdb:(\d+)$/, 
        handler: handleGetSubByMedia, 
        needAuth: true, 
        keys: ["tmdbid"] 
    },
    { 
        pattern: /^GET \/api\/v1\/subscribe\/user\/(.+)$/, 
        handler: handleGetSubByUser, 
        needAuth: true, 
        keys: ["username"] 
    },
    { 
        pattern: /^POST \/api\/v1\/subscribe\/(.+)\/refresh$/, 
        handler: handleRefreshSub, 
        needAuth: true, 
        keys: ["id"] 
    },
    { 
        pattern: /^DELETE \/api\/v1\/subscribe\/(.+)$/, 
        handler: handleDeleteSub, 
        needAuth: true, 
        keys: ["id"] 
    },
    { 
        pattern: /^PUT \/api\/v1\/subscribe\/(.+)$/, 
        handler: handleUpdateSub, 
        needAuth: true, 
        keys: ["id"] 
    },
    { 
        pattern: /^GET \/api\/v1\/subscribe\/(.+)$/, 
        handler: handleGetSub, 
        needAuth: true, 
        keys: ["id"] 
    }
];

function matchRoute(m, p) {
    const key = `${m} ${p}`;
    LOG.debug(`Matching route: ${key}`);
    
    if (STATIC_ROUTES[key]) {
        LOG.debug(`Matched static route: ${key}`);
        return { ...STATIC_ROUTES[key], params: {} };
    }
    
    for (let i = 0; i < DYNAMIC_PATTERNS.length; i++) {
        const item = DYNAMIC_PATTERNS[i];
        LOG.debug(`Testing pattern[${i}]: ${item.pattern.source}`);
        const match = key.match(item.pattern);
        
        if (match) {
            LOG.debug(`✅ Pattern matched!`);
            const params = {};
            item.keys.forEach((k, idx) => { 
                let value = match[idx + 1];
                LOG.debug(`  Captured[${idx + 1}]: ${value}`);
                params[k] = value;
            });
            return { handler: item.handler, needAuth: item.needAuth, params };
        }
    }
    
    LOG.warn(`No route matched for: ${key}`);
    return null;
}

// =============================================
// Main (Async Router)
// =============================================
(async function() {
    try {
        if (method === "OPTIONS") return jsonResponse(204, {});

        const route = matchRoute(method, path);
        if (!route) return notFound();

        let authPayload = null;
        if (route.needAuth) {
            authPayload = getAuthPayload($request);
            if (!authPayload) return unauthorized();
        }

        await route.handler(route.params, body, authPayload);

    } catch (e) {
        LOG.error(`Fatal exception: ${e.message}`);
        LOG.debug(e.stack || "");
        error(500, e.message || "Internal Error");
    }
})();
