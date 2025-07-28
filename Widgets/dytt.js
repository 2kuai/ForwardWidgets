var WidgetMetadata = {
  id: "dytt_vod",
  title: "电影天堂",
  description: "获取在线电影、电视剧、动漫、综艺和短剧",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.0.1",
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
            { title: "网络电影", value: "36" }
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
            { title: "欧美剧", value: "30" }
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
            { title: "港台动漫", value: "61" }
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
            { title: "欧美综艺", value: "42" }
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
            { title: "萌宝短剧", value: "55" }
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
        const url = `https://cgi.dytt8vip.com/filmClassifySearch?Pid=${Pid || ""}&Category=${params.category || ""}&Sort=${params.sort_by || ""}&current=${params.page}`;
        const response = await Widget.http.get(url);
        
        if (!response?.data || response.data.code !== 0) {
            throw new Error('Invalid API response structure');
        }

        return response.data.data.list.map(item => ({
            id: item.id,
            title: item.name,
            type: "url",
            description: item.blurb,
            posterPath: item.picture,
            releaseDate: item.year,
            genreTitle: item.cName,
            mediaType: item.pid !== "1" ? "tv" : "movie",
            link: `https://cgi.dytt8vip.com/filmPlayInfo?id=${item.id}`
        }));
    } catch (error) {
        throw new Error(`Failed to fetch videos: ${error.message}`);
    }
}

async function loadDetail(link) {
    if (!link) {
        throw new Error('Link parameter is required');
    }

    try {
        const response = await Widget.http.get(link);
        
        if (!response?.data || response.data.code !== 0) {
            throw new Error('Invalid API response structure');
        }

        const { data } = response.data;
        const { detail, current } = data;
        const isTVSeries = detail.pid !== "1";

        const result = {
            id: current.link,
            type: "url",
            title: detail.name,
            posterPath: detail.picture,
            releaseDate: detail.descriptor?.releaseDate,
            videoUrl: current.link,
            mediaType: isTVSeries ? "tv" : "movie"
        };
        
        if (isTVSeries) {
            const playList = detail.playList?.[0] || [];
            
            result.episode = playList.length;
            result.episodeItems = playList.map(item => ({
                id: item?.link,
                type: "url",
                videoUrl: item?.link
            }));
        }
        
        return result;
    } catch (error) {
        throw new Error(`Failed to load detail: ${error.message}`);
    }
}
