// =============================================
// P115 自动补集触发器 v6.3 - 自动触发版
// 支持：MoviePilot订阅自动触发 | Cron定时兜底 | 去重 | 中文日志
// =============================================

// =============================================
// 模块参数
// =============================================
const MODULE_ARGS = (() => {
    const params = new URLSearchParams($argument || "");
    return {
        TMDB_API_KEY: params.get("tmdb_api_key") || "",
        P115_COOKIE: params.get("p115_cookie") || "",
        ROOT_CID: params.get("cid") || "0",
        RUN_MODE: params.get("run_mode") || "queue",
        PANSOU_API: (params.get("pansou_api") || "https://so.252035.xyz").trim().replace(/\/+$/, ""),
        TG_CHANNELS: params.get("tg_channels") || "",
        CRON_HOURS: Number(params.get("cron_hours") || 8)
    };
})();

// =============================================
// 🔧 常量配置
// =============================================
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const BATCH_SIZE = 50;
const SHARE_DELAY = 2000;
const SUBFOLDER_DELAY = 200;
const RATE_LIMIT_MAX_RETRIES = 3;
const PANSOU_MAX_RETRIES = 3;
const PANSOU_RETRY_BASE_DELAY = 1500;
const RUN_LOCK_TTL_MS = 15 * 60 * 1000;
const RETRY_COOLDOWN_HOURS = Number.isFinite(MODULE_ARGS.CRON_HOURS) && MODULE_ARGS.CRON_HOURS > 0
    ? Math.min(Math.max(MODULE_ARGS.CRON_HOURS, 1), 168)
    : 8;
const RETRY_COOLDOWN_MS = RETRY_COOLDOWN_HOURS * 60 * 60 * 1000;
const TRANSFER_LOG_KEY = "115_transfer_logs";
const MAX_TRANSFER_RUNS = 50;
const MAX_RUN_LOG_LINES = 800;
const LOG_PAGE_URL = "https://mp.2kuai.run/";
const MAX_115_SHARE_CANDIDATES = 12;
const DEFAULT_MOVIE_RENAME_FORMAT = "{{title}}.{{year}}{% if release %} - {{release}}{% endif %}{% if tmdbid %}.{{tmdb_tag}}{% endif %}{{fileExt}}";
const DEFAULT_TV_RENAME_FORMAT = "{{title}}.{{year}} - {{season_episode}} - 第 {{episode}} 集{% if release %} - {{release}}{% endif %}{% if tmdbid %}.{{tmdb_tag}}{% endif %}{{fileExt}}";

const VIDEO_EXTENSIONS = [
    ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".f4v",
    ".webm", ".m4v", ".mpg", ".mpeg", ".m2ts", ".ts", ".rmvb",
    ".rm", ".3gp", ".3g2", ".vob", ".ogv", ".divx", ".xvid",
    ".asf", ".dat", ".iso", ".bdmv"
];

const PANHUNT_CHANNELS = [
    "tgsearchers3", "Aliyun_4K_Movies", "bdbdndn11", "yunpanx", "bsbdbfjfjff",
    "yp123pan", "sbsbsnsqq", "yunpanxunlei", "tianyifc", "BaiduCloudDisk",
    "txtyzy", "peccxinpd", "gotopan", "PanjClub", "kkxlzy", "baicaoZY",
    "MCPH01", "bdwpzhpd", "ysxb48", "jdjdn1111", "yggpan", "MCPH086",
    "zaihuayun", "Q66Share", "ucwpzy", "shareAliyun", "alyp_1", "dianyingshare",
    "Quark_Movies", "XiangxiuNBB", "ydypzyfx", "ucquark", "xx123pan",
    "yingshifenxiang123", "zyfb123", "tyypzhpd", "tianyirigeng", "cloudtianyi",
    "hdhhd21", "Lsp115", "oneonefivewpfx", "qixingzhenren", "taoxgzy",
    "Channel_Shares_115", "tyysypzypd", "vip115hot", "wp123zy", "yunpan139",
    "yunpan189", "yunpanuc", "yydf_hzl", "leoziyuan", "pikpakpan", "Q_dongman",
    "yoyokuakeduanju", "TG654TG", "WFYSFX02", "QukanMovie", "yeqingjie_GJG666",
    "movielover8888_film3", "Baidu_netdisk", "D_wusun", "FLMdongtianfudi",
    "KaiPanshare", "QQZYDAPP", "rjyxfx", "PikPak_Share_Channel", "btzhi",
    "newproductsourcing", "cctv1211", "duan_ju", "QuarkFree", "yunpanNB",
    "kkdj001", "xxzlzn", "pxyunpanxunlei", "jxwpzy", "kuakedongman",
    "liangxingzhinan", "xiangnikanj", "solidsexydoll", "guoman4K", "zdqxm",
    "kduanju", "cilidianying", "CBduanju", "SharePanFilms", "dzsgx",
    "BooksRealm", "Oscar_4Kmovies", "yingshiziyuanpindao", "gimy115", "gimy100"
];

function normalizeTgChannel(value) {
    return String(value || "")
        .trim()
        .replace(/^https?:\/\/t\.me\//i, "")
        .replace(/^t\.me\//i, "")
        .replace(/^@+/, "")
        .replace(/\/+$/, "")
        .trim();
}

function getPanhuntChannels() {
    const seen = {};
    const channels = [];
    const custom = String(MODULE_ARGS.TG_CHANNELS || "")
        .split(/[\s,，;；|]+/)
        .map(normalizeTgChannel)
        .filter(Boolean);

    PANHUNT_CHANNELS.concat(custom).forEach(channel => {
        const normalized = normalizeTgChannel(channel);
        const key = normalized.toLowerCase();
        if (!normalized || seen[key]) return;
        seen[key] = true;
        channels.push(normalized);
    });

    if (custom.length > 0) {
        LOG.info(`自定义 TG 频道: ${custom.length} 个，合并去重后总计 ${channels.length} 个`);
    }
    return channels;
}

// =============================================
// 📝 日志工具
// =============================================
let CURRENT_TRANSFER_RUN = null;

function appendCurrentRunLog(level, message, text) {
    if (!CURRENT_TRANSFER_RUN) return;
    CURRENT_TRANSFER_RUN.logs.push({
        time: new Date().toISOString(),
        level,
        message: String(message || ""),
        text: String(text || message || "")
    });
    if (CURRENT_TRANSFER_RUN.logs.length > MAX_RUN_LOG_LINES) {
        CURRENT_TRANSFER_RUN.logs = CURRENT_TRANSFER_RUN.logs.slice(-MAX_RUN_LOG_LINES);
    }
}

function emitLog(level, message, text) {
    console.log(text);
    appendCurrentRunLog(level, message, text);
}

const LOG = {
    section: (msg) => emitLog("section", msg, `\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`),
    step: (msg) => emitLog("step", msg, `\n${"─".repeat(50)}\n📌 ${msg}\n${"─".repeat(50)}`),
    info: (msg) => emitLog("info", msg, `[信息] ${msg}`),
    success: (msg) => emitLog("success", msg, `[成功] ✅ ${msg}`),
    error: (msg) => emitLog("error", msg, `[错误] ❌ ${msg}`),
    warn: (msg) => emitLog("warn", msg, `[警告] ⚠️  ${msg}`),
    debug: (msg) => emitLog("debug", msg, `[调试] 🔍 ${msg}`)
};

function readTransferRuns() {
    try {
        const raw = $persistentStore.read(TRANSFER_LOG_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed.runs || []);
    } catch (e) {
        console.log(`[错误] 读取转存日志失败: ${e.message}`);
        return [];
    }
}

function writeTransferRuns(runs) {
    try {
        const clean = (runs || [])
            .sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")))
            .slice(0, MAX_TRANSFER_RUNS);
        $persistentStore.write(JSON.stringify(clean), TRANSFER_LOG_KEY);
    } catch (e) {
        console.log(`[错误] 写入转存日志失败: ${e.message}`);
    }
}

function saveTransferRun(run) {
    if (!run || !run.run_id) return;
    const runs = readTransferRuns();
    const idx = runs.findIndex(item => item.run_id === run.run_id);
    const stored = {
        ...run,
        logs: (run.logs || []).slice(-MAX_RUN_LOG_LINES),
        transferred_items: run.transferred_items || []
    };
    if (idx >= 0) runs[idx] = stored;
    else runs.unshift(stored);
    writeTransferRuns(runs);
}

function createRunId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function beginTransferRun(taskParams) {
    const run = {
        run_id: createRunId(),
        started_at: new Date().toISOString(),
        finished_at: "",
        status: "running",
        tmdbid: String(taskParams.TMDB_ID || ""),
        type: String(taskParams.TMDB_TYPE || ""),
        season: String(taskParams.SEASON || "0"),
        title: taskParams.SUB_NAME || `TMDB-${taskParams.TMDB_ID}`,
        year: "",
        sub_id: String(taskParams.SUB_ID || ""),
        run_mode: MODULE_ARGS.RUN_MODE || "queue",
        transferred_items: [],
        logs: [],
        summary: {
            found_shares: 0,
            transferred_files: 0,
            message: "运行中"
        }
    };
    CURRENT_TRANSFER_RUN = run;
    saveTransferRun(run);
    return run;
}

function updateCurrentRunMeta(patch) {
    if (!CURRENT_TRANSFER_RUN) return;
    Object.assign(CURRENT_TRANSFER_RUN, patch || {});
}

function recordTransferredItem(item) {
    if (!CURRENT_TRANSFER_RUN || !item) return;
    CURRENT_TRANSFER_RUN.transferred_items.push({
        ...item,
        log_index: Math.max(0, CURRENT_TRANSFER_RUN.logs.length - 1),
        transferred_at: new Date().toISOString()
    });
}

function finishTransferRun(status, summary) {
    if (!CURRENT_TRANSFER_RUN) return null;
    const run = CURRENT_TRANSFER_RUN;
    run.status = status || run.status || "completed";
    run.finished_at = new Date().toISOString();
    run.duration_sec = Number(((Date.now() - Date.parse(run.started_at || new Date().toISOString())) / 1000).toFixed(1));
    run.summary = {
        ...(run.summary || {}),
        ...(summary || {})
    };
    saveTransferRun(run);
    CURRENT_TRANSFER_RUN = null;
    return run;
}

function buildLogPageUrl(runId) {
    return LOG_PAGE_URL + (runId ? `#run=${encodeURIComponent(runId)}` : "");
}

function tmdbMediaImage(info) {
    const path = info && (info.poster_path || info.backdrop_path);
    return path ? `https://image.tmdb.org/t/p/w500${path}` : "";
}

function notifyOptions(runId, mediaUrl) {
    const options = {
        "action": "open-url",
        "url": buildLogPageUrl(runId),
        "sound": true
    };
    if (mediaUrl) options["media-url"] = mediaUrl;
    return options;
}

function notifyBodyWithDetail(message) {
    return `${message}\n点击通知查看运行详情`;
}

// =============================================
// 🔧 工具函数
// =============================================
function isVideoFile(fileName) {
    const lowerName = fileName.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

let lastRequestTime = 0;
function rateLimit(minGap = 500) {
    return new Promise(resolve => {
        const now = Date.now();
        const gap = Math.max(0, minGap - (now - lastRequestTime));
        lastRequestTime = now + gap;
        setTimeout(resolve, gap);
    });
}

function extractEpisodeInfo(fileName) {
    const patterns = [
        /[Ss](\d{1,2})[Ee](\d{1,2})/,
        /第\s*(\d{1,2})\s*季.*?第\s*(\d{1,2})\s*集/,
        /[Ss](\d{1,2})\.[Ee](\d{1,2})/,
        /[Ee][Pp]?\s*(\d{1,2})/i,
        /[$$\(](\d{1,2})[xX](\d{1,2})[$$\)]/
    ];
    
    for (const p of patterns) {
        const m = fileName.match(p);
        if (m && parseInt(m[1]) <= 50 && parseInt(m[2]) <= 100) {
            return { season: parseInt(m[1]), episode: parseInt(m[2]) };
        }
    }
    
    const sm = fileName.match(/[Ee](\d{2,3})/i);
    if (sm) return { season: 1, episode: parseInt(sm[1]) };
    return null;
}

function extractEpisodeInfoForShare(fileName, contextText, targetSeason) {
    const name = normalizeTitleText(fileName);
    const context = normalizeTitleText(contextText);
    const target = Number(targetSeason || 1);
    let m;

    const strongPatterns = [
        /[Ss]\s*0*(\d{1,2})\s*[\._\-\s]?\s*[Ee]\s*0*(\d{1,3})/i,
        /(?:^|[^0-9A-Za-z])0*(\d{1,2})[xX]0*(\d{1,3})(?=$|[^0-9A-Za-z])/i,
        /Season\s*0*(\d{1,2}).{0,16}(?:Episode|Ep)?\s*0*(\d{1,3})/i,
        new RegExp(`第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*季.{0,16}第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*集`, "i")
    ];

    for (const pattern of strongPatterns) {
        m = name.match(pattern);
        if (!m) continue;
        const season = chineseNumberToInt(m[1]);
        const episode = chineseNumberToInt(m[2]);
        if (validSeasonEpisode(season, episode)) return { season, episode };
    }

    if (!hasSeasonMarker(`${context} ${name}`, target)) return null;

    const weakPatterns = [
        /(?:^|[^0-9A-Za-z])(?:EP|E)\s*0*(\d{1,3})(?=$|[^0-9A-Za-z])/i,
        new RegExp(`第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*集`, "i")
    ];
    for (const pattern of weakPatterns) {
        m = name.match(pattern);
        if (!m) continue;
        const episode = chineseNumberToInt(m[1]);
        if (validSeasonEpisode(target, episode)) return { season: target, episode };
    }

    return null;
}

function joinContextText() {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
}

const CN_NUM_TOKEN = "零〇一二三四五六七八九十百两\\d";

function normalizeTitleText(title) {
    return String(title || "")
        .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10))
        .replace(/[－—–]/g, "-")
        .replace(/[：]/g, ":")
        .replace(/\s+/g, " ")
        .trim();
}

function chineseNumberToInt(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);

    const map = {
        "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
        "五": 5, "六": 6, "七": 7, "八": 8, "九": 9
    };

    if (raw.includes("百")) {
        const parts = raw.split("百");
        const hundreds = parts[0] ? (map[parts[0]] || 0) : 1;
        return hundreds * 100 + chineseNumberToInt(parts[1] || "");
    }

    if (raw.includes("十")) {
        const parts = raw.split("十");
        const tens = parts[0] ? (map[parts[0]] || 0) : 1;
        const ones = parts[1] ? (map[parts[1]] || 0) : 0;
        return tens * 10 + ones;
    }

    return map[raw] || 0;
}

function validSeasonEpisode(season, episode) {
    return season > 0 && season <= 50 && episode > 0 && episode <= 200;
}

function rangeContainsMissing(start, end, missingSet) {
    let from = Number(start);
    let to = Number(end);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    if (from > to) [from, to] = [to, from];
    for (const ep of missingSet) {
        if (ep >= from && ep <= to) return true;
    }
    return false;
}

function countMissingInRange(start, end, missingSet) {
    let from = Number(start);
    let to = Number(end);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    if (from > to) [from, to] = [to, from];
    let count = 0;
    for (const ep of missingSet) {
        if (ep >= from && ep <= to) count++;
    }
    return count;
}

function hasSeasonMarker(text, season) {
    const cnSeason = numberToSimpleChinese(season);
    const patterns = [
        new RegExp(`[Ss]\\s*0*${season}(?=$|[^0-9A-Za-z])`, "i"),
        new RegExp(`Season\\s*0*${season}(?=$|[^0-9A-Za-z])`, "i"),
        new RegExp(`第\\s*(?:0*${season}|${cnSeason})\\s*季`),
        new RegExp(`(?:^|[^0-9])0*${season}\\s*季`)
    ];
    return patterns.some(pattern => pattern.test(text));
}

function numberToSimpleChinese(num) {
    const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 10) return digits[n];
    if (n === 10) return "十";
    if (n < 20) return `十${digits[n - 10]}`;
    if (n < 100) {
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return ones ? `${digits[tens]}十${digits[ones]}` : `${digits[tens]}十`;
    }
    return String(n);
}

function extractSeasonMarkers(text) {
    const seasons = new Set();
    const add = value => {
        const season = chineseNumberToInt(value);
        if (season > 0 && season <= 50) seasons.add(season);
    };

    let m;
    const patterns = [
        /[Ss]\s*0*(\d{1,2})(?=$|[^0-9A-Za-z])/gi,
        /Season\s*0*(\d{1,2})(?=$|[^0-9A-Za-z])/gi,
        new RegExp(`第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*季`, "g"),
        /(?:^|[^0-9])0*(\d{1,2})\s*季/g
    ];

    patterns.forEach(pattern => {
        while ((m = pattern.exec(text)) !== null) add(m[1]);
    });
    return seasons;
}

function scoreSeasonTitle(title, targetSeason, missingEpisodes) {
    const text = normalizeTitleText(title);
    if (!text || !missingEpisodes.length) return { score: 0, reason: "no_missing", coverage: 0, packScore: 0 };

    const missingSet = new Set(missingEpisodes);
    let score = 0;
    let reason = "";
    let coverage = 0;
    let packScore = 0;
    let explicitNonTarget = false;

    const applyScore = (currentScore, currentReason, currentCoverage, currentPackScore) => {
        if (currentScore > score) {
            score = currentScore;
            reason = currentReason;
        }
        if (currentCoverage > coverage) coverage = currentCoverage;
        if (currentPackScore > packScore) packScore = currentPackScore;
    };

    const applySeasonEpisode = (season, episode, currentScore, currentReason) => {
        if (!validSeasonEpisode(season, episode)) return;
        if (season === targetSeason && missingSet.has(episode)) {
            applyScore(currentScore, currentReason, 1, 1);
        } else {
            explicitNonTarget = true;
        }
    };

    const applySeasonRange = (season, start, end, currentScore, currentReason) => {
        if (!validSeasonEpisode(season, start) || !validSeasonEpisode(season, end)) return;
        const currentCoverage = season === targetSeason ? countMissingInRange(start, end, missingSet) : 0;
        if (currentCoverage > 0) {
            applyScore(currentScore, currentReason, currentCoverage, 3);
        } else {
            explicitNonTarget = true;
        }
    };

    let m;
    const rangePatterns = [
        /[Ss]\s*0*(\d{1,2})\s*[Ee]\s*0*(\d{1,3})\s*(?:-|~|至|到|to)\s*(?:[Ee]\s*)?0*(\d{1,3})/gi,
        /[Ss]\s*0*(\d{1,2})\s+0*(\d{1,3})\s*(?:-|~|至|到|to)\s*0*(\d{1,3})/gi,
        /Season\s*0*(\d{1,2}).{0,16}(?:Episode|Ep)?\s*0*(\d{1,3})\s*(?:-|~|至|到|to)\s*(?:Episode|Ep)?\s*0*(\d{1,3})/gi,
        new RegExp(`第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*季.{0,16}(?:第\\s*)?([${CN_NUM_TOKEN}]{1,6})\\s*(?:-|~|至|到|to)\\s*(?:第\\s*)?([${CN_NUM_TOKEN}]{1,6})\\s*集`, "gi")
    ];

    rangePatterns.forEach(pattern => {
        while ((m = pattern.exec(text)) !== null) {
            applySeasonRange(
                chineseNumberToInt(m[1]),
                chineseNumberToInt(m[2]),
                chineseNumberToInt(m[3]),
                80,
                "season_range"
            );
        }
    });

    const exactPatterns = [
        /[Ss]\s*0*(\d{1,2})\s*[\._\-\s]?\s*[Ee]\s*0*(\d{1,3})/gi,
        /(?:^|[^0-9A-Za-z])0*(\d{1,2})[xX]0*(\d{1,3})(?=$|[^0-9A-Za-z])/gi,
        /Season\s*0*(\d{1,2}).{0,16}(?:Episode|Ep)\s*0*(\d{1,3})/gi,
        new RegExp(`第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*季.{0,16}第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*集`, "gi")
    ];

    exactPatterns.forEach(pattern => {
        while ((m = pattern.exec(text)) !== null) {
            applySeasonEpisode(
                chineseNumberToInt(m[1]),
                chineseNumberToInt(m[2]),
                100,
                "season_episode"
            );
        }
    });

    const completePattern = /(完结|全集|全\s*\d+\s*集|Complete|Completed)/i;
    const seasonMarkers = extractSeasonMarkers(text);
    if (completePattern.test(text)) {
        if (seasonMarkers.has(targetSeason) || hasSeasonMarker(text, targetSeason)) {
            applyScore(60, "season_complete", missingEpisodes.length, 2);
        } else if (seasonMarkers.size > 0) {
            explicitNonTarget = true;
        } else if (targetSeason === 1) {
            applyScore(55, "season_complete_no_marker", missingEpisodes.length, 2);
        }
    }

    const updateToPatterns = [
        new RegExp(`(?:更新至|连载至).{0,12}(?:第\\s*)?([${CN_NUM_TOKEN}]{1,6})\\s*集`, "gi"),
        /(?:up\s*to|updated?\s*to).{0,12}(?:episode|ep|e)?\s*0*(\d{1,3})/gi
    ];
    updateToPatterns.forEach(pattern => {
        while ((m = pattern.exec(text)) !== null) {
            const end = chineseNumberToInt(m[1]);
            if (!validSeasonEpisode(targetSeason, end)) continue;
            const canUseWeakSeason = targetSeason === 1 && seasonMarkers.size === 0;
            if (hasSeasonMarker(text, targetSeason) || canUseWeakSeason) {
                const currentCoverage = countMissingInRange(1, end, missingSet);
                if (currentCoverage > 0) applyScore(70, "season_update_to", currentCoverage, 3);
            } else if (seasonMarkers.size > 0 && !seasonMarkers.has(targetSeason)) {
                explicitNonTarget = true;
            }
        }
    });

    if (hasSeasonMarker(text, targetSeason)) {
        const weakEpisodePatterns = [
            /(?:^|[^0-9A-Za-z])(?:EP|E)\s*0*(\d{1,3})(?=$|[^0-9A-Za-z])/gi,
            new RegExp(`第\\s*([${CN_NUM_TOKEN}]{1,6})\\s*集`, "gi")
        ];
        weakEpisodePatterns.forEach(pattern => {
            while ((m = pattern.exec(text)) !== null) {
                const episode = chineseNumberToInt(m[1]);
                if (missingSet.has(episode) && score < 50) {
                    applyScore(50, "season_marker_episode", 1, 1);
                }
            }
        });
    } else if (seasonMarkers.size > 0 && !seasonMarkers.has(targetSeason)) {
        explicitNonTarget = true;
    }

    if (score > 0) return { score, reason, coverage, packScore };
    if (explicitNonTarget) return { score: -1, reason: "wrong_season_or_episode", coverage: 0, packScore: 0 };
    return { score: 0, reason: "ambiguous", coverage: 0, packScore: 0 };
}

function uniqueValues(values) {
    const seen = {};
    const out = [];
    (values || []).forEach(value => {
        const text = String(value || "").trim();
        if (!text) return;
        const key = compactMatchText(text);
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(text);
    });
    return out;
}

function getMediaYears(tmdbInfo, type) {
    const dates = [];
    if (type === "movie") {
        dates.push(tmdbInfo && tmdbInfo.release_date);
    } else {
        dates.push(tmdbInfo && tmdbInfo.first_air_date);
        dates.push(tmdbInfo && tmdbInfo.last_air_date);
    }
    return uniqueValues(dates.map(date => String(date || "").substring(0, 4)).filter(year => /^\d{4}$/.test(year)));
}

function getTmdbAlternativeTitles(tmdbInfo) {
    const alt = tmdbInfo && tmdbInfo.alternative_titles;
    const list = []
        .concat((alt && alt.titles) || [])
        .concat((alt && alt.results) || []);
    return list.map(item => item && (item.title || item.name)).filter(Boolean);
}

function buildMediaProfile(tmdbInfo, taskParams, title, year) {
    const type = taskParams.TMDB_TYPE === "tv" ? "tv" : "movie";
    const manualShare = taskParams.MANUAL_SHARE || {};
    const manualTitles = [
        manualShare.keyword,
        manualShare.name,
        manualShare.note
    ];
    const titles = type === "movie"
        ? [
            tmdbInfo && tmdbInfo.title,
            tmdbInfo && tmdbInfo.original_title,
            ...getTmdbAlternativeTitles(tmdbInfo),
            ...manualTitles,
            taskParams.SUB_NAME,
            title
        ]
        : [
            tmdbInfo && tmdbInfo.name,
            tmdbInfo && tmdbInfo.original_name,
            ...getTmdbAlternativeTitles(tmdbInfo),
            ...manualTitles,
            taskParams.SUB_NAME,
            title
        ];
    return {
        tmdbId: String(taskParams.TMDB_ID || ""),
        type,
        title,
        titles: uniqueValues(titles),
        years: uniqueValues([year].concat(getMediaYears(tmdbInfo, type))),
        season: parseInt(taskParams.SEASON || "1", 10) || 1
    };
}

function titleMatchesAny(text, titles) {
    return (titles || []).some(title => hasMovieTitle(text, title));
}

function yearMatchesAny(text, years) {
    return (years || []).some(year => hasYearMarker(text, year));
}

function buildPanhuntSearchKeywords(profile, missingEpisodes) {
    const title = profile.title || (profile.titles && profile.titles[0]) || "";
    const keywords = [];
    if (!title) return keywords;

    if (profile.tmdbId) keywords.push(profile.tmdbId);
    keywords.push(title);

    return uniqueValues(keywords);
}

function scorePanhuntTitle(rawTitle, profile, missingEpisodes) {
    const title = normalizeTitleText(rawTitle);
    if (!title) return { score: -100, reason: "empty_title" };
    if (hasWrongTmdbId(title, profile.tmdbId)) return { score: -100, reason: "wrong_tmdb" };

    const hasTmdb = hasTargetTmdbId(title, profile.tmdbId);
    const titleHit = titleMatchesAny(title, profile.titles);
    const yearHit = yearMatchesAny(title, profile.years);
    const strongSeries = hasStrongSeriesMarker(title);
    const weakSeries = hasWeakSeriesMarker(title);

    if (!hasTmdb && !titleHit) return { score: -30, reason: "title_mismatch" };

    let score = 0;
    const reasons = [];
    if (hasTmdb) {
        score += 1000;
        reasons.push("tmdb");
    }
    if (titleHit) {
        score += 140;
        reasons.push("title");
    }
    if (yearHit) {
        score += 60;
        reasons.push("year");
    }

    if (profile.type === "movie") {
        if (strongSeries && !hasTmdb) return { score: -80, reason: "movie_title_series" };
        if (weakSeries && !hasTmdb) {
            score -= 40;
            reasons.push("weak_series");
        }
        if (!hasTmdb && !yearHit && score < 140) return { score: -20, reason: "movie_not_confirmed" };
    } else {
        const seasonScore = scoreSeasonTitle(title, profile.season, missingEpisodes || []);
        if (seasonScore.score < 0 && !hasTmdb) return { score: -70, reason: seasonScore.reason };
        if (seasonScore.score > 0) {
            score += seasonScore.score;
            reasons.push(seasonScore.reason);
            return {
                score,
                reason: reasons.join("+") || "weak",
                coverage: seasonScore.coverage || 0,
                packScore: seasonScore.packScore || 0,
                hasTmdb
            };
        } else if (hasSeasonMarker(title, profile.season)) {
            score += 35;
            reasons.push("season");
        } else if (hasTmdb && !strongSeries && !weakSeries && (missingEpisodes || []).length > 1) {
            reasons.push("tmdb_pack_candidate");
            return {
                score,
                reason: reasons.join("+") || "weak",
                coverage: (missingEpisodes || []).length,
                packScore: 4,
                hasTmdb
            };
        } else if (!hasTmdb && (missingEpisodes || []).length <= 4) {
            score -= 80;
            reasons.push("no_season");
        }
    }

    return { score, reason: reasons.join("+") || "weak", coverage: 0, packScore: 0, hasTmdb };
}

function rankPanhuntResults(results, profile, missingEpisodes, options = {}) {
    const seen = {};
    const minScore = options.minScore || (profile.type === "movie" ? 180 : 130);
    let duplicateCount = 0;
    const compareEntry = (a, b) => {
        if (profile.type === "tv") {
            const tmdbDelta = Number(!!b.hasTmdb) - Number(!!a.hasTmdb);
            if (tmdbDelta) return tmdbDelta;
            const coverageDelta = (b.coverage || 0) - (a.coverage || 0);
            if (coverageDelta) return coverageDelta;
            const packDelta = (b.packScore || 0) - (a.packScore || 0);
            if (packDelta) return packDelta;
        }
        return b.score - a.score || a.index - b.index;
    };

    (results || []).forEach((item, index) => {
        const info = extractShareInfo(item);
        const key = info.shareCode || compactMatchText(info.title || item.url || "");
        if (!key) return;
        const score = scorePanhuntTitle(info.title, profile, missingEpisodes);
        const candidate = {
            item,
            index,
            title: info.title,
            shareCode: info.shareCode,
            score: score.score,
            reason: score.reason,
            coverage: score.coverage || 0,
            packScore: score.packScore || 0,
            hasTmdb: !!score.hasTmdb
        };
        if (seen[key]) {
            duplicateCount++;
            const current = seen[key];
            if (compareEntry(current, candidate) > 0) seen[key] = candidate;
            return;
        }

        seen[key] = candidate;
    });

    const all = Object.keys(seen).map(key => seen[key]);
    const ranked = all.filter(entry => entry.score >= minScore);
    const droppedCount = all.length - ranked.length;
    ranked.sort(compareEntry);
    const limited = ranked.slice(0, MAX_115_SHARE_CANDIDATES).map(entry => entry.item);
    LOG.info(`标题评分: 可用 ${ranked.length} 个，去重 ${duplicateCount} 个，丢弃 ${droppedCount} 个，准备检查 ${limited.length} 个`);
    ranked.slice(0, 5).forEach(entry => {
        const coverageText = profile.type === "tv" && entry.coverage ? ` 覆盖${entry.coverage}集` : "";
        LOG.debug(`标题命中 +${entry.score}${coverageText} [${entry.reason}]: ${entry.title}`);
    });
    return limited;
}

function compactMatchText(value) {
    return normalizeTitleText(value)
        .toLowerCase()
        .replace(/[\\\/\s\._\-:：,，;；!！?？'"“”‘’()[\]{}（）【】《》<>]/g, "");
}

function extractTmdbIds(text) {
    const ids = new Set();
    let m;
    const pattern = /tmdb\s*[-_:：]?\s*(\d{3,10})/gi;
    while ((m = pattern.exec(String(text || ""))) !== null) ids.add(String(m[1]));
    return ids;
}

function hasWrongTmdbId(text, targetTmdbId) {
    const ids = extractTmdbIds(text);
    return ids.size > 0 && !ids.has(String(targetTmdbId || ""));
}

function hasTargetTmdbId(text, targetTmdbId) {
    if (!targetTmdbId) return false;
    return extractTmdbIds(text).has(String(targetTmdbId));
}

function hasMovieTitle(text, title) {
    const target = compactMatchText(title);
    if (!target || target.length < 2) return false;
    return compactMatchText(text).indexOf(target) >= 0;
}

function hasYearMarker(text, year) {
    return !!year && year !== "未知" && new RegExp(`(?:^|[^0-9])${year}(?=$|[^0-9])`).test(String(text || ""));
}

function hasStrongSeriesMarker(text) {
    const value = normalizeTitleText(text);
    if (!value) return false;

    const strongPatterns = [
        /(?:电视剧|剧集|连续剧|短剧|网剧|番剧|动画剧)/i,
        /[Ss]\s*\d{1,2}\s*[Ee]\s*\d{1,3}/,
        /(?:^|[^0-9A-Za-z])\d{1,2}[xX]\d{1,3}(?=$|[^0-9A-Za-z])/,
        /Season\s*\d{1,2}.{0,18}(?:Episode|Ep|\d{1,3})/i,
        new RegExp(`第\\s*[${CN_NUM_TOKEN}]{1,6}\\s*季.{0,18}第\\s*[${CN_NUM_TOKEN}]{1,6}\\s*集`, "i"),
        new RegExp(`(?:更新至|连载至).{0,12}(?:第\\s*)?[${CN_NUM_TOKEN}]{1,6}\\s*集`, "i"),
        /全\s*\d{1,3}\s*集/i
    ];
    return strongPatterns.some(pattern => pattern.test(value));
}

function hasWeakSeriesMarker(text) {
    const value = normalizeTitleText(text);
    if (!value) return false;
    const weakPatterns = [
        new RegExp(`第\\s*[${CN_NUM_TOKEN}]{1,6}\\s*集`, "i"),
        /(?:^|[^0-9A-Za-z])(?:EP|E)\s*\d{1,3}(?=$|[^0-9A-Za-z])/i,
        /(?:全集|完结|Complete|Completed)/i
    ];
    return weakPatterns.some(pattern => pattern.test(value));
}

function hasAnySeasonMarker(text) {
    const value = normalizeTitleText(text);
    if (!value) return false;
    return extractSeasonMarkers(value).size > 0
        || /Season\s*\d{1,2}(?=$|[^0-9A-Za-z])/i.test(value)
        || /[Ss]\s*\d{1,2}(?=$|[^0-9A-Za-z])/i.test(value);
}

function isMoviePartFile(name) {
    return /(?:^|[^0-9A-Za-z])(?:cd|disc|disk|part|pt)\s*[12](?=$|[^0-9A-Za-z])/i.test(name)
        || /(?:上|下)[集部]\b/.test(name);
}

function sanitizeFileNamePart(value) {
    return String(value || "")
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getFileExtension(fileName) {
    const m = String(fileName || "").match(/(\.[A-Za-z0-9]{2,8})$/);
    return m ? m[1] : "";
}

function normalizeReleaseText(value) {
    return String(value || "")
        .replace(/[._]+/g, ".")
        .replace(/\s+/g, " ")
        .replace(/DDP\.?(\d(?:\.\d)?)/ig, "DDP $1")
        .replace(/DTS[-_. ]?HD[-_. ]?MA\.?(\d(?:\.\d)?)/ig, "DTS-HD MA$1")
        .replace(/AAC\.?(\d(?:\.\d)?)/ig, "AAC$1")
        .replace(/\.{2,}/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .trim();
}

function extractReleaseGroup(fileName) {
    const stem = String(fileName || "").replace(/\.[A-Za-z0-9]{2,8}$/, "");
    const index = stem.lastIndexOf("-");
    if (index < 0 || index >= stem.length - 1) return "";
    const group = sanitizeFileNamePart(stem.slice(index + 1));
    const fullMatchedText = stem.slice(index);
    if (/^-DL$/i.test(fullMatchedText) && /\bWEB-DL$/i.test(stem)) return "";
    if (/^-HD$/i.test(fullMatchedText) && /\bDTS-HD$/i.test(stem)) return "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_]{1,30}$/.test(group)) return "";
    if (/^(DL|HD|MA|HDR|SDR|DoVi|DV|WEB|REMUX)$/i.test(group)) return "";
    return group;
}

function extractReleaseTags(fileName) {
    const text = String(fileName || "");
    const tags = [];
    const add = value => {
        const clean = normalizeReleaseText(value);
        if (!clean) return;
        const key = clean.toLowerCase();
        if (!tags.some(item => item.toLowerCase() === key)) tags.push(clean);
    };
    const addMatches = pattern => {
        let match;
        const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
        const globalPattern = new RegExp(pattern.source, flags);
        while ((match = globalPattern.exec(text)) !== null) {
            add(match[0]);
        }
    };

    addMatches(/\b(?:4320p|2160p|1080p|720p|480p)\b/i);
    addMatches(/\b(?:Disney|Netflix|NF|AMZN|HBO|HMAX|Hulu|AppleTV|ATVP|Paramount|PMTP|Peacock|PCOK|iQIYI|IQ|WeTV|Viu|Baha)\b/i);
    addMatches(/\b(?:BluRay|BDRip|WEB-?DL|WEBRip|HDTV|DVDRip|REMUX)\b/i);
    addMatches(/\b(?:DoVi|DV|HDR10\+?|HDR|HLG|SDR)\b/i);
    addMatches(/\b(?:AVC|HEVC|x26[45]|H\.?26[45])\b/i);
    addMatches(/\b(?:8|10|12)[-_. ]?bit\b/i);
    addMatches(/\b(?:23\.976|24|25|29\.97|30|50|59\.94|60)\s*fps\b/i);
    addMatches(/\bHQ\b/i);
    addMatches(/\b(?:DDP|DD\+|AAC|AC3|EAC3|DTS(?:-HD)?(?:\.?MA)?|TrueHD|Atmos)(?:[ ._-]?\d(?:\.\d)?)?\b/i);

    const releaseGroup = extractReleaseGroup(text);
    if (releaseGroup && tags.length > 0) tags[tags.length - 1] = `${tags[tags.length - 1]}-${releaseGroup}`;
    else if (releaseGroup) add(releaseGroup);

    return tags.join(".");
}

function extractReleaseField(fileName, pattern) {
    const m = String(fileName || "").match(pattern);
    return m ? normalizeReleaseText(m[0]) : "";
}

function buildReleaseFields(fileName, release) {
    const videoFormat = extractReleaseField(fileName, /\b(?:4320p|2160p|1080p|720p|480p)\b/i);
    const webSource = extractReleaseField(fileName, /\b(?:Disney|Netflix|NF|AMZN|HBO|HMAX|Hulu|AppleTV|ATVP|Paramount|PMTP|Peacock|PCOK|iQIYI|IQ|WeTV|Viu|Baha)\b/i);
    const resourceType = extractReleaseField(fileName, /\b(?:BluRay|BDRip|WEB-?DL|WEBRip|HDTV|DVDRip|REMUX)\b/i);
    const effect = extractReleaseField(fileName, /\b(?:DoVi|DV|HDR10\+?|HDR|HLG|SDR)\b/i);
    const videoCodec = extractReleaseField(fileName, /\b(?:AVC|HEVC|x26[45]|H\.?26[45])\b/i);
    const audioCodec = extractReleaseField(fileName, /\b(?:DDP|DD\+|AAC|AC3|EAC3|DTS(?:-HD)?(?:\.?MA)?|TrueHD|Atmos)(?:[ ._-]?\d(?:\.\d)?)?\b/i);
    const videoBit = extractReleaseField(fileName, /\b(?:8|10|12)[-_. ]?bit\b/i);
    const fps = extractReleaseField(fileName, /\b(?:23\.976|24|25|29\.97|30|50|59\.94|60)\s*fps\b/i);
    const releaseGroup = extractReleaseGroup(fileName);
    const edition = [resourceType, effect].filter(Boolean).join(".");
    return {
        resourceType,
        effect,
        edition,
        videoFormat,
        resource_term: [resourceType, effect, videoFormat].filter(Boolean).join("."),
        releaseGroup,
        videoCodec,
        videoBit,
        audioCodec,
        fps,
        webSource,
        release
    };
}

function padNumber(value, length) {
    const n = Number(value || 0) || 0;
    return String(n).padStart(length, "0");
}

function getTemplateValue(context, path) {
    const key = String(path || "").trim();
    if (!key) return "";
    return key.split(".").reduce((value, part) => {
        if (value === null || value === undefined) return "";
        return value[part.trim()];
    }, context);
}

function applyTemplateFilter(value, filterText) {
    const raw = String(filterText || "").trim();
    if (!raw) return value;
    const m = raw.match(/^([A-Za-z_][\w-]*)(?:\((.*)\))?$/);
    const name = m ? m[1] : raw;
    const arg = m ? String(m[2] || "").trim().replace(/^['"]|['"]$/g, "") : "";

    if (name === "pad2") return padNumber(value, 2);
    if (name === "pad3") return padNumber(value, 3);
    if (name === "default") return value === null || value === undefined || value === "" ? arg : value;
    if (name === "lower") return String(value || "").toLowerCase();
    if (name === "upper") return String(value || "").toUpperCase();
    return value;
}

function isTruthyTemplateValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return !(value === null || value === undefined || value === "" || value === false || value === 0);
}

function evalTemplateCondition(expr, context) {
    const raw = String(expr || "").trim();
    if (!raw) return false;
    const notMatch = raw.match(/^not\s+(.+)$/i);
    if (notMatch) return !evalTemplateCondition(notMatch[1], context);

    const compareMatch = raw.match(/^(.+?)\s*(==|!=)\s*['"]?([^'"]*)['"]?$/);
    if (compareMatch) {
        const left = getTemplateValue(context, compareMatch[1]);
        const right = compareMatch[3];
        return compareMatch[2] === "==" ? String(left) === right : String(left) !== right;
    }

    return isTruthyTemplateValue(getTemplateValue(context, raw));
}

function renderJinjaIfBlocks(template, context) {
    let output = String(template || "");
    const pattern = /\{%\s*if\s+(.+?)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g;
    let guard = 0;
    while (pattern.test(output) && guard < 20) {
        output = output.replace(pattern, (all, condition, truthy, falsy) => (
            evalTemplateCondition(condition, context) ? truthy : (falsy || "")
        ));
        pattern.lastIndex = 0;
        guard++;
    }
    return output;
}

function renderJinjaTemplate(template, context) {
    return renderJinjaIfBlocks(template, context).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (all, expr) => {
        const parts = String(expr || "").split("|").map(part => part.trim()).filter(Boolean);
        if (parts.length === 0) return "";
        let value = getTemplateValue(context, parts.shift());
        parts.forEach(filter => {
            value = applyTemplateFilter(value, filter);
        });
        return value === null || value === undefined ? "" : String(value);
    });
}

function cleanRenderedFileName(value) {
    const basename = String(value || "").split("/").filter(Boolean).pop() || "";
    return sanitizeFileNamePart(basename)
        .replace(/\s+-\s+(?=\.)/g, "")
        .replace(/\s+-\s+-\s+/g, " - ")
        .replace(/\.(?=\.)/g, "")
        .replace(/\s+\./g, ".")
        .replace(/\.\s+/g, ".")
        .replace(/\s+/g, " ")
        .trim();
}

function buildUnifiedFileName(options) {
    const title = sanitizeFileNamePart(options.title || "未知");
    const year = sanitizeFileNamePart(options.year || "未知");
    const tmdbId = sanitizeFileNamePart(options.tmdbId || "");
    const originalName = options.originalName || "";
    const ext = getFileExtension(originalName);
    const release = extractReleaseTags(originalName);
    const season = Number(options.season || 1) || 1;
    const episode = Number(options.episode || 0) || 0;
    const seasonFmt = `S${padNumber(season, 2)}`;
    const episodeFmt = `E${padNumber(episode, 2)}`;
    const seasonEpisode = `${seasonFmt}${episodeFmt}`;
    const template = options.type === "tv" ? DEFAULT_TV_RENAME_FORMAT : DEFAULT_MOVIE_RENAME_FORMAT;
    const releaseFields = buildReleaseFields(originalName, release);
    const context = {
        title,
        en_title: "",
        original_title: title,
        name: title,
        en_name: "",
        original_name: originalName,
        year,
        title_year: year && year !== "未知" ? `${title} (${year})` : title,
        type: options.type || "",
        category: "",
        vote_average: "",
        poster: "",
        backdrop: "",
        actors: "",
        overview: "",
        season,
        episode,
        season_fmt: seasonFmt,
        season_year: year,
        season_episode: seasonEpisode,
        episode_title: "",
        episode_date: "",
        season_pad2: padNumber(season, 2),
        episode_pad2: padNumber(episode, 2),
        ...releaseFields,
        tmdbid: tmdbId,
        tmdb_id: tmdbId,
        tmdb_tag: tmdbId ? `{tmdb-${tmdbId}}` : "",
        imdbid: "",
        doubanid: "",
        part: "",
        ext,
        extension: ext,
        fileExt: ext,
        customization: ""
    };
    const rendered = renderJinjaTemplate(template, context);
    return cleanRenderedFileName(rendered) || `${title}.${year}${ext}`;
}

function selectBestMovieFiles(files, shareTitle, title, year, tmdbId) {
    const safeFiles = (files || []).filter(file => file && file.id && isVideoFile(file.name || ""));
    if (safeFiles.length === 0) return { accepted: false, files: [], reason: "无可用视频文件" };
    const fileText = file => joinContextText(file.context, file.name);

    const titleHasTargetTmdb = hasTargetTmdbId(shareTitle, tmdbId);
    const titleLooksSeries = hasStrongSeriesMarker(shareTitle);
    if (hasWrongTmdbId(shareTitle, tmdbId)) {
        return { accepted: false, files: [], reason: "分享标题 TMDB 不匹配" };
    }
    if (titleLooksSeries && !titleHasTargetTmdb) {
        return { accepted: false, files: [], reason: "分享标题疑似剧集资源" };
    }

    const wrongTmdbFiles = safeFiles.filter(file => hasWrongTmdbId(fileText(file), tmdbId));
    if (wrongTmdbFiles.length === safeFiles.length) {
        return { accepted: false, files: [], reason: "文件 TMDB 全部不匹配" };
    }

    const targetTmdbFiles = safeFiles.filter(file => hasTargetTmdbId(fileText(file), tmdbId));
    const targetTmdbMovieFiles = targetTmdbFiles.filter(file => !hasStrongSeriesMarker(fileText(file)));
    const strongSeriesFiles = safeFiles.filter(file => hasStrongSeriesMarker(fileText(file)) || hasAnySeasonMarker(fileText(file)));
    const weakSeriesFiles = safeFiles.filter(file => hasWeakSeriesMarker(fileText(file)));
    const episodeParsedFiles = safeFiles.filter(file => !!extractEpisodeInfo(fileText(file)));

    if (!titleHasTargetTmdb && targetTmdbFiles.length === 0) {
        if (strongSeriesFiles.length >= 1 || episodeParsedFiles.length >= 2) {
            return { accepted: false, files: [], reason: "文件列表疑似剧集包" };
        }
        if (safeFiles.length >= 3 && weakSeriesFiles.length >= 2) {
            return { accepted: false, files: [], reason: "多个文件带集数标记，疑似剧集包" };
        }
    }

    let candidates = safeFiles.filter(file => !hasWrongTmdbId(fileText(file), tmdbId) && !hasStrongSeriesMarker(fileText(file)) && !hasAnySeasonMarker(fileText(file)));
    if (targetTmdbFiles.length > 0) candidates = targetTmdbMovieFiles;
    if (candidates.length === 0) return { accepted: false, files: [], reason: "无可靠电影文件" };

    const hasTitleEvidence = hasMovieTitle(shareTitle, title) || candidates.some(file => hasMovieTitle(fileText(file), title));
    const hasTmdbEvidence = titleHasTargetTmdb || candidates.some(file => hasTargetTmdbId(fileText(file), tmdbId));
    if (!hasTitleEvidence && !hasTmdbEvidence) {
        return { accepted: false, files: [], reason: "缺少电影标题或 TMDB 命中" };
    }

    const yearCandidates = candidates.filter(file => hasYearMarker(fileText(file), year));
    if (yearCandidates.length > 0) candidates = yearCandidates;

    if (candidates.length <= 2 && candidates.every(file => isMoviePartFile(file.name || ""))) {
        return { accepted: true, files: candidates, reason: "电影分段文件" };
    }

    candidates.sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
    const selected = candidates.slice(0, 1);
    const reason = candidates.length > 1 ? `选择最大主视频，过滤 ${candidates.length - 1} 个候选文件` : "电影主视频";
    return { accepted: true, files: selected, reason };
}

function shouldSkipMovieShareByTitle(shareTitle, tmdbId) {
    if (!shareTitle) return "";
    if (hasWrongTmdbId(shareTitle, tmdbId)) return "分享标题 TMDB 不匹配";
    if (hasStrongSeriesMarker(shareTitle) && !hasTargetTmdbId(shareTitle, tmdbId)) return "分享标题疑似剧集资源";
    return "";
}

// =============================================
// 📁 115 API
// =============================================
function createFolder(parentCid, folderName) {
    return new Promise((resolve, reject) => {
        rateLimit(500).then(() => {
            LOG.debug(`创建文件夹: ${folderName}`);
            
            $httpClient.post({
                url: "https://webapi.115.com/files/add",
                headers: {
                    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                },
                body: `pid=${parentCid}&cname=${encodeURIComponent(folderName)}`
            }, (err, resp, data) => {
                if (err) {
                    LOG.error(`创建文件夹失败: ${err}`);
                    return reject(err);
                }
                try {
                    const res = JSON.parse(data);
                    if (res.state === true) {
                        LOG.success(`文件夹已创建: CID=${res.cid || res.file_id}`);
                        resolve(res.cid || res.file_id);
                    } else if (res.errno === 20004) {
                        LOG.info(`文件夹已存在，查找中...`);
                        findFolder(parentCid, folderName).then(resolve).catch(reject);
                    } else {
                        LOG.error(`创建失败: ${res.error || '未知错误'}`);
                        reject(new Error(res.error || "创建失败"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}

function findFolder(parentCid, folderName) {
    return new Promise((resolve, reject) => {
        rateLimit(500).then(() => {
            $httpClient.get({
                url: `https://webapi.115.com/files?cid=${parentCid}&limit=1150&offset=0&show_dir=1&format=json`,
                headers: {
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                }
            }, (err, resp, data) => {
                if (err) return reject(err);
                try {
                    const found = (JSON.parse(data).data || []).find(f => (f.n || f.name || "") === folderName);
                    if (found) {
                        LOG.success(`找到文件夹: CID=${found.cid || found.fid || found.file_id}`);
                        resolve(found.cid || found.fid || found.file_id);
                    } else {
                        reject(new Error(`找不到文件夹: ${folderName}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}

async function findFolderQuiet(parentCid, folderName) {
    try {
        return await findFolder(parentCid, folderName);
    } catch (e) {
        LOG.debug(`目录不存在: ${folderName}`);
        return "";
    }
}

async function findFirstFolder(parentCid, folderNames) {
    for (const folderName of folderNames) {
        const cid = await findFolderQuiet(parentCid, folderName);
        if (cid) return cid;
    }
    return "";
}

function get115ItemName(item) {
    return item?.n || item?.name || item?.file_name || item?.file_name_all || "";
}

function normalize115FileList(json) {
    const data = json?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(json?.list)) return json.list;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

function search115Files(cid, keyword, limit = 500) {
    return new Promise((resolve) => {
        const searchValue = String(keyword || "").trim();
        if (!cid || !searchValue) return resolve([]);

        rateLimit(500).then(() => {
            const params = new URLSearchParams({
                cid: String(cid),
                search_value: searchValue,
                type: "99",
                fc: "2",
                offset: "0",
                limit: String(limit),
                format: "json"
            });

            $httpClient.get({
                url: `https://webapi.115.com/files/search?${params.toString()}`,
                headers: {
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                }
            }, (err, resp, data) => {
                if (err || !data) {
                    LOG.warn(`115搜索失败: ${searchValue} | ${err || "无数据"}`);
                    return resolve([]);
                }
                try {
                    const json = JSON.parse(data);
                    if (json.state === false || json.errno) {
                        LOG.warn(`115搜索返回异常: ${searchValue} | ${json.error || json.msg || json.message || json.errno}`);
                        return resolve([]);
                    }
                    resolve(normalize115FileList(json));
                } catch (e) {
                    LOG.warn(`115搜索响应解析失败: ${searchValue} | ${e.message}`);
                    resolve([]);
                }
            });
        });
    });
}

function list115Files(cid, limit = 1150) {
    return new Promise((resolve) => {
        if (!cid) return resolve([]);

        rateLimit(500).then(() => {
            $httpClient.get({
                url: `https://webapi.115.com/files?cid=${cid}&limit=${limit}&offset=0&show_dir=0&format=json`,
                headers: {
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                }
            }, (err, resp, data) => {
                if (err || !data) {
                    LOG.warn(`读取115目录失败: ${cid} | ${err || "无数据"}`);
                    return resolve([]);
                }
                try {
                    resolve(normalize115FileList(JSON.parse(data)));
                } catch (e) {
                    LOG.warn(`读取115目录响应解析失败: ${e.message}`);
                    resolve([]);
                }
            });
        });
    });
}

function rename115Files(renameMap) {
    return new Promise((resolve, reject) => {
        const entries = Object.keys(renameMap || {})
            .map(id => ({ id, name: renameMap[id] }))
            .filter(entry => entry.id && entry.name);
        if (entries.length === 0) return resolve(false);

        rateLimit(500).then(() => {
            const body = entries
                .map(entry => `files_new_name[${encodeURIComponent(entry.id)}]=${encodeURIComponent(entry.name)}`)
                .join("&");
            $httpClient.post({
                url: "https://webapi.115.com/files/batch_rename",
                headers: {
                    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                },
                body
            }, (err, resp, data) => {
                if (err || !data) return reject(new Error(String(err || "115重命名无响应")));
                try {
                    const json = JSON.parse(data);
                    if (json.state === true || json.errno === 0) return resolve(true);
                    reject(new Error(json.error || json.msg || json.message || "115重命名失败"));
                } catch (e) {
                    reject(new Error(`115重命名响应解析失败: ${e.message}`));
                }
            });
        });
    });
}

function rename115File(fileId, newName) {
    return rename115Files({ [fileId]: newName });
}

function unique115Items(items) {
    const seen = {};
    const result = [];
    (items || []).forEach(item => {
        const key = String(item?.fid || item?.cid || item?.id || item?.pc || get115ItemName(item));
        if (!key || seen[key]) return;
        seen[key] = true;
        result.push(item);
    });
    return result;
}

async function search115FilesInFolder(cid, keywords) {
    let files = [];
    for (const keyword of keywords) {
        const found = await search115Files(cid, keyword);
        files.push(...found);
    }
    files = unique115Items(files).filter(item => isVideoFile(get115ItemName(item)));

    if (files.length === 0) {
        const listed = await list115Files(cid);
        files = unique115Items(listed).filter(item => isVideoFile(get115ItemName(item)));
        if (files.length > 0) LOG.info(`115搜索无结果，已回退目录读取: ${files.length} 个视频文件`);
    }

    return files;
}

function extractTransferredFileIds(result) {
    const ids = [];
    const visit = value => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (typeof value !== "object") return;
        const id = value.file_id || value.fid || value.cid || value.id;
        if (id) ids.push(String(id));
        Object.keys(value).forEach(key => {
            if (key === "file_id" || key === "fid" || key === "cid" || key === "id") return;
            visit(value[key]);
        });
    };
    visit(result);
    return ids.filter((id, index) => ids.indexOf(id) === index);
}

function get115ItemId(item) {
    return String(item?.fid || item?.file_id || item?.cid || item?.id || "");
}

async function findTransferredFileInTarget(targetCid, sourceFile, preferredId, targetFiles) {
    if (!targetCid && !targetFiles) return null;
    const sourceName = sourceFile?.name || "";
    const sourceSize = Number(sourceFile?.size || 0);
    const files = targetFiles || await list115Files(targetCid);
    const videos = unique115Items(files).filter(item => isVideoFile(get115ItemName(item)));

    if (preferredId) {
        const byId = videos.find(item => get115ItemId(item) === String(preferredId));
        if (byId) return byId;
    }

    const byNameAndSize = videos.find(item => {
        const name = get115ItemName(item);
        const size = Number(item?.s || item?.size || item?.file_size || 0);
        return name === sourceName && (!sourceSize || !size || size === sourceSize);
    });
    if (byNameAndSize) return byNameAndSize;

    return videos.find(item => get115ItemName(item) === sourceName) || null;
}

async function renameTransferredFile(sourceFile, targetCid, newName, transferResult, targetFiles, options = {}) {
    if (!sourceFile || !targetCid || !newName) return "";
    if (sourceFile.name === newName) return newName;

    const resultIds = extractTransferredFileIds(transferResult);
    const preferredId = resultIds.length === 1 ? resultIds[0] : "";
    const targetFile = await findTransferredFileInTarget(targetCid, sourceFile, preferredId, targetFiles);
    const targetId = get115ItemId(targetFile);
    if (!targetId) {
        if (!options.silentMissing) LOG.warn(`重命名跳过，未定位目标文件: ${sourceFile.name || sourceFile.id || ""}`);
        return "";
    }

    await rename115File(targetId, newName);
    LOG.success(`重命名完成: ${sourceFile.name} -> ${newName}`);
    return newName;
}

async function renameTransferredFileWithRetry(sourceFile, targetCid, newName, transferResult) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const targetFiles = await list115Files(targetCid);
        const finalName = await renameTransferredFile(sourceFile, targetCid, newName, transferResult, targetFiles, {
            silentMissing: attempt < maxAttempts - 1
        });
        if (finalName) return finalName;
        if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
    return "";
}

async function renameTransferredBatch(files, targetCid, transferResult, buildName) {
    const renamed = {};
    let pending = (files || []).slice();
    const maxAttempts = 3;
    const resultIds = extractTransferredFileIds(transferResult);
    const preferredId = resultIds.length === 1 ? resultIds[0] : "";

    for (let attempt = 0; attempt < maxAttempts && pending.length > 0; attempt++) {
        const targetFiles = await list115Files(targetCid);
        const nextPending = [];
        const renameMap = {};
        const renameRecords = [];

        for (const file of pending) {
            try {
                const newName = buildName(file);
                if (!newName || file.name === newName) {
                    renamed[String(file.id || file.name)] = newName || file.name || "";
                    continue;
                }
                const targetFile = await findTransferredFileInTarget(targetCid, file, preferredId, targetFiles);
                const targetId = get115ItemId(targetFile);
                if (!targetId) {
                    if (attempt >= maxAttempts - 1) LOG.warn(`重命名跳过，未定位目标文件: ${file.name || file.id || ""}`);
                    nextPending.push(file);
                    continue;
                }
                renameMap[targetId] = newName;
                renameRecords.push({ source: file, targetId, newName });
            } catch (e) {
                LOG.warn(`重命名失败，保留原文件名: ${file.name || file.id || ""} | ${e.message}`);
            }
        }

        if (renameRecords.length > 0) {
            try {
                await rename115Files(renameMap);
                renameRecords.forEach(record => {
                    renamed[String(record.source.id || record.source.name)] = record.newName;
                    LOG.success(`重命名完成: ${record.source.name} -> ${record.newName}`);
                });
            } catch (e) {
                LOG.warn(`批量重命名失败: ${e.message}`);
                renameRecords.forEach(record => nextPending.push(record.source));
            }
        }

        pending = nextPending;
        if (pending.length > 0 && attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }

    return renamed;
}

function episodeKey(season, episode) {
    return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

function parseExistingEpisodeKeys(files, targetSeason) {
    const keys = new Set();
    (files || []).forEach(item => {
        const ep = extractEpisodeInfo(get115ItemName(item));
        if (ep && ep.season === targetSeason) keys.add(episodeKey(ep.season, ep.episode));
    });
    return keys;
}

function build115ExistingSearchKeywords(tmdbId, title) {
    return uniqueValues([tmdbId, title].filter(Boolean));
}

async function getExistingMovieStateFrom115(rootCid, mediaFolder, folderName, title, tmdbId) {
    LOG.step("检查115已有电影");
    const mediaCid = await findFolderQuiet(rootCid, mediaFolder);
    if (!mediaCid) return { exists: false, contentCid: "" };
    const contentCid = await findFolderQuiet(mediaCid, folderName);
    if (!contentCid) return { exists: false, contentCid: "" };

    const files = await search115FilesInFolder(contentCid, build115ExistingSearchKeywords(tmdbId, title));
    LOG.info(`115已有电影文件: ${files.length} 个`);
    return { exists: files.length > 0, contentCid };
}

async function getExistingSeasonStateFrom115(rootCid, mediaFolder, folderName, title, targetSeason, tmdbId) {
    LOG.step("检查115已有剧集");
    const mediaCid = await findFolderQuiet(rootCid, mediaFolder);
    if (!mediaCid) return { episodeKeys: new Set(), seasonCid: "", contentCid: "" };
    const contentCid = await findFolderQuiet(mediaCid, folderName);
    if (!contentCid) return { episodeKeys: new Set(), seasonCid: "", contentCid: "" };

    const seasonNames = [
        `Season ${targetSeason}`,
        `Season ${String(targetSeason).padStart(2, "0")}`,
        `S${String(targetSeason).padStart(2, "0")}`
    ];
    const seasonCid = await findFirstFolder(contentCid, seasonNames);
    if (!seasonCid) return { episodeKeys: new Set(), seasonCid: "", contentCid };

    const files = await search115FilesInFolder(seasonCid, build115ExistingSearchKeywords(tmdbId, title));
    const episodeKeys = parseExistingEpisodeKeys(files, targetSeason);
    LOG.info(`115已有 Season ${targetSeason}: ${episodeKeys.size} 集`);
    if (episodeKeys.size > 0) LOG.debug(`115已有剧集: ${Array.from(episodeKeys).sort().join(", ")}`);
    return { episodeKeys, seasonCid, contentCid };
}

function getShareContent(shareCode, receiveCode, cid = 0) {
    return new Promise((resolve, reject) => {
        rateLimit(800).then(() => {
            $httpClient.get({
                url: `https://webapi.115.com/share/snap?share_code=${shareCode}&offset=0&limit=100&asc=0&cid=${cid}&receive_code=${receiveCode}&format=json`,
                headers: {
                    "accept": "*/*",
                    "user-agent": USER_AGENT,
                    "referer": `https://115cdn.com/s/${shareCode}?password=${receiveCode}`,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                }
            }, (err, resp, data) => {
                if (err || !data) return reject(err || "无数据");

                const status = Number(resp && (resp.status || resp.statusCode || resp.status_code || 0));
                if (status === 405 || status === 429) return reject(new Error("RATE_LIMITED"));

                try {
                    const json = JSON.parse(data);
                    if (json.state === true || json.errno === 0 || json.data) {
                        return resolve(json);
                    }

                    const message = String(json.error || json.msg || json.message || json.errmsg || "");
                    if (json.errno === 405 || json.errno === 429 || /请求被阻断|访问频繁|操作频繁|稍后再试|rate\s*limit/i.test(message)) {
                        return reject(new Error("RATE_LIMITED"));
                    }

                    resolve(json);
                } catch (e) {
                    const text = String(data || "");
                    if (/请求被阻断|访问频繁|操作频繁|稍后再试|rate\s*limit/i.test(text)) {
                        return reject(new Error("RATE_LIMITED"));
                    }
                    reject(e);
                }
            });
        });
    });
}

async function inspectShareRoot(shareCode, receiveCode, rateLimitRetries = 0) {
    try {
        const result = await getShareContent(shareCode, receiveCode, 0);
        return {
            result,
            list: result.data?.list || [],
            shareTitle: result.data?.shareinfo?.share_title || result.data?.share_title || ""
        };
    } catch (e) {
        if (e.message === "SHARE_RATE_LIMITED") throw e;
        if (e.message === "RATE_LIMITED") {
            const nextRetry = rateLimitRetries + 1;
            if (nextRetry >= RATE_LIMIT_MAX_RETRIES) {
                LOG.error(`115分享读取连续限流 ${nextRetry} 次，终止任务: ${shareCode}`);
                throw new Error("SHARE_RATE_LIMITED");
            }
            LOG.warn(`被限流，第 ${nextRetry}/${RATE_LIMIT_MAX_RETRIES} 次，等待 ${SHARE_DELAY}ms 后重试...`);
            await new Promise(r => setTimeout(r, SHARE_DELAY));
            return inspectShareRoot(shareCode, receiveCode, nextRetry);
        }
        throw e;
    }
}

function batchTransfer(shareCode, receiveCode, fileIds, targetCid) {
    return new Promise((resolve, reject) => {
        rateLimit(500).then(() => {
            LOG.debug(`批量转存: ${fileIds.length} 个文件`);
            
            $httpClient.post({
                url: "https://115cdn.com/webapi/share/receive",
                headers: {
                    "accept": "*/*",
                    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "origin": "https://115cdn.com",
                    "referer": `https://115cdn.com/s/${shareCode}?password=${receiveCode}`,
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                },
                body: `share_code=${shareCode}&receive_code=${receiveCode}&file_id=${fileIds.join(",")}&cid=${targetCid}`
            }, (err, resp, data) => {
                if (err) return reject(err);
                try {
                    const result = JSON.parse(data);
                    if (result.state === true || result.errno === 0) {
                        LOG.success(`批量转存成功`);
                        resolve(result);
                    } else {
                        LOG.error(`批量转存失败: ${result.error || result.msg}`);
                        reject(new Error(result.error || result.msg || "批量转存失败"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}

function transferSingle(shareCode, receiveCode, fileId, targetCid) {
    return new Promise((resolve, reject) => {
        rateLimit(500).then(() => {
            $httpClient.post({
                url: "https://115cdn.com/webapi/share/receive",
                headers: {
                    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "user-agent": USER_AGENT,
                    "Cookie": MODULE_ARGS.P115_COOKIE
                },
                body: `share_code=${shareCode}&receive_code=${receiveCode}&file_id=${fileId}&cid=${targetCid}`
            }, (err, resp, data) => {
                if (err) return reject(err);
                try {
                    const result = JSON.parse(data);
                    if (result.state === true || result.errno === 0) {
                        resolve(result);
                    } else {
                        reject(new Error(result.error || result.msg));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}

// =============================================
// 🎬 TMDB API
// =============================================
function getTMDBInfo(tmdbId, type) {
    return new Promise((resolve, reject) => {
        const mediaType = type === "tv" ? "tv" : "movie";
        LOG.info(`获取 TMDB 信息: ${mediaType}/${tmdbId}`);
        
        $httpClient.get({
            url: `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${MODULE_ARGS.TMDB_API_KEY}&language=zh-CN&append_to_response=alternative_titles`,
            headers: { "accept": "application/json" },
            timeout: 20
        }, (err, resp, data) => {
            if (err) {
                LOG.error(`TMDB 查询失败: ${err}`);
                return reject(err);
            }
            try {
                const json = JSON.parse(data);
                if (json.success === false || json.status_code) {
                    LOG.error(`TMDB 错误: ${json.status_message}`);
                    return reject(new Error(json.status_message || "TMDB 查询失败"));
                }
                const title = type === "movie" ? json.title : json.name;
                const year = type === "movie" 
                    ? (json.release_date || "").substring(0, 4)
                    : (json.first_air_date || "").substring(0, 4);
                LOG.success(`${title} (${year})`);
                resolve(json);
            } catch (e) {
                LOG.error(`解析 TMDB 响应失败: ${e.message}`);
                reject(e);
            }
        });
    });
}

function getTVSeasonEpisodes(tmdbId, seasonNumber) {
    return new Promise((resolve, reject) => {
        LOG.debug(`获取 Season ${seasonNumber} 信息`);
        
        $httpClient.get({
            url: `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${MODULE_ARGS.TMDB_API_KEY}&language=zh-CN`,
            headers: { "accept": "application/json" }
        }, (err, resp, data) => {
            if (err) {
                LOG.error(`获取季信息失败: ${err}`);
                return reject(err);
            }
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(e);
            }
        });
    });
}

function normalizeTmdbStatus(value) {
    return String(value || "").trim().toLowerCase();
}

function getMovieUnreleasedReason(tmdbInfo) {
    const status = normalizeTmdbStatus(tmdbInfo && tmdbInfo.status);
    const unreleased = ["rumored", "planned", "in production", "post production"];
    if (unreleased.includes(status)) return `TMDB 状态: ${tmdbInfo.status}`;
    return "";
}

function getTvUnavailableReason(tmdbInfo, seasonData) {
    const status = normalizeTmdbStatus(tmdbInfo && tmdbInfo.status);
    const unavailableStatus = ["planned", "in production", "pilot"];
    if (unavailableStatus.includes(status)) return `TMDB 状态: ${tmdbInfo.status}`;

    const episodes = (seasonData && seasonData.episodes) || [];
    if (episodes.length === 0) return "TMDB 当前季暂无集数数据";
    return "";
}

function localDateString(date = new Date()) {
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getReleasedSeasonEpisodes(seasonData) {
    const today = localDateString();
    return ((seasonData && seasonData.episodes) || [])
        .filter(ep => Number(ep.episode_number || ep.episode || 0) > 0)
        .filter(ep => {
            const airDate = String(ep.air_date || "").trim();
            return /^\d{4}-\d{2}-\d{2}$/.test(airDate) && airDate <= today;
        });
}

function skipUnreleasedTask(taskParams, title, year, detail, reason, mediaUrl) {
    const message = `${reason}${detail ? `（${detail}）` : ""}，跳过本轮查询，等待下次定时检查`;
    LOG.warn(message);
    if (taskParams.SUB_ID) {
        updateSubStatus(taskParams.SUB_ID, {
            status: "pending",
            progress: 0,
            message,
            last_run_at: new Date().toISOString()
        });
        ensureQueueTaskFromParams(taskParams, {
            reason: "not_released",
            errorMessage: message
        });
    }
    const finishedRun = finishTransferRun("not_released", {
        found_shares: 0,
        transferred_files: 0,
        message
    });
    $notification.post(
        "ℹ️ 订阅未开播",
        `${title}${year && year !== "未知" ? ` (${year})` : ""}`,
        notifyBodyWithDetail(message),
        notifyOptions(finishedRun?.run_id || "", mediaUrl)
    );
}

// =============================================
// 🔍 Panhunt 搜索
// =============================================
function getHttpStatus(resp) {
    return Number(resp && (resp.status || resp.statusCode || resp.status_code || 0)) || 0;
}

function isPansouTemporaryFailure(status, data, err) {
    if (err) return true;
    if (status === 403 || status === 429 || status >= 500) return true;
    const text = String(data || "").trim();
    if (!text) return true;
    if (/^<!doctype html/i.test(text) || /^<html/i.test(text)) return true;
    if (/cloudflare|attention required|access denied|forbidden|too many requests/i.test(text)) return true;
    return false;
}

function pansouRetryDelay(attempt) {
    return PANSOU_RETRY_BASE_DELAY * Math.pow(2, Math.max(0, attempt - 1));
}

function searchPanhunt(keyword, attempt = 1) {
    return new Promise(resolve => {
        LOG.info(`Panhunt 搜索: "${keyword}"${attempt > 1 ? `（重试 ${attempt}/${PANSOU_MAX_RETRIES}）` : ""}`);
        
        const channelsStr = getPanhuntChannels().join(",");
        let url = MODULE_ARGS.PANSOU_API + "/api/search";
        url += "?kw=" + encodeURIComponent(keyword);
        url += "&res=merge&src=tg";
        url += "&channels=" + encodeURIComponent(channelsStr);
        url += "&cloud_types=115";
        url += "&ext=" + encodeURIComponent('{"referer":"https://dm.xueximeng.com"}');
        
        $httpClient.get({
            url: url,
            headers: {
                "User-Agent": USER_AGENT,
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Referer": MODULE_ARGS.PANSOU_API
            },
            timeout: 30
        }, (err, resp, data) => {
            const status = getHttpStatus(resp);
            const retry = async reason => {
                if (attempt >= PANSOU_MAX_RETRIES) {
                    LOG.error(`Panhunt 搜索失败: ${reason}，已尝试 ${attempt} 次`);
                    return resolve([]);
                }
                const delay = pansouRetryDelay(attempt);
                LOG.warn(`Panhunt 临时失败: ${reason}，${delay}ms 后重试...`);
                await new Promise(r => setTimeout(r, delay));
                resolve(await searchPanhunt(keyword, attempt + 1));
            };

            if (isPansouTemporaryFailure(status, data, err)) {
                const reason = err
                    ? String(err)
                    : (status ? `HTTP ${status}` : "无响应数据");
                return retry(reason);
            }
            try {
                const jsonData = JSON.parse(data);
                if (jsonData.code !== 0) {
                    LOG.warn(`Panhunt 返回错误码: ${jsonData.code}`);
                    return resolve([]);
                }
                const merged = (jsonData.data || {}).merged_by_type || {};
                const results = merged["115"] || [];
                LOG.success(`找到 ${results.length} 个115分享`);
                resolve(results);
            } catch (e) {
                retry(`响应解析失败: ${e.message}`);
            }
        });
    });
}

async function searchPanhuntResources(profile, missingEpisodes = []) {
    LOG.step("搜索 Panhunt 资源");

    const keywords = buildPanhuntSearchKeywords(profile, missingEpisodes);
    const allResults = [];
    const seenKeywords = {};

    for (const keyword of keywords) {
        const key = compactMatchText(keyword);
        if (!key || seenKeywords[key]) continue;
        seenKeywords[key] = true;
        const results = await searchPanhunt(keyword);
        allResults.push(...results);
        await new Promise(r => setTimeout(r, 300));
    }

    if (allResults.length === 0) {
        LOG.warn("Panhunt 未返回可用分享");
        return [];
    }

    LOG.success(`总共找到 ${allResults.length} 个115分享，开始标题评分`);
    return rankPanhuntResults(allResults, profile, missingEpisodes);
}

function extractShareInfo(item) {
    const note = item.note || item.name || "";
    const url = item.url || "";
    const regex = /https?:\/\/(?:115|115cdn)\.com\/s\/([a-zA-Z0-9]+)(?:\?password=([a-zA-Z0-9]+))?/i;
    const m = url.match(regex) || note.match(regex);
    if (m) return { shareCode: m[1], receiveCode: m[2] || "", title: note };
    return { shareCode: "", receiveCode: "", title: note };
}

// =============================================
// 📤 收集文件（去重优化）
// =============================================
async function collectMovieFiles(shareCode, receiveCode, tmdbId, cid = 0, rateLimitRetries = 0, preloaded = null, contextText = "") {
    try {
        const result = preloaded && preloaded.result ? preloaded.result : await getShareContent(shareCode, receiveCode, cid);
        const list = preloaded && preloaded.list ? preloaded.list : (result.data?.list || []);
        let shareTitle = (preloaded && preloaded.shareTitle) || (result.data?.shareinfo?.share_title || result.data?.share_title || "");
        const files = [];
        let skippedNonVideo = 0;

        for (const item of list) {
            const itemName = item.n || item.name || "未命名";
            const itemId = item.fid || item.cid || item.id;

            if (item.fc === 0) {
                await new Promise(r => setTimeout(r, SUBFOLDER_DELAY));
                const sub = await collectMovieFiles(shareCode, receiveCode, tmdbId, itemId, rateLimitRetries, null, joinContextText(contextText, itemName));
                files.push(...sub.files);
                skippedNonVideo += sub.skippedNonVideo || 0;
                if (!shareTitle && sub.shareTitle) shareTitle = sub.shareTitle;
            } else {
                if (!isVideoFile(itemName)) {
                    skippedNonVideo++;
                    continue;
                }
                files.push({ id: itemId, name: itemName, size: Number(item.s || item.size || 0), context: contextText });
            }
        }

        if (skippedNonVideo > 0) LOG.debug(`跳过 ${skippedNonVideo} 个非视频文件`);
        return { files, skippedNonVideo, shareTitle };
    } catch (e) {
        if (e.message === "SHARE_RATE_LIMITED") throw e;
        if (e.message === "RATE_LIMITED") {
            const nextRetry = rateLimitRetries + 1;
            if (nextRetry >= RATE_LIMIT_MAX_RETRIES) {
                LOG.error(`115分享读取连续限流 ${nextRetry} 次，终止任务: ${shareCode}`);
                throw new Error("SHARE_RATE_LIMITED");
            }
            LOG.warn(`被限流，第 ${nextRetry}/${RATE_LIMIT_MAX_RETRIES} 次，等待 ${SHARE_DELAY}ms 后重试...`);
            await new Promise(r => setTimeout(r, SHARE_DELAY));
            return collectMovieFiles(shareCode, receiveCode, tmdbId, cid, nextRetry);
        }
        LOG.error(`收集电影文件失败: ${e.message}`);
        return { files: [], skippedNonVideo: 0, shareTitle: "" };
    }
}

async function collectSeasonFiles(shareCode, receiveCode, tmdbId, targetSeason, cid = 0, rateLimitRetries = 0, existingEpisodeKeys = null, preloaded = null, contextText = "") {
    try {
        const result = preloaded && preloaded.result ? preloaded.result : await getShareContent(shareCode, receiveCode, cid);
        const list = preloaded && preloaded.list ? preloaded.list : (result.data?.list || []);
        let shareTitle = (preloaded && preloaded.shareTitle) || (result.data?.shareinfo?.share_title || result.data?.share_title || "");
        const files = [];
        let hasOtherSeason = false;
        let skippedNonVideo = 0;

        for (const item of list) {
            const itemName = item.n || item.name || "未命名";
            const itemId = item.fid || item.cid || item.id;

            if (item.fc === 0) {
                await new Promise(r => setTimeout(r, SUBFOLDER_DELAY));
                const sub = await collectSeasonFiles(shareCode, receiveCode, tmdbId, targetSeason, itemId, rateLimitRetries, existingEpisodeKeys, null, joinContextText(contextText, itemName));
                files.push(...sub.files);
                if (sub.hasOtherSeason) hasOtherSeason = true;
                skippedNonVideo += sub.skippedNonVideo || 0;
                if (!shareTitle && sub.shareTitle) shareTitle = sub.shareTitle;
            } else {
                if (!isVideoFile(itemName)) {
                    skippedNonVideo++;
                    continue;
                }

                const ep = extractEpisodeInfoForShare(itemName, joinContextText(shareTitle, contextText), targetSeason);
                if (ep) {
                    if (ep.season === targetSeason) {
                        const key = episodeKey(ep.season, ep.episode);
                        if (existingEpisodeKeys && existingEpisodeKeys.has(key)) {
                            continue;
                        }
                        
                        files.push({
                            id: itemId,
                            name: itemName,
                            key,
                            season: ep.season,
                            episode: ep.episode,
                            size: Number(item.s || item.size || 0),
                            context: contextText
                        });
                    } else {
                        hasOtherSeason = true;
                    }
                }
            }
        }

        if (skippedNonVideo > 0) LOG.debug(`跳过 ${skippedNonVideo} 个非视频文件`);
        return { files, hasOtherSeason, skippedNonVideo, shareTitle };
    } catch (e) {
        if (e.message === "SHARE_RATE_LIMITED") throw e;
        if (e.message === "RATE_LIMITED") {
            const nextRetry = rateLimitRetries + 1;
            if (nextRetry >= RATE_LIMIT_MAX_RETRIES) {
                LOG.error(`115分享读取连续限流 ${nextRetry} 次，终止任务: ${shareCode}`);
                throw new Error("SHARE_RATE_LIMITED");
            }
            LOG.warn(`被限流，第 ${nextRetry}/${RATE_LIMIT_MAX_RETRIES} 次，等待 ${SHARE_DELAY}ms 后重试...`);
            await new Promise(r => setTimeout(r, SHARE_DELAY));
            return collectSeasonFiles(shareCode, receiveCode, tmdbId, targetSeason, cid, nextRetry, existingEpisodeKeys);
        }
        LOG.error(`收集剧集文件失败: ${e.message}`);
        return { files: [], hasOtherSeason: false, skippedNonVideo: 0, shareTitle: "" };
    }
}

// =============================================
// 🎯 主流程
// =============================================
async function processTask(taskParams) {
    const startTime = Date.now();
    let run = null;
    let notificationMediaUrl = "";
    
    // 参数验证
    if (!taskParams.TMDB_API_KEY) {
        throw new Error("缺少 TMDB API Key，请检查模块配置");
    }
    if (!taskParams.P115_COOKIE) {
        throw new Error("缺少 115 Cookie，请检查模块配置");
    }
    if (!taskParams.ROOT_CID) {
        throw new Error("缺少根目录 CID，请检查模块配置");
    }
    if (!taskParams.TMDB_ID) {
        throw new Error("缺少 TMDB ID");
    }
    
    run = beginTransferRun(taskParams);
    
    try {
        LOG.section(`115自动补集系统 v6.2`);
        LOG.info(`媒体: ${taskParams.SUB_NAME}`);
        LOG.info(`类型: ${taskParams.TMDB_TYPE === "movie" ? "🎥 电影" : "📺 电视剧"}`);
        LOG.info(`TMDB ID: ${taskParams.TMDB_ID}`);
        if (taskParams.TMDB_TYPE === "tv") LOG.info(`Season: ${taskParams.SEASON}`);

        if (taskParams.SUB_ID) {
            updateSubStatus(taskParams.SUB_ID, {
                status: "running",
                progress: 5,
                message: "开始自动查询资源并转存"
            });
        }
        
        // 步骤 1: 获取 TMDB 信息
        LOG.step("获取 TMDB 信息");
        const tmdbInfo = await getTMDBInfo(taskParams.TMDB_ID, taskParams.TMDB_TYPE);
        notificationMediaUrl = tmdbMediaImage(tmdbInfo);
        
        let title, year;
        if (taskParams.TMDB_TYPE === "movie") {
            title = tmdbInfo.title || taskParams.SUB_NAME || "未知电影";
            year = (tmdbInfo.release_date || "").substring(0, 4) || "未知";
        } else {
            title = tmdbInfo.name || taskParams.SUB_NAME || "未知剧集";
            year = (tmdbInfo.first_air_date || "").substring(0, 4) || "未知";
        }
        
        updateCurrentRunMeta({ title, year });
        const mediaProfile = buildMediaProfile(tmdbInfo, taskParams, title, year);

        let preloadedSeasonData = null;
        if (taskParams.TMDB_TYPE === "movie") {
            const unreleasedReason = getMovieUnreleasedReason(tmdbInfo);
            if (unreleasedReason) {
                skipUnreleasedTask(taskParams, title, year, unreleasedReason, "电影尚未上映", notificationMediaUrl);
                return;
            }
        } else {
            const targetSeasonForDate = parseInt(taskParams.SEASON || "1", 10) || 1;
            preloadedSeasonData = await getTVSeasonEpisodes(taskParams.TMDB_ID, targetSeasonForDate);
            const unavailableReason = getTvUnavailableReason(tmdbInfo, preloadedSeasonData);
            if (unavailableReason) {
                skipUnreleasedTask(taskParams, title, year, unavailableReason, `Season ${targetSeasonForDate} 尚未开播`, notificationMediaUrl);
                return;
            }
        }
        
        const mediaFolder = taskParams.TMDB_TYPE === "movie" ? "电影" : "电视剧";
        const folderName = `${title} (${year})`;
        let mediaCid = "";
        let contentCid = "";

        async function ensureContentFolder() {
            if (contentCid) return contentCid;
            LOG.step("创建文件夹结构");
            mediaCid = await createFolder(taskParams.ROOT_CID, mediaFolder);
            LOG.info(`媒体库 CID: ${mediaCid}`);
            contentCid = await createFolder(mediaCid, folderName);
            LOG.success(`内容目录: ${folderName}`);
            LOG.info(`完整路径: 资源库/${mediaFolder}/${folderName}/`);
            return contentCid;
        }

        function finishNoResource() {
            const isManualShare = !!taskParams.MANUAL_SHARE;
            LOG.error("未找到任何115分享");
            if (taskParams.SUB_ID) {
                updateSubStatus(taskParams.SUB_ID, { 
                    status: "pending", 
                    progress: 100, 
                    found: 0, 
                    message: "未找到分享资源，等待下次定时补集",
                    last_run_at: new Date().toISOString()
                });
                ensureQueueTaskFromParams(taskParams, {
                    reason: "no_resource",
                    errorMessage: "未找到分享资源"
                });
            }
            const finishedRun = finishTransferRun("no_resource", {
                found_shares: 0,
                transferred_files: 0,
                message: isManualShare ? "手动分享未找到可转存资源" : "未找到分享资源，已保留订阅等待下次定时补集"
            });
            $notification.post(
                isManualShare ? "❌ 手动转存失败" : "❌ 115补集失败",
                `${title} (${year})`,
                notifyBodyWithDetail(isManualShare ? "手动分享未找到可转存资源" : "未找到分享资源，已保留订阅等待下次定时补集"),
                notifyOptions(finishedRun?.run_id || run.run_id, notificationMediaUrl)
            );
        }
        
        // 步骤 4: 处理转存
        let totalTransferred = 0;
        let totalFound = 0;
        let totalEpisodes = 0;
        let targetEpisodeCount = 0;
        let seasonFullyAired = false;
        let currentComplete = false;
        const processedSet = new Set();
        let movieExistsIn115 = false;
        let existingEpisodeKeys = new Set();
        
        if (taskParams.TMDB_TYPE === "movie") {
            // ===== 电影处理 =====
            LOG.step("处理电影转存");
            
            // 检查是否已转存
            const existingMovieState = await getExistingMovieStateFrom115(taskParams.ROOT_CID, mediaFolder, folderName, title, taskParams.TMDB_ID);
            if (existingMovieState.contentCid) contentCid = existingMovieState.contentCid;
            movieExistsIn115 = existingMovieState.exists;
            if (movieExistsIn115) {
                LOG.success(`✅ 电影已在之前转存，跳过`);
                if (taskParams.SUB_ID) completeAndRemoveSubscription(taskParams.SUB_ID, "电影已存在，无缺集");
                const existsMessage = taskParams.MANUAL_SHARE ? "电影已存在，手动转存跳过" : "电影已存在，订阅已移除";
                const finishedRun = finishTransferRun("skipped", {
                    found_shares: 0,
                    transferred_files: 0,
                    message: existsMessage
                });
                $notification.post(
                    taskParams.MANUAL_SHARE ? "✅ 手动转存完成" : "✅ 订阅完成",
                    `${title} (${year})`,
                    notifyBodyWithDetail(taskParams.MANUAL_SHARE ? existsMessage : "电影已存在，订阅完成，已移除订阅"),
                    notifyOptions(finishedRun?.run_id || run.run_id, notificationMediaUrl)
                );
                return;
            }

            let searchResults = taskParams.MANUAL_SHARE
                ? [taskParams.MANUAL_SHARE]
                : await searchPanhuntResources(mediaProfile);
            if (searchResults.length === 0) {
                finishNoResource();
                return;
            }
            
            for (let idx = 0; idx < searchResults.length; idx++) {
                const item = searchResults[idx];
                const { shareCode, receiveCode, title: shareTitle } = extractShareInfo(item);
                
                if (!shareCode || processedSet.has(shareCode)) continue;
                processedSet.add(shareCode);
                
                LOG.info(`\n📤 [${idx + 1}/${searchResults.length}] 分享: ${shareCode}`);
                if (shareTitle) LOG.debug(`分享标题: ${shareTitle}`);

                const titleSkipReason = shouldSkipMovieShareByTitle(shareTitle, taskParams.TMDB_ID);
                if (titleSkipReason) {
                    LOG.warn(`跳过电影分享: ${titleSkipReason}`);
                    continue;
                }
                
                if (taskParams.SUB_ID) {
                    const progress = Math.round((idx / searchResults.length) * 90) + 10;
                    updateSubStatus(taskParams.SUB_ID, { 
                        progress, 
                        message: `处理分享 ${idx + 1}/${searchResults.length}` 
                    });
                }
                
                const rootInfo = await inspectShareRoot(shareCode, receiveCode);
                const officialShareTitle = rootInfo.shareTitle || "";
                const confirmedShareTitle = [shareTitle, officialShareTitle].filter(Boolean).join(" ");
                const shareConfirm = scorePanhuntTitle(confirmedShareTitle || shareTitle, mediaProfile, []);
                if (shareConfirm.score < 180) {
                    LOG.warn(`跳过电影分享: 115标题确认失败 [${shareConfirm.reason}]`);
                    continue;
                }

                const { files } = await collectMovieFiles(shareCode, receiveCode, taskParams.TMDB_ID, 0, 0, rootInfo);

                const movieSelection = selectBestMovieFiles(files, confirmedShareTitle || shareTitle, title, year, taskParams.TMDB_ID);
                if (!movieSelection.accepted) {
                    LOG.warn(`跳过电影分享: ${movieSelection.reason}`);
                    continue;
                }

                const movieFiles = movieSelection.files;
                totalFound++;
                LOG.info(`发现 ${files.length} 个视频文件，${movieSelection.reason}，准备转存 ${movieFiles.length} 个`);
                const targetCid = await ensureContentFolder();
                
                const allIds = movieFiles.map(f => f.id);
                let successCount = 0;
                let failCount = 0;
                
                // 批量转存
                for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
                    const batchIds = allIds.slice(i, Math.min(i + BATCH_SIZE, allIds.length));
                    const batchFiles = movieFiles.slice(i, Math.min(i + BATCH_SIZE, movieFiles.length));
                    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                    
                    try {
                        const transferResult = await batchTransfer(shareCode, receiveCode, batchIds, targetCid);
                        successCount += batchIds.length;
                        LOG.success(`批次 ${batchNum}: ${batchIds.length} 文件转存成功`);
                        let renamed = {};
                        try {
                            renamed = await renameTransferredBatch(batchFiles, targetCid, transferResult, file => buildUnifiedFileName({
                                type: "movie",
                                title,
                                year,
                                tmdbId: taskParams.TMDB_ID,
                                originalName: file.name || ""
                            }));
                        } catch (re) {
                            LOG.warn(`批次 ${batchNum} 已转存成功，但重命名失败，保留原文件名: ${re.message}`);
                        }
                        batchFiles.forEach(file => recordTransferredItem({
                            kind: "movie",
                            label: "电影",
                            file_name: renamed[String(file.id || file.name)] || file.name || "",
                            original_name: file.name || "",
                            file_id: file.id || "",
                            share_code: shareCode,
                            share_title: officialShareTitle || shareTitle || "",
                            target_cid: targetCid
                        }));
                    } catch (e) {
                        LOG.warn(`批次 ${batchNum} 失败，尝试单个转存: ${e.message}`);
                        for (let j = 0; j < batchIds.length; j++) {
                            try {
                                const transferResult = await transferSingle(shareCode, receiveCode, batchIds[j], targetCid);
                                successCount++;
                                const file = batchFiles[j] || {};
                                let renamedName = "";
                                try {
                                    renamedName = await renameTransferredFileWithRetry(file, targetCid, buildUnifiedFileName({
                                        type: "movie",
                                        title,
                                        year,
                                        tmdbId: taskParams.TMDB_ID,
                                        originalName: file.name || ""
                                    }), transferResult);
                                } catch (re) {
                                    LOG.warn(`重命名失败，保留原文件名: ${file.name || batchIds[j]} | ${re.message}`);
                                }
                                recordTransferredItem({
                                    kind: "movie",
                                    label: "电影",
                                    file_name: renamedName || file.name || "",
                                    original_name: file.name || "",
                                    file_id: file.id || batchIds[j],
                                    share_code: shareCode,
                                    share_title: officialShareTitle || shareTitle || "",
                                    target_cid: targetCid
                                });
                            } catch (se) {
                                LOG.error(`单个文件转存失败: ${se.message}`);
                                failCount++;
                            }
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }
                }
                
                totalTransferred += successCount;
                LOG.info(`本分享结果: ${successCount} 成功 | ${failCount} 失败`);
                
                if (successCount > 0) {
                    movieExistsIn115 = true;
                    LOG.success("电影转存成功");
                    break; // 电影转存成功就停止
                }
                
                if (idx < searchResults.length - 1) {
                    await new Promise(r => setTimeout(r, SHARE_DELAY));
                }
            }
            
        } else {
            // ===== 电视剧处理 =====
            LOG.step("处理电视剧转存");
            
            const targetSeason = parseInt(taskParams.SEASON);
            
            // 获取季信息
            const seasonData = preloadedSeasonData || await getTVSeasonEpisodes(taskParams.TMDB_ID, targetSeason);
            const allEpisodes = seasonData.episodes || [];
            const releasedEpisodes = getReleasedSeasonEpisodes(seasonData);
            totalEpisodes = allEpisodes.length;
            targetEpisodeCount = releasedEpisodes.length;
            seasonFullyAired = totalEpisodes > 0 && targetEpisodeCount >= totalEpisodes;
            
            LOG.info(`Season ${targetSeason} 共有 ${totalEpisodes} 集，按今日已播 ${targetEpisodeCount} 集`);
            if (taskParams.SUB_ID) updateTvSubEpisodeState(taskParams.SUB_ID, totalEpisodes, 0, { state: "N" });
            
            // 检查115网盘中已存在的剧集
            const existingSeasonState = await getExistingSeasonStateFrom115(
                taskParams.ROOT_CID,
                mediaFolder,
                folderName,
                title,
                targetSeason,
                taskParams.TMDB_ID
            );
            if (existingSeasonState.contentCid) contentCid = existingSeasonState.contentCid;
            existingEpisodeKeys = existingSeasonState.episodeKeys || new Set();
            const transferredEpisodes = Array.from(existingEpisodeKeys).sort();
            
            LOG.info(`115已有: ${transferredEpisodes.length} 集`);
            if (transferredEpisodes.length > 0) {
                LOG.debug(`已有剧集: ${transferredEpisodes.join(", ")}`);
            }
            if (taskParams.SUB_ID) updateTvSubEpisodeState(taskParams.SUB_ID, totalEpisodes, transferredEpisodes.length, { state: "N" });
            
            if (targetEpisodeCount === 0) {
                LOG.warn(`TMDB Season ${targetSeason} 暂无已播集数，跳过本轮搜索`);
                const waitMessage = `Season ${targetSeason} 暂无已播集数，等待下次定时检查`;
                if (taskParams.SUB_ID) {
                    updateTvSubEpisodeState(taskParams.SUB_ID, totalEpisodes, 0, { state: "N" });
                    updateSubStatus(taskParams.SUB_ID, {
                        status: "pending",
                        progress: 0,
                        message: waitMessage,
                        last_run_at: new Date().toISOString()
                    });
                    ensureQueueTaskFromParams(taskParams, {
                        reason: "not_released",
                        errorMessage: waitMessage
                    });
                }
                const finishedRun = finishTransferRun("not_released", {
                    found_shares: 0,
                    transferred_files: 0,
                    message: waitMessage
                });
                $notification.post(
                    taskParams.MANUAL_SHARE ? "ℹ️ 手动转存跳过" : "ℹ️ 订阅未开播",
                    `${title} S${targetSeason}`,
                    notifyBodyWithDetail(waitMessage),
                    notifyOptions(finishedRun?.run_id || run.run_id, notificationMediaUrl)
                );
                return;
            }

            if (transferredEpisodes.length >= targetEpisodeCount) {
                const currentCompleteMessage = seasonFullyAired
                    ? `Season ${targetSeason} 已完整，无缺集`
                    : `Season ${targetSeason} 当前已播 ${targetEpisodeCount}/${totalEpisodes} 集已完整，等待后续更新`;
                LOG.success(`✅ ${currentCompleteMessage}`);
                if (seasonFullyAired && taskParams.SUB_ID) completeAndRemoveSubscription(taskParams.SUB_ID, currentCompleteMessage);
                else if (taskParams.SUB_ID) {
                    updateTvSubEpisodeState(taskParams.SUB_ID, totalEpisodes, transferredEpisodes.length, { state: "N" });
                    updateSubStatus(taskParams.SUB_ID, {
                        status: "pending",
                        progress: 100,
                        found: 0,
                        transferred: 0,
                        message: currentCompleteMessage,
                        last_run_at: new Date().toISOString()
                    });
                    ensureQueueTaskFromParams(taskParams, {
                        reason: "waiting_update",
                        errorMessage: currentCompleteMessage
                    });
                }
                const existsMessage = taskParams.MANUAL_SHARE
                    ? `${currentCompleteMessage}，手动转存跳过`
                    : (seasonFullyAired ? `${currentCompleteMessage}，订阅已移除` : currentCompleteMessage);
                const finishedRun = finishTransferRun("skipped", {
                    found_shares: 0,
                    transferred_files: 0,
                    message: existsMessage
                });
                $notification.post(
                    taskParams.MANUAL_SHARE ? "✅ 手动转存完成" : "✅ 订阅完成",
                    `${title} S${targetSeason}`,
                    notifyBodyWithDetail(existsMessage),
                    notifyOptions(finishedRun?.run_id || run.run_id, notificationMediaUrl)
                );
                return;
            }

            const missingEpisodes = releasedEpisodes
                .map(ep => Number(ep.episode_number || ep.episode || 0))
                .filter(ep => ep > 0)
                .filter(ep => !existingEpisodeKeys.has(episodeKey(targetSeason, ep)));
            const effectiveMissingEpisodes = missingEpisodes.length > 0
                ? missingEpisodes
                : Array.from({ length: targetEpisodeCount }, (_, i) => i + 1)
                    .filter(ep => !existingEpisodeKeys.has(episodeKey(targetSeason, ep)));

            if (effectiveMissingEpisodes.length > 0) {
                LOG.info(`缺集: ${effectiveMissingEpisodes.map(ep => `E${String(ep).padStart(2, '0')}`).join(", ")}`);
                let searchResults = taskParams.MANUAL_SHARE
                    ? [taskParams.MANUAL_SHARE]
                    : await searchPanhuntResources(mediaProfile, effectiveMissingEpisodes);
                if (searchResults.length === 0) {
                    finishNoResource();
                    return;
                }
            
                let seasonCid = existingSeasonState.seasonCid || "";
                async function ensureSeasonFolder() {
                    if (seasonCid) return seasonCid;
                    const targetCid = await ensureContentFolder();
                    try {
                        seasonCid = await createFolder(targetCid, `Season ${targetSeason}`);
                        LOG.success(`Season ${targetSeason} 文件夹已准备`);
                        return seasonCid;
                    } catch (e) {
                        LOG.error(`无法创建Season文件夹: ${e.message}`);
                        throw e;
                    }
                }
            
                // 处理每个分享
                for (let idx = 0; idx < searchResults.length; idx++) {
                const item = searchResults[idx];
                const { shareCode, receiveCode, title: shareTitle } = extractShareInfo(item);
                
                if (!shareCode || processedSet.has(shareCode)) continue;
                processedSet.add(shareCode);
                
                LOG.info(`\n📤 [${idx + 1}/${searchResults.length}] 分享: ${shareCode}`);
                if (shareTitle) LOG.debug(`分享标题: ${shareTitle}`);
                
                if (taskParams.SUB_ID) {
                    const progress = Math.round((idx / searchResults.length) * 90) + 10;
                    updateSubStatus(taskParams.SUB_ID, { 
                        progress, 
                        message: `处理分享 ${idx + 1}/${searchResults.length}` 
                    });
                }
                
                const rootInfo = await inspectShareRoot(shareCode, receiveCode);
                const officialShareTitle = rootInfo.shareTitle || "";
                const confirmedShareTitle = [shareTitle, officialShareTitle].filter(Boolean).join(" ");
                const shareConfirm = scorePanhuntTitle(confirmedShareTitle || shareTitle, mediaProfile, effectiveMissingEpisodes);
                if (shareConfirm.score < 130) {
                    LOG.warn(`跳过剧集分享: 115标题确认失败 [${shareConfirm.reason}]`);
                    continue;
                }

                const { files, hasOtherSeason } = await collectSeasonFiles(
                    shareCode, 
                    receiveCode, 
                    taskParams.TMDB_ID, 
                    targetSeason,
                    0,
                    0,
                    existingEpisodeKeys,
                    rootInfo
                );
                
                if (files.length === 0) {
                    LOG.warn(`该分享${hasOtherSeason ? "不包含目标季" : "无视频文件"}`);
                    continue;
                }
                
                totalFound++;
                LOG.info(`发现 ${files.length} 个 Season ${targetSeason} 的剧集`);
                const targetSeasonCid = await ensureSeasonFolder();
                
                const allIds = files.map(f => f.id);
                const allEpisodeNumbers = files.map(f => f.episode);
                let successCount = 0;
                
                // 批量转存
                for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
                    const batchIds = allIds.slice(i, Math.min(i + BATCH_SIZE, allIds.length));
                    const batchFiles = files.slice(i, Math.min(i + BATCH_SIZE, files.length));
                    const batchEpisodes = allEpisodeNumbers.slice(i, Math.min(i + BATCH_SIZE, allEpisodeNumbers.length));
                    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                    
                    try {
                        const transferResult = await batchTransfer(shareCode, receiveCode, batchIds, targetSeasonCid);
                        successCount += batchIds.length;
                        LOG.success(`批次 ${batchNum}: ${batchIds.length} 文件转存成功`);
                        let renamed = {};
                        try {
                            renamed = await renameTransferredBatch(batchFiles, targetSeasonCid, transferResult, file => buildUnifiedFileName({
                                type: "tv",
                                title,
                                year,
                                tmdbId: taskParams.TMDB_ID,
                                season: targetSeason,
                                episode: file.episode,
                                originalName: file.name || ""
                            }));
                        } catch (re) {
                            LOG.warn(`批次 ${batchNum} 已转存成功，但重命名失败，保留原文件名: ${re.message}`);
                        }
                        
                        batchEpisodes.forEach(ep => existingEpisodeKeys.add(episodeKey(targetSeason, ep)));
                        batchFiles.forEach(file => recordTransferredItem({
                            kind: "episode",
                            label: file.key || `S${String(targetSeason).padStart(2, '0')}E${String(file.episode || "").padStart(2, '0')}`,
                            season: targetSeason,
                            episode: file.episode,
                            file_name: renamed[String(file.id || file.name)] || file.name || "",
                            original_name: file.name || "",
                            file_id: file.id || "",
                            share_code: shareCode,
                            share_title: officialShareTitle || shareTitle || "",
                            target_cid: targetSeasonCid
                        }));
                        
                    } catch (e) {
                        LOG.warn(`批次 ${batchNum} 失败，尝试单个转存: ${e.message}`);
                        for (let j = 0; j < batchIds.length; j++) {
                            try {
                                const transferResult = await transferSingle(shareCode, receiveCode, batchIds[j], targetSeasonCid);
                                successCount++;
                                
                                existingEpisodeKeys.add(episodeKey(targetSeason, batchEpisodes[j]));
                                const file = batchFiles[j] || {};
                                let renamedName = "";
                                try {
                                    renamedName = await renameTransferredFileWithRetry(file, targetSeasonCid, buildUnifiedFileName({
                                        type: "tv",
                                        title,
                                        year,
                                        tmdbId: taskParams.TMDB_ID,
                                        season: targetSeason,
                                        episode: batchEpisodes[j],
                                        originalName: file.name || ""
                                    }), transferResult);
                                } catch (re) {
                                    LOG.warn(`重命名失败，保留原文件名: ${file.name || batchIds[j]} | ${re.message}`);
                                }
                                recordTransferredItem({
                                    kind: "episode",
                                    label: file.key || `S${String(targetSeason).padStart(2, '0')}E${String(batchEpisodes[j] || "").padStart(2, '0')}`,
                                    season: targetSeason,
                                    episode: batchEpisodes[j],
                                    file_name: renamedName || file.name || "",
                                    original_name: file.name || "",
                                    file_id: file.id || batchIds[j],
                                    share_code: shareCode,
                                    share_title: officialShareTitle || shareTitle || "",
                                    target_cid: targetSeasonCid
                                });
                                
                            } catch (se) {
                                LOG.error(`单个文件转存失败: ${se.message}`);
                            }
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }
                }
                
                totalTransferred += successCount;
                LOG.info(`本分享结果: ${successCount} 个剧集转存成功`);
                
                // 检查是否已完整
                if (existingEpisodeKeys.size >= targetEpisodeCount) {
                    LOG.success(seasonFullyAired ? `✅ Season ${targetSeason} 已完整！` : `✅ Season ${targetSeason} 当前已播集数已完整！`);
                    break;
                }
                
                if (idx < searchResults.length - 1) {
                    await new Promise(r => setTimeout(r, SHARE_DELAY));
                }
            }
            }
        }
        
        // 步骤 5: 完成统计
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const isManualShareTask = !!taskParams.MANUAL_SHARE;
        let hasNoMissing = taskParams.TMDB_TYPE === "movie" && movieExistsIn115;
        let completionMessage = `转存完成: ${totalTransferred} 文件`;
        
        LOG.section("任务完成");
        LOG.info(`媒体: ${title} (${year})`);
        if (taskParams.TMDB_TYPE === "tv") {
            const finalTransferred = existingEpisodeKeys.size;
            currentComplete = targetEpisodeCount > 0 && finalTransferred >= targetEpisodeCount;
            LOG.info(`Season ${taskParams.SEASON}: ${finalTransferred}/${targetEpisodeCount} 已播集，TMDB 全季 ${totalEpisodes} 集`);
            hasNoMissing = seasonFullyAired && totalEpisodes > 0 && finalTransferred >= totalEpisodes;
            completionMessage = hasNoMissing
                ? `Season ${taskParams.SEASON} 已完整，无缺集`
                : (currentComplete
                    ? `当前已播 ${targetEpisodeCount}/${totalEpisodes} 集已完整，等待后续更新`
                    : (isManualShareTask
                        ? `仍缺 ${Math.max(targetEpisodeCount - finalTransferred, 0)} 集`
                        : `仍缺 ${Math.max(targetEpisodeCount - finalTransferred, 0)} 集，保留订阅等待下次补集`));
        }
        LOG.info(`本次转存: ${totalTransferred} 个文件`);
        LOG.info(`使用分享: ${totalFound} 个`);
        LOG.info(`耗时: ${elapsedTime} 秒`);
        
        if (taskParams.SUB_ID) {
            if (hasNoMissing) {
                completeAndRemoveSubscription(taskParams.SUB_ID, completionMessage);
            } else {
                if (taskParams.TMDB_TYPE === "tv") {
                    updateTvSubEpisodeState(taskParams.SUB_ID, totalEpisodes, existingEpisodeKeys.size, { state: "N" });
                }
                updateSubStatus(taskParams.SUB_ID, {
                    status: "pending",
                    progress: 100,
                    found: totalFound,
                    transferred: totalTransferred,
                    message: completionMessage,
                    last_run_at: new Date().toISOString()
                });
                ensureQueueTaskFromParams(taskParams, {
                    reason: taskParams.TMDB_TYPE === "tv" && currentComplete ? "waiting_update" : "still_missing"
                });
                LOG.warn(`订阅保留: ${taskParams.SUB_NAME || taskParams.TMDB_ID} | ${completionMessage}`);
            }
        }
        
        const seasonTag = taskParams.TMDB_TYPE === "tv" ? ` S${taskParams.SEASON}` : "";
        const finishedRun = finishTransferRun("completed", {
            found_shares: totalFound,
            transferred_files: totalTransferred,
            message: completionMessage
        });
        const transferredUnit = taskParams.TMDB_TYPE === "tv" ? "集" : "文件";
        const resultMessage = hasNoMissing
            ? (isManualShareTask
                ? (totalTransferred > 0
                    ? `成功转存 ${totalTransferred} ${transferredUnit}，手动转存完成`
                    : `手动转存完成`)
                : (taskParams.TMDB_TYPE === "tv"
                    ? (totalTransferred > 0
                        ? `成功转存 ${totalTransferred} ${transferredUnit}，全集订阅完成，已移除订阅`
                        : `全集订阅完成，已移除订阅`)
                    : (totalTransferred > 0
                        ? `成功转存 ${totalTransferred} ${transferredUnit}，电影订阅完成，已移除订阅`
                        : `电影订阅完成，已移除订阅`)))
            : (totalTransferred > 0
                ? `成功转存 ${totalTransferred} ${transferredUnit}，${completionMessage}`
                : completionMessage);
        $notification.post(
            isManualShareTask ? "✅ 手动转存完成" : "✅ 订阅完成",
            `${title}${seasonTag} (${year})`,
            notifyBodyWithDetail(resultMessage),
            notifyOptions(finishedRun?.run_id || run.run_id, notificationMediaUrl)
        );
        
    } catch (e) {
        const errorMessage = e.message === "SHARE_RATE_LIMITED"
            ? `115分享读取连续限流 ${RATE_LIMIT_MAX_RETRIES} 次，任务已终止`
            : e.message;
        LOG.error(`任务失败: ${errorMessage}`);
        LOG.debug(e.stack || "");
        
        if (taskParams.SUB_ID) {
            updateSubStatus(taskParams.SUB_ID, {
                status: "error",
                progress: 0,
                message: `${errorMessage}，等待下次定时重试`,
                last_run_at: new Date().toISOString()
            });
            ensureQueueTaskFromParams(taskParams, {
                reason: "failed_retry",
                failed: true,
                errorMessage
            });
        }
        
        const failedRun = finishTransferRun("error", {
            found_shares: 0,
            transferred_files: 0,
            message: errorMessage
        });
        $notification.post(
            "❌ 115补集失败",
            taskParams.SUB_NAME || `TMDB-${taskParams.TMDB_ID}`,
            notifyBodyWithDetail(errorMessage),
            notifyOptions(failedRun?.run_id || (run && run.run_id), notificationMediaUrl)
        );
        
        throw e;
    }
}

// =============================================
// 辅助函数（订阅状态管理）
// =============================================
function readJSONStore(key, fallback) {
    try {
        const raw = $persistentStore.read(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        LOG.error(`读取 ${key} 失败: ${e.message}`);
        return fallback;
    }
}

function writeJSONStore(key, value) {
    try {
        $persistentStore.write(JSON.stringify(value), key);
    } catch (e) {
        LOG.error(`写入 ${key} 失败: ${e.message}`);
    }
}

function getSettings() {
    return readJSONStore("mp_settings", {});
}

function saveSettings(settings) {
    writeJSONStore("mp_settings", settings);
}

function acquireRunLock(task) {
    const settings = getSettings();
    const running = settings.runningTask;
    const now = Date.now();

    if (running && running.started_at) {
        const startedAt = Date.parse(running.started_at);
        const isFresh = Number.isFinite(startedAt) && now - startedAt < RUN_LOCK_TTL_MS;
        if (isFresh) {
            LOG.warn(`已有任务运行中: ${running.name || running.id || "unknown"}`);
            return false;
        }
        LOG.warn(`发现过期运行锁，自动覆盖: ${running.name || running.id || "unknown"}`);
    }

    settings.runningTask = {
        id: task.id || task.SUB_ID || task.TMDB_ID || "manual",
        tmdbid: task.tmdbid || task.TMDB_ID || "",
        type: task.type || task.TMDB_TYPE || "",
        season: task.season || task.SEASON || "0",
        name: task.name || task.SUB_NAME || "",
        mode: task.mode || "generic",
        started_at: new Date().toISOString()
    };
    saveSettings(settings);
    return true;
}

function refreshRunLock(task) {
    const settings = getSettings();
    settings.runningTask = {
        id: task.id || task.SUB_ID || task.TMDB_ID || "manual",
        tmdbid: task.tmdbid || task.TMDB_ID || "",
        type: task.type || task.TMDB_TYPE || "",
        season: task.season || task.SEASON || "0",
        name: task.name || task.SUB_NAME || "",
        mode: task.mode || "generic",
        started_at: settings.runningTask?.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    saveSettings(settings);
}

function releaseRunLock() {
    const settings = getSettings();
    delete settings.runningTask;
    saveSettings(settings);
}

function getImmediateTask(settings) {
    const taskQueue = settings.taskQueue || [];
    const id = settings.immediateTaskId;
    if (id) {
        const queued = taskQueue.find(t => String(t.id) === String(id));
        if (queued) return queued;
    }
    return settings.immediateTask || null;
}

function clearImmediateTask(id) {
    const settings = getSettings();
    if (!id || String(settings.immediateTaskId || "") === String(id)) {
        delete settings.immediateTaskId;
        delete settings.immediateTask;
        saveSettings(settings);
    }
}

function updateSubStatus(id, patch) {
    try {
        const subs = readJSONStore("mp_subscriptions", []);
        const idx = subs.findIndex(s => s.id === id);
        if (idx >= 0) {
            subs[idx] = { ...subs[idx], ...patch, updated_at: new Date().toISOString() };
            writeJSONStore("mp_subscriptions", subs);
        }
    } catch (e) {
        LOG.error(`更新订阅状态失败: ${e.message}`);
    }
}

function updateTvSubEpisodeState(id, totalEpisodes, completedEpisodes, options = {}) {
    if (!id) return;
    const total = Number(totalEpisodes || 0) || 0;
    const completed = Number(completedEpisodes || 0) || 0;
    const patch = {
        total_episode: total,
        total_episodes: total,
        completed_episode: completed,
        lack_episode: Math.max(total - completed, 0),
        state: options.state || (total > 0 && completed >= total ? "R" : "N"),
        last_update: new Date().toISOString()
    };
    updateSubStatus(id, patch);
}

function completeAndRemoveSubscription(id, reason) {
    if (!id) return false;
    try {
        const subs = readJSONStore("mp_subscriptions", []);
        const idx = subs.findIndex(s => String(s.id) === String(id));
        if (idx < 0) {
            LOG.warn(`订阅已不在列表中，无需移除: ${id}`);
            removeQueueTask(id);
            clearImmediateTask(id);
            return false;
        }

        const removed = {
            ...subs.splice(idx, 1)[0],
            status: "completed",
            completed_at: new Date().toISOString(),
            removed_at: new Date().toISOString(),
            remove_reason: reason || "订阅已完成，无缺集"
        };
        writeJSONStore("mp_subscriptions", subs);

        const history = readJSONStore("mp_history", []);
        history.push(removed);
        writeJSONStore("mp_history", history.slice(-200));

        removeQueueTask(id);
        clearImmediateTask(id);
        LOG.success(`订阅已完成且无缺集，已移除订阅: ${removed.name || id} | ${removed.remove_reason}`);
        return true;
    } catch (e) {
        LOG.error(`移除已完成订阅失败: ${e.message}`);
        return false;
    }
}

function removeQueueTask(id) {
    try {
        const settings = getSettings();
        if (settings.taskQueue) {
            settings.taskQueue = settings.taskQueue.filter(t => String(t.id) !== String(id));
            saveSettings(settings);
        }
    } catch (e) {
        LOG.error(`移除队列任务失败: ${e.message}`);
    }
}

function retryTimeFromNow() {
    return new Date(Date.now() + RETRY_COOLDOWN_MS).toISOString();
}

function ensureQueueTaskFromParams(taskParams, options) {
    if (!taskParams.SUB_ID) return;
    try {
        const opts = options || {};
        const settings = getSettings();
        if (!settings.taskQueue) settings.taskQueue = [];
        const now = new Date().toISOString();
        const nextRunAt = opts.nextRunAt || retryTimeFromNow();
        const reason = opts.reason || "still_missing";
        const exists = settings.taskQueue.find(t => String(t.id) === String(taskParams.SUB_ID));
        if (!exists) {
            settings.taskQueue.push({
                id: taskParams.SUB_ID,
                tmdbid: taskParams.TMDB_ID,
                type: taskParams.TMDB_TYPE,
                season: taskParams.SEASON || "0",
                cid: taskParams.ROOT_CID,
                name: taskParams.SUB_NAME,
                added_at: now,
                updated_at: now,
                next_run_at: nextRunAt,
                reason,
                fail_count: opts.failed ? 1 : 0,
                last_error: opts.errorMessage || ""
            });
        } else {
            exists.tmdbid = taskParams.TMDB_ID;
            exists.type = taskParams.TMDB_TYPE;
            exists.season = taskParams.SEASON || "0";
            exists.cid = taskParams.ROOT_CID;
            exists.name = taskParams.SUB_NAME;
            exists.updated_at = now;
            exists.next_run_at = nextRunAt;
            exists.reason = reason;
            if (opts.failed) exists.fail_count = Number(exists.fail_count || 0) + 1;
            if (opts.errorMessage) exists.last_error = opts.errorMessage;
        }
        saveSettings(settings);
        LOG.info(`订阅已保留并设置下次处理时间: ${taskParams.SUB_NAME || taskParams.TMDB_ID} | ${nextRunAt} | ${reason}`);
    } catch (e) {
        LOG.error(`缺集订阅重新入队失败: ${e.message}`);
    }
}

function filterRunnableQueue(taskQueue, runMode) {
    if (runMode === "current") return taskQueue || [];
    const now = Date.now();
    const runnable = [];
    let skipped = 0;
    (taskQueue || []).forEach(task => {
        const nextRunAt = task.next_run_at ? Date.parse(task.next_run_at) : 0;
        if (Number.isFinite(nextRunAt) && nextRunAt > now) {
            skipped++;
            console.log(`[信息] 跳过冷却中任务: ${task.name || task.tmdbid || task.id} | 下次运行 ${task.next_run_at}`);
            return;
        }
        runnable.push(task);
    });
    if (skipped > 0) console.log(`[信息] 冷却中任务 ${skipped} 个，本次不处理`);
    return runnable;
}

// =============================================
// 🔥 启动入口
// =============================================
(async () => {
    try {
        console.log(`\n${"═".repeat(60)}`);
        console.log(`  ${MODULE_ARGS.RUN_MODE === "current" ? "当前订阅即时任务" : "Cron 定时任务"}`);
        console.log(`${"═".repeat(60)}`);

        const settings = getSettings();
        const immediateTask = MODULE_ARGS.RUN_MODE === "current" ? getImmediateTask(settings) : null;
        const rawTaskQueue = MODULE_ARGS.RUN_MODE === "current"
            ? (immediateTask ? [immediateTask] : [])
            : (settings.taskQueue || []);
        const taskQueue = filterRunnableQueue(rawTaskQueue, MODULE_ARGS.RUN_MODE);

        if (taskQueue.length === 0) {
            console.log(`[信息] ${MODULE_ARGS.RUN_MODE === "current" ? "无当前即时任务" : "无到期任务需要处理"}`);
        } else {
            console.log(`[信息] 发现 ${taskQueue.length} 个待处理任务\n`);

            if (!acquireRunLock({ ...taskQueue[0], mode: MODULE_ARGS.RUN_MODE })) {
                console.log(`[信息] 已有任务运行中，本次触发跳过`);
            } else {
                try {
                    for (let i = 0; i < taskQueue.length; i++) {
                        const task = taskQueue[i];
                        console.log(`[信息] [${i + 1}/${taskQueue.length}] 处理任务: ${task.name}`);

                        const fullParams = {
                            TMDB_ID: task.tmdbid,
                            TMDB_TYPE: task.type,
                            SEASON: task.season || "0",
                            ROOT_CID: MODULE_ARGS.ROOT_CID || task.cid,
                            SUB_NAME: task.name,
                            SUB_ID: task.manual_share ? "" : task.id,
                            MANUAL_TASK_ID: task.manual_share ? task.id : "",
                            MANUAL_SHARE: task.manual_share || null,
                            TMDB_API_KEY: MODULE_ARGS.TMDB_API_KEY,
                            P115_COOKIE: MODULE_ARGS.P115_COOKIE
                        };

                        refreshRunLock({ ...fullParams, mode: MODULE_ARGS.RUN_MODE });

                        try {
                            await processTask(fullParams);
                        } catch (e) {
                            console.log(`[错误] ❌ 任务处理失败: ${e.message}`);
                        }

                        if (i < taskQueue.length - 1) {
                            console.log(`[信息] 等待 3 秒后处理下一个任务...\n`);
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }
                } finally {
                    if (MODULE_ARGS.RUN_MODE === "current") {
                        clearImmediateTask(taskQueue[0]?.id);
                    }
                    releaseRunLock();
                }
            }

            console.log(`[成功] ✅ ${MODULE_ARGS.RUN_MODE === "current" ? "当前即时任务处理完毕" : "所有定时任务处理完毕"}`);
        }

        $done();
        
    } catch(e) {
        console.log(`[错误] ❌ 致命错误: ${e.message}`);
        console.log(e.stack || "");
        $done();
    }
})();
