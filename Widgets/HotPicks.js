const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

var WidgetMetadata = {
  id: "hot_picks",
  title: "热门精选",
  description: "获取最新热播剧和热门影片推荐",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.1.1",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "实时榜单",
      description: "实时热播剧榜单",
      requiresWebView: false,
      functionName: "getTVRanking",
      params: [
        {
          name: "seriesType",
          title: "类型",
          type: "enumeration",
          cacheDuration: 10800,
          enumOptions: [
            { title: "全部剧集", value: "" },
            { title: "电视剧", value: "0" },
            { title: "网络剧", value: "1" },
            { title: "综艺", value: "2" }
          ]
        },
        {
          name: "sort_by",
          title: "平台",
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
      title: "观影偏好",
      description: "根据个人偏好推荐影视作品",
      requiresWebView: false,
      functionName: "getPreferenceRecommendations",
      cacheDuration: 10800,
      params: [
        {
          name: "source",
          title: "来源",
          type: "enumeration",
          enumOptions: [
            { title: "豆瓣", value: "douban" },
            { title: "TMDB", value: "tmdb" }
          ]
        },
        {
          name: "mediaType",
          title: "类别",
          type: "enumeration",
          enumOptions: [
            { title: "剧集", value: "tv" },
            { title: "电影", value: "movie" }
          ]
        },
        {
          name: "genre",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "喜剧", value: "喜剧" },
            { title: "爱情", value: "爱情" },
            { title: "动作", value: "动作" },
            { title: "科幻", value: "科幻" },
            { title: "动画", value: "动画" },
            { title: "悬疑", value: "悬疑" },
            { title: "犯罪", value: "犯罪" },
            { title: "音乐", value: "音乐" },
            { title: "历史", value: "历史" },
            { title: "奇幻", value: "奇幻" },
            { title: "恐怖", value: "恐怖" },
            { title: "战争", value: "战争" },
            { title: "西部", value: "西部" },
            { title: "歌舞", value: "歌舞" },
            { title: "传记", value: "传记" },
            { title: "武侠", value: "武侠" },
            { title: "纪录片", value: "纪录片" },
            { title: "短片", value: "短片" },
            
          ]
        },
        {
          name: "region",
          title: "地区",
          type: "enumeration",
          enumOptions: [
            { title: "全部地区", value: "" },
            { title: "华语", value: "华语" },
            { title: "欧美", value: "欧美" },
            { title: "韩国", value: "韩国" },
            { title: "日本", value: "日本" },
            { title: "中国大陆", value: "中国大陆" },
            { title: "中国香港", value: "中国香港" },
            { title: "中国台湾", value: "中国台湾" },
            { title: "美国", value: "美国" },
            { title: "英国", value: "英国" },
            { title: "法国", value: "法国" },
            { title: "德国", value: "德国" },
            { title: "意大利", value: "意大利" },
            { title: "西班牙", value: "西班牙" },
            { title: "印度", value: "印度" },
            { title: "泰国", value: "泰国" }
          ]
        },
        {
          name: "year",
          title: "年份",
          type: "enumeration",
          enumOptions: [
            { title: "全部年份", value: "" },
            { title: "2025", value: "2025" },
            { title: "2024", value: "2024" },
            { title: "2023", value: "2023" },
            { title: "2022", value: "2022" },
            { title: "2021", value: "2021" },
            { title: "2020年代", value: "2020年代" },
            { title: "2010年代", value: "2010年代" },
            { title: "2000年代", value: "2000年代" }

          ]
        },
        {
          name: "sort_by",
          title: "排序",
          type: "enumeration",
          enumOptions: [
            { title: "综合排序", value: "T" },
            { title: "近期热度", value: "U" },
            { title: "首映时间", value: "R" },
            { title: "高分优选", value: "S" }
          ]
        },
        {
          name: "tags",
          title: "标签",
          type: "input",
          description: "设置自定义标签，例如：丧尸"  
        },
        {
          name: "rating",
          title: "评分",
          type: "input",
          description: "设置最低评分过滤，例如：6"  
        },
        {
          name: "offset",
          title: "起始位置",
          type: "offset"
        }
      ]
    },
    {
      title: "电影推荐",  
      description: "最近热门电影推荐",
      requiresWebView: false,
      functionName: "getHotMovies",
      cacheDuration: 3600,
      params: [
        {
          name: "source",
          title: "来源",
          type: "enumeration",
          enumOptions: [
            { title: "豆瓣", value: "douban" },
            { title: "TMDB", value: "tmdb" }
          ]
        },
        {
          name: "category",
          title: "类别",
          type: "enumeration",
          enumOptions: [
            { title: "热门电影", value: "" },
            { title: "最新电影", value: "最新" },
            { title: "豆瓣高分", value: "豆瓣高分" },
            { title: "冷门佳片", value: "冷门佳片" }
          ]
        },
        {
          name: "sort_by",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部电影", value: "全部" },
            { title: "华语电影", value: "华语" },
            { title: "欧美电影", value: "欧美" },
            { title: "韩国电影", value: "韩国" },
            { title: "日本电影", value: "日本" }
          ]
        },
        {
          name: "rating",
          title: "评分",
          type: "input",
          description: "设置最低评分过滤，例如：6"  
        },
        {
          name: "offset",
          title: "起始位置",
          type: "offset"
        }
      ]
    },
    {
      title: "剧集推荐",
      description: "最近热门剧集推荐",
      requiresWebView: false,
      functionName: "getHotTv",
      cacheDuration: 3600,
      params: [
        {
          name: "source",
          title: "来源",
          type: "enumeration",
          enumOptions: [
            { title: "豆瓣", value: "douban" },
            { title: "TMDB", value: "tmdb" }
          ]
        },
        {
          name: "sort_by",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部剧集", value: "tv" },
            { title: "国产剧", value: "tv_domestic" },
            { title: "欧美剧", value: "tv_american" },
            { title: "日剧", value: "tv_japanese" },
            { title: "韩剧", value: "tv_korean" },
            { title: "动画", value: "tv_animation" },
            { title: "纪录片", value: "tv_documentary" },
            { title: "国内综艺", value: "show_domestic" },
            { title: "国外综艺", value: "show_foreign" }
          ]
        },
        {
          name: "rating",
          title: "评分",
          type: "input",
          description: "设置最低评分过滤，例如：6"
        },
        {
          name: "offset",
          title: "起始位置",
          type: "offset"
        }
      ]
    },
    {
      title: "追番推荐",
      description: "最近热门番剧推荐",
      requiresWebView: false,
      functionName: "getHotAnime",
      cacheDuration: 3600,
      params: [
        {
          name: "type",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "正在热播", value: "V_CARD" },
            { title: "为你推荐", value: "COMMON_FEED" }
          ]
        },
        {
          name: "name",
          title: "名称",
          type: "enumeration",
          belongTo: {
            paramName: "type",
            value: ["COMMON_FEED"]
          },
          enumOptions: [
            { title: "番剧", value: "bangumi" },
            { title: "国创", value: "guochuang" }
          ]
        },
        {
          name: "offset",
          title: "起始位置",
          type: "offset"
        }
      ]
    },
    {
        title: "悬疑剧场",
        description: "获取白夜剧场剧集信息",
        requiresWebView: false,
        functionName: "getSuspenseTheater",
        cacheDuration: 86400,
        params: [
        {
            name: "type",
            title: "类别",
            type: "enumeration",
            description: "选择剧集上映时间",
            enumOptions: [
                { title: "即将上线", value: "coming_soon" },
                { title: "正在热播", value: "now_playing" }
            ]
        },
        {
            name: "sort_by",
            title: "类型",
            type: "enumeration",
            description: "选择要查看的剧场类型",
            enumOptions: [
                { title: "全部剧场", value: "all" },
                { title: "迷雾剧场", value: "迷雾剧场" },
                { title: "白夜剧场", value: "白夜剧场" },
                { title: "季风剧场", value: "季风剧场" },
                { title: "X剧场", value: "X剧场" }
            ]
        }
      ]
    },
    {
      title: "院线电影",
      description: "获取正在上映或即将上映的电影列表",
      requiresWebView: false,
      functionName: "getMovies",
      cacheDuration: 43200,
      params: [
        {
          name: "type",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { value: "nowplaying", title: "正在上映" },
            { value: "later", title: "即将上映" },
            { value: "todayRank", title: "今日票房" },
            { value: "historyRank", title: "历史票房" }
          ]
        },
        {
          name: "offset",
          title: "起始位置",
          type: "offset"
        }
      ]
    },
    {
      title: "本周榜单",
      description: "获取豆瓣本周榜单",
      requiresWebView: false,
      functionName: "getDoubanWeekly",
      cacheDuration: 10800,
      params: [
        {
          name: "type",
          title: "榜单类型",
          type: "enumeration",
          enumOptions: [
            { title: "一周口碑电影榜", value: "movie_weekly_best" },
            { title: "华语口碑剧集榜", value: "tv_chinese_best_weekly" },
            { title: "全球口碑剧集榜", value: "tv_global_best_weekly" },
            { title: "国内口碑综艺榜", value: "show_chinese_best_weekly" },
            { title: "国外口碑综艺榜", value: "show_global_best_weekly" }
          ]
        }
      ]
    },
    {
      title: "年度榜单",
      description: "获取豆瓣年度榜单",
      requiresWebView: false,
      functionName: "getDouban2024",
      cacheDuration: 86400,
      params: [
        {
          name: "id",
          title: "榜单",
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
            { title: "上映周年电影", value: "565" }
          ]
        },
        {
          name: "sub_id",
          title: "分类",
          type: "enumeration",
          belongTo: {
            paramName: "id",
            value: ["563"]
          },
          enumOptions: [
            { title: "评分最高日本电影", value: "16065" },
            { title: "评分最高韩国电影", value: "16066" },
            { title: "评分最高喜剧片", value: "16067" },
            { title: "评分最高爱情片", value: "16068" },
            { title: "评分最高恐怖片", value: "16069" },
            { title: "评分最高动画片", value: "16070" },
            { title: "评分最高纪录片", value: "16071" }
          ]
        },
        {
          name: "sub_id",
          title: "分类",
          type: "enumeration",
          description: "选择要查看的上映周年",
          belongTo: {
            paramName: "id",
            value: ["565"]
          },
          enumOptions: [
            { title: "上映10周年电影", value: "16080" },
            { title: "上映20周年电影", value: "16081" },
            { title: "上映30周年电影", value: "16082" },
            { title: "上映40周年电影", value: "16083" },
            { title: "上映50周年电影", value: "16084" }
          ]
        }
      ]
    }
  ]
};

// 实时榜单
async function getTVRanking(params = {}) {
    try {
        const today = new Date();
        const showDate = today.getFullYear() +
            String(today.getMonth() + 1).padStart(2, '0') +
            String(today.getDate()).padStart(2, '0');
        
        console.log(`[猫眼榜单] 正在获取${params.sort_by === '0' ? '全网' : `平台${params.sort_by}`}榜单数据...`);
        
        const response = await Widget.http.get(`https://piaofang.maoyan.com/dashboard/webHeatData?showDate=${showDate}&seriesType=${params.seriesType}&platformType=${params.sort_by}`, {
            headers: {
                "User-Agent": USER_AGENT,
                "referer": "https://piaofang.maoyan.com/dashboard/web-heat"
            }
        });

        if (!response || !response.data) throw new Error("获取数据失败");

        const maoyanList = response.data.dataList.list;
        const results = await Promise.all(
            maoyanList
                .filter(item => item.seriesInfo?.name)
                .map(async item => {
                    try {
                        return await getTmdbDetail(item.seriesInfo.name, 'tv');
                    } catch (error) {
                        console.log(`[猫眼榜单] 处理 '${item.seriesInfo.name}' 失败: ${error.message}`);
                        return null;
                    }
                })
        );

        const validResults = results.filter(Boolean);
        if (!validResults.length) throw new Error("所有剧集处理失败");

        console.log(`[猫眼榜单] 成功处理 ${validResults.length}/${maoyanList.length} 个剧集`);
        return validResults;

    } catch (error) {
        throw new Error(`获取榜单失败: ${error.message}`);
    }
}

// 观影偏好
async function getPreferenceRecommendations(params = {}) {
    try {
        const rating = params.rating || "0";
        if (!/^\d$/.test(String(rating))) throw new Error("评分必须为 0～9 的整数");

        const selectedCategories = {
            "类型": params.genre || "",
            "地区": params.region || ""
        };

        const tags_sub = [];
        if (params.genre) tags_sub.push(params.genre);
        if (params.region) tags_sub.push(params.region);
        if (params.year) {
            if (params.year.includes("年代")) {
                tags_sub.push(params.year);
            } else {
                tags_sub.push(`${params.year}年`);
            }
        }
        if (params.tags) {
            const customTagsArray = params.tags.split(',').filter(tag => tag.trim() !== '');
            tags_sub.push(...customTagsArray);
        }

        const limit = 20;
        const offset = Number(params.offset);
        const url = `https://m.douban.com/rexxar/api/v2/${params.mediaType}/recommend?refresh=0&start=${offset}&count=${Number(offset) + limit}&selected_categories=${encodeURIComponent(JSON.stringify(selectedCategories))}&uncollect=false&score_range=${rating},10&tags=${encodeURIComponent(tags_sub.join(","))}&sort=${params.sort_by}`;

        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://movie.douban.com/explore"
            }
        });

        if (!response.data?.items?.length) throw new Error("未找到匹配的影视作品");

        const validItems = response.data.items.filter(item => item.card === "subject");

        if (!validItems.length) throw new Error("未找到有效的影视作品");
        
        if (params.source === "douban") {
            return validItems.map(item => ({
                id: item.id,
                type: "douban",
                title: item.title,
                mediaType: params.mediaType
            }));
        } else {
            return await Promise.all(validItems.map(async item => {
                return await getTmdbDetail(item.title, params.mediaType);
            }));
        }

    } catch (error) {
        throw error;
    }
}


// 电影推荐
async function getHotMovies(params = {}) {
    return getDoubanRecs(params, 'movie');
}

// 剧集推荐
async function getHotTv(params = {}) {
    return getDoubanRecs(params, 'tv');
}

// 处理豆瓣推荐
async function getDoubanRecs(params = {}, mediaType) {
    try {
        const rating = params.rating || "0";
        if (!/^\d$/.test(String(rating))) throw new Error("评分必须为 0～9 的整数");
        
        const limit = 20;
        const offset = Number(params.offset);     
        const category = params.category != null ? params.category : "tv";        
        const url = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${mediaType}?start=${offset}&limit=${offset + limit}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(params.sort_by)}&score_range=${rating},10`;
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://movie.douban.com/explore"
            }
        });

        if (!response.data?.items?.length) throw new Error("数据格式不符合预期");

        if (params.source === "douban") {
            return response.data.items.map(item => ({
                id: item.id,
                type: "douban",
                title: item.title,
                mediaType: mediaType
            }));
        } else {
            const tmdbDetails = await Promise.all(response.data.items.map(async item => {
                return await getTmdbDetail(item.title, mediaType);
            }));
            // Filter out null values when source is tmdb
            return tmdbDetails.filter(detail => detail !== null);
        }

    } catch (error) {
        throw error;
    }
}


// 追番推荐
async function getHotAnime(params = {}) {
    const fetchChannelData = async (channel) => {
    const url = `https://api.bilibili.com/pgc/page/channel?page_name=m_station_${channel}`;
    try {
      const response = await Widget.http.get(url, {
        headers: { 
            "User-Agent": USER_AGENT,
            "Referer": "https://m.bilibili.com/" 
        }
      });

      const modules = response.data?.data?.modules;
      if (!Array.isArray(modules)) return [];

      const targetModule = modules.find(mod => mod.type === params.type);
      const items = targetModule?.module_data?.items || [];
      return items.map(item => ({ ...item, _source: channel }));
    } catch (err) {
      console.log(`获取 ${channel} 数据失败: ${err.message}`);
      return [];
    }
  };

  let items = [];

  if (params.type === "V_CARD") {
    const results = await Promise.all(["bangumi", "guochuang"].map(fetchChannelData));
    items = results.flat();
  } else if (params.type === "COMMON_FEED") {
    if (!params.name) throw new Error("为你推荐类型下必须指定 name 参数");
    items = await fetchChannelData(params.name);
  }

  if (!items.length) throw new Error("未获取到任何条目");
  
  const limit = 10;
  const offset = Number(params.offset);
  const pagedItems = items.slice(offset, offset + limit);

  const enriched = await Promise.all(
    pagedItems.map((item, index) =>
      getTmdbDetail(item.title, "tv")
        .then(data => data ? { ...data, originalIndex: index, source: item._source } : null)
        .catch(() => null)
    )
  );

  return enriched
    .filter(Boolean)
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(({ originalIndex, ...rest }) => rest);
}

// 悬疑剧场
async function getSuspenseTheater(params = {}) {
  try {
    const response = await Widget.http.get('https://raw.githubusercontent.com/2kuai/ForwardWidgets/main/data/theater-data.json', {
      headers: {
        "User-Agent": USER_AGENT
      }
    });
    
    if (!response?.data) throw new Error("获取剧场数据失败");
    
    const data = response.data;
    const sortBy = params.sort_by || "all"; // 默认全部剧场
    const type = params.type || "now_playing"; // 默认正在热播

    // 映射type参数到数据中的section
    const sectionMap = {
      "now_playing": "aired",
      "coming_soon": "upcoming"
    };
    const section = sectionMap[type] || "aired";

    // 处理全部剧场的情况
    let results = [];
    if (sortBy === "all") {
      // 合并所有剧场的对应section数据
      for (const theaterName of ["迷雾剧场", "白夜剧场", "季风剧场", "X剧场"]) {
        if (data[theaterName]?.[section]) {
          results.push(...data[theaterName][section].map(item => ({
            ...item,
            theater: theaterName // 添加剧场来源标识
          })));
        }
      }
    } else {
      // 单个剧场的情况
      if (!data[sortBy]) throw new Error(`未找到 ${sortBy} 数据`);
      if (!data[sortBy][section]) throw new Error(`${sortBy} 中没有 ${type} 数据`);
      
      results = data[sortBy][section].map(item => ({
        ...item,
        theater: sortBy // 添加剧场来源标识
      }));
    }

    // 返回所有数据（不再分页）
    return results;
    
  } catch (error) {
    console.error(`获取剧场数据失败: ${error.message}`);
    throw error;
  }
}


// 院线电影
async function getMovies(params = {}) {
  try {
    const type = params.type;
    
    // 处理票房榜单数据
    if (type === "historyRank") {
      return await getHistoryRank(params);
    } else if (type === "todayRank") {
      return await getTodayRank(params);
    }
    
    console.log(`开始获取${type === "later" ? "即将" : "正在"}上映的电影`);

    const response = await Widget.http.get('https://raw.githubusercontent.com/2kuai/ForwardWidgets/main/data/movies-data.json', {
      headers: {
        "User-Agent": USER_AGENT
      }
    });
    
    if (!response?.data) throw new Error("获取院线数据失败");

    const data = response.data;
    const movieType = type === "later" ? "later" : "nowplaying";
    
    if (!data[movieType]?.length) throw new Error(`未找到${type === "later" ? "即将" : "正在"}上映的电影`);
    
    const limit = 20;
    const offset = Number(params.offset);
    const results = data[movieType].slice(offset, offset + limit);
    
    if (!results.length) throw new Error("没有更多数据");
    
    return results;
  } catch (error) {
    console.error(`[电影列表] 获取失败: ${error.message}`);
    throw error;
  }
}

// 历史票房
async function getTodayRank(params = {}) {
  try {
    const response = await Widget.http.get("https://piaofang.maoyan.com/i/globalBox/todayRank", {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://piaofang.maoyan.com/i/globalBox/historyRank"
      }
    });
    
    // 解析HTML内容
    const $ = Widget.html.load(response.data);
    const movies = [];
    
    // 获取所有榜单项
    $(".movie-item").each((index, element) => {
      const $item = $(element);
      const title = $item.find(".movie-name").text().trim();
      const releaseYear = $item.find(".movie-year").text().trim();
      
      if (title) movies.push(`${title}（${releaseYear}）`);

    });
    
    // 分页处理
    const offset = Number(params.offset) || 0;
    const limit = 10;
    const paginatedMovies = movies.slice(offset, offset + limit);
    
    if (paginatedMovies.length === 0 && offset > 0) {
      throw new Error("没有更多数据");
    }
    
    // 获取 TMDB 详情（只返回 TMDB 数据）
    const tmdbResults = await Promise.all(
      paginatedMovies.map(async (movie) => {
        try {
          // 调用 getTmdbDetail，传入原始标题（如 "2029阿凡达"）
          const tmdbDetail = await getTmdbDetail(movie, "movie");
          
          if (tmdbDetail) {
            return tmdbDetail; // 直接返回 TMDB 数据
          }
          return null;
        } catch (error) {
          console.error(`获取电影[${movie.originalTitle}]详情失败:`, error);
          return null;
        }
      })
    ).then(results => results.filter(Boolean)); // 过滤掉 null 值
    
    return tmdbResults;
  } catch (error) {
    console.error("获取历史票房榜单失败:", error);
    throw error;
  }
}
async function getHistoryRank(params = {}) {
  try {
    const response = await Widget.http.get("https://piaofang.maoyan.com/i/globalBox/historyRank", {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://piaofang.maoyan.com/i/globalBox/historyRank"
      }
    });
    
    // 解析HTML内容
    const $ = Widget.html.load(response.data);
    const movies = [];
    
    // 获取所有榜单项
    $(".movie-item").each((index, element) => {
      const $item = $(element);
      const title = $item.find(".movie-name").text().trim();
      const releaseYear = $item.find(".movie-year").text().trim();
      
      if (title) movies.push(`${title}（${releaseYear}）`);

    });
    
    // 分页处理
    const offset = Number(params.offset) || 0;
    const limit = 10;
    const paginatedMovies = movies.slice(offset, offset + limit);
    
    if (paginatedMovies.length === 0 && offset > 0) {
      throw new Error("没有更多数据");
    }
    
    // 获取 TMDB 详情（只返回 TMDB 数据）
    const tmdbResults = await Promise.all(
      paginatedMovies.map(async (movie) => {
        try {
          // 调用 getTmdbDetail，传入原始标题（如 "2029阿凡达"）
          const tmdbDetail = await getTmdbDetail(movie, "movie");
          
          if (tmdbDetail) {
            return tmdbDetail; // 直接返回 TMDB 数据
          }
          return null;
        } catch (error) {
          console.error(`获取电影[${movie.originalTitle}]详情失败:`, error);
          return null;
        }
      })
    ).then(results => results.filter(Boolean)); // 过滤掉 null 值
    
    return tmdbResults;
  } catch (error) {
    console.error("获取历史票房榜单失败:", error);
    throw error;
  }
}


// 本周榜单
async function getDoubanWeekly(params = {}) {
  try {
    const url = `https://m.douban.com/rexxar/api/v2/subject_collection/${params.type}/items?updated_at&items_only=1&type_tag&for_mobile=1`;
    const response = await Widget.http.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "referer": `https://m.douban.com/subject_collection/${params.type}/`
      }
    });
    
    if (!response.data?.subject_collection_items?.length) throw new Error("无返回数据");
    
    return response.data.subject_collection_items.map(item => ({
      id: item.id,
      type: "douban",
      title: item.title,
      posterPath: item.poster_path || "",
      backdropPath: item.cover_url,
      description: item.description|| "暂无描述",
      mediaType: item.type,
      link: `https://movie.douban.com/subject/${item.id}/`
    }));
  } catch (error) {
    console.error(`获取榜单数据失败: ${error.message}`);
    throw error;
  }
}

// 年度榜单
async function getDouban2024(options = {}) {
  try {
    
    const response = await Widget.http.get("https://movie.douban.com/j/neu/page/27/", {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://movie.douban.com/annual/2024/?fullscreen=1&dt_from=movie_navigation"
      }
    });

    const matched = response.data.widgets?.find(widget => 
      String(widget.id) === String(options.id)
    );
    
    if (!matched?.source_data) throw new Error("未找到对应的榜单数据");

    const sourceData = matched.source_data;

    if (Array.isArray(sourceData) && options.sub_id) {
      const matchedGroup = sourceData.find(group => 
        String(group.subject_collection?.id) === String(options.sub_id)
      );

      if (!matchedGroup?.subject_collection_items?.length) {
        throw new Error("未找到匹配的子榜单数据");
      }

      return matchedGroup.subject_collection_items.map(item => ({
        id: item.id,
        type: "douban",
        title: item.title,
        coverUrl: item.cover_url, 
        rating: item.rating.value
      }));
    }

    if (!sourceData.subject_collection_items?.length) throw new Error("榜单数据为空");

    console.log('[电影年度数据] 成功获取数据');
    return sourceData.subject_collection_items.map(item => ({
      id: item.id,
      type: "douban",
      title: item.title,
      coverUrl: item.cover_url,
      rating: item.rating.value
    }));

  } catch (error) {
    console.error(`获取电影年度数据失败: ${error.message}`);
    throw error;
  }
}

// 通用剧名查询，例如：await getTmdbDetail("阿凡达（2019）", "movie")
const getTmdbDetail = async (title, mediaType) => {
  if (!title?.trim() || !['tv', 'movie'].includes(mediaType)) {
    console.error(`[TMDB] 参数错误: mediaType 必须为 'tv' 或 'movie'`);
    return null;
  }

  const yearMatch = title.match(/\b(19|20)\d{2}\b/)?.[0];

  const cleanTitle = title
    .replace(/([（(][^）)]*[)）])/g, '') // 移除中文括号及内容
    .replace(/剧场版|特别篇|动态漫|中文配音|中配|粤语版|国语版/g, '') // 移除不需要的部分
    .replace(/第[0-9一二三四五六七八九十]+季/g, '') // 移除季信息
    .trim();

  try {        
    const params = {
      query: cleanTitle,
      language: "zh_CN"
    };

    if (yearMatch) {
      params.year = yearMatch;
    }

    const response = await Widget.tmdb.get(`/search/${mediaType}`, {params});

    if (!response?.results?.length) {
      console.log(`[TMDB] 无返回数据`);
      return null;
    }

    const exactMatch = response.results.find(
      item => 
        (item.name === cleanTitle || item.title === cleanTitle) ||
        (item.original_name === cleanTitle || item.original_title === cleanTitle)
    );

    if (exactMatch) {
      return formatTmdbResult(exactMatch, mediaType);
    }

    return formatTmdbResult(response.results[0], mediaType);
  } catch (error) {
    console.error(`[TMDB] 请求失败: ${error.message}`);
    return null;
  }
};

// 辅助函数：格式化 TMDB 返回的结果
const formatTmdbResult = (item, mediaType) => ({
  id: item.id,
  type: "tmdb",
  title: item.name ?? item.title,
  description: item.overview,
  posterPath: item.poster_path,
  backdropPath: item.backdrop_path,
  releaseDate: item.first_air_date ?? item.release_date,
  rating: item.vote_average,
  mediaType: mediaType
});