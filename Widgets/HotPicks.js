// 填写你的 TMDB API 访问令牌
const TMDB_API_TOKEN = "";


var WidgetMetadata = {
  id: "hot_picks",
  title: "热门精选",
  description: "获取最新热播剧和热门影片推荐",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.0.5",
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
          enumOptions: [
            { title: "全部剧集", value: "" },
            { title: "电视剧", value: "0" },
            { title: "网络剧", value: "1" },
            { title: "综艺", value: "2" }
          ]
        },
        {
          name: "platform",
          title: "平台",
          type: "enumeration",
          enumOptions: [
            { title: "全网", value: "0" },
            { title: "优酷", value: "1" },
            { title: "爱奇艺", value: "2" },
            { title: "腾讯视频", value: "3" }
          ]
        }
      ]
    },
    {
      title: "观影偏好",
      description: "根据个人偏好推荐影视作品",
      requiresWebView: false,
      functionName: "getPreferenceRecommendations",
      params: [
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
          name: "sortBy",
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
          name: "rating",
          title: "评分",
          type: "input",
          description: "设置最低评分过滤，例如：6"  
        },
        {
          name: "page",
          title: "页码",
          type: "page"
        }
      ]
    },
    {
      title: "电影推荐",  
      description: "最近热门电影推荐",
      requiresWebView: false,
      functionName: "getHotMovies",
      params: [
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
          name: "type",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部地区", value: "全部" },
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
          name: "page",
          title: "页码",
          type: "page"
        }
      ]
    },
    {
      title: "剧集推荐",
      description: "最近热门剧集推荐",
      requiresWebView: false,
      functionName: "getHotTv",
      params: [
        {
          name: "type",
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
            { title: "全部综艺", value: "show" },
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
          name: "page",
          title: "页码",
          type: "page"
        }
      ]
    },
    {
      title: "追番推荐",
      description: "最近热门番剧推荐",
      requiresWebView: false,
      functionName: "getHotAnime",
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
          name: "page",
          title: "页码",
          type: "page"
        }
      ]
    },
    {
        title: "迷雾剧场",
        description: "获取迷雾剧场剧集信息",
        requiresWebView: false,
        functionName: "getMysteryTheater",
        params: [
            {
                name: "type",
                title: "类型",
                type: "enumeration",
                description: "选择要获取的剧集类型",
                value: "nowplaying",
                enumOptions: [
                    {
                        title: "正在热播",
                        value: "nowplaying"
                    },
                    {
                        title: "即将上线",
                        value: "upcoming"
                    }
                ]
            }
        ]
    },
    {
      title: "年度榜单",
      description: "获取豆瓣年度榜单",
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
    },
    {
      title: "年度人物",
      description: "获取豆瓣年度人物榜单",
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


// 实时榜单
async function getTVRanking(params = {}) {
    try {
        const today = new Date();
        const showDate = today.getFullYear() +
            String(today.getMonth() + 1).padStart(2, '0') +
            String(today.getDate()).padStart(2, '0');
        
        console.log(`[猫眼榜单] 正在获取${params.platform === '0' ? '全网' : `平台${params.platform}`}榜单数据...`);
        
        const response = await Widget.http.get(`https://piaofang.maoyan.com/dashboard/webHeatData?showDate=${showDate}&seriesType=${params.seriesType}&platformType=${params.platform}`, {
            headers: {
                "referer": "https://piaofang.maoyan.com/dashboard/web-heat"
            }
        });

        if (!response.data?.dataList?.list?.length) {
            throw new Error("API返回空数据");
        }

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
        if (!validResults.length) {
            throw new Error("所有剧集处理失败");
        }

        console.log(`[猫眼榜单] 成功处理 ${validResults.length}/${maoyanList.length} 个剧集`);
        return validResults;

    } catch (error) {
        throw new Error(`获取榜单失败: ${error.message}`);
    }
}

// 观影偏好
async function getPreferenceRecommendations(params = {}) {
    try {
        if (!/^\d$/.test(String(params.rating))) throw new Error("评分必须为 0～9 的整数");

        const selectedCategories = {
            "类型": params.genre || "",
            "地区": params.region || ""
        };

        const tags = [];
        if (params.genre) tags.push(params.genre);
        if (params.region) tags.push(params.region);
        if (params.year) {
            if (params.year.includes("年代")) {
                tags.push(params.year);
            } else {
                tags.push(`${params.year}年`);
            }
        }

        const url = `https://m.douban.com/rexxar/api/v2/${params.mediaType}/recommend?refresh=0&start=${(params.page - 1) * 20}&count=${params.page * 20}&selected_categories=${encodeURIComponent(JSON.stringify(selectedCategories))}&uncollect=false&score_range=${params.rating || 0},10&tags=${encodeURIComponent(tags.join(","))}&sort=${params.sortBy || "T"}`;

        const response = await Widget.http.get(url, {
            headers: {
                "Referer": "https://movie.douban.com/explore"
            }
        });

        if (!response.data?.items?.length) {
            throw new Error("未找到匹配的影视作品");
        }

        const validItems = response.data.items.filter(item => item.card === "subject");

        if (!validItems.length) {
            throw new Error("未找到有效的影视作品");
        }

        return validItems.map(item => ({
            id: item.id || "unknown_id",
            type: "douban",
            title: item.title || "未知标题",
            coverUrl: item.pic?.normal || "",
            description: item.card_subtitle || "暂无描述"
        }));

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

// 处理豆瓣推荐榜单
async function getDoubanRecs(params = {}, mediaType) {
    try {
        const page = params.page;
        const rating = params.rating || "0";
        if (!/^\d$/.test(String(rating))) throw new Error("评分必须为 0～9 的整数");
        
        const category = params.category != null ? params.category : "tv";        
        const url = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${mediaType}?start=${(page - 1) * 20}&limit=${page * 20}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(params.type)}&score_range=${rating},10`;
        const response = await Widget.http.get(url, {
            headers: {
                "Referer": "https://movie.douban.com/explore"
            }
        });

        if (!response.data?.items?.length) {
            throw new Error("数据格式不符合预期");
        }

        return response.data.items.map(media => ({
            id: media.id || "unknown_id",
            type: "douban",
            title: media.title || `未知剧名`
        }));

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
        headers: { Referer: "https://m.bilibili.com/" }
      });

      const modules = response.data?.data?.modules;
      if (!Array.isArray(modules)) return [];

      const targetModule = modules.find(mod => mod.type === params.type);
      const items = targetModule?.module_data?.items || [];
      return items.map(item => ({ ...item, _source: channel }));
    } catch (err) {
      console.warn(`获取 ${channel} 数据失败:`, err.message);
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

  const pagedItems = items.slice((params.page - 1) * 10, params.page * 10);

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

// 迷雾剧场
async function getMysteryTheater(params = {}) {
    try {
        const titles = await (async () => {
            if (params.type === 'nowplaying') {
                const response = await Widget.http.get('https://www.iqiyi.com/theater/2', {
                    headers: { "Referer": "https://www.iqiyi.com" }
                });

                const docId = Widget.dom.parse(response.data);
                const elements = Widget.dom.select(docId, '.qy-mod-list .qy-mod-li');

                if (!elements || elements.length === 0) {
                    throw new Error('未找到剧集列表元素');
                }

                return elements
                    .map(el => Widget.dom.text(el, '.link-txt'))
                    .map(title => (title || '').replace(/^[0-9]{4}\s*/, '').trim())
                    .filter(title => title);
            } else {
                const response = await Widget.http.get(
                    'https://pcw-api.iqiyi.com/strategy/pcw/data/themeTheaterComingBlock?entity_id=44311095112',
                    { headers: { "Referer": "https://www.iqiyi.com/theater/2" } }
                );

                const data = response.data;
                const isValid = !!(data && data.code === "A00000" && data.data?.formatData?.list);

                if (!isValid) {
                    throw new Error('API响应数据验证失败');
                }

                return data.data.formatData.list
                    .map(item => item.name)
                    .filter(title => title?.trim())
                    .map(title => title.trim());
            }
        })();

        if (!titles?.length) throw new Error("未获取到剧集列表");

        const tmdbPromises = titles.map(title => getTmdbDetail(title, 'tv'));
        const tmdbResults = await Promise.all(tmdbPromises);

        const results = tmdbResults
            .map((result, index) => result ? { ...result, originalIndex: index } : null)
            .filter(Boolean)
            .sort((a, b) => a.originalIndex - b.originalIndex)
            .map(({ originalIndex, ...rest }) => rest);

        if (!results.length) {
            throw new Error("未能获取到有效的剧集信息");
        }

        return results;
    } catch (error) {
        throw error;
    }
}

// 年度榜单
async function getMovie2024(options = {}) {
    return getDoubanAnnualData(options, 'movie');
}

// 年度人物
async function getPerson2024(options = {}) {
    return getDoubanAnnualData(options, 'person'); 
}

// 处理豆瓣年度数据
async function getDoubanAnnualData(options = {}, dataType = 'movie') {
    try {

        const typeName = dataType === 'movie' ? '电影' : '人物';
        console.log(`[${typeName}年度数据] 正在获取数据...`);
        
        const response = await Widget.http.get("https://movie.douban.com/j/neu/page/27/", {
            headers: {
                "Referer": "https://movie.douban.com/annual/2024/?fullscreen=1&dt_from=movie_navigation"
            }
        });

        const matched = response.data.widgets?.find(widget => String(widget.id) === String(options.id));
        if (!matched?.source_data) {
            throw new Error("未找到对应的榜单数据");
        }

        const sourceData = matched.source_data;

        if (dataType === 'movie' && Array.isArray(sourceData) && options.sub_id) {
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
                ...(item.desc && { description: item.desc })
            }));
        }

        const items = dataType === 'movie' ? sourceData.subject_collection_items : sourceData;
        if (!items?.length) {
            throw new Error("榜单数据为空");
        }

        console.log(`[${typeName}年度数据] 成功获取 ${items.length} 条数据`);
        return items.map(item => ({
            id: item.id,
            type: "douban",
            title: item.title,
            coverUrl: item.cover_url,
            ...(item.desc && { description: item.desc })
        }));

    } catch (error) {
        throw error;
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