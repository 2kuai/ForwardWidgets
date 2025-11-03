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
      console.log(`[TMDB] 🌐 发送请求 (${attempt}/${maxRetries}): ${url}`);
      const response = await axios(url, options);
      console.log(`[TMDB] ✅ 请求成功: ${response.status}`);
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
        console.log(`[TMDB] ❌ 未找到电影: ${cleanTitle}`);
        return null;
      }
      
      // 调试：打印所有搜索结果
      console.log(`[TMDB] 🔍 找到 ${response.data.results.length} 个结果:`);
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
        console.log(`[TMDB] ⚠️ 未找到完全匹配的电影: ${cleanTitle}，使用第一个结果`);
        movie = response.data.results[0];
      }
      
      console.log(`[TMDB] ✅ 成功匹配电影: ${movie.title} (${movie.original_title})`);
      
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
        console.error(`[TMDB] 💥 获取电影详情失败 (${maxRetries}次尝试后): ${error.message}`);
        return null;
      }
      
      if (error.response?.status === 429) {
        // 429错误，等待更长时间
        const waitTime = 5000 * attempt; // 逐渐增加等待时间
        console.log(`[TMDB] ⏳ 请求频率限制，等待 ${waitTime/1000} 秒后重试`);
        await delay(waitTime);
      } else {
        // 其他错误，等待较短时间后重试
        const waitTime = 2000 * attempt;
        console.log(`[TMDB] ⚠️ 请求失败，等待 ${waitTime/1000} 秒后重试`);
        await delay(waitTime);
      }
    }
  }
}

// 注释掉：获取豆瓣正在热映和即将上映电影
/*
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
*/

// 注释掉：获取经典影片排行
/*
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
*/

// 获取年度电影榜单（从豆瓣片单获取2025年度国内院线电影，支持翻页和TMDB查询）
async function getYearlyMovies() {
  const doulistId = '160478173';
  const baseUrl = `https://m.douban.com/doulist/${doulistId}/`;
  let allMovies = [];
  let start = 0;
  const pageSize = 25;
  let hasNextPage = true;
  let pageCount = 0;

  try {
    console.log('🎯 开始获取2025年度国内院线电影榜单...');
    console.log('📝 片单URL:', baseUrl);
    
    // 第一步：获取所有电影标题（支持翻页）
    while (hasNextPage && pageCount < 5) { // 限制最多5页防止无限循环
      pageCount++;
      const pageUrl = start === 0 ? baseUrl : `${baseUrl}?start=${start}`;
      
      console.log(`\n=== 第 ${pageCount} 页 ===`);
      console.log('请求URL:', pageUrl);
      
      try {
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': config.USER_AGENT,
            'referer': 'https://www.douban.com/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          },
          timeout: 15000
        });

        console.log('✅ 页面请求成功');
        console.log('响应状态码:', response.status);
        console.log('响应数据长度:', response.data?.length);

        // 检查是否是验证页面或错误页面
        if (!response.data) {
          console.error('❌ 响应数据为空');
          break;
        }

        if (response.data.includes('检测到有异常请求')) {
          console.error('❌ 触发反爬虫验证');
          break;
        }

        if (response.data.includes('页面不存在')) {
          console.error('❌ 页面不存在');
          break;
        }

        const $ = cheerio.load(response.data);
        
        // 调试：打印页面标题
        const pageTitle = $('title').text();
        console.log('页面标题:', pageTitle);

        // 检查是否有电影项目
        const movieItems = $('.doulist-item');
        console.log(`找到 ${movieItems.length} 个 .doulist-item 元素`);

        // 如果没有找到电影项目，尝试其他选择器
        if (movieItems.length === 0) {
          console.log('⚠️ 尝试其他选择器...');
          const alternativeItems = $('[id*="doulist"], .list-item, .item');
          console.log(`备用选择器找到 ${alternativeItems.length} 个元素`);
        }

        // 解析当前页的电影信息
        const pageMovies = [];
        movieItems.each((index, element) => {
          const $el = $(element);
          
          // 调试每个项目的HTML结构
          const itemHtml = $el.html().substring(0, 200); // 只取前200字符
          console.log(`项目 ${index + 1} 部分HTML:`, itemHtml);
          
          // 尝试多种选择器获取标题
          let title = $el.find('.title a').text().trim();
          if (!title) title = $el.find('h3 a').text().trim();
          if (!title) title = $el.find('a').first().text().trim();
          
          console.log(`项目 ${index + 1} 原始标题:`, title);

          if (title) {
            const yearMatch = title.match(/（(\d{4})）$/);
            const year = yearMatch?.[1] || '';
            const cleanTitle = title.replace(/（\d{4}）$/, '').trim();
            
            const movieInfo = {
              doubanTitle: year ? `${cleanTitle}（${year}）` : cleanTitle,
              title: cleanTitle,
              year: year,
              rawTitle: title
            };
            
            pageMovies.push(movieInfo);
            console.log(`✅ 解析成功: ${movieInfo.doubanTitle}`);
          } else {
            console.log(`❌ 项目 ${index + 1} 标题解析失败`);
          }
        });

        allMovies = allMovies.concat(pageMovies);
        console.log(`📊 第 ${pageCount} 页解析完成，有效电影: ${pageMovies.length} 部`);
        console.log('当前累计电影:', allMovies.length);

        // 判断是否有下一页
        const nextPageLink = $('.paginator .next a');
        const hasNextLink = nextPageLink.length > 0;
        
        if (hasNextLink) {
          const nextHref = nextPageLink.attr('href');
          console.log('下一页链接:', nextHref);
          start = parseInt(nextHref?.match(/start=(\d+)/)?.[1]) || start + pageSize;
        } else {
          console.log('📄 没有下一页链接');
        }

        // 检查是否应该继续翻页
        if (!hasNextLink && movieItems.length < pageSize) {
          hasNextPage = false;
          console.log('🚩 停止翻页：没有下一页且当前页项目不足');
        } else if (hasNextLink) {
          console.log('➡️ 继续获取下一页...');
        } else {
          hasNextPage = false;
          console.log('🚩 停止翻页：没有下一页链接');
        }

        await delay(2000); // 页面间延迟增加至2秒
        
      } catch (error) {
        console.error(`❌ 获取第 ${pageCount} 页失败:`, error.message);
        console.error('错误详情:', error.response?.status, error.response?.data?.substring(0, 200));
        hasNextPage = false;
        break;
      }
    }

    console.log(`\n🎯 年度电影榜单获取完成`);
    console.log(`总页数: ${pageCount}`);
    console.log(`总电影数: ${allMovies.length}`);
    console.log('电影列表:', allMovies.map(m => m.doubanTitle));

    // 如果豆瓣解析失败，使用备选方案
    if (allMovies.length === 0) {
      console.log('⚠️ 豆瓣解析失败，使用备选电影列表');
      allMovies = [
        { doubanTitle: "流浪地球2（2023）", title: "流浪地球2", year: "2023" },
        { doubanTitle: "满江红（2023）", title: "满江红", year: "2023" },
        { doubanTitle: "深海（2023）", title: "深海", year: "2023" }
      ];
      console.log('使用备选电影列表:', allMovies.map(m => m.doubanTitle));
    }

    // 第二步：使用TMDB API获取每部电影的详细信息
    const tmdbResults = [];
    console.log('\n=== 开始TMDB匹配 ===');
    
    for (const [index, movie] of allMovies.entries()) {
      try {
        console.log(`\n🎬 处理第 ${index + 1}/${allMovies.length} 部电影: ${movie.doubanTitle}`);
        
        const result = await getTmdbDetails(movie.doubanTitle);
        if (result) {
          tmdbResults.push(result);
          console.log(`✅✅ TMDB匹配成功: ${result.title} (ID: ${result.id})`);
        } else {
          console.log(`❌❌ TMDB未匹配到: ${movie.doubanTitle}`);
        }
        
        // 在电影之间添加延迟
        await delay(1500 + Math.random() * 1000);
        
      } catch (error) {
        console.error(`💥 处理电影失败: ${movie.doubanTitle}`, error.message);
      }
    }

    console.log(`\n🎉 年度电影榜单最终结果: ${tmdbResults.length} 部电影`);
    return tmdbResults;

  } catch (error) {
    console.error("💥 获取年度电影榜单失败:", error);
    // 返回空数组而不是抛出错误，保证程序继续运行
    return [];
  }
}

// 主函数
async function main() {
  try {
    await delay(2000);
    console.log("🎬 开始数据采集（仅获取2025年度电影）...");

    // 注释掉其他数据源，只保留年度电影
    /*
    const [nowplaying, coming, classics] = await Promise.all([
      getMovies({ type: 'nowplaying' }),
      getMovies({ type: 'coming' }),
      getClassicRank(),
    ]);
    */

    // 只获取年度电影数据
    const yearly = await getYearlyMovies();

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      // 注释掉其他字段
      // nowplaying: [],
      // coming: [],
      // classics: [],
      yearly: yearly // 只保留年度电影数据
    };

    // 确保目录存在
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    await fs.writeFile(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
🎯 年度电影: ${yearly.length}部
🕒 更新时间: ${result.last_updated}
📁 数据已保存至: ${path.resolve(config.outputPath)}
`);
  } catch (error) {
    console.error('💥 程序执行出错:', error);
    process.exit(1);
  }
}

// 执行
main();
