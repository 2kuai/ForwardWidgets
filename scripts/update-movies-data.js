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
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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

    let results = [];
    if (type === "nowplaying") {
      const selector = "#nowplaying .list-item";
      const elements = $(selector).toArray();
      if (!elements.length) {
        throw new Error(`未找到正在上映的电影`);
      }
      results = elements.map(el => {
        const $el = $(el);
        return {
          id: $el.attr("id"),
          type: "douban",
          title: $el.attr("data-title") || $el.find(".stitle a").attr("title"),
          mediaType: "movie"
        };
      }).filter(movie => movie.id && movie.title);
    } else if (type === "later") {
      const selector = "#showing-soon .item.mod";
      const elements = $(selector).toArray();
      if (!elements.length) {
        throw new Error(`未找到即将上映的电影`);
      }
      results = elements.map(el => {
        const $el = $(el);
        let title = $el.find("h3 a").text().trim();
        if (!title) {
          title = $el.find("h3").text().trim().replace(/\s*\d{1,2}月\d{1,2}日.*$/, '').trim();
        }
        let idMatch = $el.find("h3 a").attr("href")?.match(/subject\/(\d+)/);
        let id = idMatch ? idMatch[1] : null;
        return {
          id: id,
          type: "douban",
          title: title,
          mediaType: "movie"
        };
      }).filter(movie => movie.id && movie.title);
    }

    if (!results.length) {
      throw new Error("未能解析出有效的电影信息");
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