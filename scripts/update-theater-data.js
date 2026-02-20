import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';

// 类型映射表
const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片", 18: "剧情", 
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部", 
    10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻", 
    10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

const THEATERS = [
    { name: "迷雾剧场", id: "128396349" },
    { name: "白夜剧场", id: "158539495" },
    { name: "X剧场", id: "155026800" }
];

function parseDoubanTitle(doubanTitle) {
    const match = doubanTitle.match(/^(.*?)(?:\((\d{4})\))?$/);
    if (match) {
        return {
            title: match[1].trim(),
            year: match[2] || null,
        };
    }
    return { title: doubanTitle.trim(), year: null };
}

async function fetchTheaterAllPages(theaterName, doulistId) {
    const theaterData = {
        name: theaterName,
        url: `https://m.douban.com/doulist/${doulistId}/`,
        shows: []
    };

    try {
        console.log(`开始获取 ${theaterName} 剧场数据`);
        
        let allItems = [];
        let start = 0;
        const pageSize = 25;
        let hasNextPage = true;
        let pageCount = 0;

        while (hasNextPage) {
            pageCount++;
            const pageUrl = start === 0 ? theaterData.url : `${theaterData.url}?start=${start}`;
            
            const response = await axios.get(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
                },
                timeout: 10000
            });

            if (!response?.data) break;
            
            const $ = cheerio.load(response.data);
            const items = $('ul.doulist-items > li');
            
            items.each((index, element) => {
                const title = $(element).find('.info .title').text().trim();
                const meta = $(element).find('.info .meta').text().trim();
                const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
                const year = yearMatch?.[1] || '';
                allItems.push({ title: year ? `${title}(${year})` : title });
            });
            
            if (items.length < pageSize) {
                hasNextPage = false;
            } else {
                start += pageSize;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        const shows = [];
        for (const item of allItems) {
            const { title: cleanTitle, year: parsedYear } = parseDoubanTitle(item.title);
            const tmdbData = await searchTMDB(cleanTitle, parsedYear);
            await new Promise(resolve => setTimeout(resolve, 200));

            if (tmdbData) {
                shows.push({ doubanTitle: item.title, tmdbData });
            }
        }
        
        const now = new Date();
        const aired = [];
        const upcoming = [];
        
        for (const show of shows) {
            if (show.tmdbData.releaseDate && new Date(show.tmdbData.releaseDate) <= now) {
                aired.push(show.tmdbData);
            } else {
                upcoming.push(show.tmdbData);
            }
        }

        aired.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
        
        return { 
            [theaterName]: {
                aired,
                upcoming,
                totalItems: allItems.length,
                totalPages: pageCount
            }
        };
        
    } catch (error) {
        console.error(`${theaterName} 错误:`, error.message);
        return { [theaterName]: { aired: [], upcoming: [], totalItems: 0, totalPages: 0 } };
    }
}

async function searchTMDB(title, year = null) {
    try {
        const params = { query: title, language: 'zh-CN' };
        if (year) params.first_air_date_year = year;

        const response = await axios.get(TMDB_BASE_URL, {
            params,
            headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
            timeout: 10000
        });
        
        if (response.data.results?.length > 0) {
            const exactMatch = response.data.results.find(result => {
                const isTitleMatch = result.name.trim().toLowerCase() === title.trim().toLowerCase();
                if (year) {
                    const releaseYear = result.first_air_date ? new Date(result.first_air_date).getFullYear() : null;
                    return isTitleMatch && releaseYear === parseInt(year);
                }
                return isTitleMatch;
            });

            if (exactMatch) {
                // 转换类型并映射到 genreTitle 字段
                const genreTitle = (exactMatch.genre_ids || [])
                    .map(id => GENRE_MAP[id])
                    .filter(Boolean)
                    .join(',');

                return {
                    id: exactMatch.id,
                    type: "tmdb",
                    title: exactMatch.name,
                    description: exactMatch.overview,
                    rating: exactMatch.vote_average,
                    voteCount: exactMatch.vote_count,
                    popularity: exactMatch.popularity,
                    releaseDate: exactMatch.first_air_date,
                    posterPath: exactMatch.poster_path || null,
                    backdropPath: exactMatch.backdrop_path || null,
                    mediaType: "tv",
                    genreTitle: genreTitle
                };
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function updateTheaterData() {
    try {
        const data = {
            last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
        };

        for (const theater of THEATERS) {
            const result = await fetchTheaterAllPages(theater.name, theater.id);
            Object.assign(data, result);
        }
        
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log('数据更新成功');
    } catch (error) {
        console.error('更新失败:', error);
    }
}

updateTheaterData();
