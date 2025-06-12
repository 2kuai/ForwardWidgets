import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
const config = {
  doubanBaseUrl: 'https://movie.douban.com/cinema',
  tmdbApiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzYmJjNzhhN2JjYjI3NWU2M2Y5YTM1MmNlMTk4NWM4MyIsInN1YiI6IjU0YmU4MTNlYzNhMzY4NDA0NjAwODZjOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.esM4zgTT64tFpnw9Uk5qwrhlaDUwtNNYKVzv_jNr390',
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  HistoryBoxOfficeUrl: 'https://piaofang.maoyan.com/i/globalBox/historyRank',
  outputPath: 'data/movies-data.json',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'Referer': 'https://movie.douban.com/explore'
  }
};

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 从TMDB获取电影详情
async function getTmdbDetails(title) {
  try {
    const yearMatch = title.match(/（(\d{4})）$/);
    const year = yearMatch ? yearMatch[1] : "";
    const cleanTitle = title.replace(/（\d{4}）$/, '').trim();
    
    const response = await axios.get(`${config.tmdbBaseUrl}/search/movie`, {
      params: {
        query: cleanTitle,
        language: 'zh-CN',
        year: year
      },
      headers: {
        'Authorization': `Bearer ${config.tmdbApiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response?.data?.results?.length) {
      console.log(`[TMDB] 未找到电影: ${cleanTitle}`);
      return null;
    }

    const exactMatch = response.data.results.find(movie => {
      const movieTitle = movie.title.toLowerCase();
      const searchTitle = cleanTitle.toLowerCase();
      return movieTitle === searchTitle || 
             movieTitle.includes(searchTitle) || 
             searchTitle.includes(movieTitle);
    });

    const movie = exactMatch || response.data.results[0];
    
    const movieTitle = movie.title.toLowerCase();
    const searchTitle = cleanTitle.toLowerCase();
    if (!movieTitle.includes(searchTitle) && !searchTitle.includes(movieTitle)) {
      console.log(`[TMDB] 匹配度太低，跳过: ${cleanTitle} -> ${movie.title}`);
      return null;
    }

    return {
      id: movie.id,
      type: "tmdb",
      title: movie.title,
      description: movie.overview,
      posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdropPath: movie.backdrop_path ? `https://image.tmdb.org/t/p/w500${movie.backdrop_path}` : null,
      releaseDate: movie.release_date,
      rating: movie.vote_average,
      mediaType: "movie"
    };
  } catch (error) {
    console.error(`[TMDB] 获取电影详情失败: ${error.message}`);
    return null;
  }
}

// 获取豆瓣电影数据
async function getMovies(params = {}) {
  try {
    const type = params.type || 'nowplaying';
    console.log(`开始获取${type === "later" ? "即将" : "正在"}上映的电影`);
    const url = `${config.doubanBaseUrl}/${type}/shanghai/`;
    
    const response = await axios.get(url, {
      headers: config.headers,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    let movies = [];

    if (type === "nowplaying") {
      const elements = $("#nowplaying .lists .list-item").toArray();
      movies = elements.map(el => {
        const $el = $(el);
        const title = $el.attr("data-title") || $el.find(".stitle a").attr("title") || $el.find("h3 a").text().trim();
        const year = $el.attr("data-release");
        return `${title}${year ? `（${year}）` : ''}`;
      }).filter(Boolean);
    } else if (type === "later") {
      const elements = $("#showing-soon .item.mod").toArray();
      movies = elements.map(el => {
        const $el = $(el);
        let title = $el.find("h3 a").text().trim();
        if (!title) title = $el.find("h3").text().trim();
        const year = $el.attr("data-release");
        return `${title}${year ? `（${year}）` : ''}`;
      }).filter(Boolean);
    }

    console.log(`开始从TMDB获取${movies.length}部电影的详细信息...`);
    const results = [];
    for (const movie of movies) {
      try {
        const details = await getTmdbDetails(movie);
        if (details) results.push(details);
        await delay(250);
      } catch (error) {
        console.error(`处理电影失败: ${movie}`, error);
      }
    }
    return results;
  } catch (error) {
    console.error(`获取电影列表失败: ${error.message}`);
    return [];
  }
}

// 获取历史票房排行
async function getHistoryRank() {
  try {
    const response = await axios.get(config.HistoryBoxOfficeUrl, {
      headers: {
        "User-Agent": config.USER_AGENT,
        "Referer": "https://piaofang.maoyan.com/rankings/year"
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const movies = [];
    
    $(".movie-item").each((index, element) => {
      const $item = $(element);
      const title = $item.find(".movie-name").text().trim();
      const releaseYear = $item.find(".movie-year").text().trim();
      if (title) movies.push(`${title}（${releaseYear}）`);
    });

    const tmdbResults = await Promise.all(
      movies.map(async movie => {
        try {
          return await getTmdbDetails(movie);
        } catch (error) {
          console.error(`获取电影详情失败: ${movie}`, error);
          return null;
        }
      })
    ).then(results => results.filter(Boolean));
    
    return tmdbResults;
  } catch (error) {
    console.error("获取历史票房榜单失败:", error);
    return [];
  }
}

// 主函数
async function main() {
  try {
    await delay(2000);
    console.log("开始数据采集...");

    const [nowplaying, later, historyRank] = await Promise.all([
      getMovies({ type: 'nowplaying' }),
      getMovies({ type: 'later' }),
      getHistoryRank()
    ]);

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      nowplaying,
      later,
      historyRank
    };

    // 确保目录存在
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
🎬🎬 正在热映: ${nowplaying.length}部
🍿🍿 即将上映: ${later.length}部
📜📜 历史票房: ${historyRank.length}部
🕒🕒🕒 更新时间: ${result.last_updated}
数据已保存至: ${path.resolve(config.outputPath)}
`);
  } catch (error) {
    console.error('程序执行出错:', error);
    process.exit(1);
  }
}

// 执行
main();
