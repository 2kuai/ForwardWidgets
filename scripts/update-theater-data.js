import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3NzE0YWYxZGMwZDA3ZjVkODA1ZDEzNGQwMGZkZGM5ZCIsIm5iZiI6MTc0MzI1NDg0NS4wNCwic3ViIjoiNjdlN2Y1M2RiNTY1NWFhYzQyNjM4ODk2Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.rBotPSAvlgM8mMWI4_NVLEU-ssD9plLdA-r17bPA3aA';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search/tv';

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

async function searchTMDB(title, year = null) {
    try {
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
            }
        });
        
        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            return {
                id: result.id,
                type: "tmdb",
                title: result.name,
                original_title: result.original_name,
                description: result.overview,
                posterPath: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
                backdropPath: result.backdrop_path ? `https://image.tmdb.org/t/p/w500${result.backdrop_path}` : null,
                releaseDate: result.first_air_date,
                rating: result.vote_average,
                mediaType: "tv",
                source: '迷雾剧场'
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
        const mistTheater = await fetchMistTheaterTitles();
        
        console.log(`Found ${mistTheater.airedShows.length} aired shows and ${mistTheater.upcomingShows.length} upcoming shows`);
        
        // Process aired shows - 只保留找到TMDB数据的
        const processedAiredShows = [];
        for (const item of mistTheater.airedShows) {
            console.log(`Searching TMDB for aired show: ${item.title} (${item.year})`);
            const tmdbData = await searchTMDB(item.title, item.year);
            if (tmdbData) {
                processedAiredShows.push({
                    ...tmdbData,
                    actors: item.actors,
                    notes: item.notes,
                    air_date: item.air_date
                });
            } else {
                console.log(`No TMDB data found for aired show: ${item.title}`);
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        
        // Process upcoming shows - 只保留找到TMDB数据的
        const processedUpcomingShows = [];
        for (const item of mistTheater.upcomingShows) {
            console.log(`Searching TMDB for upcoming show: ${item.title}`);
            const tmdbData = await searchTMDB(item.title);
            
            if (tmdbData) {
                processedUpcomingShows.push({
                    ...tmdbData,
                    actors: item.actors,
                    notes: item.notes
                });
            } else {
                console.log(`No TMDB data found for upcoming show: ${item.title}`);
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        
        const data = {
            last_updated: new Date().toISOString(),
            aired_shows: processedAiredShows,
            upcoming_shows: processedUpcomingShows
        };
        
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`Successfully updated data with:
        - ${processedAiredShows.length} aired shows (${mistTheater.airedShows.length - processedAiredShows.length} not found in TMDB)
        - ${processedUpcomingShows.length} upcoming shows (${mistTheater.upcomingShows.length - processedUpcomingShows.length} not found in TMDB)`);
    } catch (error) {
        console.error('Error updating data:', error);
        process.exit(1);
    }
}

updateTheaterData();
