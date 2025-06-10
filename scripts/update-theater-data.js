import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3NzE0YWYxZGMwZDA3ZjVkODA1ZDEzNGQwMGZkZGM5ZCIsIm5iZiI6MTc0MzI1NDg0OS4wNCwic3ViIjoiNjdlN2Y1M2RiNTY1NWFhYzQyNjM4ODk2Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.rBotPSAvlgM8mMWI4_NVLEU-ssD9plLdA-r17bPA3aA';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';

// 1. 获取迷雾剧场数据（表格形式）
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

        if (!response.data?.parse?.text?.['*']) {
            console.error('Invalid Wikipedia API response:', response.data);
            return { airedShows: [], upcomingShows: [] };
        }

        const html = response.data.parse.text['*'];
        const $ = cheerio.load(html);
        
        const airedShows = [];
        const upcomingShows = [];
        
        // 解析已播剧集（带日期列的表格）
        $('table.wikitable').has('th:contains("首播日期")').each((_, table) => {
            $(table).find('tr').slice(1).each((_, row) => {
                const cols = $(row).find('td');
                if (cols.length >= 4) {
                    const dateText = $(cols[0]).text().trim();
                    const title = $(cols[1]).find('a').first().text().trim().replace(/^《|》$/g, '');
                    const yearMatch = dateText.match(/(\d{4})年/);
                    const year = yearMatch ? yearMatch[1] : '';
                    
                    if (title && year) {
                        airedShows.push({
                            title,
                            year,
                            actors: $(cols[2]).text().trim(),
                            notes: $(cols[3]).text().trim(),
                            source: '迷雾剧场'
                        });
                    }
                }
            });
        });

        // 解析待播剧集（带"剧名"列的表格）
        $('table.wikitable').has('th:contains("剧名")').each((_, table) => {
            $(table).find('tr').slice(1).each((_, row) => {
                const cols = $(row).find('td');
                if (cols.length >= 2) {
                    const title = $(cols[0]).find('a').first().text().trim().replace(/^《|》$/g, '');
                    if (title) {
                        upcomingShows.push({
                            title,
                            actors: $(cols[1]).text().trim(),
                            source: '迷雾剧场'
                        });
                    }
                }
            });
        });

        console.log(`Found 迷雾剧场: ${airedShows.length}部已播, ${upcomingShows.length}部待播`);
        return { airedShows, upcomingShows };
    } catch (error) {
        console.error('获取迷雾剧场数据失败:', error.message);
        return { airedShows: [], upcomingShows: [] };
    }
}

// 2. 获取白夜剧场数据（列表形式）
async function fetchWhiteNightTheaterTitles() {
    try {
        console.log('Fetching 白夜剧场 data from Wikipedia...');
        const response = await axios.get('https://zh.m.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '优酷剧场',
                format: 'json',
                prop: 'text',
                section: 2  // 白夜剧场在优酷剧场页面的第2部分
            },
            timeout: 10000
        });

        if (!response.data?.parse?.text?.['*']) {
            console.error('Invalid Wikipedia API response:', response.data);
            return { airedShows: [], upcomingShows: [] };
        }

        const html = response.data.parse.text['*'];
        const $ = cheerio.load(html);
        
        const airedShows = [];
        const upcomingShows = [];
        
        // 解析列表项（格式示例：2024年：《微暗之火》）
        $('.div-col ul li').each((_, element) => {
            const text = $(element).text().trim();
            const titleMatch = text.match(/《([^》]+)》/);
            if (!titleMatch) return;

            const title = titleMatch[1].trim();
            const yearMatch = text.match(/(\d{4})年/);
            const isUpcoming = text.startsWith('待定：');

            if (isUpcoming) {
                upcomingShows.push({ title, source: '白夜剧场' });
            } else if (yearMatch) {
                airedShows.push({ 
                    title, 
                    year: yearMatch[1],
                    source: '白夜剧场' 
                });
            } else {
                airedShows.push({ title, source: '白夜剧场' }); // 无年份默认为已播
            }
        });

        console.log(`Found 白夜剧场: ${airedShows.length}部已播, ${upcomingShows.length}部待播`);
        return { airedShows, upcomingShows };
    } catch (error) {
        console.error('获取白夜剧场数据失败:', error.message);
        return { airedShows: [], upcomingShows: [] };
    }
}

// 3. 查询TMDB获取剧集详情
async function searchTMDB(title, year = null) {
    try {
        const params = { 
            query: title,
            language: 'zh-CN',
            ...(year && { first_air_date_year: year })
        };

        const response = await axios.get(TMDB_BASE_URL, {
            params,
            headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
            timeout: 10000
        });

        if (response.data?.results?.length > 0) {
            const show = response.data.results[0];
            return {
                id: show.id,
                title: show.name,
                original_title: show.original_name,
                year: year || show.first_air_date?.substring(0, 4),
                description: show.overview,
                poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
                rating: show.vote_average,
                release_date: show.first_air_date,
                source: 'TMDB'
            };
        }
        return null;
    } catch (error) {
        console.error(`TMDB查询失败 "${title}":`, error.message);
        return null;
    }
}

// 4. 主函数：合并数据并生成JSON
async function generateTheaterData() {
    try {
        // 获取原始数据
        const [mist, whiteNight] = await Promise.all([
            fetchMistTheaterTitles(),
            fetchWhiteNightTheaterTitles()
        ]);

        // 合并所有剧集
        const allAired = [...mist.airedShows, ...whiteNight.airedShows];
        const allUpcoming = [...mist.upcomingShows, ...whiteNight.upcomingShows];

        // 查询TMDB补充信息（限制速率）
        const processedAired = [];
        for (const show of allAired) {
            const tmdbData = await searchTMDB(show.title, show.year);
            if (tmdbData) {
                processedAired.push({ ...show, ...tmdbData });
            }
            await new Promise(resolve => setTimeout(resolve, 300)); // 防止速率限制
        }

        const processedUpcoming = [];
        for (const show of allUpcoming) {
            const tmdbData = await searchTMDB(show.title);
            if (tmdbData) {
                processedUpcoming.push({ ...show, ...tmdbData });
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 生成最终数据
        const result = {
            last_updated: new Date().toISOString(),
            stats: {
                total_aired: processedAired.length,
                total_upcoming: processedUpcoming.length
            },
            aired_shows: processedAired,
            upcoming_shows: processedUpcoming
        };

        // 写入文件
        const outputPath = path.join(__dirname, 'theater-data.json');
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        console.log(`数据已保存至 ${outputPath}`);

    } catch (error) {
        console.error('生成数据失败:', error);
        process.exit(1);
    }
}

// 执行主函数
generateTheaterData();
