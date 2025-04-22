var WidgetMetadata = {
  id: "hot_picks",
  title: "热门精选",
  description: "获取最新热播剧和热门影片推荐",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.0.4",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "实时榜单",
      functionName: "getTVRanking",
      requiresWebView: false,
      params: [
        {
          name: "platform",
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
      title: "高分影片",
      requiresWebView: false,
      functionName: "getHighMovies",
      params: [
        {
          name: "region",
          title: "地区",
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
      requiresWebView: false,
      functionName: "getHotMovies",
      params: [
        {
          name: "region",
          title: "地区",
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
      requiresWebView: false,
      functionName: "getHotTv",
      params: [
        {
          name: "region",
          title: "类型",
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
      requiresWebView: false,
      functionName: "getMovie2024",
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
            { title: "上映周年电影", value: "565" },
          ]
        },
        {
          name: "sub_id",
          title: "分类",
          type: "enumeration",
          enumOptions: [
            { title: "评分最高日本电影", value: "16065" },
            { title: "评分最高韩国电影", value: "16066" },
            { title: "评分最高喜剧片", value: "16067" },
            { title: "评分最高爱情片", value: "16068" },
            { title: "评分最高恐怖片", value: "16069" },
            { title: "评分最高动画片", value: "16070" },
            { title: "评分最高纪录片", value: "16071" }
          ],
          belongTo: {
            paramName: "id",
            value: ["563"]
          }
        },
        {
          name: "sub_id",
          title: "分类",
          type: "enumeration",
          enumOptions: [
            { title: "上映10周年电影", value: "16080" },
            { title: "上映20周年电影", value: "16081" },
            { title: "上映30周年电影", value: "16082" },
            { title: "上映40周年电影", value: "16083" },
            { title: "上映50周年电影", value: "16084" }
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
      requiresWebView: false,
      functionName: "getPerson2024",
      params: [
        {
          name: "id",
          title: "榜单",
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

// 匹配逻辑
function findBestMatch(title, results) {
    const cleanTitle = title.trim().toLowerCase();
    
    // 1. 精确匹配（中文名或原名）
    const exactMatch = results.find(item => 
        item.name?.toLowerCase() === cleanTitle ||
        item.original_name?.toLowerCase() === cleanTitle
    );
    if (exactMatch) {
        console.log(`[TMDB查询] 找到精确匹配: ${exactMatch.name}`);
        return exactMatch;
    }

    // 2. 选择发布时间最新的
    const sortedByDate = [...results].sort((a, b) => {
        const dateA = a.first_air_date ? new Date(a.first_air_date) : new Date(0);
        const dateB = b.first_air_date ? new Date(b.first_air_date) : new Date(0);
        return dateB - dateA;
    });
    const latestMatch = sortedByDate[0];
    if (latestMatch) {
        console.log(`[TMDB查询] 选择最新发布的: ${latestMatch.name} (发布日期: ${latestMatch.first_air_date})`);
        return latestMatch;
    }

    // 3. 最终兜底：选择第一个结果
    const firstMatch = results[0];
    console.log(`[TMDB查询] 选择默认结果: ${firstMatch.name}`);
    return firstMatch;
}

async function getTmdbId(title, options = {}) {
    if (!title?.trim()) {
        const errorMsg = "剧集标题不能为空";
        console.error(`[TMDB查询] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    try {
        const cleanTitle = title.trim().replace(/\s*第[一二三四五六七八九十]+季\s*$/, '');
        console.log(`[TMDB查询] 正在查询: ${cleanTitle}`);
        
        const api = `/search/tv?query=${encodeURIComponent(cleanTitle)}&language=zh-CN`;
        const response = await Widget.tmdb.get(api);
        
        if (!response?.results?.length) {
            const errorMsg = "未找到匹配的剧集";
            console.error(`[TMDB查询] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        const results = response.results;
        const bestMatch = findBestMatch(cleanTitle, results);
        
        if (!bestMatch) {
            const errorMsg = "未找到匹配的剧集";
            console.error(`[TMDB查询] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        console.log(`[TMDB查询] 最终选择: ${bestMatch.name} (ID: ${bestMatch.id}, 发布日期: ${bestMatch.first_air_date})`);
        return String(bestMatch.id);
    } catch (error) {
        console.error(`[TMDB查询] 查询失败: ${error.message}`);
        throw new Error(`TMDB查询失败: ${error.message}`);
    }
}

async function getTVRanking(params = {}) {
    try {
        console.log(`[猫眼榜单] 正在获取${params.platform || '全网'}榜单数据...`);
        
        const response = await Widget.http.get(`https://piaofang.maoyan.com/dashboard/webHeatData?seriesType=&platformType=${params.platform}&showDate=2&dateType=0&rankType=0` || '', {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            }
        });

        if (!response.data?.dataList?.list?.length) {
            const errorMsg = "API返回空数据";
            console.error(`[猫眼榜单] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        const results = [];
        let errorCount = 0;
        const totalItems = response.data.dataList.list.length;

        for (const item of response.data.dataList.list) {
            try {
                const title = item.seriesInfo?.name;
                if (!title) {
                    const errorMsg = "剧集标题缺失";
                    console.error(`[猫眼榜单] ${errorMsg}`);
                    throw new Error(errorMsg);
                }

                try {
                    const id = await getTmdbId(title);
                    results.push({
                        id,
                        type: "tmdb",
                        title
                    });
                } catch (tmdbError) {
                    if (!item.seriesInfo?.id) {
                        const errorMsg = `无法获取有效ID: ${tmdbError.message}`;
                        console.error(`[猫眼榜单] ${errorMsg}`);
                        throw new Error(errorMsg);
                    }
                }
            } catch (error) {
                errorCount++;
                console.error(`[猫眼榜单] 处理失败: ${error.message}`);
            }
        }

        if (results.length === 0) {
            const errorMsg = `所有剧集处理失败 (共${errorCount}项)`;
            console.error(`[猫眼榜单] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        console.log(`[猫眼榜单] 成功处理 ${results.length}/${totalItems} 个剧集`);
        return results;

    } catch (error) {
        console.error(`[猫眼榜单] 获取失败: ${error.message}`);
        throw new Error(`获取榜单失败: ${error.message}`);
    }
}

// 通用函数：获取豆瓣推荐影视数据
async function getDoubanMediaRecommendations(params = {}, mediaType, category) {
    try {
        if (!params.region) {
            const errorMsg = "缺少必要参数：region";
            console.error(`[豆瓣${mediaType === 'movie' ? '电影' : '剧集'}推荐] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        console.log(`[豆瓣${mediaType === 'movie' ? '电影' : '剧集'}推荐] 正在获取数据...`);
        
        const baseUrl = 'https://m.douban.com/rexxar/api/v2/subject/recent_hot/';
        const url = `${baseUrl}${mediaType}?category=${category}&type=${encodeURIComponent(params.region)}`;

        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://www.douban.com/"
            }
        });

        if (!response.data || !response.data.items) {
            const errorMsg = "数据格式不符合预期";
            console.error(`[豆瓣${mediaType === 'movie' ? '电影' : '剧集'}推荐] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        console.log(`[豆瓣${mediaType === 'movie' ? '电影' : '剧集'}推荐] 成功获取 ${response.data.items.length} 条数据`);

        return response.data.items.map((media) => ({
            id: media.id || "unknown_id",
            type: "douban",
            title: media.title || `未知${mediaType === 'movie' ? '电影' : '剧集'}`,
            coverUrl: media.pic?.large || "",
            description: media.card_subtitle || "暂无描述"
        }));

    } catch (error) {
        console.error(`[豆瓣${mediaType === 'movie' ? '电影' : '剧集'}推荐] 获取失败: ${error.message}`);
        throw new Error(`获取豆瓣${mediaType === 'movie' ? '电影' : '剧集'}推荐失败: ${error.message}`);
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

// 通用函数：获取豆瓣年度数据
async function getDoubanAnnualData(options = {}, dataType = 'movie') {
  const id = options.id;
  const subId = options.sub_id;

  if (!id) {
    const errorMsg = "缺少必要参数：id";
    console.error(`[${dataType === 'movie' ? '电影' : '人物'}年度数据] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    console.log(`[${dataType === 'movie' ? '电影' : '人物'}年度数据] 正在获取数据...`);
    
    const response = await Widget.http.get("https://movie.douban.com/j/neu/page/27/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://movie.douban.com/annual/2024/?fullscreen=1&dt_from=movie_navigation"
      }
    });

    const widgets = response.data.widgets;
    const matched = widgets.find(widget => String(widget.id) === String(id));

    if (!matched) {
      const errorMsg = "未找到对应的榜单数据";
      console.error(`[${dataType === 'movie' ? '电影' : '人物'}年度数据] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const sourceData = matched.source_data;

    if (dataType === 'movie' && Array.isArray(sourceData) && subId) {
      const matchedGroup = sourceData.find(group =>
        String(group.subject_collection?.id) === String(subId)
      );

      if (matchedGroup && matchedGroup.subject_collection_items) {
        console.log(`[电影年度数据] 成功获取 ${matchedGroup.subject_collection_items.length} 条数据`);
        return matchedGroup.subject_collection_items.map(item => ({
          id: item.id,
          type: "douban",
          title: item.title,
          coverUrl: item.cover_url
        }));
      } else {
        const errorMsg = "未找到匹配的子榜单";
        console.error(`[电影年度数据] ${errorMsg}`);
        throw new Error(errorMsg);
      }
    }

    if (dataType === 'movie' && (!sourceData || !sourceData.subject_collection_items)) {
      const errorMsg = "榜单数据为空";
      console.error(`[电影年度数据] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (dataType === 'person' && !Array.isArray(sourceData)) {
      const errorMsg = "数据格式错误";
      console.error(`[人物年度数据] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const items = dataType === 'movie' ? sourceData.subject_collection_items : sourceData;
    console.log(`[${dataType === 'movie' ? '电影' : '人物'}年度数据] 成功获取 ${items.length} 条数据`);

    return items.map(item => ({
      id: item.id,
      type: "douban",
      title: item.title,
      ...(dataType === 'person' && {
        description: item.desc,
        coverUrl: item.cover_url
      }),
      ...(dataType === 'movie' && {
        coverUrl: item.cover_url
      })
    }));
  } catch (error) {
    console.error(`[${dataType === 'movie' ? '电影' : '人物'}年度数据] 获取失败: ${error.message}`);
    throw new Error(`获取${dataType === 'movie' ? '电影' : '人物'}年度数据失败: ${error.message}`);
  }
}

// 获取年度榜单
async function getMovie2024(options = {}) {
  return getDoubanAnnualData(options, 'movie');
}

// 获取年度人物
async function getPerson2024(options = {}) {
  return getDoubanAnnualData(options, 'person');
}