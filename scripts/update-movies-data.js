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
        // 429错误，需要等待更长时间
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
        
        console.log(`[TMDB] 请求被限制，等待 ${waitTime/1000} 秒后重试 (${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else if (error.response?.status >= 500) {
        // 服务器错误，重试
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[TMDB] 服务器错误，等待 ${waitTime/1000} 秒后重试 (${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        // 网络错误，重试
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[TMDB] 网络错误 ${error.code}，等待 ${waitTime/1000} 秒后重试 (${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else {
        // 其他错误，不重试
        throw error;
      }
    }
  }
  
  throw lastError;
}

// 从TMDB获取电影详情（带重试机制）
async function getTmdbDetails(title, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 提取年份（支持多种格式：电影名（1998）、电影名（1998美国）、电影名（1998(罗马尼亚)）等）
      const yearMatch = title.match(/（(\d{4})(?:\(.*?\))?）$/); // 匹配年份，可能后面跟着括号内的国家信息
      const year = yearMatch ? yearMatch[1] : "";
      
      // 清除标题中的年份和国家信息部分
      const cleanTitle = title.replace(/（\d{4}(?:\(.*?\))?）$/, '').trim();
      
      console.log(`[TMDB] 查询电影: "${cleanTitle}" (${year || '无年份'}) [尝试 ${attempt}/${maxRetries}]`);
      
      // 调用TMDB搜索API（使用带重试的请求）
      const response = await requestWithRetry(`${config.tmdbBaseUrl}/search/movie`, {
        params: {
          query: cleanTitle,  // 查询标题
          language: 'zh-CN',  // 中文结果
          year: year          // 年份筛选
        },
        headers: {
          'Authorization': `Bearer ${config.tmdbApiKey}`,
          'Accept': 'application/json'
        },
        timeout: 10000  // 10秒超时
      }, 2, 1000); // 内部请求重试2次，基础延迟1秒

      // 如果没有结果
      if (!response?.data?.results?.length) {
        console.log(`[TMDB] 未找到电影: ${cleanTitle}`);
        return null;
      }
      
      // 调试：打印所有搜索结果
      console.log(`[TMDB] 找到 ${response.data.results.length} 个结果:`);
      response.data.results.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title} (${item.original_title}) - ${item.release_date}`);
      });
      
      // 寻找匹配的条目（中文名或原名）
      let movie = response.data.results.find(
        item => 
          (item.title === cleanTitle || item.original_title === cleanTitle)
      );
      
      // 如果没有完全匹配，尝试模糊匹配（包含关系）
      if (!movie) {
        movie = response.data.results.find(
          item => 
            item.title.includes(cleanTitle) || 
            item.original_title.includes(cleanTitle) ||
            cleanTitle.includes(item.title) ||
            cleanTitle.includes(item.original_title)
        );
      }
      
      // 如果还是没有匹配，使用第一个结果
      if (!movie) {
        console.log(`[TMDB] 未找到完全匹配的电影: ${cleanTitle}，使用第一个结果`);
        movie = response.data.results[0];
      }
      
      // 返回格式化后的电影信息
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
        console.error(`[TMDB] 获取电影详情失败 (${maxRetries}次尝试后): ${error.message}`);
        return null;
      }
      
      if (error.response?.status === 429) {
        // 429错误，等待更长时间
        const waitTime = 5000 * attempt; // 逐渐增加等待时间
        console.log(`[TMDB] 请求频率限制，等待 ${waitTime/1000} 秒后重试`);
        await delay(waitTime);
      } else {
        // 其他错误，等待较短时间后重试
        const waitTime = 2000 * attempt;
        console.log(`[TMDB] 请求失败，等待 ${waitTime/1000} 秒后重试`);
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
                if (yearMatch) {
                    year = yearMatch[1] || yearMatch[2];
                }
                
                return `${title}${year ? `（${year}）` : ''}`;
            }).filter(Boolean);
        }
        
        console.log(`从豆瓣获取${movies.length}部${type === "coming" ? "即将" : "正在"}上映的电影`);
        
        const results = [];
        for (const movie of movies) {
            try {
                const details = await getTmdbDetails(movie);
                if (details) results.push(details);
                
                // 在电影之间添加更长的延迟，避免触发频率限制
                await delay(1000 + Math.random() * 2000); // 1-3秒随机延迟
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

// 获取经典影片排行
async function getClassicRank() {
  try {
    const response = await axios.get("https://m.maoyan.com/asgard/board/4", {
      headers: {
        "User-Agent": config.USER_AGENT,
        "referer": "https://m.maoyan.com/asgard/board/4"
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // 提取所有电影卡片
    const movieCards = $('.board-card');
    console.log(`从猫眼获取到${movieCards.length}部经典影片`);
    
    // 提取每部电影的名称和上映年份
    const movies = movieCards.map((i, card) => {
      const $card = $(card);
      const title = $card.find('.title').text().trim();
      const date = $card.find('.date').text().trim();
      
      // 从日期中提取年份（如"2018-07-05" → "2018"）
      const year = date ? date.split('-')[0] : '';
      
      return `${title}${year ? `（${year}）` : ''}`;
    }).get();
    
    console.log('经典影片列表:', movies);
    
    const tmdbResults = [];
    for (const movie of movies) {
      try {
        const result = await getTmdbDetails(movie);
        if (result) {
          tmdbResults.push(result);
        } else {
          console.log(`TMDB未匹配到: ${movie}`);
        }
        
        // 在电影之间添加更长的延迟
        await delay(1000 + Math.random() * 2000); // 1-3秒随机延迟
      } catch (error) {
        console.error(`获取电影详情失败: ${movie}`, error);
      }
    }
    
    return tmdbResults;
  } catch (error) {
    console.error("获取经典影片榜单失败:", error);
    return [];
  }
}

// 主函数
async function main() {
  try {
    await delay(2000);
    console.log("开始数据采集...");

    const [nowplaying, coming, classics] = await Promise.all([
      getMovies({ type: 'nowplaying' }),
      getMovies({ type: 'coming' }),
      getClassicRank()
    ]);

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      nowplaying,
      coming,
      classics
    };

    // 确保目录存在
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
🎬🎬🎬🎬 正在热映: ${nowplaying.length}部
🍿🍿🍿🍿 即将上映: ${coming.length}部
📜📜📜📜 经典影片: ${classics.length}部
🕒🕒🕒🕒🕒🕒🕒🕒🕒 更新时间: ${result.last_updated}
数据已保存至: ${path.resolve(config.outputPath)}
`);
  } catch (error) {
    console.error('程序执行出错:', error);
    process.exit(1);
  }
}

// 执行
main();
