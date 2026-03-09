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

/**
 * 封装带详细日志的请求
 */
async function safeGet(url, config, label) {
    try {
        const response = await axios.get(url, config);
        return response;
    } catch (err) {
        const status = err.response ? err.response.status : '网络错误';
        const detail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error(`  [${label}] 失败 | 状态码: ${status} | 原因: ${detail}`);
        return null;
    }
}

async function getAccurateTmdbData(doubanItem) {
    if (!TMDB_API_KEY) {
        console.warn('  [TMDB] 跳过: 未设置 TMDB_API_KEY');
        return null;
    }

    const title = doubanItem.original_title || doubanItem.title;
    const year = doubanItem.year;

    // 搜索：原名 + 年份
    const searchRes = await safeGet(`https://api.themoviedb.org/3/search/movie`, {
        params: {
            api_key: TMDB_API_KEY,
            query: title,
            language: 'zh-CN',
            primary_release_year: year
        }
    }, `TMDB 搜索: ${title}`);

    let bestMatch = searchRes?.data?.results?.[0];

    if (!bestMatch) {
        // 回退搜索：仅标题
        const fallback = await safeGet(`https://api.themoviedb.org/3/search/movie`, {
            params: { api_key: TMDB_API_KEY, query: doubanItem.title, language: 'zh-CN' }
        }, `TMDB 回退搜索: ${doubanItem.title}`);
        bestMatch = fallback?.data?.results?.[0];
    }

    if (bestMatch) {
        const detailRes = await safeGet(`https://api.themoviedb.org/3/movie/${bestMatch.id}`, {
            params: { api_key: TMDB_API_KEY, language: 'zh-CN' }
        }, `TMDB 详情: ${bestMatch.id}`);

        if (detailRes) {
            const d = detailRes.data;
            console.log(`    ✅ 匹配成功: ${d.title} (TMDB ID: ${d.id})`);
            return {
                id: d.id,
                type: "tmdb",
                title: d.title || doubanItem.title,
                description: d.overview || "",
                rating: d.vote_average || doubanItem.rating.average,
                voteCount: d.vote_count || 0,
                popularity: d.popularity || 0,
                releaseDate: d.release_date || doubanItem.year,
                posterPath: d.poster_path ? d.poster_path : doubanItem.images?.large,
                backdropPath: d.backdrop_path ? d.backdrop_path : "",
                mediaType: "movie",
                genreTitle: d.genres?.length > 0 ? d.genres.map(g => g.name).join(',') : doubanItem.genres.join(',')
            };
        }
    }
    console.warn(`    ❌ 未找到匹配: ${title}`);
    return null;
}

async function fetchAndSync(endpoint) {
    const movies = [];
    const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' };

    console.log(`\n>>> 开始同步 [${endpoint}]...`);

    try {
        // 1. 获取总数 (修正为 GET 请求并尝试将 apikey 放入 params)
        const init = await axios.get(`${BASE_URL}/${endpoint}`, {
            params: { apikey: DOUBAN_API_KEY, start: 0, count: 1 },
            headers: commonHeaders
        });

        const total = init.data.total || 0;
        console.log(`[${endpoint}] 发现数据总量: ${total}`);

        if (total === 0) {
            console.warn(`[${endpoint}] 警告: 接口返回总量为 0，请检查 API Key 是否有效。`);
            return movies;
        }

        // 2. 循环分页 (通常限制前 40 条避免封禁)
        const limit = Math.min(total, 40); 
        for (let start = 0; start < limit; start += 20) {
            console.log(`\n--- 正在处理第 ${start + 1} - ${Math.min(start + 20, limit)} 条 ---`);

            const res = await axios.get(`${BASE_URL}/${endpoint}`, {
                params: { 
                    apikey: DOUBAN_API_KEY,
                    start: start, 
                    count: 20 
                },
                headers: commonHeaders
            });

            const subjects = res.data.subjects || [];

            for (const item of subjects) {
                const data = await getAccurateTmdbData(item);
                if (data) movies.push(data);
                // 延迟 500ms，对 API 友好一点
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (e) {
        console.error(`\n[${endpoint}] 流程致命异常:`);
        if (e.response) {
            console.error(`  状态码: ${e.response.status}`);
            console.error(`  响应体: ${JSON.stringify(e.response.data)}`);
        } else {
            console.error(`  错误信息: ${e.message}`);
        }
    }
    return movies;
}

async function main() {
    if (!DOUBAN_API_KEY) {
        console.error("错误: 请先在环境变量中设置 DOUBAN_API_KEY");
        return;
    }

    const finalResult = {
        updateTime: new Date().toISOString(),
        in_theaters: await fetchAndSync('in_theaters'),
        coming_soon: await fetchAndSync('coming_soon'),
        top250: await fetchAndSync('top250')
    };

    fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
    console.log(`\n================================`);
    console.log(`🎉 任务结束！保存路径: ${FILE_PATH}`);
    console.log(`数据总计: 在映 ${finalResult.in_theaters.length} 条, 即将上映 ${finalResult.coming_soon.length} 条, Top250 ${finalResult.top250.length} 条`);
}

main();
