const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 配置项
const config = {
  doubanBaseUrl: 'https://movie.douban.com/cinema',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  outputPath: path.join('data', 'movies-data.json') // 修改为指定路径
};

// 获取豆瓣电影数据
async function fetchDoubanMovies(type) {
  try {
    const url = `${config.doubanBaseUrl}/${type}/shanghai/`;
    console.log(`🔄 正在获取${type === 'nowplaying' ? '正在热映' : '即将上映'}电影...`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': config.userAgent,
        'Referer': 'https://sec.douban.com/'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const movies = [];

    $(type === 'nowplaying' ? '#nowplaying .list-item' : '#showing-soon .item.mod').each((_, el) => {
      const $el = $(el);
      const movie = {
        id: $el.attr('id') || $el.find('h3 a').attr('href')?.match(/subject\/(\d+)/)?.[1],
        type: "douban",
        title: type === 'nowplaying' 
          ? $el.attr('data-title') || $el.find('.stitle a').attr('title')
          : ($el.find('h3 a').text().trim() || $el.find('h3').text().trim().replace(/\s*\d{1,2}月\d{1,2}日.*$/, '')).trim(),
        mediaType: "movie"
      };
      if (movie.id && movie.title) movies.push(movie);
    });

    return movies;

  } catch (error) {
    console.error(`❌ ${type}获取失败:`, error.message);
    return [];
  }
}

// 主函数
async function main() {
  try {
    const [nowplaying, later] = await Promise.all([
      fetchDoubanMovies('nowplaying'),
      fetchDoubanMovies('later')
    ]);

    const result = {
      last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
      nowplaying,
      later
    };

    // 创建data目录（如果不存在）
    fs.mkdirSync(path.dirname(config.outputPath), { recursive: true });
    
    // 写入文件
    fs.writeFileSync(config.outputPath, JSON.stringify(result, null, 2));
    
    console.log(`
✅ 数据采集完成！
🎬 正在热映: ${nowplaying.length}部
🍿 即将上映: ${later.length}部
🕒 更新时间: ${result.last_updated}
`);

  } catch (error) {
    console.error('💥 程序执行出错:', error);
    process.exit(1);
  }
}

// 执行
main();
