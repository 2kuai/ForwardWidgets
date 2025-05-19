const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

var WidgetMetadata = {
  id: "hot_picks",
  title: "热门精选",
  description: "获取最新热播剧和热门影片推荐",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.0.9",
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
            name: "category",
            title: "类型",
            type: "enumeration",
            description: "选择要查看的剧场类型",
            belongTo: {
              paramName: "type",
              value: ["now_playing"]
            },
            enumOptions: [
                { title: "迷雾剧场", value: "迷雾剧场" },
                { title: "白夜剧场", value: "白夜剧场" },
                { title: "季风剧场", value: "季风剧场" },
                { title: "X剧场", value: "X剧场" },
                // { title: "生花剧场", value: "生花剧场" }
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
      title: "院线电影",
      description: "获取正在上映或即将上映的电影列表",
      requiresWebView: false,
      functionName: "getMovies",
      params: [
        {
          name: "type",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { value: "nowplaying", title: "正在上映" },
            { value: "later", title: "即将上映" }
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
        
        console.log(`[猫眼榜单] 正在获取${params.platform === '0' ? '全网' : `平台${params.platform}`}榜单数据...`);
        
        const response = await Widget.http.get(`https://piaofang.maoyan.com/dashboard/webHeatData?showDate=${showDate}&seriesType=${params.seriesType}&platformType=${params.platform}`, {
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
        const url = `https://m.douban.com/rexxar/api/v2/${params.mediaType}/recommend?refresh=0&start=${offset}&count=${Number(offset) + limit}&selected_categories=${encodeURIComponent(JSON.stringify(selectedCategories))}&uncollect=false&score_range=${rating},10&tags=${encodeURIComponent(tags_sub.join(","))}&sort=${params.sortBy}`;

        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://movie.douban.com/explore"
            }
        });

        if (!response.data?.items?.length) throw new Error("未找到匹配的影视作品");

        const validItems = response.data.items.filter(item => item.card === "subject");

        if (!validItems.length) throw new Error("未找到有效的影视作品");

        return validItems.map(item => ({
            id: item.id || "",
            type: "douban",
            title: item.title || "未知标题",
            coverUrl: item.pic?.normal || "",
            mediaType: params.mediaType
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

// 处理豆瓣推荐
async function getDoubanRecs(params = {}, mediaType) {
    try {
        const rating = params.rating || "0";
        if (!/^\d$/.test(String(rating))) throw new Error("评分必须为 0～9 的整数");
        
        const limit = 20;
        const offset = Number(params.offset);     
        const category = params.category != null ? params.category : "tv";        
        const url = `https://m.douban.com/rexxar/api/v2/subject/recent_hot/${mediaType}?start=${offset}&limit=${offset + limit}&category=${encodeURIComponent(category)}&type=${encodeURIComponent(params.type)}&score_range=${rating},10`;
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://movie.douban.com/explore"
            }
        });

        if (!response.data?.items?.length) throw new Error("数据格式不符合预期");

        return response.data.items.map(media => ({
            id: media.id || "",
            type: "douban",
            title: media.title || "",
            mediaType
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
    const titles = await (async () => {
      if (params.type === 'now_playing') {
        if (params.category === "迷雾剧场") {
          const response = await Widget.http.get('https://www.iqiyi.com/theater/2', {
            headers: { 
              "User-Agent": USER_AGENT,
              "Referer": "https://www.iqiyi.com"
            }
          });
          
          if (!response?.data) throw new Error("获取数据失败");
          
          const $ = Widget.html.load(response.data);
          if (!$) throw new Error("解析 HTML 失败");
          
          const elements = $('.qy-mod-list .qy-mod-li');
          if (!elements?.length) throw new Error('未找到剧集列表元素');
          
          return elements
            .map((_, el) => $(el).find('.link-txt').text())
            .toArray()
            .map(title => (title || '').replace(/^[0-9]{4}\s*/, '').trim())
            .filter(Boolean);
        }
        
        if (params.category === "白夜剧场" || params.category === "生花剧场") {
          const title = encodeURIComponent("优酷剧场");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=${params.category === "白夜剧场" ? 2 : 1}`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });
          
          if (!response?.data?.parse?.text?.["*"]) throw new Error("获取维基百科数据失败");
          
          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$) throw new Error("解析 HTML 失败");
          
          const dramaList = [];
          $('.div-col ul li').each((index, element) => {
            const liText = $(element).text().trim();
            if (liText.startsWith('待定：')) return;
            const match = liText.match(/《([^》]+)》/);
            if (match && match[1]) {
              dramaList.push(match[1].trim());
            }
          });
          
          return dramaList.reverse();
        }
        
        if (params.category === "季风剧场") {
          const title = encodeURIComponent("芒果季风计划");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=2`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });
          
          if (!response?.data?.parse?.text?.["*"]) throw new Error("获取维基百科数据失败");
          
          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$) throw new Error("解析 HTML 失败");
          
          const playingDramas = [];
          
          $('table.wikitable').each((tableIndex, table) => {
            let isPendingSection = false;
            
            $(table).find('tr').each((rowIndex, row) => {
              const $tds = $(row).find('td');
              
              if ($tds.length > 0) {
                const rowText = $(row).text().trim();
                
                if (rowText.includes('待播映')) {
                  isPendingSection = true;
                  return;
                }
                
                if (!isPendingSection) {
                  if (rowIndex > 0) {
                    const $firstTd = $tds.eq(0);
                    const $link = $firstTd.find('a').first();
                    
                    if ($link.length) {
                      const title = $link.text().trim();
                      if (title) {
                        playingDramas.push(title);
                      }
                    }
                  }
                }
              }
            });
          });
          
          try {
            const networkUrl = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=3`;
            const networkResponse = await Widget.http.get(networkUrl, {
              headers: {
                "User-Agent": USER_AGENT,
                "Accept": "application/json"
              }
            });
            
            if (networkResponse?.data?.parse?.text?.["*"]) {
              const $network = Widget.html.load(networkResponse.data.parse.text["*"]);
              
              $network('table.wikitable tr').each((i, row) => {
                const $tds = $network(row).find('td');
                
                if ($tds.length >= 2 && i > 0) {
                  const status = $tds.eq(1).text().trim();
                  
                  if (status.includes('播映完毕')) {
                    const $link = $tds.eq(0).find('a').first();
                    if ($link.length) {
                      const title = $link.text().trim();
                      if (title) {
                        playingDramas.push(title);
                      }
                    }
                  }
                }
              });
            }
          } catch (error) {
            console.error("获取网络剧数据失败:", error.message);
          }
          
          return playingDramas;
        }
        
        if (params.category === "X剧场") {
          const title = encodeURIComponent("X剧场");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=1`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });

          if (!response?.data?.parse?.text?.["*"]) {
            throw new Error("获取维基百科数据失败");
          }

          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$ || !$('table.wikitable').length) {
            throw new Error("未找到目标表格");
          }

          const dramaList = [];
          const $table = $('table.wikitable').first();

          $table.find('tr').each((index, row) => {
            if (index === 0) return;
            const $cells = $(row).find('td');
            if ($cells.length < 2) return;
            const dateText = $cells.eq(0).text().trim();
            if (/待公布/.test(dateText)) return;
            const $nameLink = $cells.eq(1).find('a').first();
            if (!$nameLink.length) return;
            const dramaName = $nameLink
              .clone()
              .children()
              .end()
              .text()
              .replace(/[《》\s]+/g, ' ')
              .trim();
            if (dramaName) {
              dramaList.push(dramaName);
            }
          });

          return dramaList.length ? dramaList.reverse() : [];
        }
        
        return null;
      } else {
        async function fetchPendingDramas() {
          const title = encodeURIComponent("优酷剧场");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=2`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });

          if (!response?.data?.parse?.text?.["*"]) throw new Error("获取维基百科数据失败");

          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$) throw new Error("解析 HTML 失败");

          const pendingDramas = [];
          $('.div-col ul li').each((index, element) => {
            const liText = $(element).text().trim();
            if (liText.startsWith('待定：')) {
              const match = liText.match(/待定：《([^》]+)》/);
              if (match && match[1]) {
                pendingDramas.push(match[1].trim());
              }
            }
          });

          return pendingDramas;
        }

        async function fetchMistDramas() {
          const title = encodeURIComponent("迷雾剧场");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=3`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });

          if (!response?.data?.parse?.text?.["*"]) throw new Error("获取维基百科数据失败");

          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$) throw new Error("解析 HTML 失败");

          const mistDramas = [];
          $('.wikitable tbody tr').each((index, element) => {
            if (index === 0) return;
            const $td = $(element).find('td').first();
            const titleText = $td.text().trim();
            const match = titleText.match(/《([^》]+)》/);
            if (match && match[1]) {
              mistDramas.push(match[1].trim());
            }
          });

          return mistDramas;
        }

        async function fetchSeasonWindDramas() {
          const title = encodeURIComponent("芒果季风计划");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=2`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });

          if (!response?.data?.parse?.text?.["*"]) throw new Error("获取维基百科数据失败");

          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$) throw new Error("解析 HTML 失败");

          const pendingDramas = [];

          $('table.wikitable').each((tableIndex, table) => {
            let isPendingSection = false;
            
            $(table).find('tr').each((rowIndex, row) => {
              const $tds = $(row).find('td');
              
              if ($tds.length > 0) {
                const rowText = $(row).text().trim();
                
                if (rowText.includes('待播映')) {
                  isPendingSection = true;
                }
                
                if (isPendingSection) {
                  const $firstTd = $tds.eq(0);
                  const $link = $firstTd.find('a').first();
                  
                  if ($link.length) {
                    const title = $link.text().trim();
                    if (title) {
                      pendingDramas.push(title);
                    }
                  }
                }
              }
            });
          });
          
          try {
            const networkUrl = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=3`;
            const networkResponse = await Widget.http.get(networkUrl, {
              headers: {
                "User-Agent": USER_AGENT,
                "Accept": "application/json"
              }
            });
            
            if (networkResponse?.data?.parse?.text?.["*"]) {
              const $network = Widget.html.load(networkResponse.data.parse.text["*"]);
              
              $network('table.wikitable tr').each((i, row) => {
                const $tds = $network(row).find('td');
                
                if ($tds.length >= 2) {
                  const status = $tds.eq(1).text().trim();
                  
                  if (status.includes('待播映')) {
                    const $link = $tds.eq(0).find('a').first();
                    if ($link.length) {
                      const title = $link.text().trim();
                      if (title) {
                        pendingDramas.push(title);
                      }
                    }
                  }
                }
              });
            }
          } catch (error) {
            console.error("获取网络剧数据失败:", error.message);
          }

          return pendingDramas;
        }

        async function fetchXTheaterDramas() {
          const title = encodeURIComponent("X剧场");
          const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=1`;
          const response = await Widget.http.get(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Accept": "application/json"
            }
          });

          if (!response?.data?.parse?.text?.["*"]) throw new Error("获取维基百科数据失败");

          const $ = Widget.html.load(response.data.parse.text["*"]);
          if (!$ || !$('table.wikitable').length) throw new Error("未找到目标表格");

          const pendingDramas = [];
          const $table = $('table.wikitable').first();

          $table.find('tr').each((index, row) => {
            if (index === 0) return;
            const $cells = $(row).find('td');
            if ($cells.length < 2) return;
            
            const dateText = $cells.eq(0).text().trim();
            if (!/待公布/.test(dateText)) return;
            
            const $nameLink = $cells.eq(1).find('a').first();
            if (!$nameLink.length) return;
            
            const dramaName = $nameLink
              .clone()
              .children()
              .end()
              .text()
              .replace(/[《》\s]+/g, ' ')
              .trim();
              
            if (dramaName) {
              pendingDramas.push(dramaName);
            }
          });

          return pendingDramas;
        }

        try {
          const [pendingDramas, mistDramas, seasonWindDramas, xTheaterDramas] = await Promise.all([
            fetchPendingDramas(),
            fetchMistDramas(),
            fetchSeasonWindDramas(),
            fetchXTheaterDramas()
          ]);

          return [...pendingDramas, ...mistDramas, ...seasonWindDramas, ...xTheaterDramas];
        } catch (error) {
          console.error("获取剧场数据失败:", error);
          throw error;
        }
      }
    })();
    
    if (!titles?.length) throw new Error("未获取到剧集列表");
    console.log(titles);
    
    const limit = 10;
    const offset = Number(params.offset);
    const pageItems = titles.slice(offset, offset + limit);

    const tmdbPromises = pageItems.map(title => getTmdbDetail(title, 'tv'));
    const tmdbResults = await Promise.all(tmdbPromises);

    const results = tmdbResults
      .map((result, index) => result ? { ...result, originalIndex: index } : null)
      .filter(Boolean)
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map(({ originalIndex, ...rest }) => rest);

    if (!results.length) throw new Error("未能获取到有效的剧集信息");

    return results;
  } catch (error) {
    console.error(`获取悬疑剧场剧集失败: ${error.message}`);
    throw error;
  }
}

// 院线电影
async function getMovies(params = {}) {
  try {
    const type = params.type;
    console.log(`开始获取${type === "later" ? "即将" : "正在"}上映的电影`);

    const url = `https://movie.douban.com/cinema/${type}/shanghai/`;
    
    const response = await Widget.http.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "referer": "https://sec.douban.com/",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    
    if (!response || !response.data) throw new Error("获取数据失败");

    const $ = Widget.html.load(response.data);
    if (!$ || $ === null) throw new Error("解析 HTML 失败");
    
    const limit = 20;
    const offset = Number(params.offset);
    
    let results = [];
    if (type === "nowplaying") {
      const selector = "#nowplaying .list-item";
      const elements = $(selector).toArray();
      if (!elements.length) throw new Error(`未找到${type}的电影`);
      const pageItems = elements.slice(offset, offset + limit);
      results = pageItems.map(el => {
        const $el = $(el);   
        return { 
          id: $el.attr("id"), 
          type: "douban", 
          title: $el.attr("data-title") || $el.find(".stitle a").attr("title"),
          mediaType: "movie"
        };
      }).filter(Boolean);      
    } else if (type === "later") {
      const selector = "#showing-soon .item.mod";
      const elements = $(selector).toArray();
      if (!elements.length) throw new Error(`未找到${type === "later" ? "即将" : "正在"}上映的电影`);
      const pageItems = elements.slice(offset, offset + limit);
      results = pageItems.map(el => {
        const $el = $(el);   
        let title = $el.find("h3 a").text().trim();
        if (!title) {
          title = $el.find("h3").text().trim().replace(/\s*\d{1,2}月\d{1,2}日.*$/, '').trim();
        }
        let idMatch = $el.find("h3 a").attr("href")?.match(/subject\/(\d+)/);
        let id = idMatch ? idMatch[1] : null;
        if (!id) {
          id = null;
        }
        return { 
          id: id, 
          type: "douban", 
          title: title,
          mediaType: "movie"
        };
      }).filter(Boolean);
    }
    
    if (!results.length) throw new Error("未能解析出有效的电影信息");
    return results;
  } catch (error) {
    console.error(`[电影列表] 获取失败: ${error.message}`);
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

// 通用剧名查询
async function getTmdbDetail(title, mediaType) {
    if (!title?.trim() || !['tv', 'movie'].includes(mediaType)) {
        console.error(`[TMDB精确查询] 参数错误: title 不能为空，mediaType 必须为 'tv' 或 'movie'`);
        return null;
    }

    const yearMatch = title.match(/\b(19|20)\d{2}\b/)?.[0] || "";

    const cleanTitle = title
        .replace(/([（(][^）)]*[)）]|剧场版|特别篇|动态漫|中文配音|中配|粤语版|国语版|\s+[^\s]+篇|第[0-9一二三四五六七八九十]+季)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    try {
        const api = `/search/${mediaType}?query=${encodeURIComponent(cleanTitle)}&year=${yearMatch}&language=zh-CN`;
        const response = await Widget.tmdb.get(api);
        
        if (!response?.results?.length) {
            console.log(`[TMDB] 无返回数据，尝试使用豆瓣搜索: ${title}`);
            return await getDoubanDetail(cleanTitle);
        }

        const exactMatch = response.results.find(item => {
            const name = (item.name || item.title || "").toLowerCase();
            const original = (item.original_name || item.original_title || "").toLowerCase();
            const lowerCleanTitle = cleanTitle.toLowerCase();
            return name === lowerCleanTitle || original === lowerCleanTitle;
        });

        if (!exactMatch) {
            console.log(`[TMDB] 没有精确匹配结果，尝试使用豆瓣搜索: ${title}`);
            const doubanResult = await getDoubanDetail(cleanTitle);
            if (doubanResult) {
                console.log(`[豆瓣] 成功找到匹配结果: ${title}`);
                return doubanResult;
            }
            return null;
        }

        console.log(`[TMDB] 成功找到匹配结果: ${title}`);
        return {
            id: exactMatch.id,
            type: "tmdb",
            title: exactMatch.name || exactMatch.title || title,
            originalTitle: exactMatch.original_name || exactMatch.original_title || "",
            posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/original${exactMatch.poster_path}` : "",
            backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/original${exactMatch.backdrop_path}` : "",
            description: exactMatch.overview || "暂无描述",
            releaseDate: exactMatch.first_air_date || exactMatch.release_date || "",
            mediaType: mediaType,
            rating: exactMatch.vote_average ? exactMatch.vote_average.toFixed(1) : ""
        };

    } catch (error) {
        console.error(`[TMDB] 请求失败: ${error.message}，尝试使用豆瓣搜索`);
        try {
            return await getDoubanDetail(cleanTitle);
        } catch (doubanError) {
            console.error(`[豆瓣] 请求也失败: ${doubanError.message}`);
            return null;
        }
    }
}

async function getDoubanDetail(title) {
    try {
        if (!title?.trim()) throw new Error("标题不能为空");

        console.log(`[豆瓣] 开始搜索: ${title}`);
        const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(title)}`;
        
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://movie.douban.com/",
                "Accept": "application/json, text/javascript, */*; q=0.01"
            }
        });

        if (!response?.data?.length) {
            throw new Error("未找到匹配的影视作品");
        }

        const exactMatch = response.data.find(item => {
            const name = (item.sub_title || item.title).toLowerCase();
            return name === title.toLowerCase();
        });

        if (!exactMatch) {
            console.log(`[豆瓣] 没有精确匹配结果: ${title}`);
            return null;
        }

        console.log(`[豆瓣] 找到匹配结果: ${exactMatch.title}`);
        return {
            id: exactMatch.id || "",
            type: "douban",
            title: exactMatch.title || "",
            posterPath: exactMatch.img || "",
            backdropPath: exactMatch.img || "",
            releaseDate: exactMatch.year || "",
            mediaType: exactMatch.type || "movie"
        };

    } catch (error) {
        console.error(`[豆瓣] 搜索失败: ${error.message}`);
        throw error;
    }
}
