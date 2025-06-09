import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3NzE0YWYxZGMwZDA3ZjVkODA1ZDEzNGQwMGZkZGM5ZCIsIm5iZiI6MTc0MzI1NDg0NS4wNCwic3ViIjoiNjdlN2Y1M2RiNTY1NWFhYzQyNjM4ODk2Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.rBotPSAvlgM8mMWI4_NVLEU-ssD9plLdA-r17bPA3aA';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function fetchMistTheaterTitles() {
    try {
        const response = await axios.get('https://zh.m.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '迷雾剧场',
                format: 'json',
                prop: 'text',
                section: 1
            }
        });
        const html = response.data.parse.text['*'];
        const $ = cheerio.load(html);
        
        const airedShows = [];
        const upcomingShows = [];
        const currentDate = new Date();
        
        // Process aired shows (from tables with date columns)
        $('table.wikitable').has('th:contains("首播日期")').each((tableIndex, table) => {
            $(table).find('tr').slice(1).each((rowIndex, row) => {
                const columns = $(row).find('td');
                if (columns.length >= 4) {
                    const dateText = $(columns[0]).text().trim();
                    const titleLink = $(columns[1]).find('a').first();
                    const title = titleLink.text().trim().replace(/^《|》$/g, '');
                    
                    const yearMatch = dateText.match(/(\d{4})年/);
                    const year = yearMatch ? yearMatch[1] : '';
                    const monthDayMatch = dateText.match(/(\d{1,2})月(\d{1,2})日/);
                    
                    let airDate;
                    if (year && monthDayMatch) {
                        airDate = `${year}-${monthDayMatch[1].padStart(2, '0')}-${monthDayMatch[2].padStart(2, '0')}`;
                    }
                    
                    if (title && year) {
                        airedShows.push({
                            title: title,
                            year: year,
                            air_date: airDate || `${year}-01-01`,
                            actors: $(columns[2]).text().trim(),
                            notes: $(columns[3]).text().trim(),
                            source: '迷雾剧场'
                        });
                    }
                }
            });
        });
        
        // Process upcoming shows (from tables without date columns)
        $('table.wikitable').has('th:contains("剧名")').each((tableIndex, table) => {
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
        });
        
        return { airedShows, upcomingShows };
    } catch (error) {
        console.error('Error fetching from Wikipedia:', error);
        return { airedShows: [], upcomingShows: [] };
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
        // Fetch data for multiple theaters (currently just 迷雾剧场)
        const mistTheater = await fetchMistTheaterTitles();
        // In the future, you can add:
        // const whiteNightTheater = await fetchWhiteNightTheaterTitles();
        
        console.log(`Found ${mistTheater.airedShows.length} aired shows and ${mistTheater.upcomingShows.length} upcoming shows from 迷雾剧场`);
        
        // Process aired shows
        const processedAiredShows = [];
        for (const item of mistTheater.airedShows) {
            console.log(`Searching TMDB for aired show: ${item.title} (${item.year})`);
            const tmdbData = await searchTMDB(item.title, item.year);
            if (tmdbData) {
                processedAiredShows.push({
                    ...tmdbData,
                    actors: item.actors,
                    notes: item.notes,
                    air_date: item.air_date,
                    source: item.source
                });
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        
        // Process upcoming shows
        const processedUpcomingShows = mistTheater.upcomingShows.map(item => ({
            title: item.title,
            actors: item.actors,
            notes: item.notes,
            source: item.source
        }));
        
        // Structure the final data with theater categories
        const data = {
            last_updated: new Date().toISOString(),
            theaters: {
                "迷雾剧场": {
                    description: "爱奇艺推出的悬疑类型剧场",
                    shows: {
                        已播: processedAiredShows,
                        待播: processedUpcomingShows
                    }
                },
                // In the future you can add:
                // "白夜剧场": {
                //     description: "爱奇艺推出的另一类型剧场",
                //     shows: {
                //         已播: [...],
                //         待播: [...]
                //     }
                // }
            }
        };
        
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Successfully updated theater data with ${processedAiredShows.length} aired shows and ${processedUpcomingShows.length} upcoming shows from 迷雾剧场`);
    } catch (error) {
        console.error('Error updating theater data:', error);
        process.exit(1);
    }
}

updateTheaterData();
