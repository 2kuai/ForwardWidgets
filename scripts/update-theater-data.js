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

// 获取单个剧场的所有页面数据
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

        // 循环获取所有页面
        while (hasNextPage) {
            pageCount++;
            const pageUrl = start === 0 ? 
                theaterData.url : 
                `${theaterData.url}?start=${start}`;
            
            console.log(`获取第 ${pageCount} 页`, `URL: ${pageUrl}`);
            
            const response = await axios.get(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
                },
                timeout: 10000
            });

            if (!response?.data) {
                console.error(`${theaterName} 第 ${pageCount} 页数据获取失败`, "无返回数据");
                break;
            }
            
            console.log(`${theaterName} 第 ${pageCount} 页HTML获取成功`, "开始解析...");
            const $ = cheerio.load(response.data);
            
            const items = $('ul.doulist-items > li');
            console.log(`第 ${pageCount} 页找到 ${items.length} 个剧集项目`);
            
            // 将当前页的项目添加到总列表中
            items.each((index, element) => {
                const title = $(element).find('.info .title').text().trim();
                const meta = $(element).find('.info .meta').text().trim();
                
                // 提取年份
                const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
                const year = yearMatch?.[1] || '';
                
                const showTitle = year ? `${title}(${year})` : title;
                allItems.push({ element: $(element), title: showTitle });
            });
            
            // 判断是否有下一页：如果当前页项目数量小于25，说明没有下一页
            if (items.length < pageSize) {
                hasNextPage = false;
                console.log(`第 ${pageCount} 页项目数量 ${items.length} < ${pageSize}，没有下一页`);
            } else {
                start += pageSize;
                // 添加页面间延迟，避免请求过快
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log(`${theaterName} 剧场共获取 ${pageCount} 页，总计 ${allItems.length} 个项目`);
        
        // 串行处理所有剧集并加入限流
        const shows = [];
        for (const [index, item] of allItems.entries()) {
            try {
                // 解析豆瓣标题
                const { title: cleanTitle, year: parsedYear } = parseDoubanTitle(item.title);
                
                // 获取TMDB数据
                const tmdbData = await searchTMDB(cleanTitle, parsedYear);
                
                // 限流
                await new Promise(resolve => setTimeout(resolve, 200));

                if (tmdbData) {
                    const showData = {
                        doubanTitle: item.title,
                        tmdbData: tmdbData
                    };
                    console.log(`处理成功: 第${index + 1}个项目`, item.title);
                    shows.push(showData);
                } else {
                    console.log(`处理失败，未找到TMDB数据: 第${index + 1}个项目`, item.title);
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
                upcoming,
                totalItems: allItems.length,
                totalPages: pageCount
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
        
        return { [theaterName]: { aired: [], upcoming: [], totalItems: 0, totalPages: 0 } };
    }
}

async function updateTheaterData() {
    try {
        const theaterResults = [];
        for (const theater of THEATERS) {
            const result = await fetchTheaterAllPages(theater.name, theater.id);
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
            const totalItems = result[theaterName].totalItems;
            const totalPages = result[theaterName].totalPages;
            console.log(`- ${theaterName}: ${totalPages}页 ${totalItems}个项目, ${airedCount}已播, ${upcomingCount}待播`);
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
