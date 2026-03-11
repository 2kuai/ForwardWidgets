const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY;
const BASE_URL = "https://api.douban.com/v2/movie";

// TMDB 电影类型映射表 (用于将 genre_ids 转换为中文标签)
const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情", 
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部"
};

const dir = './data';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const FILE_PATH = path.join(dir, 'douban_movie_data.json');

// ================= 核心逻辑 =================

/**
 * 优化的 TMDB 搜索函数
 * 逻辑：优先使用原名+年份精确匹配，若无结果则回退到中文名搜索
 */
async function getAccurateTmdbData(doubanItem) {
    try {
        const title = doubanItem.title;
        const originalTitle = doubanItem.original_title;
        const year = parseInt(doubanItem.year);

        console.log(`    [TMDB] 尝试匹配: ${title} (${year})`);
        
        // 1. 发起搜索请求 (优先使用 original_title 提高国际电影匹配率)
        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                query: originalTitle || title,
                language: 'zh-CN',
                primary_release_year: year
            },
            headers: {
                'Authorization': `Bearer ${TMDB_API_KEY}`,
                'accept': 'application/json'
            },
            timeout: 10000
        });

        let results = searchRes.data.results || [];

        // 2. 如果初次搜索无结果，尝试回退到中文名且不带年份（宽泛搜索）
        if (results.length === 0) {
            console.log(`    [TMDB] 初次匹配失败，尝试回退搜索...`);
            const fallback = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
                params: {
                    query: title,
                    language: 'zh-CN'
                },
                headers: { 'Authorization': `Bearer ${TMDB_API_KEY}` }
            });
            results = fallback.data.results || [];
        }

        // 3. 在结果集中寻找最匹配的项
        const exactMatch = results.find(m => {
            const tmdbYear = m.release_date ? new Date(m.release_date).getFullYear() : null;
            // 匹配条件：标题一致且年份相同
            const isTitleMatch = (m.title === title || m.original_title === originalTitle || m.title === originalTitle);
            return isTitleMatch && tmdbYear === year;
        }) || results[0]; // 如果找不到完全匹配，则取第一个（相关度最高）

        if (exactMatch) {
            console.log(`    ✅ [TMDB] 匹配成功: ${exactMatch.title}`);

            // 类型转换：将 genre_ids 映射为文字
            const genreTitle = (exactMatch.genre_ids || [])
                .map(id => GENRE_MAP[id])
                .filter(Boolean)
                .join(',') || doubanItem.genres.join(',');

            return {
                id: exactMatch.id,
                type: "tmdb",
                title: exactMatch.title || title,
                description: exactMatch.overview || "",
                rating: exactMatch.vote_average || doubanItem.rating.average,
                voteCount: exactMatch.vote_count || 0,
                popularity: exactMatch.popularity || 0,
                releaseDate: exactMatch.release_date || doubanItem.year,
                // 补全图片完整路径
                posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : doubanItem.images.large,
                backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/original${exactMatch.backdrop_path}` : "",
                mediaType: "movie",
                genreTitle: genreTitle
            };
        }

        console.warn(`    ❌ [TMDB] 未找到对应条目: ${title}`);
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
        const init = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
            params: { start: 0, count: 20 },
            headers: commonHeaders
        });

        const total = init.data.total;
        console.log(`[豆瓣] 响应成功！该分类总数: ${total}`);

        if (!total || total === 0) {
            console.warn(`[豆瓣] 警告: total 为 0。响应详情:`, JSON.stringify(init.data));
            return movies;
        }

        // 分页爬取
        for (let start = 0; start < total; start += 20) {
            const currentRange = `${start + 1} - ${Math.min(start + 20, total)}`;
            console.log(`\n[分页] 正在拉取第 ${currentRange} 条数据...`);

            const res = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
                params: { start: start, count: 20 },
                headers: commonHeaders
            });

            const subjects = res.data.subjects || [];
            
            for (const item of subjects) {
                const data = await getAccurateTmdbData(item);
                if (data) {
                    movies.push(data);
                }
                // 控制请求频率，避免被 TMDB 封禁
                await new Promise(r => setTimeout(r, 200)); 
            }
        }
    } catch (e) {
        console.error(`\n❌ [${endpoint}] 流程中断: ${e.message}`);
    }
    return movies;
}

async function main() {
    console.log(`开始执行同步任务...`);
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
