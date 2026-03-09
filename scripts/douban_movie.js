const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY;
const BASE_URL = "https://api.douban.com/v2/movie";

const dir = './data';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const FILE_PATH = path.join(dir, 'douban_movie_data.json');

async function getAccurateTmdbData(doubanItem) {
    try {
        console.log(`    [TMDB] 尝试匹配: ${doubanItem.title} (${doubanItem.year})`);
        
        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                query: doubanItem.original_title || doubanItem.title,
                language: 'zh-CN',
                primary_release_year: doubanItem.year
            },
            headers: {
                'Authorization': `Bearer ${TMDB_API_KEY}`,
                'accept': 'application/json'
            }
        });

        let bestMatch = searchRes.data.results[0];
        if (!bestMatch) {
            console.log(`    [TMDB] 初次匹配失败，尝试回退搜索...`);
            const fallback = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
                params: {
                    query: doubanItem.title,
                    language: 'zh-CN'
                },
                headers: {
                    'Authorization': `Bearer ${TMDB_API_KEY}`,
                    'accept': 'application/json'
                }
            });
            bestMatch = fallback.data.results[0];
        }

        if (bestMatch) {
            const detailRes = await axios.get(`https://api.themoviedb.org/3/movie/${bestMatch.id}`, {
                params: { api_key: TMDB_API_KEY, language: 'zh-CN' }
            });
            const d = detailRes.data;
            console.log(`    ✅ [TMDB] 匹配成功: ${d.title}`);

            return {
                id: d.id,
                type: "tmdb",
                title: d.title || doubanItem.title,
                description: d.overview || "",
                rating: d.vote_average || doubanItem.rating.average,
                voteCount: d.vote_count || 0,
                popularity: d.popularity || 0,
                releaseDate: d.release_date || doubanItem.year,
                posterPath: d.poster_path ? d.poster_path : doubanItem.images.large,
                backdropPath: d.backdrop_path ? d.backdrop_path : "",
                mediaType: "movie",
                genreTitle: d.genres.length > 0 ? d.genres.map(g => g.name).join(',') : doubanItem.genres.join(',')
            };
        }
        console.warn(`    ❌ [TMDB] 未找到对应条目`);
        return null;
    } catch (err) {
        console.error(`    ⚠️ [TMDB] 异常: ${err.message}`);
        return null;
    }
}

async function fetchAndSync(endpoint) {
    const movies = [];
    const requestBody = { apikey: DOUBAN_API_KEY };
    const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' };

    console.log(`\n========================================`);
    console.log(`🚀 开始同步分类: ${endpoint}`);
    console.log(`========================================`);

    try {
        console.log(`[豆瓣] 发送初始化 POST 请求以获取总量...`);
        const init = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
            params: { start: 0, count: 20 },
            headers: commonHeaders
        });

        const total = init.data.total;
        console.log(`[豆瓣] 响应成功！该分类总数: ${total}`);

        if (!total || total === 0) {
            console.warn(`[豆瓣] 警告: total 为 0 或 undefined。响应详情:`, JSON.stringify(init.data));
            return movies;
        }

        for (let start = 0; start < total; start += 20) {
            const currentRange = `${start + 1} - ${Math.min(start + 20, total)}`;
            console.log(`\n[分页] 正在拉取第 ${currentRange} 条数据...`);

            const res = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
                params: { start: start, count: 20 },
                headers: commonHeaders
            });

            const subjects = res.data.subjects || [];
            console.log(`[豆瓣] 成功获取 ${subjects.length} 个条目，准备对接 TMDB...`);

            for (const item of subjects) {
                const data = await getAccurateTmdbData(item);
                if (data) {
                    movies.push(data);
                }
                await new Promise(r => setTimeout(r, 300)); // 略微增加延迟确保稳定
            }
        }
    } catch (e) {
        console.error(`\n❌ [${endpoint}] 流程中断:`);
        if (e.response) {
            console.error(`   HTTP状态码: ${e.response.status}`);
            console.error(`   错误信息: ${JSON.stringify(e.response.data)}`);
        } else {
            console.error(`   错误原因: ${e.message}`);
        }
    }
    return movies;
}

async function main() {
    console.log(`开始执行同步任务... 检查配置中...`);
    if (!DOUBAN_API_KEY) console.warn("提示: DOUBAN_API_KEY 未设置");
    if (!TMDB_API_KEY) console.warn("提示: TMDB_API_KEY 未设置");

    const startTime = Date.now();
    
    const finalResult = {
        in_theaters: await fetchAndSync('in_theaters'),
        coming_soon: await fetchAndSync('coming_soon'),
        top250: await fetchAndSync('top250')
    };

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
    
    console.log(`\n\n****************************************`);
    console.log(`🏁 任务完成! 总耗时: ${duration}s`);
    console.log(`📁 保存位置: ${FILE_PATH}`);
    console.log(`📊 最终统计: 
       - 正在热映: ${finalResult.in_theaters.length}
       - 即将上映: ${finalResult.coming_soon.length}
       - Top 250: ${finalResult.top250.length}`);
    console.log(`****************************************`);
}

main();
