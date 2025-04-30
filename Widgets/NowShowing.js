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

async function getTmdbDetail(title, mediaType) {
    if (!title?.trim()) {
        console.log("[TMDB查询] 错误：标题不能为空");
        return null;
    }

    if (!mediaType || !['tv', 'movie'].includes(mediaType)) {
        console.log("[TMDB查询] 错误：mediaType 必须为 'tv' 或 'movie'");
        return null;
    }

    try {
        let cleanTitle = title.trim().replace(/\s*第[0-9一二三四五六七八九十]+季\s*$/, '');
        const searchType = mediaType;
        const token = TMDB_API_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzYmJjNzhhN2JjYjI3NWU2M2Y5YTM1MmNlMTk4NWM4MyIsInN1YiI6IjU0YmU4MTNlYzNhMzY4NDA0NjAwODZjOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.esM4zgTT64tFpnw9Uk5qwrhlaDUwtNNYKVzv_jNr390";
        
        const api = `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(cleanTitle)}&language=zh-CN`;
        const response = await Widget.http.get(api, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "accept": "application/json"
            }
        });
        
        if (!response.data?.results?.length) {
            console.log(`[TMDB查询] 错误：未找到匹配 '${title.trim()}' 的${mediaType === 'movie' ? '电影' : '剧集'}`);
            return null;
        }

        const results = response.data.results;
        
        // 格式化结果函数
        const formatResult = (item) => ({
            id: String(item.id),
            type: "tmdb",
            title: title.trim(),
            coverUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
            description: item.overview || "暂无描述",
            releaseDate: item.first_air_date || item.release_date || ""
        });
        
        // 1. 精确匹配（中文名或原名）
        const exactMatch = results.find(item => {
            const itemTitle = (item.name || item.title || "").toLowerCase();
            const itemOriginalTitle = (item.original_name || item.original_title || "").toLowerCase();
            const searchTitle = cleanTitle.toLowerCase();
            return itemTitle === searchTitle || itemOriginalTitle === searchTitle;
        });
        
        if (exactMatch) {
            console.log(`[TMDB查询] 找到精确匹配: ${exactMatch.name || exactMatch.title}`);
            return formatResult(exactMatch);
        }

        // 2. 选择发布时间最新的
        const sortedByDate = [...results].sort((a, b) => {
            const dateA = a.first_air_date || a.release_date ? new Date(a.first_air_date || a.release_date) : new Date(0);
            const dateB = b.first_air_date || b.release_date ? new Date(b.first_air_date || b.release_date) : new Date(0);
            return dateB - dateA;
        });
        
        const latestMatch = sortedByDate[0];
        console.log(`[TMDB查询] 选择最新发布的: ${latestMatch.name || latestMatch.title}`);
        return formatResult(latestMatch);

    } catch (error) {
        console.log(`[TMDB查询] 查询 '${title}' 时发生错误: ${error.message}`);
        return null;
    }
}


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

// 通用电影获取函数
async function getMovies(params = {}) {
    try {
        console.log(`[电影列表] 开始获取${params.type === "nowplaying" ? "正在上映" : "即将上映"}的电影`);
        
        const response = await Widget.http.get("https://movie.douban.com/cinema/nowplaying/shanghai/", {
            headers: {
                "Referer": "https://movie.douban.com/"
            }
        });
        
        if (!response?.data) {
            throw new Error("获取电影数据失败");
        }
        
        const docId = Widget.dom.parse(response.data);
        const selector = params.type === "nowplaying" ? '#nowplaying .list-item' : '#upcoming .list-item';
        const movieElements = Widget.dom.select(docId, selector);
        
        if (!movieElements || movieElements.length === 0) {
            throw new Error(`未找到${params.type === "nowplaying" ? "正在上映" : "即将上映"}的电影数据`);
        }
        
        // 获取前20个电影
        const movies = movieElements
            .map(elementId => ({
                title: Widget.dom.attr(elementId, 'data-title'),
                doubanId: Widget.dom.attr(elementId, 'id')
            }))
            .filter(movie => movie.title && movie.doubanId)
            .slice(0, 20);
        
        // 使用 map 保持顺序，同时进行并发查询
        const moviePromises = movies.map(async (movie, index) => {
            try {
                // 首先尝试 TMDB
                const tmdbResult = await getTmdbDetail(movie.title, 'movie');
                if (tmdbResult) {
                    return { index, data: tmdbResult };
                }
                
                // TMDB 失败后尝试豆瓣
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

        // 等待所有查询完成
        const results = await Promise.all(moviePromises);
        
        // 按原始顺序排序并过滤掉失败的结果
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