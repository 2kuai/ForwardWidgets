import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzYmJjNzhhN2JjYjI3NWU2M2Y5YTM1MmNlMTk4NWM4MyIsInN1YiI6IjU0YmU4MTNlYzNhMzY4NDA0NjAwODZjOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.esM4zgTT64tFpnw9Uk5qwrhlaDUwtNNYKVzv_jNr390';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';

async function fetchMistTheaterTitles() {
    try {
        console.log('Fetching 迷雾剧场 data from Wikipedia...');
        const response = await axios.get('https://zh.m.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '迷雾剧场',
                format: 'json',
                prop: 'text',
                section: 1
            },
            timeout: 10000
        });

        if (!response.data || !response.data.parse || !response.data.parse.text) {
            console.error('Invalid Wikipedia API response:', response.data);
            return { "迷雾剧场": [] };
        }

        const html = response.data.parse.text['*'];
        console.log('Successfully fetched 迷雾剧场 HTML content');
        
        const $ = cheerio.load(html);
        const mistTheaterShows = [];
        
        const tables = $('table.wikitable');
        console.log(`Found ${tables.length} tables in 迷雾剧场 section`);
        
        tables.each((tableIndex, table) => {
            const hasDateHeader = $(table).find('th:contains("首播日期")').length > 0;
            const hasTitleHeader = $(table).find('th:contains("剧名")').length > 0;
            
            if (hasDateHeader) {
                console.log(`Processing aired shows table #${tableIndex + 1}`);
                $(table).find('tr').slice(1).each((rowIndex, row) => {
                    const columns = $(row).find('td');
                    if (columns.length >= 4) {
                        const dateText = $(columns[0]).text().trim();
                        const titleLink = $(columns[1]).find('a').first();
                        const title = titleLink.text().trim().replace(/^《|》$/g, '');
                        
                        const yearMatch = dateText.match(/(\d{4})年/);
                        const year = yearMatch ? yearMatch[1] : '';
                        
                        if (title && year) {
                            const formattedTitle = `${title}（${year}）`;
                            mistTheaterShows.push(formattedTitle);
                        }
                    }
                });
            } else if (hasTitleHeader) {
                console.log(`Processing upcoming shows table #${tableIndex + 1}`);
                $(table).find('tr').slice(1).each((rowIndex, row) => {
                    const columns = $(row).find('td');
                    if (columns.length >= 2) {
                        const titleLink = $(columns[0]).find('a').first();
                        const title = titleLink.text().trim().replace(/^《|》$/g, '');
                        
                        if (title) {
                            mistTheaterShows.push(title);
                        }
                    }
                });
            }
        });
        
        console.log(`Found ${mistTheaterShows.length} shows in 迷雾剧场`);
        return { "迷雾剧场": mistTheaterShows };
    } catch (error) {
        console.error('Error fetching 迷雾剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { "迷雾剧场": [] };
    }
}


async function fetchWhiteNightTheaterTitles() {
    try {
        console.log('Fetching 白夜剧场 data from Wikipedia...');
        const response = await axios.get('https://zh.m.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '优酷剧场',
                format: 'json',
                prop: 'text',
                section: 2
            },
            timeout: 10000
        });

        if (!response.data || !response.data.parse || !response.data.parse.text) {
            console.error('Invalid Wikipedia API response:', response.data);
            return { "白夜剧场": [] };
        }

        const html = response.data.parse.text['*'];
        console.log('Successfully fetched 白夜剧场 HTML content');
        
        const $ = cheerio.load(html);
        if (!$) throw new Error("解析 HTML 失败");
        
        const whiteNightTheaterShows = [];
        const listItems = $('.div-col ul li');
        console.log(`Found ${listItems.length} list items in 白夜剧场 section`);
        
        listItems.each((index, element) => {
            const liText = $(element).text().trim();
            const match = liText.match(/《([^》]+)》/);
            
            if (match && match[1]) {
                const title = match[1].trim();
                
                // Check if the text contains a year pattern like (2023)
                const yearMatch = liText.match(/\((\d{4})\)/);
                
                if (yearMatch) {
                    // For aired shows with year: "剧名（年份）"
                    whiteNightTheaterShows.push(`${title}（${yearMatch[1]}）`);
                } else if (liText.startsWith('待定：')) {
                    // For upcoming shows: just the title
                    whiteNightTheaterShows.push(title);
                } else {
                    // For other aired shows without explicit year
                    whiteNightTheaterShows.push(title);
                }
            } else {
                console.log(`No title found in list item: ${liText}`);
            }
        });
        
        console.log(`Found ${whiteNightTheaterShows.length} shows in 白夜剧场`);
        return { 
            "白夜剧场": whiteNightTheaterShows
        };
    } catch (error) {
        console.error('Error fetching 白夜剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { "白夜剧场": [] };
    }
}


async function fetchMonsoonTheaterTitles() {
    try {
        console.log('Fetching 季风剧场 data from Wikipedia...');
        
        // 获取芒果季风计划页面内容
        const response = await axios.get('https://zh.m.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '芒果季风计划',
                format: 'json',
                prop: 'text',
                section: 2
            },
            timeout: 10000
        });

        if (!response.data?.parse?.text?.['*']) {
            console.error('Invalid Wikipedia API response');
            return { "季风剧场": [] };
        }

        const $ = cheerio.load(response.data.parse.text['*']);
        const monsoonTheaterShows = [];

        // 处理电视剧表格
        const tvTable = $('table.wikitable').first();
        let isPendingSection = false;
        let pendingShows = new Set(); // 用于存储待播剧集
        
        // 首先收集所有待播剧集
        tvTable.find('tr').each((rowIndex, row) => {
            const $ths = $(row).find('th');
            const $tds = $(row).find('td');
            
            // 检查是否是待播映行
            const yearCell = $ths.filter('[rowspan]').first();
            if (yearCell.length > 0) {
                const yearText = yearCell.text().trim();
                isPendingSection = yearText.includes('待播映');
            }
            
            if ($tds.length > 0) {
                const $firstTd = $tds.eq(0);
                const $link = $firstTd.find('a').first();
                
                if ($link.length) {
                    const title = $firstTd.text().trim()
                        .replace(/\s+/g, ' ')  // 替换多个空格为单个空格
                        .replace(/[《》]/g, '') // 移除书名号
                        .trim();
                        
                    if (title) {
                        // 检查状态列是否包含"待播映"
                        const statusText = $tds.eq(1).text().trim();
                        if (isPendingSection || statusText.includes('待播映')) {
                            pendingShows.add(title);
                        }
                    }
                }
            }
        });
        
        // 然后处理所有剧集
        tvTable.find('tr').each((rowIndex, row) => {
            const $ths = $(row).find('th');
            const $tds = $(row).find('td');
            
            if ($tds.length > 0) {
                const $firstTd = $tds.eq(0);
                const $link = $firstTd.find('a').first();
                
                if ($link.length) {
                    const title = $firstTd.text().trim()
                        .replace(/\s+/g, ' ')  // 替换多个空格为单个空格
                        .replace(/[《》]/g, '') // 移除书名号
                        .trim();
                        
                    if (title) {
                        // 尝试提取年份信息
                        const yearMatch = $tds.eq(1).text().trim().match(/(\d{4})/);
                        const year = yearMatch ? yearMatch[1] : '';
                        
                        if (pendingShows.has(title)) {
                            // 待播剧集只添加剧名
                            monsoonTheaterShows.push(title);
                        } else {
                            // 已播剧集添加剧名和年份（如果有）
                            const formattedTitle = year ? `${title}（${year}）` : title;
                            monsoonTheaterShows.push(formattedTitle);
                        }
                    }
                }
            }
        });

        // 处理网络剧表格
        const webTable = $('table.wikitable').eq(1);
        let currentStatus = '';
        webTable.find('tr').each((rowIndex, row) => {
            const $ths = $(row).find('th');
            const $tds = $(row).find('td');
            // 检查是否是进度（状态）行
            const statusCell = $ths.filter('[rowspan]').first();
            if (statusCell.length > 0) {
                currentStatus = statusCell.text().trim();
            }
            if ($tds.length > 0) {
                const $firstTd = $tds.eq(0);
                const $link = $firstTd.find('a').first();
                if ($link.length) {
                    const title = $link.text().trim();
                    if (title) {
                        // 尝试提取年份信息
                        const yearMatch = $tds.eq(1).text().trim().match(/(\d{4})/);
                        const year = yearMatch ? yearMatch[1] : '';
                        
                        // 进度为"待播映"归为未播出，其余归为已播出
                        if (currentStatus.includes('待播映') || $tds.eq(1).text().trim().includes('待播映')) {
                            // 待播剧集只添加剧名
                            monsoonTheaterShows.push(title);
                        } else {
                            // 已播剧集添加剧名和年份（如果有）
                            const formattedTitle = year ? `${title}（${year}）` : title;
                            monsoonTheaterShows.push(formattedTitle);
                        }
                    }
                }
            }
        });

        console.log(`Found ${monsoonTheaterShows.length} shows in 季风剧场`);
        
        return { 
            "季风剧场": monsoonTheaterShows
        };
    } catch (error) {
        console.error('Error fetching 季风剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { "季风剧场": [] };
    }
}

async function fetchXTheaterTitles() {
    try {
        console.log('Fetching X剧场 data from Wikipedia...');
        const response = await axios.get('https://zh.m.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: 'X剧场',
                format: 'json',
                prop: 'text',
                section: 1
            },
            timeout: 10000
        });

        if (!response.data || !response.data.parse || !response.data.parse.text) {
            console.error('Invalid Wikipedia API response:', response.data);
            return { "X剧场": [] };
        }

        const html = response.data.parse.text['*'];
        console.log('Successfully fetched X剧场 HTML content');
        
        const $ = cheerio.load(html);
        const xTheaterShows = [];
        
        // 解析表格数据
        const table = $('table.wikitable');
        if (table.length === 0) {
            console.log('No table found in X剧场 section');
            return { "X剧场": [] };
        }

        console.log('Processing X剧场 table');
        
        table.find('tr').slice(1).each((rowIndex, row) => {
            const columns = $(row).find('td');
            if (columns.length >= 2) {
                // 处理首播日期列
                const dateText = $(columns[0]).text().trim();
                let year = '';
                
                // 匹配日期格式：2023年4月22日 或 待公布
                if (dateText !== '待公布') {
                    const yearMatch = dateText.match(/(\d{4})/);
                    year = yearMatch ? yearMatch[1] : '';
                }
                
                // 处理剧名列
                const titleLink = $(columns[1]).find('a').first();
                const title = titleLink.text().trim().replace(/^《|》$/g, '');
                
                if (title) {
                    // 如果有有效年份则添加年份，否则不加
                    const formattedTitle = year ? `${title}（${year}）` : title;
                    xTheaterShows.push(formattedTitle);
                }
            }
        });

        console.log(`Found ${xTheaterShows.length} shows in X剧场`);
        return { "X剧场": xTheaterShows };
    } catch (error) {
        console.error('Error fetching X剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { "X剧场": [] };
    }
}

async function updateTheaterData() {
    try {
        // 获取四个剧场的数据
        const [mistTheater, whiteNightTheater, monsoonTheater, xTheater] = await Promise.all([
            fetchMistTheaterTitles(),
            fetchWhiteNightTheaterTitles(),
            fetchMonsoonTheaterTitles(),
            fetchXTheaterTitles()  // 新增的X剧场
        ]);
        
        console.log(`Final counts before TMDB search:
        - 迷雾剧场: ${mistTheater["迷雾剧场"].length} shows
        - 白夜剧场: ${whiteNightTheater["白夜剧场"].length} shows
        - 季风剧场: ${monsoonTheater["季风剧场"].length} shows
        - X剧场: ${xTheater["X剧场"].length} shows`);  // 新增的X剧场
        
        // 为每个剧场单独处理TMDB搜索并分类
        const processTheaterShows = async (theaterName, shows) => {
            const airedShows = [];
            const upcomingShows = [];
            const currentDate = new Date();
            
            for (const show of shows) {
                // 解析剧名和年份（如果有）
                const match = show.match(/^(.+?)(?:（(\d{4})）)?$/);
                const title = match[1];
                const year = match[2] || null;
                
                const tmdbData = await searchTMDB(title, year);
                if (tmdbData) {
                    const showData = {
                        ...tmdbData
                    };
                    
                    // 根据release_date分类
                    if (tmdbData.releaseDate) {
                        const releaseDate = new Date(tmdbData.releaseDate);
                        if (releaseDate <= currentDate) {
                            airedShows.push(showData);
                        } else {
                            upcomingShows.push(showData);
                        }
                    } else {
                        upcomingShows.push(showData);
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 250)); // 限流
            }
            
            // 对已播剧集按release_date降序排序（最新的在前）
            airedShows.sort((a, b) => {
                const dateA = new Date(a.releaseDate || 0);
                const dateB = new Date(b.releaseDate || 0);
                return dateB - dateA;
            });
            
            return {
                aired: airedShows,
                upcoming: upcomingShows
            };
        };

        // 并行处理四个剧场的数据
        const [mistTheaterData, whiteNightTheaterData, monsoonTheaterData, xTheaterData] = await Promise.all([
            processTheaterShows("迷雾剧场", mistTheater["迷雾剧场"]),
            processTheaterShows("白夜剧场", whiteNightTheater["白夜剧场"]),
            processTheaterShows("季风剧场", monsoonTheater["季风剧场"]),
            processTheaterShows("X剧场", xTheater["X剧场"])
        ]);
        
        // 创建最终数据结构
        const data = {
            last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
            "迷雾剧场": {
                aired: mistTheaterData.aired,
                upcoming: mistTheaterData.upcoming
            },
            "白夜剧场": {
                aired: whiteNightTheaterData.aired,
                upcoming: whiteNightTheaterData.upcoming
            },
            "季风剧场": {
                aired: monsoonTheaterData.aired,
                upcoming: monsoonTheaterData.upcoming
            },
            "X剧场": {
                aired: xTheaterData.aired,
                upcoming: xTheaterData.upcoming
            }
        };
        
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`Successfully updated data:
        - 迷雾剧场: ${mistTheaterData.aired.length} aired, ${mistTheaterData.upcoming.length} upcoming
        - 白夜剧场: ${whiteNightTheaterData.aired.length} aired, ${whiteNightTheaterData.upcoming.length} upcoming
        - 季风剧场: ${monsoonTheaterData.aired.length} aired, ${monsoonTheaterData.upcoming.length} upcoming
        - X剧场: ${xTheaterData.aired.length} aired, ${xTheaterData.upcoming.length} upcoming`);
        
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