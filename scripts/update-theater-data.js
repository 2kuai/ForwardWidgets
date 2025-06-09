import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3NzE0YWYxZGMwZDA3ZjVkODA1ZDEzNGQwMGZkZGM5ZCIsIm5iZiI6MTc0MzI1NDg0NS4wNCwic3ViIjoiNjdlN2Y1M2RiNTY1NWFhYzQyNjM4ODk2Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.rBotPSAvlgM8mMWI4_NVLEU-ssD9plLdA-r17bPA3aA';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function fetchMistTheaterTitles() {
    try {
        const response = await axios.get('https://zh.wikipedia.org/w/api.php', {
            params: {
                action: 'parse',
                page: '迷雾剧场',
                format: 'json',
                prop: 'text',
                section: 0
            }
        });
        const html = response.data.parse.text['*'];
        const titleYearRegex = /《([^》]+)》\s*\((\d{4})年\)/g;
        const matches = [...html.matchAll(titleYearRegex)];
        return matches.map(match => ({
            title: match[1],
            year: match[2]
        }));
    } catch (error) {
        console.error('Error fetching from Wikipedia:', error);
        return [];
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
        const wikiData = await fetchMistTheaterTitles();
        console.log(`Found ${wikiData.length} shows from Wikipedia`);
        const shows = [];
        for (const item of wikiData) {
            console.log(`Searching TMDB for: ${item.title} (${item.year})`);
            const tmdbData = await searchTMDB(item.title, item.year);
            if (tmdbData) {
                shows.push(tmdbData);
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        const data = {
            last_updated: new Date().toISOString(),
            shows: shows
        };
        const outputPath = path.join(__dirname, '..', 'data', 'theater-data.json');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Successfully updated theater data with ${shows.length} shows`);
    } catch (error) {
        console.error('Error updating theater data:', error);
        process.exit(1);
    }
}

updateTheaterData(); 