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
  tmdbApiKey: process.env.TMDB_API_KEY,
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  outputPath: 'data/movies-data.json',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 带重试机制的请求函数
async function requestWithRetry(url, options, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios(url, options);
      return response;
    } catch (error) {
      lastError = error;
      
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`[TMDB] 请求被限制，等待 ${waitTime/1000} 秒后重试 (${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else if (error.response?.status >= 500) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[TMDB] 服务器错误，等待 ${waitTime/1000} 秒后重试 (${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[TMDB] 网络错误，等待 ${waitTime/1000} 秒后重试 (${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// 从TMDB获取电影详情（简化日志）
async function getTmdbDetails(title, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const yearMatch = title.match(/（(\d{4})(?:\(.*?\))?）$/);
      const year = yearMatch ? yearMatch[1] : "";
      const cleanTitle = title.replace(/（\d{4}(?:\(.*?\))?）$/, '').trim();
      
      if (attempt === 1) {
        console.log(`[TMDB] 查询: "${cleanTitle}" (${year || '无年份'})`);
      }
      
      const response = await requestWithRetry(`${config.tmdbBaseUrl}/search/movie`, {
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
      }, 2, 1000);

      if (!response?.data?.results?.length) {
        console.log(`[TMDB] ❌ 未找到: ${cleanTitle}`);
        return null;
      }
      
      // 简化搜索结果日志
      console.log(`[TMDB] 找到 ${response.data.results.length} 个结果`);
      
      let movie = response.data.results.find(
        item => (item.title === cleanTitle || item.original_title === cleanTitle)
      );
      
      if (!movie) {
        movie = response.data.results.find(
          item => 
            item.title.includes(cleanTitle) || 
            item.original_title.includes(cleanTitle) ||
            cleanTitle.includes(item.title) ||
            cleanTitle.includes(item.original_title)
        );
      }
      
      if (!movie) {
        console.log(`[TMDB] ⚠️ 使用近似匹配: ${cleanTitle}`);
        movie = response.data.results[0];
      }
      
      console.log(`[TMDB] ✅ 匹配成功: ${movie.title}`);
      return {
        id: movie.id,
        type: "tmdb",
        title: movie.title,
        originalTitle: movie.original_title,
        description: movie.overview,
        posterPath: movie.poster_path 
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
          : null,
        backdropPath: movie.backdrop_path 
          ? `https://image.tmdb.org/t/p/w500${movie.backdrop_path}` 
          : null,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        mediaType: "movie"
      };
      
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`[TMDB] ❌ 获取失败: ${error.message}`);
        return null;
      }
      
      if (error.response?.status === 429) {
        const waitTime = 5000 * attempt;
        console.log(`[TMDB] ⏳ 频率限制，等待 ${waitTime/1000} 秒`);
        await delay(waitTime);
      } else {
        const waitTime = 2000 * attempt;
        console.log(`[TMDB] 🔄 请求失败，重试中...`);
        await delay(waitTime);
      }
    }
  }
}

// 获取豆瓣电影数据
async function getMovies(params = {}) {
    try {
        const type = params.type || 'nowplaying';
        const url = `https://movie.douban.com/${type}?sequence=asc`;
        
        console.log(`[豆瓣] 获取${type === "coming" ? "即将上映" : "正在热映"}电影列表...`);
        
        const response = await axios.get(url, {
            headers: {
              'User-Agent': config.USER_AGENT,
              'referer': `https://movie.douban.com/${type}?sequence=desc`
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let movies = [];

        if (type === "nowplaying") {
            const elements = $("#nowplaying .lists .list-item").toArray();
            movies = elements.map(el => {
                const $el = $(el);
                let title = $el.attr("data-title") || 
                            $el.find(".stitle a").attr("title") || 
                            $el.find("h3 a").text().trim();
                const year = $el.attr("data-release");
                return `${title}${year ? `（${year}）` : ''}`;
            }).filter(Boolean);
        } else if (type === "coming") {
            const elements = $(".coming_list tbody tr").toArray();
            movies = elements.map(el => {
                const $el = $(el);
                let title = $el.find("td:nth-child(2) a").text().trim();
                if (!title) title = $el.find("td:nth-child(2)").text().trim();
                const dateText = $el.find("td:first-child").text().trim();
                let year = "";
                const yearMatch = dateText.match(/(\d{4})年|\b(20\d{2})\b/);
                if (yearMatch) year = yearMatch[1] || yearMatch[2];
                return `${title}${year ? `（${year}）` : ''}`;
            }).filter(Boolean);
        }
        
        console.log(`[豆瓣] 获取到 ${movies.length} 部电影`);
        
        const results = [];
        let successCount = 0;
        
        for (const movie of movies) {
            try {
                const details = await getTmdbDetails(movie);
                if (details) {
                    results.push(details);
                    successCount++;
                }
                await delay(800 + Math.random() * 400);
            } catch (error) {
                console.error(`[错误] 处理电影失败: ${movie}`);
            }
        }
        
        console.log(`[豆瓣] 成功获取 ${successCount}/${movies.length} 部电影详情`);
        return results;
    } catch (error) {
        console.error(`[豆瓣] 获取电影列表失败: ${error.message}`);
        return [];
    }
}

// 获取经典影片排行
async function getClassicRank() {
  try {
    console.log('[猫眼] 获取经典影片榜单...');
    
    const response = await axios.get("https://m.maoyan.com/asgard/board/4", {
      headers: {
        "User-Agent": config.USER_AGENT,
        "referer": "https://m.maoyan.com/asgard/board/4"
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const movieCards = $('.board-card');
    
    const movies = movieCards.map((i, card) => {
      const $card = $(card);
      const title = $card.find('.title').text().trim();
      const date = $card.find('.date').text().trim();
      const year = date ? date.split('-')[0] : '';
      return `${title}${year ? `（${year}）` : ''}`;
    }).get();
    
    console.log(`[猫眼] 获取到 ${movies.length} 部经典影片`);
    
    const tmdbResults = [];
    let successCount = 0;
    
    for (const movie of movies) {
      try {
        const result = await getTmdbDetails(movie);
        if (result) {
          tmdbResults.push(result);
          successCount++;
        }
        await delay(800 + Math.random() * 400);
      } catch (error) {
        console.error(`[错误] 获取电影详情失败: ${movie}`);
      }
    }
    
    console.log(`[猫眼] 成功获取 ${successCount}/${movies.length} 部经典影片详情`);
    return tmdbResults;
  } catch (error) {
    console.error("[猫眼] 获取经典影片榜单失败:", error.message);
    return [];
  }
}

// 获取2025年度电影榜单
async function getYearlyMovies() {
  const doulistId = '160478173';
  const baseUrl = `https://m.douban.com/doulist/${doulistId}/`;
  let allMovies = [];
  let start = 0;
  const pageSize = 25;
  let hasNextPage = true;
  let pageCount = 0;

  try {
    console.log('[年度] 获取2025年度电影榜单...');
    
    while (hasNextPage && pageCount < 5) {
      pageCount++;
      const pageUrl = start === 0 ? baseUrl : `${baseUrl}?start=${start}`;
      
      try {
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
            'referer': 'https://www.douban.com/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          },
          timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const items = $('ul.doulist-items > li');
        
        const pageMovies = [];
        items.each((index, element) => {
          const title = $(element).find('.info .title').text().trim();
          const meta = $(element).find('.info .meta').text().trim();
          const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
          const year = yearMatch?.[1] || '';
          if (title) {
            const showTitle = year ? `${title}（${year}）` : title;
            pageMovies.push(showTitle);
          }
        });
        
        allMovies = allMovies.concat(pageMovies);
        console.log(`[年度] 第 ${pageCount} 页获取 ${pageMovies.length} 部电影`);

        if (items.length < pageSize) {
          hasNextPage = false;
        } else {
          start += pageSize;
        }

        await delay(1500);
        
      } catch (error) {
        console.error(`[年度] 获取第 ${pageCount} 页失败: ${error.message}`);
        hasNextPage = false;
      }
    }

    console.log(`[年度] 总共获取 ${allMovies.length} 部电影`);
    
    const tmdbResults = [];
    let successCount = 0;
    
    for (const movie of allMovies) {
      try {
        const result = await getTmdbDetails(movie);
        if (result) {
          tmdbResults.push(result);
          successCount++;
        }
        await delay(800 + Math.random() * 400);
      } catch (error) {
        console.error(`[错误] 处理电影失败: ${movie}`);
      }
    }
    
    console.log(`[年度] 成功获取 ${successCount}/${allMovies.length} 部电影详情`);
    return tmdbResults;

  } catch (error) {
    console.error("[年度] 获取年度电影榜单失败:", error.message);
    return [];
  }
}

// 进度跟踪器
class ProgressTracker {
  constructor(total, name) {
    this.total = total;
    this.current = 0;
    this.name = name;
    this.startTime = Date.now();
  }
  
  increment() {
    this.current++;
    const progress = Math.round((this.current / this.total) * 100);
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    process.stdout.write(`\r[${this.name}] 进度: ${this.current}/${this.total} (${progress}%) 耗时: ${elapsed}s`);
    
    if (this.current === this.total) {
      console.log(` ✅ 完成`);
    }
  }
}

// 主函数
async function main() {
  try {
    console.log("🎬 开始数据采集...\n");
    
    // 使用进度跟踪器
    const [nowplaying, coming, classics, yearly2025] = await Promise.all([
      getMovies({ type: 'nowplaying' }),
      getMovies({ type: 'coming' }),
      getClassicRank(),
      getYearlyMovies()
    ]);

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      nowplaying,
      coming,
      classics,
      yearly2025
    };

    // 确保目录存在
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
┌─────────────────┬────────┬────────────┐
│     类别        │  数量  │   状态     │
├─────────────────┼────────┼────────────┤
│ 🎬 正在热映     │ ${nowplaying.length.toString().padEnd(6)} │ ✅ 完成     │
│ 🍿 即将上映     │ ${coming.length.toString().padEnd(6)} │ ✅ 完成     │
│ 📜 经典影片     │ ${classics.length.toString().padEnd(6)} │ ✅ 完成     │
│ 🎯 2025年度     │ ${yearly2025.length.toString().padEnd(6)} │ ✅ 完成     │
└─────────────────┴────────┴────────────┘
📅 更新时间: ${result.last_updated}
💾 保存路径: ${path.resolve(config.outputPath)}
`);
  } catch (error) {
    console.error('❌ 程序执行出错:', error.message);
    process.exit(1);
  }
}

// 执行
main();
