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
        // 1. 定义公共配置：apikey 放在请求体
        const requestBody = { apikey: DOUBAN_API_KEY };
        const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' };

        // 2. 获取总数 (start=0, count=20 作为 URL 参数)
        const init = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
            params: { start: 0, count: 20 },
            headers: commonHeaders
        });

        const total = init.data.total;
        console.log(`[${endpoint}] 同步开始，总数: ${total}`);

        // 3. 循环分页
        for (let start = 0; start < total; start += 20) {
            console.log(`正在同步第 ${start + 1} - ${Math.min(start + 20, total)} 条数据...`);

            const res = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
                params: { 
                    start: start, // 分页参数在 URL 
                    count: 20 
                },
                headers: commonHeaders
            });

            const subjects = res.data.subjects || [];

            for (const item of subjects) {
                try {
                    const data = await getAccurateTmdbData(item);
                    if (data) movies.push(data);
                } catch (tmdbErr) {
                    console.error(`TMDB 匹配跳过 [${item.title}]:`, tmdbErr.message);
                }
                // 延迟 250ms 避免请求过快
                await new Promise(r => setTimeout(r, 250));
            }
        }
    } catch (e) {
        console.error(`${endpoint} 流程异常:`, e.message);
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
