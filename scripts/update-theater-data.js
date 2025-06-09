const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3NzE0YWYxZGMwZDA3ZjVkODA1ZDEzNGQwMGZkZGM5ZCIsIm5iZiI6MTc0MzI1NDg0NS4wNCwic3ViIjoiNjdlN2Y1M2RiNTY1NWFhYzQyNjM4ODk2Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.rBotPSAvlgM8mMWI4_NVLEU-ssD9plLdA-r17bPA3aA';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function fetchMistTheaterData() {
  try {
    const response = await axios.get('https://www.iqiyi.com/theater/2', {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": "https://www.iqiyi.com"
      }
    });

    const $ = cheerio.load(response.data);
    const elements = $('.qy-mod-list .qy-mod-li');
    
    if (!elements.length) {
      throw new Error('未找到剧集列表元素');
    }

    return elements
      .map((_, el) => $(el).find('.link-txt').text())
      .toArray()
      .map(title => (title || '').replace(/^[0-9]{4}\s*/, '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('获取迷雾剧场数据失败:', error.message);
    return [];
  }
}

async function fetchWhiteNightTheaterData() {
  try {
    const title = encodeURIComponent("优酷剧场");
    const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=2`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
      }
    });

    if (!response?.data?.parse?.text?.["*"]) {
      throw new Error("获取维基百科数据失败");
    }

    const $ = cheerio.load(response.data.parse.text["*"]);
    const dramaList = [];

    $('.div-col ul li').each((index, element) => {
      const liText = $(element).text().trim();
      if (liText.startsWith('待定：')) return;
      const match = liText.match(/《([^》]+)》/);
      if (match && match[1]) {
        dramaList.push(match[1].trim());
      }
    });

    return dramaList.reverse();
  } catch (error) {
    console.error('获取白夜剧场数据失败:', error.message);
    return [];
  }
}

async function fetchSeasonWindTheaterData() {
  try {
    const title = encodeURIComponent("芒果季风计划");
    const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=2`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
      }
    });

    if (!response?.data?.parse?.text?.["*"]) {
      throw new Error("获取维基百科数据失败");
    }

    const $ = cheerio.load(response.data.parse.text["*"]);
    const playingDramas = [];

    $('table.wikitable').each((tableIndex, table) => {
      let isPendingSection = false;
      
      $(table).find('tr').each((rowIndex, row) => {
        const $tds = $(row).find('td');
        
        if ($tds.length > 0) {
          const rowText = $(row).text().trim();
          
          if (rowText.includes('待播映')) {
            isPendingSection = true;
            return;
          }
          
          if (!isPendingSection && rowIndex > 0) {
            const $firstTd = $tds.eq(0);
            const $link = $firstTd.find('a').first();
            
            if ($link.length) {
              const title = $link.text().trim();
              if (title) {
                playingDramas.push(title);
              }
            }
          }
        }
      });
    });

    return playingDramas;
  } catch (error) {
    console.error('获取季风剧场数据失败:', error.message);
    return [];
  }
}

async function fetchXTheaterData() {
  try {
    const title = encodeURIComponent("X剧场");
    const url = `https://zh.wikipedia.org/w/api.php?action=parse&page=${title}&format=json&prop=text&section=1`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
      }
    });

    if (!response?.data?.parse?.text?.["*"]) {
      throw new Error("获取维基百科数据失败");
    }

    const $ = cheerio.load(response.data.parse.text["*"]);
    if (!$('table.wikitable').length) {
      throw new Error("未找到目标表格");
    }

    const dramaList = [];
    const $table = $('table.wikitable').first();

    $table.find('tr').each((index, row) => {
      if (index === 0) return;
      const $cells = $(row).find('td');
      if ($cells.length < 2) return;
      const dateText = $cells.eq(0).text().trim();
      if (/待公布/.test(dateText)) return;
      const $nameLink = $cells.eq(1).find('a').first();
      if (!$nameLink.length) return;
      const dramaName = $nameLink
        .clone()
        .children()
        .end()
        .text()
        .replace(/[《》\s]+/g, ' ')
        .trim();
      if (dramaName) {
        dramaList.push(dramaName);
      }
    });

    return dramaList.reverse();
  } catch (error) {
    console.error('获取X剧场数据失败:', error.message);
    return [];
  }
}

async function fetchFromWikipedia() {
    try {
        const response = await axios.get('https://zh.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '迷雾剧场',
                format: 'json',
                prop: 'text',
                section: 0
            }
        });

        const html = response.data.parse.text['*'];
        const titleYearRegex = /《([^》]+)》\s*\((\d{4})年\)/g;
        const matches = [...html.matchAll(titleYearRegex)];
        
        return matches.map(match => ({
            title: match[1],
            year: match[2]
        }));
    } catch (error) {
        console.error('Error fetching from Wikipedia:', error);
        return [];
    }
}

async function searchTMDB(title, year) {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
            params: {
                api_key: TMDB_API_KEY,
                query: title,
                first_air_date_year: year,
                language: 'zh-CN'
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            return {
                title: result.name,
                original_title: result.original_name,
                year: year,
                poster_path: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
                overview: result.overview,
                vote_average: result.vote_average,
                first_air_date: result.first_air_date
            };
        }
        return null;
    } catch (error) {
        console.error(`Error searching TMDB for ${title}:`, error);
        return null;
    }
}

async function updateTheaterData() {
    try {
        // 从维基百科获取剧名和年份
        const wikiData = await fetchFromWikipedia();
        console.log(`Found ${wikiData.length} shows from Wikipedia`);

        // 使用TMDB API搜索详细信息
        const shows = [];
        for (const item of wikiData) {
            console.log(`Searching TMDB for: ${item.title} (${item.year})`);
            const tmdbData = await searchTMDB(item.title, item.year);
            if (tmdbData) {
                shows.push(tmdbData);
            }
            // 添加延迟以避免API限制
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        // 保存数据
        const data = {
            last_updated: new Date().toISOString(),
            shows: shows
        };

        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`Successfully updated theater data with ${shows.length} shows`);
    } catch (error) {
        console.error('Error updating theater data:', error);
        process.exit(1);
    }
}

updateTheaterData(); 