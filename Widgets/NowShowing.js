// 填写你的 TMDB API 访问令牌
const TMDB_API_TOKEN = "";

var WidgetMetadata = {
    id: "now_showing",
    title: "院线电影",
    description: "获取正在上映和即将上映的电影信息",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.0.2",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "正在上映",
            description: "获取当前正在上映的电影列表",
            requiresWebView: false,
            functionName: "getMovies",
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "constant",
                    value: "nowplaying"
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        },
        {
            title: "即将上映",
            description: "获取即将上映的电影及上映日期",
            requiresWebView: false,
            functionName: "getMovies",
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "constant",
                    value: "upcoming"
                }
            ]
        }
    ]
}

async function getMovies(params = {}) {
  try {
    const type = params.type === "upcoming" ? "即将上映" : "正在上映";
    console.log(`[电影列表] 开始获取${type}的电影`);

    const response = await Widget.http.get("https://movie.douban.com/cinema/nowplaying/shanghai/", {
      headers: { Referer: "https://movie.douban.com/" }
    });

    if (!response?.data) throw new Error("获取页面失败");

    const $ = Widget.html.load(response.data);
    const selector = params.type === "upcoming" ? "#upcoming .list-item" : "#nowplaying .list-item";
    const elements = $(selector).toArray();

    if (!elements.length) throw new Error(`未找到${type}的电影`);

    const page = Number(params.page || 1);
    const pageItems = elements.slice((page - 1) * 10, page * 10);

    const results = pageItems.map(el => {
      const $el = $(el);
      const title = $el.attr("data-title");
      const id = $el.attr("id");
      return title && id ? { id, type: "douban", title } : null;
    }).filter(Boolean);

    if (!results.length) throw new Error("未能解析出有效的电影信息");

    return results;
  } catch (err) {
    console.error("[电影列表] 获取失败：", err.message);
    throw err;
  }
}
