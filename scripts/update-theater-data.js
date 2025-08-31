import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

// 修复__dirname/__filename在ESModule中的定义（保留原逻辑，补充注释）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 环境变量校验（新增：提前报错，避免后续逻辑无效）
const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  console.error('Error: TMDB_API_KEY environment variable is not set');
  process.exit(1);
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';
// 剧场列表（保留原数据）
const THEATERS = [
  { name: "迷雾剧场", id: "128396349" },
  { name: "白夜剧场", id: "158539495" },
  { name: "季风剧场", id: "153511846" },
  { name: "X剧场", id: "155026800" }
];

/**
 * 解析豆瓣标题，提取纯标题和年份
 * @param {string} doubanTitle - 豆瓣原始标题（如"隐秘的角落 (2020)"）
 * @returns {Object} 含title和year的对象
 */
function parseDoubanTitle(doubanTitle) {
  const match = doubanTitle.match(/^(.*?)(?:\((\d{4})\))?$/);
  if (match) {
    return {
      title: match[1].trim(),
      year: match[2] ? parseInt(match[2], 10) : null,  // 优化：年份转为数字
    };
  }
  return { title: doubanTitle.trim(), year: null };
}

/**
 * 获取单个剧场的豆瓣数据，并补充TMDB信息
 * @param {string} theaterName - 剧场名称
 * @param {string} doulistId - 豆瓣豆列ID
 * @returns {Object} 分类后的已播/待播数据
 */
async function fetchTheaterTitles(theaterName, doulistId) {
  const theaterData = {
    name: theaterName,
    url: `https://m.douban.com/doulist/${doulistId}/`,
    shows: []
  };

  try {
    console.log(`[Start] 获取 ${theaterName} 数据，URL: ${theaterData.url}`);
    
    // 发起豆瓣请求（保留原UA，避免被拦截）
    const response = await axios.get(theaterData.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
      },
      timeout: 15000,  // 优化：超时时间延长至15秒，避免网络波动
    });

    if (!response?.data) {
      console.error(`[Error] ${theaterName} 无返回数据`);
      return { [theaterName]: { aired: [], upcoming: [] } };
    }

    console.log(`[Success] ${theaterName} HTML获取完成，开始解析`);
    const $ = cheerio.load(response.data);
    const items = $('ul.doulist-items > li');
    console.log(`[Parse] 找到 ${items.length} 个剧集项目`);

    const shows = [];
    const itemElements = items.get();
    // 串行处理每个项目（保留限流，避免触发API反爬）
    for (const [index, element] of itemElements.entries()) {
      try {
        const title = $(element).find('.info .title').text().trim();
        const meta = $(element).find('.info .meta').text().trim();

        // 提取年份（优化：兼容无日期的情况）
        const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
        const showTitle = year ? `${title}(${year})` : title;

        // 解析标题
        const { title: cleanTitle, year: parsedYear } = parseDoubanTitle(showTitle);
        if (!cleanTitle) {
          console.log(`[Skip] 第${index + 1}项：标题为空，跳过`);
          continue;
        }

        // 获取TMDB数据
        const tmdbData = await searchTMDB(cleanTitle, parsedYear);
        // 限流200ms（保留，避免TMDB API限流）
        await new Promise(resolve => setTimeout(resolve, 200));

        if (tmdbData) {
          shows.push({ doubanTitle: showTitle, tmdbData });
          console.log(`[Processed] 第${index + 1}项：${showTitle}（TMDB匹配成功）`);
        } else {
          console.log(`[Skipped] 第${index + 1}项：${showTitle}（无TMDB数据）`);
        }

      } catch (error) {
        console.error(`[Error] 处理 ${theaterName} 第${index + 1}项：`, error.message);
        continue;  // 单个项目报错不中断整体流程
      }
    }

    console.log(`[Finish] ${theaterName} 处理完成，共${shows.length}个有效剧集`);

    // 分类已播/待播（优化：日期比较逻辑更严谨）
    const now = new Date();
    const aired = [];
    const upcoming = [];

    for (const show of shows) {
      const releaseDate = show.tmdbData.releaseDate ? new Date(show.tmdbData.releaseDate) : null;
      if (releaseDate && !isNaN(releaseDate.getTime()) && releaseDate <= now) {
        aired.push(show.tmdbData);
      } else {
        upcoming.push(show.tmdbData);
      }
    }

    // 已播剧集按日期降序（保留原逻辑）
    aired.sort((a, b) => {
      const dateA = new Date(a.releaseDate || 0);
      const dateB = new Date(b.releaseDate || 0);
      return dateB - dateA;
    });

    return { [theaterName]: { aired, upcoming } };

  } catch (error) {
    // 细化错误日志（优化：便于排查问题）
    if (error.response) {
      console.error(`[Request Error] ${theaterName}，状态码: ${error.response.status}`);
    } else if (error.request) {
      console.error(`[Request Error] ${theaterName}，无响应（可能被豆瓣拦截）`);
    } else {
      console.error(`[Config Error] ${theaterName}，请求配置错误:`, error.message);
    }
    return { [theaterName]: { aired: [], upcoming: [] } };
  }
}

/**
 * 主函数：更新所有剧场数据并写入文件
 */
async function updateTheaterData() {
  try {
    const theaterResults = [];
    // 串行处理每个剧场（避免并行请求导致反爬）
    for (const theater of THEATERS) {
      const result = await fetchTheaterTitles(theater.name, theater.id);
      theaterResults.push(result);
      // 剧场间增加1秒间隔（新增：避免豆瓣反爬）
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 构建输出数据（保留原时区逻辑）
    const data = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
    };

    // 汇总结果并打印统计
    console.log('\n[Final Stats] TMDB匹配结果：');
    for (const result of theaterResults) {
      const theaterName = Object.keys(result)[0];
      const { aired, upcoming } = result[theaterName];
      data[theaterName] = { aired, upcoming };
      console.log(`- ${theaterName}: 已播${aired.length}部，待播${upcoming.length}部`);
    }

    // 写入文件（保留原路径逻辑）
    const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n[Success] 数据已写入：${outputPath}`);
    return data;

  } catch (error) {
    console.error('[Fatal Error] 整体更新失败：', error.message);
    throw error;
  }
}

/**
 * 调用TMDB API搜索剧集
 * @param {string} title - 剧集标题
 * @param {number|null} year - 播出年份
 * @returns {Object|null} TMDB数据（无匹配则返回null）
 */
async function searchTMDB(title, year = null) {
  try {
    const searchLog = year ? `${title} (${year})` : title;
    console.log(`[TMDB Search] ${searchLog}`);

    // 构建请求参数（保留原逻辑）
    const params = {
      query: title,
      language: 'zh-CN',
      page: 1,  // 仅查第一页（优化：避免冗余请求）
    };
    if (year) params.first_air_date_year = year;

    // 发起TMDB请求（保留原授权逻辑）
    const response = await axios.get(TMDB_BASE_URL, {
      params,
      headers: {
        Authorization: `Bearer ${TMDB_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000,  // 优化：超时时间延长至15秒
    });

    // 处理TMDB响应（优化：匹配逻辑更严谨）
    const { results } = response.data;
    if (!results || results.length === 0) {
      console.log(`[TMDB No Match] ${searchLog}`);
      return null;
    }

    // 查找精确匹配（标题完全一致，年份匹配）
    const exactMatch = results.find(result => {
      const resultTitle = result.name.trim().toLowerCase();
      const targetTitle = title.trim().toLowerCase();
      // 标题完全匹配
      if (resultTitle !== targetTitle) return false;
      // 年份匹配（若有）
      if (!year) return true;
      const resultYear = result.first_air_date ? new Date(result.first_air_date).getFullYear() : null;
      return resultYear === year;
    });

    if (exactMatch) {
      console.log(`[TMDB Match] ${searchLog} -> ${exactMatch.name}`);
      // 整理返回数据（保留原字段逻辑）
      return {
        id: exactMatch.id,
        type: "tmdb",
        title: exactMatch.name,
        description: exactMatch.overview || "暂无简介",  // 优化：处理空简介
        posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : null,
        backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/w500${exactMatch.backdrop_path}` : null,
        releaseDate: exactMatch.first_air_date || null,
        rating: exactMatch.vote_average || 0,  // 优化：处理无评分
        mediaType: "tv"
      };
    }

    console.log(`[TMDB No Exact Match] ${searchLog}`);
    return null;

  } catch (error) {
    console.error(`[TMDB Error] ${title}：`, error.message);
    return null;
  }
}

// 执行主函数（保留原逻辑）
updateTheaterData()
  .then(() => {
    console.log('\n[Complete] 数据更新全部完成');
    process.exit(0);
  })
  .catch(() => {
    console.error('\n[Failed] 数据更新失败');
    process.exit(1);
  });