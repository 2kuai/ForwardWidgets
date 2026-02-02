import axios from 'axios';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import UserAgent from 'user-agents';

// --- 配置与常量 ---
const config = {
  tmdbApiKey: process.env.TMDB_API_KEY,
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  outputPath: './data/movies-data.json',
  concurrency: 3, // TMDB 并发数
};

const GENRE_MAP = {
  28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片", 18: "剧情", 
  10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 
  10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部", 
  10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻", 
  10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

const limit = pLimit(config.concurrency);
const getUA = () => new UserAgent({ deviceCategory: 'desktop' }).toString();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 工具函数：重试逻辑 ---
/**
 * 带有指数退避的重试包装器
 */
async function withRetry(fn, retries = 3, baseDelay = 2000) {
  try {
    return await fn();
  } catch (error) {
    const isRetryable = !error.response || error.response.status === 429 || error.response.status >= 500;
    if (retries > 0 && isRetryable) {
      // 如果是 429 (Too Many Requests)，等待时间加长
      const waitTime = error.response?.status === 429 ? baseDelay * 2 : baseDelay;
      console.warn(`⚠️ 请求失败: ${error.message}，正在重试... 剩余次数: ${retries}`);
      await delay(waitTime);
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    throw error;
  }
}

// --- 核心逻辑：TMDB 数据获取 ---
async function getTmdbDetails(rawTitle) {
  return limit(() => withRetry(async () => {
    // 提取年份和清洗标题
    const yearMatch = rawTitle.match(/[(（](\d{4})[)）]/);
    const year = yearMatch ? yearMatch[1] : "";
    const cleanTitle = rawTitle.replace(/[(（].*?[)）]/g, '').trim();

    const res = await axios.get(`${config.tmdbBaseUrl}/search/movie`, {
      params: { query: cleanTitle, language: 'zh-CN', year: year },
      headers: { 
        'Authorization': `Bearer ${config.tmdbApiKey}`,
        'User-Agent': getUA()
      },
      timeout: 10000
    });

    const results = res.data.results;
    if (!results?.length) {
      console.log(`[TMDB] ❌ 未找到: ${cleanTitle}`);
      return null;
    }

    const movie = results.find(m => m.title === cleanTitle || m.original_title === cleanTitle) || results[0];
    
    // 标签映射
    const genres = (movie.genre_ids || [])
      .map(id => GENRE_MAP[id])
      .filter(Boolean)
      .slice(0, 3);

    return {
      id: movie.id,
      type: "tmdb",
      title: movie.title,
      description: movie.overview,
      posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdropPath: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      rating: movie.vote_average,
      releaseDate: movie.release_date,
      genres: genres,
      mediaType: "movie"
    };
  }));
}

// --- 爬虫模块 ---
const Scrapers = {
  async getDouban(type) {
    return withRetry(async () => {
      const url = `https://movie.douban.com/${type}`;
      const res = await axios.get(url, { 
        headers: { 'User-Agent': getUA(), 'Referer': 'https://movie.douban.com/' },
        timeout: 10000 
      });
      const $ = cheerio.load(res.data);
      const titles = [];

      if (type === 'nowplaying') {
        $('#nowplaying .list-item').each((_, el) => {
          const t = $(el).attr('data-title');
          const r = $(el).attr('data-release');
          if (t) titles.push(`${t}${r ? `（${r}）` : ''}`);
        });
      } else {
        $('.coming_list tbody tr').each((_, el) => {
          const t = $(el).find('td:nth-child(2) a').text().trim();
          const y = $(el).find('td:first-child').text().trim().match(/\d{4}/)?.[0] || "";
          if (t) titles.push(`${t}${y ? `（${y}）` : ''}`);
        });
      }
      return titles;
    });
  },

  async getMaoyan() {
    return withRetry(async () => {
      const res = await axios.get("https://m.maoyan.com/asgard/board/4", {
        headers: { 'User-Agent': getUA() },
        timeout: 10000
      });
      const $ = cheerio.load(res.data);
      return $('.board-card .title').map((_, el) => $(el).text().trim()).get();
    });
  }
};

// --- 主函数 ---
async function main() {
  console.time('🚀 脚本总执行耗时');
  
  if (!config.tmdbApiKey) {
    console.error("❌ 错误: 未检测到 TMDB_API_KEY 环境变量");
    process.exit(1);
  }

  try {
    console.log("📦 正在拉取各平台原始数据...");
    const [dbNow, dbSoon, myClassic] = await Promise.all([
      Scrapers.getDouban('nowplaying').catch(() => []),
      Scrapers.getDouban('coming').catch(() => []),
      Scrapers.getMaoyan().catch(() => [])
    ]);

    // 汇总并去重，避免重复请求 TMDB
    const allUniqueTitles = [...new Set([...dbNow, ...dbSoon, ...myClassic])];
    console.log(`🔍 待处理唯一影片数: ${allUniqueTitles.length}`);

    // 并发获取详情
    const movieMap = new Map();
    const detailsResults = await Promise.all(allUniqueTitles.map(title => getTmdbDetails(title)));
    
    allUniqueTitles.forEach((title, index) => {
      if (detailsResults[index]) movieMap.set(title, detailsResults[index]);
    });

    // 组装最终 JSON
    const finalData = {
      updated_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      now_playing: dbNow.map(t => movieMap.get(t)).filter(Boolean),
      coming_soon: dbSoon.map(t => movieMap.get(t)).filter(Boolean),
      classics: myClassic.map(t => movieMap.get(t)).filter(Boolean)
    };

    // 写入文件
    const dir = path.dirname(config.outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(config.outputPath, JSON.stringify(finalData, null, 2));

    console.log(`\n✅ 数据更新成功！`);
    console.table({
      '正在热映': finalData.now_playing.length,
      '即将上映': finalData.coming_soon.length,
      '经典推荐': finalData.classics.length,
      '匹配总数': movieMap.size
    });

  } catch (err) {
    console.error("🚨 脚本执行中断:", err.message);
    process.exit(1);
  }
  
  console.timeEnd('🚀 脚本总执行耗时');
}

main();
