var WidgetMetadata = {
    id: "hot_picks",
    title: "热门精选",
    description: "获取最新热播剧和热门影片推荐",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets", 
    version: "1.0.0",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "实时榜单", // 热播剧
            description: "预置平台",
            functionName: "getTVRanking",
            requiresWebView: false,
            params: [
                {   
                    name: "platform",
                    title: "数据源",
                    type: "enumeration",
                    enumOptions: [
                        { title: "全网", value: "0" },
                        { title: "优酷", value: "1" },
                        { title: "爱奇艺", value: "2" },
                        { title: "腾讯视频", value: "3" },
                        { title: "乐视视频", value: "4" },
                        { title: "搜狐视频", value: "5" },
                        { title: "PPTV", value: "6" },
                        { title: "芒果TV", value: "7" }
                    ]
                }
            ]
        },
        {
            title: "电影推荐",
            description: "豆瓣热门电影推荐",
            requiresWebView: false,
            functionName: "getHotMovies",
            params: [
                {
                    name: "region",
                    title: "地区筛选",
                    type: "enumeration",
                    enumOptions: [
                        {title: "全部地区",value: "全部"},
                        {title: "华语电影",value: "华语"},
                        {title: "欧美电影",value: "欧美"},
                        {title: "韩国电影",value: "韩国"},
                        {title: "日本电影",value: "日本"}
                    ],
                }
            ]
        },
        {
            title: "剧集推荐",
            description: "豆瓣热门剧集推荐",
            requiresWebView: false,
            functionName: "getHotTv",
            params: [
                {
                    name: "region",
                    title: "地区筛选",
                    type: "enumeration",
                    enumOptions: [
                        {title: "全部地区",value: "tv"},
                        {title: "国产剧",value: "tv_domestic"},
                        {title: "欧美剧",value: "tv_american"},
                        {title: "日剧",value: "tv_japanese"},
                        {title: "韩剧",value: "tv_korean"},
                        {title: "动画",value: "tv_animation"}
                    ],
                }
            ]
        }
    ]
};

async function getTmdbId(title, options = {}) {
    if (!title?.trim()) throw new Error('剧集标题不能为空');

    try {
        // 清洗剧集名称
        const cleanTitle = title.trim().replace(/\s*第[一二三四五六七八九十]+季\s*$/, '');
        
        const api = `/search/tv?query=${encodeURIComponent(cleanTitle)}&language=zh-CN`;

        const response = await Widget.tmdb.get(api);
        console.log(response);
        if (!response?.results?.length) throw new Error('TMDB数据有误');

        // 使用清洗后的标题进行匹配
        const results = response.results;
        const bestMatch = findBestMatch(cleanTitle, results);
        
        return String(bestMatch.id);
    } catch (error) {
        throw new Error(`TMDB查询失败: ${error.message}`);
    }
}

// 匹配逻辑
function findBestMatch(title, results) {
    const cleanTitle = title.trim().toLowerCase();

    // 1. 精确匹配标题（中文名或原名）
    const exactMatch = results.find(item => 
        item.name?.toLowerCase() === cleanTitle ||
        item.original_name?.toLowerCase() === cleanTitle
    );
    if (exactMatch) return exactMatch;

    // 2. 模糊匹配（包含关键词）
    const fuzzyMatch = results.find(item => 
        item.name?.toLowerCase().includes(cleanTitle) ||
        item.original_name?.toLowerCase().includes(cleanTitle)
    );
    if (fuzzyMatch) return fuzzyMatch;

    // 3. 最终兜底：选择TMDB默认排序的第一个结果
    return results[0];
}

async function getTVRanking(params = {}) {
    try {
        const response = await Widget.http.get(`https://piaofang.maoyan.com/dashboard/webHeatData?seriesType=&platformType=${params.platform}&showDate=2&dateType=0&rankType=0` || '', {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            }
        });

        if (!response.data?.dataList?.list?.length) {
            throw new Error("猫眼API返回空数据");
        }

        const results = [];
        let errorCount = 0;

        for (const item of response.data.dataList.list) {
            try {
                const title = item.seriesInfo?.name;
                if (!title) throw new Error('猫眼剧集标题缺失');

                try {
                    const id = await getTmdbId(title);
                    results.push({
                        id,
                        type: "tmdb",
                        title
                    });
                } catch (tmdbError) {
                    if (!item.seriesInfo?.id) {
                        throw new Error(`无法获取有效ID: ${tmdbError.message}`);
                    }
                }
            } catch (error) {
                errorCount++;
                throw new Error(`处理剧集失败: ${error.message}`);
            }
        }

        if (results.length === 0) {
            throw new Error(`所有剧集处理失败 (共${errorCount}项)`);
        }

        return results;

    } catch (error) {
        throw new Error(`获取榜单失败: ${error.message}`);
    }
}

// 通用函数：获取豆瓣推荐影视数据
async function getDoubanMediaRecommendations(params = {}, mediaType) {
    try {
        if (!params.region) throw new Error("缺少必要参数：region");

        const baseUrl = 'https://m.douban.com/rexxar/api/v2/subject/recent_hot/';
        const category = mediaType === 'movie' ? '%E7%83%AD%E9%97%A8' : 'tv';
        const url = `${baseUrl}${mediaType}?category=${category}&type=${encodeURIComponent(params.region)}`;

        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://www.douban.com/"
            }
        });

        if (!response.data || !response.data.items) {
            throw new Error("无效响应：数据格式不符合预期");
        }
        console.log("请求结果:", response.data.items);

        return response.data.items.map((media) => ({
            id: media.id || "unknown_id",
            type: "douban",
            title: media.title || `未知${mediaType === 'movie' ? '电影' : '剧集'}`,
            coverUrl: media.pic?.large || "",
            description: media.card_subtitle || "暂无描述"
        }));

    } catch (error) {
        console.error(`获取推荐${mediaType === 'movie' ? '电影' : '剧集'}失败:`, error);
        throw new Error(`获取推荐${mediaType === 'movie' ? '电影' : '剧集'}失败: ${error.message}`);
    }
}

// 获取推荐电影
async function getHotMovies(params = {}) {
    return getDoubanMediaRecommendations(params, 'movie');
}

// 获取推荐剧集
async function getHotTv(params = {}) {
    return getDoubanMediaRecommendations(params, 'tv');
}