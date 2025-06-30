const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

// 配置
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

// 剧场配置
const THEATERS = [
    { name: "迷雾剧场", id: "128396349" },
    { name: "白夜剧场", id: "158539495" },
    { name: "季风剧场", id: "153511846" },
    { name: "X剧场", id: "155026800" }
];

// 日志辅助函数
function log(...messages) {
    console.log(`[${new Date().toISOString()}]`, ...messages);
}

function logError(...messages) {
    console.error(`[${new Date().toISOString()}]`, ...messages);
}

// 从豆瓣标题中提取标题和年份
function parseDoubanTitle(title) {
    const yearMatch = title.match(/\((.*?)\)/);
    let year = null;
    let cleanTitle = title;
    
    if (yearMatch && yearMatch[1]) {
        year = yearMatch[1];
        cleanTitle = title.replace(`(${year})`, '').trim();
    }
    
    return { title: cleanTitle, year };
}

// TMDB搜索函数
async function searchTMDB(title, year = null) {
    try {
        log(`Searching TMDB for: ${title}${year ? ` (${year})` : ''}`);
        
        const params = {
            query: title,
            language: 'zh-CN',
            include_adult: false
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
                log(`Found exact TMDB match for: ${title} -> ${exactMatch.name}`);
                return {
                    id: exactMatch.id,
                    type: "tmdb",
                    title: exactMatch.name,
                    description: exactMatch.overview,
                    posterPath: exactMatch.poster_path ? `${TMDB_IMAGE_BASE_URL}${exactMatch.poster_path}` : null,
                    backdropPath: exactMatch.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${exactMatch.backdrop_path}` : null,
                    releaseDate: exactMatch.first_air_date,
                    rating: exactMatch.vote_average,
                    mediaType: "tv"
                };
            }
        }
        log(`No exact TMDB match found for: ${title}`);
        return null;
    } catch (error) {
        logError(`Error searching TMDB for ${title}:`, error.message);
        return null;
    }
}

// 获取单个剧场数据并补充TMDB信息
async function fetchTheaterTitles(theaterName, doulistId) {
    const theaterData = {
        name: theaterName,
        url: `https://m.douban.com/doulist/${doulistId}/`,
        shows: []
    };

    try {
        log(`开始获取 ${theaterName} 剧场数据`, `URL: ${theaterData.url}`);
        
        const response = await axios.get(theaterData.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
            },
            timeout: 10000
        });

        if (!response?.data) {
            logError(`${theaterName} 剧场数据获取失败`, "无返回数据");
            return { [theaterName]: { aired: [], upcoming: [] } };
        }
        
        log(`${theaterName} 剧场HTML获取成功`, "开始解析...");
        const $ = cheerio.load(response.data);
        
        const items = $('ul.doulist-items > li');
        log(`找到 ${items.length} 个剧集项目`);
        
        // 并行处理所有剧集
        const showPromises = items.map(async (index, element) => {
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
                
                const showData = {
                    doubanTitle: showTitle,
                    tmdbData: tmdbData || null
                };
                
                log(`处理成功: 第${index + 1}个项目`, showTitle);
                return showData;
                
            } catch (error) {
                logError(`处理 ${theaterName} 剧场第${index + 1}个项目时出错`, error.message);
                return null;
            }
        }).get();
        
        // 等待所有剧集处理完成
        const shows = (await Promise.all(showPromises)).filter(Boolean);
        
        log(`${theaterName} 剧场数据处理完成`, `共获取 ${shows.length} 个剧集`);
        
        // 简单分类：假设有releaseDate且早于当前日期的为已播出，否则为即将播出
        const now = new Date();
        const aired = [];
        const upcoming = [];
        
        for (const show of shows) {
            if (show.tmdbData?.releaseDate) {
                const releaseDate = new Date(show.tmdbData.releaseDate);
                if (releaseDate < now) {
                    aired.push(show);
                } else {
                    upcoming.push(show);
                }
            } else {
                // 没有TMDB数据或releaseDate的默认放入aired
                aired.push(show);
            }
        }
        
        return { 
            [theaterName]: {
                aired,
                upcoming
            }
        };
        
    } catch (error) {
        if (error.response) {
            logError(`${theaterName} 剧场请求失败`, `状态码: ${error.response.status}`);
        } else if (error.request) {
            logError(`${theaterName} 剧场请求失败`, "无响应");
        } else {
            logError(`${theaterName} 剧场请求设置错误`, error.message);
        }
        
        return { [theaterName]: { aired: [], upcoming: [] } };
    }
}

// 主函数
async function main() {
    log("===== 开始获取所有剧场数据 =====");
    
    try {
        // 并行获取所有剧场数据
        const results = await Promise.all(
            THEATERS.map(theater => fetchTheaterTitles(theater.name, theater.id))
        );
        
        // 合并结果
        const finalResult = {
            last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
            ...results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
        };
        
        log("===== 所有剧场数据获取完成 =====");
        log("最终结果:", JSON.stringify(finalResult, null, 2));
        
        const outputPath = path.join(__dirname, '../data/theater-data_2.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(finalResult, null, 2), 'utf8');
        
        return finalResult;
    } catch (error) {
        logError("主流程出错:", error);
        throw error;
    }
}

// 直接执行主函数
main()
    .then(() => log("数据获取流程完成"))
    .catch((error) => logError("数据获取流程出错:", error.message));
