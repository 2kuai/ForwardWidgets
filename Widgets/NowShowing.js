var WidgetMetadata = {
    id: "now_showing",
    title: "院线电影",
    description: "获取正在热映和即将上映的电影信息",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.0.1",
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

// 获取 TMDB 电影详情
async function getTmdbMovieDetails(title) {
    try {
        const response = await Widget.tmdb.get(`/search/movie?query=${encodeURIComponent(title)}&language=zh-CN`);
        if (!response?.results?.length) return null;
        
        const results = response.results;
        const cleanTitle = title.trim().toLowerCase();
        
        // 1. 精确匹配（中文名或原名）
        const exactMatch = results.find(item => 
            item.title?.toLowerCase() === cleanTitle ||
            item.original_title?.toLowerCase() === cleanTitle
        );
        if (exactMatch) {
            console.log(`[TMDB查询] 找到精确匹配: ${exactMatch.title}`);
            return formatTmdbMovie(exactMatch);
        }

        // 2. 选择发布时间最新的
        const sortedByDate = [...results].sort((a, b) => {
            const dateA = a.release_date ? new Date(a.release_date) : new Date(0);
            const dateB = b.release_date ? new Date(b.release_date) : new Date(0);
            return dateB - dateA;
        });
        const latestMatch = sortedByDate[0];
        if (latestMatch) {
            console.log(`[TMDB查询] 选择最新发布的: ${latestMatch.title} (发布日期: ${latestMatch.release_date})`);
            return formatTmdbMovie(latestMatch);
        }

        // 3. 最终兜底：选择第一个结果
        const firstMatch = results[0];
        console.log(`[TMDB查询] 选择默认结果: ${firstMatch.title}`);
        return formatTmdbMovie(firstMatch);

    } catch (error) {
        console.error(`获取 TMDB 电影详情失败: ${title}`, error);
        return null;
    }
}

// 格式化 TMDB 电影数据
function formatTmdbMovie(movie) {
    return {
        id: movie.id.toString(),
        type: "tmdb",
        title: movie.title,
        coverUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
        durationText: movie.runtime ? `${Math.floor(movie.runtime / 60)}:${(movie.runtime % 60).toString().padStart(2, '0')}` : "00:00",
        description: movie.overview || "暂无简介",
        rating: movie.vote_average ? movie.vote_average.toFixed(1) : "暂无评分",
        releaseDate: movie.release_date || "待定",
        originalTitle: movie.original_title,
        backdropPath: movie.backdrop_path ? `https://image.tmdb.org/t/p/w500${movie.backdrop_path}` : "",
        genreIds: movie.genre_ids
    };
}

// 通用电影获取函数
async function getMovies(params = {}) {
    try {
        const response = await Widget.http.get("https://movie.douban.com/cinema/nowplaying/shanghai/", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
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
        
        // 并发获取所有 TMDB 数据
        const tmdbPromises = movieElements.map(async (elementId) => {
            const title = Widget.dom.attr(elementId, 'data-title');
            if (!title) return null;
            
            // 获取 TMDB 详细信息
            console.log(`Fetching TMDB for: ${title}`);
            const tmdbDetails = await getTmdbMovieDetails(title);
            if (tmdbDetails) {
                return tmdbDetails;
            }
            return null;
        });

        // 等待所有 TMDB 请求完成
        const results = await Promise.all(tmdbPromises);
        const validMovies = results.filter(movie => movie !== null);
        
        if (validMovies.length === 0) {
            throw new Error("未能解析到有效的电影数据");
        }

        return validMovies;

    } catch (error) {
        console.error(`获取${params.type === "nowplaying" ? "正在上映" : "即将上映"}电影失败:`, error);
        throw error;
    }
}