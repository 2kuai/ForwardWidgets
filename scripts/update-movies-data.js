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
  concurrency: 2, // 降低并发以应对无缓存的 API 压力
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

// --- 重试逻辑 ---
async function withRetry(fn, retries = 3, baseDelay = 3000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && (!error.response || error.response.status === 429 || error.response.status >= 500)) {
      console.warn(`⚠️ 请求重试中... 剩余次数: ${retries}`);
      await delay(baseDelay);
      return withRetry(fn, retries - 1, baseDelay * 1.5);
    }
    throw error;
  }
}

// --- TMDB 核心获取 (无缓存版) ---
async function getTmdbDetails(rawTitle) {
  return limit(() => withRetry(async () => {
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
    if (!results?.length) return null;

    const movie = results.find(m => m.title === cleanTitle || m.original_title === cleanTitle) || results[0];
    
    return {
      id: movie.id,
      type: "tmdb",
      title: movie.title,
      description: movie.overview,
      posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdropPath: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      rating: movie.vote_average,
      releaseDate: movie.release_date,
      genres: (movie.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 3),
      mediaType: "movie"
    };
  }));
}

// --- 爬虫模块 ---
const Scrapers = {
  async getDoubanTop250() {
    const titles = [];
    for (let i = 0; i < 250; i += 25) {
      console.log(`正在抓取豆瓣 Top 250 (第 ${i + 1} - ${i + 25} 名)`);
      const res = await withRetry(() => axios.get(`https://movie.douban.com/top250?start=${i}`, {
        headers: { 'User-Agent': getUA(), 'Referer': 'https://movie.douban.com/' }
      }));
      const $ = cheerio.load(res.data);
      $('.item').each((_, el) => {
        const t = $(el).find('.title').first().text().trim();
        const y = $(el).find('.bd p').text().trim().match(/\d{4}/)?.[0] || "";
        if (t) titles.push(`${t}${y ? `（${y}）` : ''}`);
      });
      await delay(1500); // 必须的延迟，防止豆瓣封 IP
    }
    return titles;
  },

  async getDouban(type) {
    const res = await withRetry(() => axios.get(`https://movie.douban.com/${type}`, { 
      headers: { 'User-Agent': getUA(), 'Referer': 'https://movie.douban.com/' }
    }));
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
  }
};

async function main() {
  console.time('⏱️ 执行耗时');
  if (!config.tmdbApiKey) { console.error("❌ 缺少 TMDB_API_KEY"); process.exit(1); }

  try {
    console.log("🚀 开始实时同步...");
    const [dbNow, dbSoon, dbTop250] = await Promise.all([
      Scrapers.getDouban('nowplaying').catch(() => []),
      Scrapers.getDouban('coming').catch(() => []),
      Scrapers.getDoubanTop250().catch(() => [])
    ]);

    const allTitles = [...new Set([...dbNow, ...dbSoon, ...dbTop250])];
    console.log(`📡 正在请求 TMDB 详情 (共 ${allTitles.length} 部)...`);

    // 实时并发获取
    const movieMap = new Map();
    const results = await Promise.all(allTitles.map(t => getTmdbDetails(t)));
    allTitles.forEach((t, i) => { if (results[i]) movieMap.set(t, results[i]); });

    const finalData = {
      updated_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      now_playing: dbNow.map(t => movieMap.get(t)).filter(Boolean),
      coming_soon: dbSoon.map(t => movieMap.get(t)).filter(Boolean),
      top250: dbTop250.map(t => movieMap.get(t)).filter(Boolean)
    };

    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, JSON.stringify(finalData, null, 2));
    
    console.log(`\n✅ 数据已写入: ${config.outputPath}`);
  } catch (err) {
    console.error("🚨 执行失败:", err.message);
    process.exit(1);
  }
  console.timeEnd('⏱️ 执行耗时');
}

main();
