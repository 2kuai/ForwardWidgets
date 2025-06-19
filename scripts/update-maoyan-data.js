import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前模块的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  throw new Error('TMDB_API_KEY 环境变量未设置');
}
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_REQUEST_DELAY = 250; // TMDB请求间隔(毫秒)
const OUTPUT_PATH = path.join(__dirname, '../data/maoyan-data.json'); // 输出路径

const PLATFORMS = [
  { title: "全网", value: "0" },
  { title: "优酷", value: "1" },
  { title: "爱奇艺", value: "2" },
  { title: "腾讯视频", value: "3" },
  { title: "乐视视频", value: "4" },
  { title: "搜狐视频", value: "5" },
  { title: "PPTV", value: "6" },
  { title: "芒果TV", value: "7" }
];

// 工具函数
function cleanShowName(showName) {
  return showName.replace(/(第[\d一二三四五六七八九十]+季)/g, '').trim();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TMDB数据处理
async function searchTMDB(showName) {
  try {
    const cleanedName = cleanShowName(showName);
    const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
      params: {
        query: cleanedName,
        language: 'zh-CN'
      },
      headers: {
        'Authorization': `Bearer ${TMDB_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    const data = response.data;
    
    if (data.results && data.results.length > 0) {
      const bestMatch = data.results[0];
      return {
        id: bestMatch.id,
        type: "tmdb",
        title: bestMatch.name,
        description: bestMatch.overview,
        posterPath: bestMatch.poster_path 
          ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` 
          : null,
        backdropPath: bestMatch.backdrop_path 
          ? `https://image.tmdb.org/t/p/w500${bestMatch.backdrop_path}` 
          : null,
        releaseDate: bestMatch.first_air_date,
        rating: bestMatch.vote_average,
        mediaType: "tv"
      };
    }
    return null;
  } catch (error) {
    console.error(`[TMDB] 搜索失败 "${showName}": ${error.message}`);
    return null;
  }
}

// 猫眼数据抓取
async function fetchPlatformData(platformValue, platformTitle, seriesType) {
  try {
    const today = new Date();
    const showDate = today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    console.log(`[${platformTitle}] 正在获取${seriesType === '2' ? '综艺' : '剧集'}数据...`);
    
    const url = `https://piaofang.maoyan.com/dashboard/webHeatData?showDate=${showDate}&seriesType=${seriesType}&platformType=${platformValue}`;
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "referer": "https://piaofang.maoyan.com/dashboard/web-heat"
      },
      timeout: 10000 // 10秒超时
    });

    if (response.data?.dataList?.list) {
      const shows = response.data.dataList.list
        .filter(item => item.seriesInfo?.name)
        .map(item => ({
          originalName: item.seriesInfo.name,
          cleanedName: cleanShowName(item.seriesInfo.name)
        }));
      
      const enhancedShows = [];
      for (const show of shows) {
        await delay(TMDB_REQUEST_DELAY);
        const tmdbData = await searchTMDB(show.cleanedName);
        if (tmdbData) {
          enhancedShows.push(tmdbData);
        }
      }
      return enhancedShows;
    }
    return [];
  } catch (error) {
    console.error(`[${platformTitle}] 数据获取失败:`, error.message);
    return [];
  }
}

// 主函数
async function main() {
  const result = {
    last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
    tv: {},
    show: {}
  };

  // 并行获取所有平台数据
  await Promise.all([
    // 剧集数据
    (async () => {
      const tvResults = await Promise.all(
        PLATFORMS.map(async platform => ({
          platform: platform.title,
          shows: await fetchPlatformData(platform.value, platform.title, '')
        }))
      );
      tvResults.forEach(r => { result.tv[r.platform] = r.shows; });
    })(),
    
    // 综艺数据
    (async () => {
      const showResults = await Promise.all(
        PLATFORMS.map(async platform => ({
          platform: platform.title,
          shows: await fetchPlatformData(platform.value, platform.title, '2')
        }))
      );
      showResults.forEach(r => { result.show[r.platform] = r.shows; });
    })()
  ]);

  // 保存数据
  const dataDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`数据已保存至: ${OUTPUT_PATH}`);
}

// 执行入口
main().catch(error => {
  console.error('脚本执行出错:', error);
  process.exit(1);
});
