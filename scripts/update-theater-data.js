const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

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

async function main() {
  try {
    const [mistTheater, whiteNightTheater, seasonWindTheater, xTheater] = await Promise.all([
      fetchMistTheaterData(),
      fetchWhiteNightTheaterData(),
      fetchSeasonWindTheaterData(),
      fetchXTheaterData()
    ]);

    const data = {
      mist_theater: {
        now_playing: mistTheater
      },
      white_night_theater: {
        now_playing: whiteNightTheater
      },
      season_wind_theater: {
        now_playing: seasonWindTheater
      },
      x_theater: {
        now_playing: xTheater
      },
      last_updated: new Date().toISOString()
    };

    const dataPath = path.join(__dirname, '..', 'data', 'theater_data.json');
    
    // 确保目录存在
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    
    // 写入数据
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('剧场数据更新成功');
  } catch (error) {
    console.error('更新失败:', error.message);
    process.exit(1);
  }
}

main(); 