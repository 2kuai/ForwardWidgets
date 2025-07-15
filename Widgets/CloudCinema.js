var WidgetMetadata = {
    id: "cloud_cinema",
    title: "云端影院",
    description: "获取在线云端在线资源",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.1.001",
    requiredVersion: "0.0.1",
    modules: [
      {
        title: "低端影视",
        description: "获取在线服务器资源",
        requiresWebView: false,
        functionName: "ddys_Videos",
        params: [
          {
            name: "type",
            title: "类别",
            type: "enumeration",
            cacheDuration: 10800,
            enumOptions: [
              { title: "电影", value: "movie" },
              { title: "电视剧", value: "drama" },
              { title: "动画", value: "anime" }
            ]
          },
          {
            name: "category",
            title: "分类",
            type: "enumeration",
            description: "",
            belongTo: {
              paramName: "type",
              value: ["movie"]
            },
            enumOptions: [
              { title: "全部电影", value: "" },
              { title: "欧美电影", value: "western-movie" },
              { title: "日韩电影", value: "asian-movie" },
              { title: "华语电影", value: "chinese-movie" }
            ]
          },
          {
            name: "category",
            title: "分类",
            type: "enumeration",
            description: "",
            belongTo: {
              paramName: "type",
              value: ["drama"]
            },
            enumOptions: [
              { title: "全部剧集", value: "" },
              { title: "欧美剧集", value: "western-drama" },
              { title: "日剧", value: "jp-drama" },
              { title: "韩剧", value: "kr-drama" },
              { title: "华语剧", value: "cn-drama" },
              { title: "其他剧集", value: "other" }
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
        title: "电影天堂",
        description: "获取在线电影天堂资源",
        requiresWebView: false,
        functionName: "dytt_Videos",
        params: [
          {
            name: "type",
            title: "类别",
            type: "enumeration",
            enumOptions: [
              { title: "电影", value: "1" },
              { title: "电视剧", value: "2" },
              { title: "动漫", value: "3" },
              { title: "综艺", value: "4" },
              { title: "短剧", value: "27" }
            ]
          },
          {
            name: "category",
            title: "类型",
            type: "enumeration",
            belongTo: { paramName: "type", value: ["1"] },
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
            name: "category",
            title: "类型",
            type: "enumeration",
            belongTo: { paramName: "type", value: ["2"] },
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
            name: "category",
            title: "类型",
            type: "enumeration",
            belongTo: { paramName: "type", value: ["3"] },
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
            name: "category",
            title: "类型",
            type: "enumeration",
            belongTo: { paramName: "type", value: ["4"] },
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
            name: "category",
            title: "类型",
            type: "enumeration",
            belongTo: { paramName: "type", value: ["27"] },
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
              { title: "中国大陆", value: "中国大陆" },
              { title: "英国", value: "英国" },
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
      }
    ]
  }

// ========== 工具函数 ==========
const safeGet = (obj, path, defaultValue = undefined) =>
  path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : defaultValue), obj);

const logError = (msg, error, context) => {
  console.error(`[${msg}]`, { error, ...context });
};

const encode = v => encodeURIComponent(v || "");

// ========== 低端影视视频列表 ==========
async function ddys_Videos(params = {}) {
  try {
    const categoryPath = params.category && params.type !== "anime" ? `${params.category}/` : '';
    const url = `https://ddys.pro/category/${params.type}/${categoryPath}page/${params.page}`;
    console.log('[getVideos] Request URL:', url);
    const response = await Widget.http.get(url);
    if (!response?.data) throw new Error("获取数据失败：响应为空");
    const $ = Widget.html.load(response.data);
    const articles = $('article.post-box');
    if (articles.length === 0) throw new Error("未找到视频数据");
    const movies = articles.map((i, el) => {
      const $el = $(el);
      const titleLink = $el.find('.post-box-title a');
      const imageStyle = $el.find('.post-box-image').attr('style');
      let posterPath = '';
      try {
        posterPath = imageStyle?.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || '';
      } catch (e) {
        console.warn('封面URL提取失败:', e);
      }
      return {
        id: titleLink.attr('href')?.trim() || '',
        title: titleLink.text().trim(),
        type: "url",
        posterPath: posterPath,
        link: titleLink.attr('href')?.trim() || ''
      };
    }).get().filter(movie => movie.id);
    if (movies.length === 0) throw new Error("有效视频数据为空");
    return movies;
  } catch (error) {
    logError('getVideos 发生错误', error, { params });
    throw new Error(`获取视频失败: ${error.message}`);
  }
}

// ========== 电影天堂视频列表 ==========
async function dytt_Videos(params = {}) {
  try {
    const url = `https://cgi.dytt8vip.com/filmClassifySearch?Pid=${encode(params.type)}&Category=${encode(params.category)}&Plot=${encode(params.plot)}&Year=${encode(params.year)}&Area=${encode(params.area)}&Sort=${encode(params.sort_by)}&current=${encode(params.page)}`;
    const response = await Widget.http.get(url);
    if (!safeGet(response, ['data', 'data', 'list'], []).length) throw new Error("数据格式不符合预期");
    return response.data.data.list.map(item => ({
      id: `https://cgi.dytt8vip.com/filmPlayInfo?id=${item.id}`,
      title: item.name,
      type: "url",
      posterPath: item.picture,
      link: `https://cgi.dytt8vip.com/filmPlayInfo?id=${item.id}`
    }));
  } catch (error) {
    logError('dytt_Videos 发生错误', error, { params });
    throw error;
  }
}

// ========== 详情解析 ==========
async function loadddys(link) {
  try {
    const response = await Widget.http.get(link);
    if (!response.data) throw new Error("API返回数据结构不符合预期");
    const $ = Widget.html.load(response.data);
    const jsonData = $('.wp-playlist-script').html();
    if (!jsonData) throw new Error("未找到视频详情数据");
    const data = JSON.parse(jsonData);
    if (data.type === "video") {
      const track = data.tracks;
      const mediaType = track.length > 1 ? "tv" : "movie";
      const result = {
        id: "https://ddys.pro" + (track[0].src0 || track[0].src3),
        type: "url",
        videoUrl: "https://v.ddys.pro" + (track[0].src0 || track[0].src3),
        mediaType: mediaType,
        customHeaders: {
          "range": "bytes=0-1",
          "referer": "https://ddys.pro/",
          "accept-encoding": "identity",
          "accept-language": "zh-CN,zh-Hans;q=0.9",
          "origin": "https://ddys.pro"
        }
      };
      if (mediaType === "tv") {
        result.episodeItems = track.map(item => ({
          id: "https://v.ddys.pro" + (item.src0 || item.src3),
          type: "url",
          title: item.src0 ? item.src0.replace(/^.*(S\d+E\d+).*$/, "$1") : "未知集数",
          videoUrl: "https://v.ddys.pro" + (item.src0 || item.src3),
          customHeaders: {
            "range": "bytes=0-1",
            "referer": "https://ddys.pro/",
            "accept-encoding": "identity",
            "accept-language": "zh-CN,zh-Hans;q=0.9",
            "origin": "https://ddys.pro"
          }
        }));
      }
      return result;
    } else {
      throw new Error("未知的详情类型");
    }
  } catch (error) {
    logError('loadddys出错', error, { link });
    throw error;
  }
}

async function loaddytt(link) {
  try {
    const response = await Widget.http.get(link);
    if (!safeGet(response, ['data', 'data', 'detail', 'descriptor'])) {
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
      const currentPlayList = data?.detail?.playList?.[0] || [];
      const episodeItems = currentPlayList.map(item => ({
        id: item?.link || "",
        type: "url",
        title: item?.episode || "未知集数",
        videoUrl: item?.link || ""
      }));
      result.episode = currentPlayList.length;
      result.episodeItems = episodeItems;
    }
    return result;
  } catch (error) {
    logError('loaddytt出错', error, { link });
    throw error;
  }
}

async function loadDetail(link) {
  try {
    if (link.includes("ddys.pro")) {
      return await loadddys(link);
    } else if (link.includes("dytt8vip.com")) {
      return await loaddytt(link);
    } else {
      throw new Error("未知的详情链接类型");
    }
  } catch (error) {
    logError('loadDetail出错', error, { link });
    throw new Error(`加载详情失败: ${error.message}`);
  }
} 