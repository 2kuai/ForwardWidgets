var WidgetMetadata = {
  id: "movie_paradise",
  title: "在线影院",
  description: "获取在线电影、电视剧、动漫、综艺和短剧",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "电影",
      description: "获取在线电影",
      requiresWebView: false,
      functionName: "getMovies",
      params: [
        {
          name: "category",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "剧情片", value: "6" },
            { title: "动作片", value: "7" },
            { title: "冒险片", value: "8" },
            { title: "同性片", value: "9" },
            { title: "喜剧片", value: "10" },
            { title: "奇幻片", value: "11" },
            { title: "恐怖片", value: "12" },
            { title: "悬疑片", value: "20" },
            { title: "惊悚片", value: "21" },
            { title: "灾难片", value: "22" },
            { title: "爱情片", value: "23" },
            { title: "犯罪片", value: "24" },
            { title: "科幻片", value: "25" },
            { title: "动画电影", value: "26" },
            { title: "歌舞片", value: "33" },
            { title: "战争片", value: "34" },
            { title: "经典片", value: "35" },
            { title: "网络电影", value: "36" },
            { title: "其它片", value: "37" }
          ]
        },
        {
          name: "plot",
          title: "剧情",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "剧情", value: "剧情" },
            { title: "爱情", value: "爱情" },
            { title: "喜剧", value: "喜剧" },
            { title: "动作", value: "动作" },
            { title: "科幻", value: "科幻" },
            { title: "犯罪", value: "犯罪" },
            { title: "爱情", value: "爱情" },
            { title: "惊悚", value: "惊悚" },
            { title: "悬疑", value: "悬疑" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "language",
          title: "语言",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "英语", value: "英语" },
            { title: "国语", value: "国语" },
            { title: "日语", value: "日语" },
            { title: "未知", value: "未知" },
            { title: "韩语", value: "韩语" },
            { title: "粤语", value: "粤语" },
            { title: "法语", value: "法语" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "year",
          title: "年份",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "2024", value: "2024" },
            { title: "2023", value: "2023" },
            { title: "2022", value: "2022" },
            { title: "2021", value: "2021" },
            { title: "2020", value: "2020" },
            { title: "2019", value: "2019" },
            { title: "2018", value: "2018" },
            { title: "2017", value: "2017" },
            { title: "2016", value: "2016" },
            { title: "2015", value: "2015" },
            { title: "2014", value: "2014" },
            { title: "2013", value: "2013" }
          ]
        },
        {
          name: "area",
          title: "地区",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "欧美", value: "欧美" },
            { title: "大陆", value: "大陆" },
            { title: "日本", value: "日本" },
            { title: "香港", value: "香港" },
            { title: "韩国", value: "韩国" },
            { title: "台湾", value: "台湾" },
            { title: "新马", value: "新马" },
            { title: "泰国", value: "泰国" },
            { title: "越南", value: "越南" },
            { title: "美国", value: "美国" },
            { title: "中国台湾", value: "中国台湾" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "sort_by",
          title: "排序",
          type: "enumeration",
          enumOptions: [
            { title: "时间排序", value: "update_stamp" },
            { title: "人气排序", value: "hits" },
            { title: "评分排序", value: "score" },
            { title: "最新上映", value: "release_stamp" }
          ]
        },
        {
          name: "page",
          title: "页数",
          type: "page"
        }
      ]
    },
    {
      title: "电视剧",
      description: "获取在线电视剧",
      requiresWebView: false,
      functionName: "getTVSeries",
      params: [
        {
          name: "category",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "国产剧", value: "13" },
            { title: "港剧", value: "14" },
            { title: "韩剧", value: "15" },
            { title: "日剧", value: "16" },
            { title: "泰剧", value: "28" },
            { title: "台剧", value: "29" },
            { title: "欧美剧", value: "30" },
            { title: "新马剧", value: "31" },
            { title: "其它剧", value: "32" }
          ]
        },
        {
          name: "plot",
          title: "剧情",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "剧情", value: "剧情" },
            { title: "纪录", value: "纪录" },
            { title: "武侠", value: "武侠" },
            { title: "纪录片", value: "纪录片" },
            { title: "喜剧", value: "喜剧" },
            { title: "动作", value: "动作" },
            { title: "科幻", value: "科幻" },
            { title: "犯罪", value: "犯罪" },
            { title: "爱情", value: "爱情" },
            { title: "惊悚", value: "惊悚" },
            { title: "悬疑", value: "悬疑" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "language",
          title: "语言",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "英语", value: "英语" },
            { title: "国语", value: "国语" },
            { title: "日语", value: "日语" },
            { title: "未知", value: "未知" },
            { title: "韩语", value: "韩语" },
            { title: "粤语", value: "粤语" },
            { title: "法语", value: "法语" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "year",
          title: "年份",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "2024", value: "2024" },
            { title: "2023", value: "2023" },
            { title: "2022", value: "2022" },
            { title: "2021", value: "2021" },
            { title: "2020", value: "2020" },
            { title: "2019", value: "2019" },
            { title: "2018", value: "2018" },
            { title: "2017", value: "2017" },
            { title: "2016", value: "2016" },
            { title: "2015", value: "2015" },
            { title: "2014", value: "2014" },
            { title: "2013", value: "2013" }
          ]
        },
        {
          name: "area",
          title: "地区",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "欧美", value: "欧美" },
            { title: "大陆", value: "大陆" },
            { title: "日本", value: "日本" },
            { title: "香港", value: "香港" },
            { title: "韩国", value: "韩国" },
            { title: "台湾", value: "台湾" },
            { title: "新马", value: "新马" },
            { title: "泰国", value: "泰国" },
            { title: "中国大陆", value: "中国大陆" },
            { title: "英国", value: "英国" },
            { title: "美国", value: "美国" },
            { title: "港台", value: "港台" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "sort_by",
          title: "排序",
          type: "enumeration",
          enumOptions: [
            { title: "时间排序", value: "update_stamp" },
            { title: "人气排序", value: "hits" },
            { title: "评分排序", value: "score" },
            { title: "最新上映", value: "release_stamp" }
          ]
        },
        {
          name: "page",
          title: "页数",
          type: "page"
        }
      ]
    },
    {
      title: "动漫",
      description: "获取在线动漫",
      requiresWebView: false,
      functionName: "getAnime",
      params: [
        {
          name: "category",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "欧美动漫", value: "57" },
            { title: "日本动漫", value: "58" },
            { title: "韩国动漫", value: "59" },
            { title: "国产动漫", value: "60" },
            { title: "港台动漫", value: "61" },
            { title: "新马泰动漫", value: "62" },
            { title: "其他动漫", value: "63" }
          ]
        },
        {
          name: "plot",
          title: "剧情",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "剧情", value: "剧情" },
            { title: "纪录", value: "纪录" },
            { title: "武侠", value: "武侠" },
            { title: "纪录片", value: "纪录片" },
            { title: "喜剧", value: "喜剧" },
            { title: "动作", value: "动作" },
            { title: "科幻", value: "科幻" },
            { title: "犯罪", value: "犯罪" },
            { title: "爱情", value: "爱情" },
            { title: "惊悚", value: "惊悚" },
            { title: "悬疑", value: "悬疑" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "language",
          title: "语言",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "英语", value: "英语" },
            { title: "国语", value: "国语" },
            { title: "日语", value: "日语" },
            { title: "未知", value: "未知" },
            { title: "韩语", value: "韩语" },
            { title: "粤语", value: "粤语" },
            { title: "汉语普通话", value: "汉语普通话" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "year",
          title: "年份",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "2024", value: "2024" },
            { title: "2023", value: "2023" },
            { title: "2022", value: "2022" },
            { title: "2021", value: "2021" },
            { title: "2020", value: "2020" },
            { title: "2019", value: "2019" },
            { title: "2018", value: "2018" },
            { title: "2017", value: "2017" },
            { title: "2016", value: "2016" },
            { title: "2015", value: "2015" },
            { title: "2014", value: "2014" },
            { title: "2013", value: "2013" }
          ]
        },
        {
          name: "area",
          title: "地区",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "欧美", value: "欧美" },
            { title: "大陆", value: "大陆" },
            { title: "日本", value: "日本" },
            { title: "香港", value: "香港" },
            { title: "韩国", value: "韩国" },
            { title: "台湾", value: "台湾" },
            { title: "新马", value: "新马" },
            { title: "泰国", value: "泰国" },
            { title: "中国大陆", value: "中国大陆" },
            { title: "英国", value: "英国" },
            { title: "美国", value: "美国" },
            { title: "港台", value: "港台" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "sort_by",
          title: "排序",
          type: "enumeration",
          enumOptions: [
            { title: "时间排序", value: "update_stamp" },
            { title: "人气排序", value: "hits" },
            { title: "评分排序", value: "score" },
            { title: "最新上映", value: "release_stamp" }
          ]
        },
        {
          name: "page",
          title: "页数",
          type: "page"
        }
      ]
    },
    {
      title: "综艺",
      description: "获取在线综艺",
      requiresWebView: false,
      functionName: "getVarietyShows",
      params: [
        {
          name: "category",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "国产综艺", value: "38" },
            { title: "港台综艺", value: "39" },
            { title: "韩国综艺", value: "40" },
            { title: "日本综艺", value: "41" },
            { title: "欧美综艺", value: "42" },
            { title: "新马泰综艺", value: "43" },
            { title: "其他综艺", value: "44" }
          ]
        },
        {
          name: "plot",
          title: "剧情",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "剧情", value: "剧情" },
            { title: "纪录", value: "纪录" },
            { title: "武侠", value: "武侠" },
            { title: "纪录片", value: "纪录片" },
            { title: "喜剧", value: "喜剧" },
            { title: "动作", value: "动作" },
            { title: "科幻", value: "科幻" },
            { title: "犯罪", value: "犯罪" },
            { title: "爱情", value: "爱情" },
            { title: "惊悚", value: "惊悚" },
            { title: "悬疑", value: "悬疑" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "language",
          title: "语言",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "英语", value: "英语" },
            { title: "国语", value: "国语" },
            { title: "日语", value: "日语" },
            { title: "未知", value: "未知" },
            { title: "韩语", value: "韩语" },
            { title: "粤语", value: "粤语" },
            { title: "汉语普通话", value: "汉语普通话" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "year",
          title: "年份",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "2024", value: "2024" },
            { title: "2023", value: "2023" },
            { title: "2022", value: "2022" },
            { title: "2021", value: "2021" },
            { title: "2020", value: "2020" },
            { title: "2019", value: "2019" },
            { title: "2018", value: "2018" },
            { title: "2017", value: "2017" },
            { title: "2016", value: "2016" },
            { title: "2015", value: "2015" },
            { title: "2014", value: "2014" },
            { title: "2013", value: "2013" }
          ]
        },
        {
          name: "area",
          title: "地区",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "欧美", value: "欧美" },
            { title: "大陆", value: "大陆" },
            { title: "日本", value: "日本" },
            { title: "香港", value: "香港" },
            { title: "韩国", value: "韩国" },
            { title: "台湾", value: "台湾" },
            { title: "新马", value: "新马" },
            { title: "泰国", value: "泰国" },
            { title: "中国大陆", value: "中国大陆" },
            { title: "英国", value: "英国" },
            { title: "美国", value: "美国" },
            { title: "港台", value: "港台" },
            { title: "其它", value: "其它" }
          ]
        },
        {
          name: "sort_by",
          title: "排序",
          type: "enumeration",
          enumOptions: [
            { title: "时间排序", value: "update_stamp" },
            { title: "人气排序", value: "hits" },
            { title: "评分排序", value: "score" },
            { title: "最新上映", value: "release_stamp" }
          ]
        },
        {
          name: "page",
          title: "页数",
          type: "page"
        }
      ]
    },
    {
      title: "短剧",
      description: "获取在线短剧",
      requiresWebView: false,
      functionName: "getShortDramas",
      params: [
        {
          name: "category",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部", value: "" },
            { title: "古装短剧", value: "45" },
            { title: "虐恋短剧", value: "46" },
            { title: "逆袭短剧", value: "47" },
            { title: "悬疑短剧", value: "48" },
            { title: "神豪短剧", value: "49" },
            { title: "重生短剧", value: "50" },
            { title: "复仇短剧", value: "51" },
            { title: "穿越短剧", value: "52 " },
            { title: "甜宠短剧", value: "53" },
            { title: "强者短剧", value: "54" },
            { title: "萌宝短剧", value: "55" },
            { title: "其它短剧", value: "56" }
          ]
        },
        {
          name: "sort_by",
          title: "排序",
          type: "enumeration",
          enumOptions: [
            { title: "时间排序", value: "update_stamp" },
            { title: "人气排序", value: "hits" },
            { title: "评分排序", value: "score" },
            { title: "最新上映", value: "release_stamp" }
          ]
        },
        {
          name: "page",
          title: "页数",
          type: "page"
        }
      ]
    }
  ]
};

// 电影
async function getMovies(params = {}) {
  return getVideos(params, '1');
}

// 电视剧
async function getTVSeries(params = {}) {
  return getVideos(params, '2');
}           

// 动漫
async function getAnime(params = {}) {
  return getVideos(params, '3');
}

// 综艺
async function getVarietyShows(params = {}) {
  return getVideos(params, '4');
}

// 短剧
async function getShortDramas(params = {}) {
  return getVideos(params, '27');
}

async function getVideos(params = {}, Pid) {
    try {           
        const url = `https://cgi.dytt8vip.com/filmClassifySearch?Pid=${Pid || ""}&Category=${params.category || ""}&Plot=${params.plot || ""}&Language=${params.language || ""}&Year=${params.year || ""}&Area=${params.area || ""}&Sort=${params.sort_by || ""}&current=${params.page}`;
        const response = await Widget.http.get(url);

        if (!response.data?.data.list?.length) throw new Error("数据格式不符合预期");
        
        return response.data.data.list.map(item => ({
            id: `https://cgi.dytt8vip.com/filmPlayInfo?id=${item.id}`,
            title: item.name,
            type: "url",
            posterPath: item.picture,
            link: `https://cgi.dytt8vip.com/filmPlayInfo?id=${item.id}` 
        }));
        
    } catch (error) {
        throw error;
    }
}

async function loadDetail(link) {
  try {
    const response = await Widget.http.get(link);

    if (!response?.data?.data?.detail?.descriptor) {
      throw new Error("API返回数据结构不符合预期");
    }

    const data = response.data.data;
    const mediaType = data.detail.playList[0].length > 1 ? "tv" : "movie";

    const result = {
      id: data.current.link,
      type: "url",
      title: data.detail.name,
      posterPath: data.detail.picture,
      releaseDate: data.detail.descriptor.releaseDate,
      mediaType: mediaType,
      videoUrl: data.current.link
    };
    
    if (mediaType === "tv") {
  // 安全访问 playList[0]，默认空数组防止报错
  const currentPlayList = data?.detail?.playList?.[0] || [];
  
  const episodeItems = currentPlayList.map(item => ({
    id: item?.link || "",      // 防止 item.link 不存在
    type: "url",    
    title: item?.episode || "未知集数",  // 防止 item.episode 不存在
    videoUrl: item?.link || ""  // 防止 item.link 不存在
  }));
  
  // 计算总集数（currentPlayList.length 已经是安全的）
  result.episode = currentPlayList.length;
  result.episodeItems = episodeItems;
}

    
    return result;
  } catch (error) {
    console.error("loadDetail出错:", error);
    throw new Error(`加载详情失败: ${error.message}`);
  }
}

