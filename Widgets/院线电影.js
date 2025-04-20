var WidgetMetadata = {
    id: "douban_movie_shanghai",
    title: "院线电影",
    description: "获取正在上映和即将上映的电影列表",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "正在上映",
            description: "获取当前正在上映的电影",
            requiresWebView: false,
            functionName: "getNowPlayingMovies",
            params: []
        },
        {
            title: "即将上映",
            description: "获取即将上映的电影及上映日期",
            requiresWebView: false,
            functionName: "getUpcomingMovies",
            params: []
        }
    ]
};

// 通用参数
const url = `https://movie.douban.com/cinema/nowplaying/shanghai/`;

// 正在上映处理函数
async function getNowPlayingMovies(params = {}) {
    try {
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://movie.douban.com/"
            }
        });

        if (!response?.data) throw new Error("无效响应");
        
        const docId = Widget.dom.parse(response.data);
        const movieElements = Widget.dom.select(docId, '#nowplaying .list-item');
        
        const movies = [];
        for (const elementId of movieElements) {
            movies.push({
                id: Widget.dom.attr(elementId, 'id') || 'unknown',
                type: "douban",
                title: Widget.dom.attr(elementId, 'data-title') || 'unknown',
                rating: Widget.dom.attr(elementId, 'data-score') || '暂无评分',
                description: Widget.dom.attr(elementId, 'data-region') || 'unknown',
                releaseDate: Widget.dom.attr(elementId, 'data-release') || 'unknown',
                durationText: Widget.dom.attr(elementId, 'data-duration') || '00:00',
                coverUrl: Widget.dom.attr(Widget.dom.selectFirst(elementId, '.poster img'), 'src') || ""
            });
        }

        return movies;

    } catch (error) {
        console.error("错误:", error);
        throw error;
    }
}

// 即将上映处理函数
async function getUpcomingMovies(params = {}) {
    try {
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://movie.douban.com/"
            }
        });

        if (!response?.data) throw new Error("无效响应");
        
        const docId = Widget.dom.parse(response.data);
        const movieElements = Widget.dom.select(docId, '#upcoming .list-item');
        
        const movies = [];
        for (const elementId of movieElements) {
            movies.push({
                id: Widget.dom.attr(elementId, 'id') || 'unknown',
                type: "douban",
                title: Widget.dom.attr(elementId, 'data-title') || 'unknown',
                description: Widget.dom.attr(elementId, 'data-region') || 'unknown',
                releaseDate: Widget.dom.text(Widget.dom.selectFirst(elementId, '.release-date')) || "待定",
                durationText: Widget.dom.attr(elementId, 'data-duration') || '00:00',
                coverUrl: Widget.dom.attr(Widget.dom.selectFirst(elementId, '.poster img'), 'src') || ""
            });
        }

        return movies;

    } catch (error) {
        console.error("错误:", error);
        throw error;
    }
}