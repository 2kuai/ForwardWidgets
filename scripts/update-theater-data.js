import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';

const THEATERS = [
    { name: "迷雾剧场", id: "128396349" },
    { name: "白夜剧场", id: "158539495" },
    { name: "季风剧场", id: "153511846" },
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

// 获取单个剧场数据并补充TMDB信息
async function fetchTheaterTitles(theaterName, doulistId) {
    const theaterData = {
        name: theaterName,
        url: `https://m.douban.com/doulist/${doulistId}/`,
        shows: []
    };

    try {
        console.log(`开始获取 ${theaterName} 剧场数据`, `URL: ${theaterData.url}`);
        
        const response = await axios.get(theaterData.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
            },
            timeout: 10000
        });

        if (!response?.data) {
            console.error(`${theaterName} 剧场数据获取失败`, "无返回数据");
            return { [theaterName]: { aired: [], upcoming: [] } };
        }
        
        console.log(`${theaterName} 剧场HTML获取成功`, "开始解析...");
        const $ = cheerio.load(response.data);
        
        const items = $('ul.doulist-items > li');
        console.log(`找到 ${items.length} 个剧集项目`);
        
        // 串行处理所有剧集并加入限流
        const shows = [];
        const itemElements = items.get();
        for (const [index, element] of itemElements.entries()) {
            try {
                const title = $(element).find('.info .title').text().trim();
                const meta = $(element).find('.info .meta').text().trim();
                
                // 提取年份
                const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
                const year = yearMatch?.[1] || '';
                
                const showTitle = year ? `${title}(${year})` : title;
                
                // 解析豆瓣标题
                const { title: cleanTitle, year: parsedYear } = parseDoubanTitle(showTitle);
                
                // 获取TMDB数据
                const tmdbData = await searchTMDB(cleanTitle, parsedYear);
                
                // 限流
                await new Promise(resolve => setTimeout(resolve, 200));

                if (tmdbData) {
                    const showData = {
                        doubanTitle: showTitle,
                        tmdbData: tmdbData
                    };
                    console.log(`处理成功: 第${index + 1}个项目`, showTitle);
                    shows.push(showData);
                } else {
                    console.log(`处理失败，未找到TMDB数据: 第${index + 1}个项目`, showTitle);
                }
                
            } catch (error) {
                console.error(`处理 ${theaterName} 剧场第${index + 1}个项目时出错`, error.message);
            }
        }
        
        console.log(`${theaterName} 剧场数据处理完成`, `共获取 ${shows.length} 个剧集`);
        
        // 简单分类：假设有releaseDate且早于当前日期的为已播出，否则为即将播出
        const now = new Date();
        const aired = [];
        const upcoming = [];
        
        for (const show of shows) {
            if (show.tmdbData.releaseDate) {
                const releaseDate = new Date(show.tmdbData.releaseDate);
                if (releaseDate <= now) {
                    aired.push(show.tmdbData);
                } else {
                    upcoming.push(show.tmdbData);
                }
            } else {
                // 没有TMDB数据或releaseDate的默认放入upcoming
                upcoming.push(show.tmdbData);
            }
        }

        // 对已播剧集按release_date降序排序（最新的在前）
        aired.sort((a, b) => {
            const dateA = new Date(a.releaseDate || 0);
            const dateB = new Date(b.releaseDate || 0);
            return dateB - dateA;
        });
        
        return { 
            [theaterName]: {
                aired,
                upcoming
            }
        };
        
    } catch (error) {
        if (error.response) {
            console.error(`${theaterName} 剧场请求失败`, `状态码: ${error.response.status}`);
        } else if (error.request) {
            console.error(`${theaterName} 剧场请求失败`, "无响应");
        } else {
            console.error(`${theaterName} 剧场请求设置错误`, error.message);
        }
        
        return { [theaterName]: { aired: [], upcoming: [] } };
    }
}

async function updateTheaterData() {
    try {
        const theaterResults = [];
        for (const theater of THEATERS) {
            const result = await fetchTheaterTitles(theater.name, theater.id);
            theaterResults.push(result);
        }

        const data = {
            last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
        };

        console.log('Final counts after TMDB search:');
        for (const result of theaterResults) {
            const theaterName = Object.keys(result)[0];
            data[theaterName] = result[theaterName];
            const airedCount = result[theaterName].aired.length;
            const upcomingCount = result[theaterName].upcoming.length;
            console.log(`- ${theaterName}: ${airedCount} aired, ${upcomingCount} upcoming`);
        }
        
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log('Successfully updated data in theater-data.json');
        
        return data;
    } catch (error) {
        console.error('Error updating data:', error);
        throw error;
    }
}

async function searchTMDB(title, year = null) {
    try {
        console.log(`Searching TMDB for: ${title}${year ? ` (${year})` : ''}`);
        const params = {
            query: title,
            language: 'zh-CN'
        };
        
        if (year) {
            params.first_air_date_year = year;
        }

        const response = await axios.get(TMDB_BASE_URL, {
            params,
            headers: {
                Authorization: `Bearer ${TMDB_API_KEY}`
            },
            timeout: 10000
        });
        
        if (response.data.results && response.data.results.length > 0) {
            // 查找精确匹配的结果
            const exactMatch = response.data.results.find(result => {
                // 比较标题是否相同（忽略大小写和前后空格）
                const isTitleMatch = result.name.trim().toLowerCase() === title.trim().toLowerCase();
                
                // 如果有年份参数，还需要比较年份
                if (year) {
                    const releaseYear = result.first_air_date ? new Date(result.first_air_date).getFullYear() : null;
                    return isTitleMatch && releaseYear === parseInt(year);
                }
                
                return isTitleMatch;
            });

            if (exactMatch) {
                console.log(`Found exact TMDB match for: ${title} -> ${exactMatch.name}`);
                return {
                    id: exactMatch.id,
                    type: "tmdb",
                    title: exactMatch.name,
                    description: exactMatch.overview,
                    posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : null,
                    backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/w500${exactMatch.backdrop_path}` : null,
                    releaseDate: exactMatch.first_air_date,
                    rating: exactMatch.vote_average,
                    mediaType: "tv"
                };
            }
        }
        console.log(`No exact TMDB match found for: ${title}`);
        return null;
    } catch (error) {
        console.error(`Error searching TMDB for ${title}:`, error.message);
        return null;
    }
}

// 执行更新
updateTheaterData().then(data => {
    console.log('Data update completed');
    process.exit(0);
}).catch(err => {
    console.error('Data update failed:', err);
    process.exit(1);
});
