var WidgetMetadata = {
  id: "ddys_tv",
  title: "低端影视",
  description: "获取在线电影、电视剧、动漫",
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
            { title: "全部电影", value: "" },
            { title: "欧美电影", value: "western-movie" },
            { title: "日韩电影", value: "asian-movie" },
            { title: "华语电影", value: "chinese-movie" }
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
      title: "动画",
      description: "获取在线动画",
      requiresWebView: false,
      functionName: "getAnime",
      params: [
        {
          name: "page",
          title: "页数",
          type: "page"
        }
      ]
    }
  ]
};

async function getVideos(params = {}, id) {
    try {
        // 1. 参数处理与URL构建
        const categoryPath = params.category ? `${params.category}/` : '';
        const page = params.page || 1; // 默认第一页
        const url = `https://ddys.pro/category/${id}/${categoryPath}page/${page}`;
        
        console.log('[getVideos] Request URL:', url); // 更清晰的日志
        
        // 2. HTTP请求
        const response = await Widget.http.get(url);
        if (!response?.data) {
            throw new Error("获取数据失败：响应为空");
        }

        // 3. HTML解析
        const $ = Widget.html.load(response.data);
        const articles = $('article.post-box');
        
        if (articles.length === 0) {
            throw new Error("未找到视频数据");
        }

        // 4. 数据提取（优化版）
        const movies = articles.map((i, el) => {
            const $el = $(el);
            const titleLink = $el.find('.post-box-title a');
            const imageStyle = $el.find('.post-box-image').attr('style');
            
            // 安全提取封面URL
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
        }).get().filter(movie => movie.id); // 过滤无效条目

        if (movies.length === 0) {
            throw new Error("有效视频数据为空");
        }

        return movies;
        
    } catch (error) {
        console.error(`[getVideos] 发生错误: ${error.message}`, {
            params,
            id,
            stack: error.stack
        });
        throw new Error(`获取视频失败: ${error.message}`);
    }
}

async function getMovies(params) {
  return getVideos(params, "movie");
}

async function getTVSeries(params) {
  return getVideos(params, "drama");
}

async function getAnime(params) {
  return getVideos(params, "anime");
}

async function loadDetail(link) {
  try {
    const response = await Widget.http.get(link);

    if (!response.data) {
      throw new Error("API返回数据结构不符合预期");
    }

    const $ = Widget.html.load(response.data);
    const jsonData = $('.wp-playlist-script').html();

    if (!jsonData) {
      throw new Error("未找到视频详情数据");
    }
    const data = JSON.parse(jsonData);
    
    // 只处理 type: 'video' 的情况 
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
          id: "https://v.ddys.pro" + (item.src0 || item.src3),  // 修正为英文冒号和 src0
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
    console.error("loadDetail出错:", error);
    throw new Error(`加载详情失败: ${error.message}`);
  }
}
