import axios from 'axios';
import cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
const config = {
  doubanBaseUrl: 'https://movie.douban.com/cinema',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  outputPath: path.join(__dirname, '..', 'data', 'movies-data.json'),
  backupPath: path.join(__dirname, '..', 'data', 'movies-data.backup.json'),
  maxRetries: 3,
  retryDelay: 5000, // 5秒
  requestDelay: 2000, // 2秒
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

// 数据清理函数
function cleanMovieData(movie) {
  return {
    ...movie,
    title: movie.title?.trim().replace(/\s+/g, ' '),
    id: movie.id?.trim(),
    type: "douban",
    mediaType: "movie"
  };
}

// 数据验证函数
function validateMovie(movie) {
  return movie.id && movie.title && movie.id.length > 0 && movie.title.length > 0;
}

// 获取豆瓣电影数据（带重试机制）
async function fetchDoubanMovies(type, retryCount = 0) {
  try {
    const url = `${config.doubanBaseUrl}/${type}/shanghai/`;
    console.log(`🔄 正在获取${type === 'nowplaying' ? '正在热映' : '即将上映'}电影...`);

    // 添加请求延迟
    await delay(config.requestDelay);

    const response = await axios.get(url, {
      headers: config.headers,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const movies = new Map(); // 使用Map去重

    $(type === 'nowplaying' ? '#nowplaying .list-item' : '#showing-soon .item.mod').each((_, el) => {
      const $el = $(el);
      const movie = cleanMovieData({
        id: $el.attr('id') || $el.find('h3 a').attr('href')?.match(/subject\/(\d+)/)?.[1],
        title: type === 'nowplaying' 
          ? $el.attr('data-title') || $el.find('.stitle a').attr('title')
          : ($el.find('h3 a').text().trim() || $el.find('h3').text().trim().replace(/\s*\d{1,2}月\d{1,2}日.*$/, '')).trim()
      });

      if (validateMovie(movie)) {
        movies.set(movie.id, movie);
      }
    });

    return Array.from(movies.values());

  } catch (error) {
    console.error(`❌ ${type}获取失败:`, error.message);
    
    if (retryCount < config.maxRetries) {
      console.log(`⏳ 将在${config.retryDelay/1000}秒后重试... (${retryCount + 1}/${config.maxRetries})`);
      await delay(config.retryDelay);
      return fetchDoubanMovies(type, retryCount + 1);
    }
    
    return [];
  }
}

// 备份当前数据
async function backupCurrentData() {
  try {
    await fs.copyFile(config.outputPath, config.backupPath);
    console.log('📦 已备份当前数据');
  } catch (error) {
    console.warn('⚠️ 备份数据失败:', error.message);
  }
}

// 主函数
async function main() {
  try {
    // 备份当前数据
    await backupCurrentData();

    const [nowplaying, later] = await Promise.all([
      fetchDoubanMovies('nowplaying'),
      fetchDoubanMovies('later')
    ]);

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      nowplaying,
      later,
      total: nowplaying.length + later.length
    };

    // 创建data目录（如果不存在）
    await fs.mkdir(path.dirname(config.outputPath), { recursive: true });
    
    // 写入文件
    await fs.writeFile(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
🎬 正在热映: ${nowplaying.length}部
🍿 即将上映: ${later.length}部
📊 总计: ${result.total}部
🕒 更新时间: ${result.last_updated}
`);

  } catch (error) {
    console.error('💥 程序执行出错:', error);
    process.exit(1);
  }
}

// 执行
main();
