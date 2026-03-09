const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY;
const BASE_URL = "https://api.douban.com/v2/movie";

// 确保目录存在
const dir = './data';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const FILE_PATH = path.join(dir, 'douban_movie_data.json');

async function getAccurateTmdbData(doubanItem) {
    try {
        // 搜索：原名 + 年份
        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                query: doubanItem.original_title || doubanItem.title,
                language: 'zh-CN',
                primary_release_year: doubanItem.year
            }
        });

        let bestMatch = searchRes.data.results[0];
        if (!bestMatch) {
            const fallback = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
                params: { api_key: TMDB_API_KEY, query: doubanItem.title, language: 'zh-CN' }
            });
            bestMatch = fallback.data.results[0];
        }

        if (bestMatch) {
            const detailRes = await axios.get(`https://api.themoviedb.org/3/movie/${bestMatch.id}`, {
                params: { api_key: TMDB_API_KEY, language: 'zh-CN' }
            });
            const d = detailRes.data;

            return {
                id: d.id,
                type: "tmdb",
                title: d.title || doubanItem.title,
                description: d.overview || "",
                rating: d.vote_average || doubanItem.rating.average,
                voteCount: d.vote_count || 0,
                popularity: d.popularity || 0,
                releaseDate: d.release_date || doubanItem.year,
                // TMDB 路径不带前缀，缺失则回填豆瓣完整 URL
                posterPath: d.poster_path ? d.poster_path : doubanItem.images.large,
                backdropPath: d.backdrop_path ? d.backdrop_path : "",
                mediaType: "movie",
                genreTitle: d.genres.length > 0 ? d.genres.map(g => g.name).join(',') : doubanItem.genres.join(',')
            };
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function fetchAndSync(endpoint) {
    const movies = [];
    try {
        const init = await axios.get(`${BASE_URL}/${endpoint}`, {
            params: { apikey: DOUBAN_API_KEY, start: 0, count: 20 },
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' }
        });

        const total = init.data.total;
        console.log(`同步 [${endpoint}]，总数: ${total}`);

        for (let start = 0; start < total; start += 20) {
            const res = await axios.get(`${BASE_URL}/${endpoint}`, {
                params: { apikey: DOUBAN_API_KEY, start, count: 20 },
                headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' }
            });

            for (const item of res.data.subjects) {
                const data = await getAccurateTmdbData(item);
                if (data) movies.push(data);
                await new Promise(r => setTimeout(r, 250));
            }
        }
    } catch (e) {
        console.error(`${endpoint} 失败:`, e.message);
    }
    return movies;
}

async function main() {
    const finalResult = {
        in_theaters: await fetchAndSync('in_theaters'),
        coming_soon: await fetchAndSync('coming_soon'),
        top250: await fetchAndSync('top250')
    };

    fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
    console.log(`保存成功: ${FILE_PATH}`);
}

main();
