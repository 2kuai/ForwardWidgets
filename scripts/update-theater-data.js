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
            return { airedShows: [], upcomingShows: [] };
        }

        const html = response.data.parse.text['*'];
        console.log('Successfully fetched 迷雾剧场 HTML content');
        
        const $ = cheerio.load(html);
        const airedShows = [];
        const upcomingShows = [];
        
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
                            const monthDayMatch = dateText.match(/(\d{1,2})月(\d{1,2})日/);
                            let airDate = `${year}-01-01`;
                            if (monthDayMatch) {
                                airDate = `${year}-${monthDayMatch[1].padStart(2, '0')}-${monthDayMatch[2].padStart(2, '0')}`;
                            }
                            
                            airedShows.push({
                                title: title,
                                year: year,
                                air_date: airDate,
                                actors: $(columns[2]).text().trim(),
                                notes: $(columns[3]).text().trim(),
                                source: '迷雾剧场'
                            });
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
                            upcomingShows.push({
                                title: title,
                                actors: $(columns[1]).text().trim(),
                                notes: columns.length >= 3 ? $(columns[2]).text().trim() : '',
                                source: '迷雾剧场'
                            });
                        }
                    }
                });
            }
        });
        
        console.log(`Found in 迷雾剧场: ${airedShows.length} aired, ${upcomingShows.length} upcoming`);
        return { airedShows, upcomingShows };
    } catch (error) {
        console.error('Error fetching 迷雾剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { airedShows: [], upcomingShows: [] };
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
            return { airedShows: [], upcomingShows: [] };
        }

        const html = response.data.parse.text['*'];
        console.log('Successfully fetched 白夜剧场 HTML content');
        
        const $ = cheerio.load(html);
        if (!$) throw new Error("解析 HTML 失败");
        
        const airedShows = [];
        const upcomingShows = [];
        const listItems = $('.div-col ul li');
        console.log(`Found ${listItems.length} list items in 白夜剧场 section`);
        
        listItems.each((index, element) => {
            const liText = $(element).text().trim();
            const match = liText.match(/《([^》]+)》/);
            
            if (match && match[1]) {
                const showData = {
                    title: match[1].trim(),
                    source: '白夜剧场'
                };
                
                if (liText.startsWith('待定：')) {
                    upcomingShows.push(showData);
                } else {
                    airedShows.push(showData);
                }
            } else {
                console.log(`No title found in list item: ${liText}`);
            }
        });
        
        console.log(`Found in 白夜剧场: ${airedShows.length} aired, ${upcomingShows.length} upcoming`);
        return { 
            airedShows,
            upcomingShows
        };
    } catch (error) {
        console.error('Error fetching 白夜剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { airedShows: [], upcomingShows: [] };
    }
}

async function fetchMonsoonTheaterTitles() {
    try {
        console.log('Fetching 季风剧场 data from Wikipedia...');
        
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
            return { airedShows: [], upcomingShows: [] };
        }

        const $ = cheerio.load(response.data.parse.text['*']);
        const airedShows = [];
        const upcomingShows = [];

        // 处理电视剧表格
        const tvTable = $('table.wikitable').first();
        let currentYear = '';
        let isPendingSection = false;
        
        tvTable.find('tr').each((rowIndex, row) => {
            const $row = $(row);
            const $tds = $row.find('td');
            const $ths = $row.find('th');
            
            // 检查年份单元格（可能有rowspan）
            const yearTh = $ths.filter('[rowspan]').first();
            if (yearTh.length > 0) {
                const yearText = yearTh.text().trim();
                currentYear = yearText.match(/\d{4}/)?.[0] || '';
                isPendingSection = yearText.includes('待播映');
                return; // 跳过标题行
            }
            
            if ($tds.length >= 4) {
                const $firstTd = $tds.eq(0);
                const $link = $firstTd.find('a').first();
                
                if ($link.length) {
                    const title = $link.text().trim().replace(/^《|》$/g, '');
                    if (title) {
                        const showData = {
                            title: title,
                            actors: $tds.eq(2).text().trim(),
                            notes: $tds.eq(3).text().trim(),
                            source: '季风剧场'
                        };
                        
                        // 如果有年份信息则添加
                        if (currentYear) {
                            showData.year = currentYear;
                            showData.air_date = `${currentYear}-01-01`;
                        }
                        
                        // 根据状态分类
                        if (isPendingSection || $row.text().includes('待播映')) {
                            upcomingShows.push(showData);
                        } else {
                            airedShows.push(showData);
                        }
                    }
                }
            }
        });

        // 处理网络剧表格（如果有）
        const webTable = $('table.wikitable').eq(1);
        if (webTable.length > 0) {
            let webStatus = '';
            
            webTable.find('tr').each((rowIndex, row) => {
                const $row = $(row);
                const $tds = $row.find('td');
                const $ths = $row.find('th');
                
                // 检查状态标题
                const statusTh = $ths.filter('[rowspan]').first();
                if (statusTh.length > 0) {
                    webStatus = statusTh.text().trim();
                    return; // 跳过标题行
                }
                
                if ($tds.length >= 4) {
                    const $link = $tds.eq(0).find('a').first();
                    if ($link.length) {
                        const title = $link.text().trim().replace(/^《|》$/g, '');
                        if (title) {
                            const showData = {
                                title: title,
                                actors: $tds.eq(2).text().trim(),
                                notes: $tds.eq(3).text().trim(),
                                source: '季风剧场'
                            };
                            
                            if (webStatus.includes('待播映') || $row.text().includes('待播映')) {
                                upcomingShows.push(showData);
                            } else {
                                airedShows.push(showData);
                            }
                        }
                    }
                }
            });
        }

        console.log(`Found in 季风剧场: ${airedShows.length} aired, ${upcomingShows.length} upcoming`);
        return { 
            airedShows,
            upcomingShows
        };
    } catch (error) {
        console.error('Error fetching 季风剧场 from Wikipedia:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { airedShows: [], upcomingShows: [] };
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
            const result = response.data.results[0];
            console.log(`Found TMDB match for: ${title} -> ${result.name}`);
            return {
                id: result.id,
                type: "tmdb",
                title: result.name,
                description: result.overview,
                posterPath: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
                backdropPath: result.backdrop_path ? `https://image.tmdb.org/t/p/w500${result.backdrop_path}` : null,
                releaseDate: result.first_air_date,
                rating: result.vote_average,
                mediaType: "tv",
                source: result.source || 'unknown'
            };
        }
        console.log(`No TMDB results found for: ${title}`);
        return null;
    } catch (error) {
        console.error(`Error searching TMDB for ${title}:`, error.message);
        return null;
    }
}

async function updateTheaterData() {
    try {
        // 获取三个剧场的数据
        const [mistTheater, whiteNightTheater, monsoonTheater] = await Promise.all([
            fetchMistTheaterTitles(),
            fetchWhiteNightTheaterTitles(),
            fetchMonsoonTheaterTitles()
        ]);
        
        console.log(`Final counts before TMDB search:
        - 迷雾剧场: ${mistTheater.airedShows.length} aired, ${mistTheater.upcomingShows.length} upcoming
        - 白夜剧场: ${whiteNightTheater.airedShows.length} aired, ${whiteNightTheater.upcomingShows.length} upcoming
        - 季风剧场: ${monsoonTheater.airedShows.length} aired, ${monsoonTheater.upcomingShows.length} upcoming`);
        
        // 合并数据
        const allAiredShows = [...mistTheater.airedShows, ...whiteNightTheater.airedShows, ...monsoonTheater.airedShows];
        const allUpcomingShows = [...mistTheater.upcomingShows, ...whiteNightTheater.upcomingShows, ...monsoonTheater.upcomingShows];
        
        // 并行处理TMDB搜索（限制并发数）
        const processBatch = async (items, isAired) => {
            const results = [];
            for (const item of items) {
                const tmdbData = await searchTMDB(item.title, isAired ? item.year : null);
                if (tmdbData) {
                    results.push({
                        ...tmdbData,
                        source: item.source
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 250)); // 限流
            }
            return results;
        };

        const [processedAiredShows, processedUpcomingShows] = await Promise.all([
            processBatch(allAiredShows, true),
            processBatch(allUpcomingShows, false)
        ]);
        
        const data = {
            last_updated: new Date().toISOString(),
            aired_shows: processedAiredShows,
            upcoming_shows: processedUpcomingShows
        };
        
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`Successfully updated data with:
        - ${processedAiredShows.length} aired shows
        - ${processedUpcomingShows.length} upcoming shows`);
        
        return data;
    } catch (error) {
        console.error('Error updating data:', error);
        throw error;
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
