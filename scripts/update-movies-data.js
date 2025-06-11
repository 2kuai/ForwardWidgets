import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
const config = {
  doubanBaseUrl: 'https://movie.douban.com/cinema',
  tmdbApiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzYmJjNzhhN2JjYjI3NWU2M2Y5YTM1MmNlMTk4NWM4MyIsInN1YiI6IjU0YmU4MTNlYzNhMzY4NDA0NjAwODZjOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.esM4zgTT64tFpnw9Uk5qwrhlaDUwtNNYKVzv_jNr390',
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  outputPath: 'data/movies-data.json',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://movie.douban.com/'
  }
};

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 从TMDB获取电影详情
async function getTmdbDetails(title, year) {
  try {
    const response = await axios.get(`${config.tmdbBaseUrl}/search/movie`, {
      params: {
        query: title,
        year: year,
        language: 'zh-CN'
      },
      headers: {
        'Authorization': `Bearer ${config.tmdbApiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response?.data?.results?.length) {
      console.log(`[TMDB] 未找到电影: ${title} (${year})`);
      return null;
    }

    // 查找最匹配的结果
    const exactMatch = response.data.results.find(movie => 
      movie.title === title || 
      movie.original_title === title
    );

    const movie = exactMatch || response.data.results[0];
    
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
async function getMovies(type) {
  try {
    console.log(`开始获取${type === "later" ? "即将" : "正在"}上映的电影`);
    const url = `${config.doubanBaseUrl}/${type}/shanghai/`;
    
    const response = await axios.get(url, {
      headers: config.headers,
      timeout: 10000
    });

    if (!response || !response.data) {
      throw new Error("获取数据失败");
    }

    const $ = cheerio.load(response.data);
    if (!$) {
      throw new Error("解析 HTML 失败");
    }

    let movies = [];
    if (type === "nowplaying") {
      const selector = "#nowplaying .list-item";
      const elements = $(selector).toArray();
      if (!elements.length) {
        throw new Error(`未找到正在上映的电影`);
      }
      movies = elements.map(el => {
        const $el = $(el);
        const title = $el.find("h3 a").text().trim();
        const yearMatch = title.match(/（(\d{4})）$/);
        const year = yearMatch ? yearMatch[1] : null;
        return { title, year };
      });
    } else if (type === "later") {
      const selector = "#showing-soon .item.mod";
      const elements = $(selector).toArray();
      if (!elements.length) {
        throw new Error(`未找到即将上映的电影`);
      }
      movies = elements.map(el => {
        const $el = $(el);
        let title = $el.find("h3 a").text().trim();
        if (!title) {
          title = $el.find("h3").text().trim().replace(/\s*\d{1,2}月\d{1,2}日.*$/, '').trim();
        }
        const yearMatch = title.match(/（(\d{4})）$/);
        const year = yearMatch ? yearMatch[1] : null;
        const cleanTitle = title.replace(/（\d{4}）$/, '').trim();
        return { title: cleanTitle, year };
      });
      console.log(movies);
    }

    if (!movies.length) {
      throw new Error("未能解析出有效的电影信息");
    }

    // 使用TMDB获取详细信息
    console.log(`开始从TMDB获取${movies.length}部电影的详细信息...`);
    const results = [];
    for (const movie of movies) {
      const details = await getTmdbDetails(movie.title, movie.year);
      if (details) {
        results.push(details);
      }
      await delay(250); // 添加延迟以避免API限制
    }

    return results;
  } catch (error) {
    console.error(`[电影列表] 获取失败: ${error.message}`);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    // 添加请求延迟
    await delay(2000);

    const [nowplaying, later] = await Promise.all([
      getMovies('nowplaying'),
      getMovies('later')
    ]);

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      nowplaying,
      later
    };

    // 写入文件
    await fs.writeFile(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
🎬 正在热映: ${nowplaying.length}部
🍿 即将上映: ${later.length}部
📊 总计: ${nowplaying.length + later.length}部
🕒 更新时间: ${result.last_updated}
`);

  } catch (error) {
    console.error('💥 程序执行出错:', error);
    process.exit(1);
  }
}

// 执行
main(); 