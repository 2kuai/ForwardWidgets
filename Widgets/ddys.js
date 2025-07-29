var WidgetMetadata = {
  id: "ddys_vod",
  title: "低端影视",
  description: "获取在线电影、电视剧、动漫",
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

const domain = "ddys.pro"; // 主站域名

async function getVideos(params = {}, id) {
    try {
        // 1. 参数处理与URL构建
        const categoryPath = params.category ? `${params.category}/` : '';
        const page = params.page || 1;
        const url = `https://${domain}/category/${id}/${categoryPath}page/${page}`;

        // 2. HTTP请求
        const response = await Widget.http.get(url);
        if (!response?.data) {
            throw new Error("获取数据失败：响应为空");
        }

        // 3. HTML解析与数据提取
        const $ = Widget.html.load(response.data);
        const articles = $('article.post-box');
        
        if (articles.length === 0) {
            throw new Error("未找到视频数据");
        }

        // 4. 数据转换
        const movies = articles.map((i, el) => {
            const $el = $(el);
            const titleLink = $el.find('.post-box-title a');
            const href = titleLink.attr('href')?.trim() || '';
            const rawTitle = titleLink.text().trim();
            const description = $el.find('.post-box-text p').text().trim();
            
            // 提取标题和更新信息
            const title = rawTitle.replace(/\s*(?:更新至|\().*$/, '');
            
            // 提取季和集信息
            let season = "1";
            let episode = "";
            const updateMatch = rawTitle.match(/更新至\s*(?:第(\d+)季)?(\d+)/);
            if (updateMatch) {
                season = updateMatch[1] || "1";
                episode = updateMatch[2] || "";
            }
            
            
            // 提取封面图片（不使用辅助函数）
            const imageStyle = $el.find('.post-box-image').attr('style');
            const posterPath = imageStyle ? (imageStyle.match(/url\(['"]?(.*?)['"]?\)/) || [])[1] || '' : '';
            
            const result = {
                id: href,
                title: title,
                type: "url",
                posterPath: posterPath,
                description: description,
                link: href
            };
            
            if (season !== "1" && episode !== "0") {
                result.releaseDate = `更新至 第${season}季${episode}集`;
            }
            
            return result;
        }).get().filter(movie => movie.id);

        if (movies.length === 0) {
            throw new Error("有效视频数据为空");
        }

        return movies;
        
    } catch (error) {
        throw new Error(`获取视频失败: ${error.message}`);
    }
}



function extractImageUrl(style) {
    if (!style) return '';
    try {
        return style.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || '';
    } catch (e) {
        console.warn('封面URL提取失败:', e);
        return '';
    }
}

async function getMovies(params = {}) {
    return getVideos(params, "movie");
}

async function getTVSeries(params = {}) {
    return getVideos(params, "drama");
}

async function getAnime(params = {}) {
    return getVideos(params, "anime");
}

async function loadDetail(link) {
    if (!link) {
        throw new Error("链接不能为空");
    }

    try {
        const response = await Widget.http.get(link);
        if (!response?.data) {
            throw new Error("API返回数据结构不符合预期");
        }

        const $ = Widget.html.load(response.data);
        const jsonData = $('.wp-playlist-script').html();

        if (!jsonData) {
            throw new Error("未找到视频详情数据");
        }

        const data = JSON.parse(jsonData);
        
        if (data.type !== "video") {
            throw new Error("不支持的详情类型");
        }

        const tracks = data.tracks;
        if (!tracks || tracks.length === 0) {
            throw new Error("未找到视频资源");
        }

        const mediaType = tracks.length > 1 ? "tv" : "movie";
        const commonHeaders = {
            "range": "bytes=0-1",
            "referer": `https://${domain}/`,
            "accept-encoding": "identity",
            "accept-language": "zh-CN,zh-Hans;q=0.9",
            "origin": `https://${domain}`
        };

        const baseResult = {
            id: `https://${domain}${tracks[0].src0 || tracks[0].src3}`,
            type: "url",
            videoUrl: `https://v.${domain}${tracks[0].src0 || tracks[0].src3}`,
            mediaType: mediaType,
            customHeaders: commonHeaders
        };

        if (mediaType === "tv") {
            baseResult.episodeItems = tracks.map(item => ({
                id: `https://v.${domain}${item.src0 || item.src3}`,
                type: "url",
                videoUrl: `https://v.${domain}${item.src0 || item.src3}`,
                customHeaders: commonHeaders
            }));
        }

        return baseResult;
    } catch (error) {
        throw new Error(`加载详情失败: ${error.message}`);
    }
}
