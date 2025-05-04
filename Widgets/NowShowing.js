// 填写你的 TMDB API 访问令牌
const TMDB_API_TOKEN = "";

var WidgetMetadata = {
    id: "now_showing",
    title: "院线电影",
    description: "获取正在上映和即将上映的电影信息",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.0.2",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "正在上映",
            description: "获取当前正在上映的电影列表",
            requiresWebView: false,
            functionName: "getMovies",
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "constant",
                    value: "nowplaying"
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            title: "即将上映",
            description: "获取即将上映的电影及上映日期",
            requiresWebView: false,
            functionName: "getMovies",
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "constant",
                    value: "upcoming"
                }
            ]
        }
    ]
};

async function getMovies(params = {}) {
    try {
        console.log(`[电影列表] 开始获取${params.type === "nowplaying" ? "正在上映" : "即将上映"}的电影`);
        
        const response = await Widget.http.get("https://movie.douban.com/cinema/nowplaying/shanghai/", {
            headers: {
                "Referer": "https://movie.douban.com/"
            }
        });
        
        if (!response?.data) throw new Error("获取电影数据失败");
        
        const docId = Widget.dom.parse(response.data);
        const selector = params.type === "nowplaying" ? '#nowplaying .list-item' : '#upcoming .list-item';
        const movieElements = Widget.dom.select(docId, selector);
        
        if (!movieElements || movieElements.length === 0) {
            throw new Error(`未找到${params.type === "nowplaying" ? "正在上映" : "即将上映"}的电影数据`);
        }
        
        const page = params.page || "1";
        const pagedItems = movieElements.slice((page - 1) * 10, page * 10);

        const movies = pagedItems
            .map(elementId => ({
                title: Widget.dom.attr(elementId, 'data-title'),
                doubanId: Widget.dom.attr(elementId, 'id')
            }))
            .filter(movie => movie.title && movie.doubanId);
        
        const moviePromises = movies.map(async (movie, index) => {
            try {
                const tmdbResult = await getTmdbDetail(movie.title, 'movie');
                if (tmdbResult) {
                    return { index, data: tmdbResult };
                }
                
                const doubanResult = await getDoubanDetail(movie.doubanId);
                if (doubanResult) {
                    return { index, data: doubanResult };
                }
                
                return { index, data: null };
            } catch (error) {
                console.log(`[电影查询] ${movie.title} 查询失败: ${error.message}`);
                return { index, data: null };
            }
        });

        const results = await Promise.all(moviePromises);
        
        const validMovies = results
            .sort((a, b) => a.index - b.index)
            .map(item => item.data)
            .filter(movie => movie !== null);
        
        if (validMovies.length === 0) {
            throw new Error("未能解析到有效的电影数据");
        }
        
        return validMovies;
    } catch (error) {
        console.error(`[电影列表] 获取${params.type === "nowplaying" ? "正在上映" : "即将上映"}电影失败:`, error);
        throw error;
    }
}


// 公共函数： 豆瓣 API 查询
async function getDoubanDetail(doubanId) {
    try {
        const api = `https://m.douban.com/rexxar/api/v2/movie/${doubanId}?ck=&for_mobile=1`;
        const response = await Widget.http.get(api, {
            headers: {
                "Referer": "https://movie.douban.com/"
            }
        });

        if (!response?.data) {
            return null;
        }

        const data = response.data;
        return {
            id: data.id,
            type: "douban",
            title: data.title,
            coverUrl: data.cover_url || "",
            description: data.intro || "暂无描述",
            releaseDate: data.pubdate?.[0] || "",
            previewUrl: data.trailers[0].video_url || "",
            durationText: data.durations[0] || "未知"
        };
    } catch (error) {
        console.log(`[豆瓣查询] 获取电影详情失败: ${error.message}`);
        return null;
    }
}

// 公共函数： TMDB API 查询
async function getTmdbDetail(title, mediaType) {
    if (!title?.trim() || !['tv', 'movie'].includes(mediaType)) {
        console.error("[TMDB查询] 参数错误：title 不能为空，mediaType 必须为 'tv' 或 'movie'");
        return null;
    }

    const token = TMDB_API_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzYmJjNzhhN2JjYjI3NWU2M2Y5YTM1MmNlMTk4NWM4MyIsInN1YiI6IjU0YmU4MTNlYzNhMzY4NDA0NjAwODZjOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.esM4zgTT64tFpnw9Uk5qwrhlaDUwtNNYKVzv_jNr390";
    const rawTitle = title.trim();
    const cleanTitle = cleanUpTitle(rawTitle);
    const api = `https://api.themoviedb.org/3/search/${mediaType}?query=${encodeURIComponent(cleanTitle)}&language=zh-CN`;

    try {
        const response = await Widget.http.get(api, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "accept": "application/json"
            }
        });

        const results = response.data?.results;
        if (!results?.length) {
            console.log(`[TMDB查询] 未找到标题为 ${rawTitle} 的数据`);
            return null;
        }

        const match = findBestMatch(results, cleanTitle.toLowerCase(), rawTitle.toLowerCase());
        console.log(`[TMDB查询] 匹配结果: ${rawTitle} => ${match.name || match.title}`);
        return formatResult(match, rawTitle);

    } catch (error) {
        console.error(`[TMDB查询] 请求失败:`, error);
        return null;
    }
}

// 清洗标题
function cleanUpTitle(title) {
    return title.replace(
        /(?:之[^·:：\---()\s]*|[·:：\---].*$|[（(][^）)]*[)）]|剧场版|特别篇|动态漫|中文配音|中配|粤语版|国语版|\s+[^\s]+篇|第[0-9一二三四五六七八九十]+季)/g,
        ''
    ).trim();
}

// 格式化 TMDB 返回数据
function formatResult(item, originalTitle) {
    return {
        id: String(item.id),
        type: "tmdb",
        title: originalTitle,
        coverUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
        description: item.overview || "暂无描述",
        releaseDate: item.first_air_date || item.release_date || ""
    };
}

// 匹配最佳结果
function findBestMatch(results, searchTitle, rawTitle) {
    const exact = results.find(item => {
        const name = (item.name || item.title || "").toLowerCase();
        const original = (item.original_name || item.original_title || "").toLowerCase();
        return name === searchTitle || original === searchTitle;
    });
    if (exact) return exact;

    let best = results[0], highest = -Infinity;
    for (const item of results) {
        const name = (item.name || item.title || "").toLowerCase();
        const original = (item.original_name || item.original_title || "").toLowerCase();
        const score = Math.max(
            getSimilarityScore(rawTitle, name),
            getSimilarityScore(rawTitle, original)
        );
        if (score > highest) {
            highest = score;
            best = item;
        }
    }
    return best;
}

// 相似度打分
function getSimilarityScore(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    let score = 0;

    if (b.includes(a)) score += 3;
    if (a.includes(b)) score += 2;

    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    const common = aWords.filter(w => bWords.includes(w)).length;

    score += common;
    score -= Math.abs(a.length - b.length) * 0.1;

    return score;
}