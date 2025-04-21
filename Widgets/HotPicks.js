var WidgetMetadata = {
  id: "hot_picks",
  title: "热门精选",
  description: "获取最新热播剧和热门影片推荐",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "实时榜单",
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
      title: "高分影片",
      description: "豆瓣高分电影推荐",
      requiresWebView: false,
      functionName: "getHighMovies",
      params: [
        {
          name: "region",
          title: "地区筛选",
          type: "enumeration",
          enumOptions: [
            { title: "全部地区", value: "全部" },
            { title: "华语电影", value: "华语" },
            { title: "欧美电影", value: "欧美" },
            { title: "韩国电影", value: "韩国" },
            { title: "日本电影", value: "日本" }
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
            { title: "全部地区", value: "全部" },
            { title: "华语电影", value: "华语" },
            { title: "欧美电影", value: "欧美" },
            { title: "韩国电影", value: "韩国" },
            { title: "日本电影", value: "日本" }
          ]
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
            { title: "全部地区", value: "tv" },
            { title: "国产剧", value: "tv_domestic" },
            { title: "欧美剧", value: "tv_american" },
            { title: "日剧", value: "tv_japanese" },
            { title: "韩剧", value: "tv_korean" },
            { title: "动画", value: "tv_animation" }
          ]
        }
      ]
    },
    {
      title: "年度榜单",
      description: "获取豆瓣2024年度电影榜单",
      requiresWebView: false,
      functionName: "getMovie2024",
      params: [
        {
          name: "id",
          title: "榜单选择",
          type: "enumeration",
          enumOptions: [
            { title: "评分最高华语电影", value: "478" },
            { title: "评分最高外语电影", value: "528" },
            { title: "年度冷门佳片", value: "529" },
            { title: "评分最高华语剧集", value: "545" },
            { title: "评分最高英美新剧", value: "547" },
            { title: "评分最高英美续订剧", value: "546" },
            { title: "最值得期待华语电影", value: "559" },
            { title: "最值得期待外语电影", value: "560" },
            { title: "最值得期待剧集", value: "561" },
            { title: "地区&类型电影", value: "563" },
            { title: "上映周年电影", value: "565" },
          ]
        },
        {
          name: "sub_id",
          title: "分类榜单",
          type: "enumeration",
          enumOptions: [
            { title: "豆瓣2024评分最高日本电影", value: "16065" },
            { title: "豆瓣2024评分最高韩国电影", value: "16066" },
            { title: "豆瓣2024评分最高喜剧片", value: "16067" },
            { title: "豆瓣2024评分最高爱情片", value: "16068" },
            { title: "豆瓣2024评分最高恐怖片", value: "16069" },
            { title: "豆瓣2024评分最高动画片", value: "16070" },
            { title: "豆瓣2024评分最高纪录片", value: "16071" }
          ],
          belongTo: {
            paramName: "id",
            value: ["563"]
          }
        },
        {
          name: "sub_id",
          title: "分类榜单",
          type: "enumeration",
          enumOptions: [
            { title: "豆瓣2024上映10周年电影", value: "16080" },
            { title: "豆瓣2024上映20周年电影", value: "16081" },
            { title: "豆瓣2024上映30周年电影", value: "16082" },
            { title: "豆瓣2024上映40周年电影", value: "16083" },
            { title: "豆瓣2024上映50周年电影", value: "16084" }
          ],
          belongTo: {
            paramName: "id",
            value: ["565"]
          }
        }
      ]
    },
    {
      title: "年度人物",
      description: "获取豆瓣2024年度人物榜单",
      requiresWebView: false,
      functionName: "getPreson2024",
      params: [
        {
          name: "id",
          title: "榜单筛选",
          type: "enumeration",
          enumOptions: [
            { title: "最受关注演员", value: "551" },
            { title: "最受关注导演", value: "552" },
            { title: "2024离开我们的人", value: "553" }
          ]
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
async function getDoubanMediaRecommendations(params = {}, mediaType, category) {
    try {
        if (!params.region) throw new Error("缺少必要参数：region");

        const baseUrl = 'https://m.douban.com/rexxar/api/v2/subject/recent_hot/';
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
        throw new Error(`获取推荐${mediaType === 'movie' ? '电影' : '剧集'}失败: ${error.message}`);
    }
}

// 获取豆瓣高分电影
async function getHighMovies(params = {}) {
    return getDoubanMediaRecommendations(params,'movie', '%E8%B1%86%E7%93%A3%E9%AB%98%E5%88%86');
}

// 获取推荐电影
async function getHotMovies(params = {}) {
    return getDoubanMediaRecommendations(params,'movie', '%E7%83%AD%E9%97%A8');
}

// 获取推荐剧集
async function getHotTv(params = {}) {
    return getDoubanMediaRecommendations(params, 'tv', 'tv');
}

// 获取年度榜单
async function getMovie2024(options = {}) {
  const id = options.id;
  const subId = options.sub_id;

  if (!id) throw new Error("缺少参数 id");

  try {
    const response = await Widget.http.get("https://movie.douban.com/j/neu/page/27/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://movie.douban.com/annual/2024/?fullscreen=1&dt_from=movie_navigation"
      }
    });

    const widgets = response.data.widgets;

    const widget = widgets.find(w => String(w.id) === String(id));
    if (!widget) throw new Error("未找到对应榜单");

    const sourceData = widget.source_data;

    if (Array.isArray(sourceData) && subId) {
      const matched = sourceData.find(group =>
        String(group.subject_collection?.id) === String(subId)
      );

      if (matched && matched.subject_collection_items) {
        return matched.subject_collection_items.map(item => ({
          id: item.id,
          type: "douban",
          title: item.title,
          coverUrl: item.cover_url
        }));
      } else {
        throw new Error("未找到匹配的子榜单");
      }
    }

    if (!sourceData || !sourceData.subject_collection_items) {
      throw new Error("榜单数据为空");
    }

    return sourceData.subject_collection_items.map(item => ({
      id: item.id,
      type: "douban",
      title: item.title,
      coverUrl: item.cover_url
    }));
  } catch (error) {
    throw new Error(`获取年度榜单失败: ${error.message}`);
  }
}

// 获取年度人物
async function getPreson2024(options = {}) {
  const id = options.id;

  if (!id) throw new Error("缺少参数 id");

  try {
    const response = await Widget.http.get("https://movie.douban.com/j/neu/page/27/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://movie.douban.com/annual/2024/?fullscreen=1&dt_from=movie_navigation"
      }
    });

    const widgets = response.data.widgets;

    const matched = widgets.find(widget => String(widget.id) === String(id));

    if (!matched || !Array.isArray(matched.source_data)) {
      throw new Error("未找到对应的年度人物数据");
    }

    return matched.source_data.map(item => ({
      id: item.id,
      type: "douban",
      title: item.title,
      description: item.desc,
      coverUrl: item.cover_url,
    }));
  } catch (error) {
    throw new Error(`获取年度人物失败: ${error.message}`);
  }
}