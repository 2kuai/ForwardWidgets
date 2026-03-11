const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY;
const BASE_URL = "https://api.douban.com/v2/movie";

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情", 
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部"
};

const dir = './data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const FILE_PATH = path.join(dir, 'douban_movie_data.json');

// ================= 核心逻辑 =================

/**
 * 核心匹配逻辑
 * 逻辑：TMDB 优先 -> 失败则回退至 Douban 数据
 */
async function getAccurateMovieData(doubanItem) {
    const title = doubanItem.title;
    const originalTitle = doubanItem.original_title;
    const year = parseInt(doubanItem.year);

    try {
        // 1. 尝试从 TMDB 获取数据
        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                query: originalTitle || title,
                language: 'zh-CN',
                primary_release_year: year
            },
            headers: { 'Authorization': `Bearer ${TMDB_API_KEY}` },
            timeout: 10000 // 10秒超时控制
        });

        const results = searchRes.data.results || [];
        const exactMatch = results.find(m => {
            const tmdbYear = m.release_date ? new Date(m.release_date).getFullYear() : null;
            return (m.title === title || m.original_title === originalTitle) && tmdbYear === year;
        }) || (results.length > 0 ? results[0] : null);

        if (exactMatch) {
            console.log(`    ✅ [TMDB] 匹配成功: ${exactMatch.title}`);
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
                releaseDate: exactMatch.release_date || doubanItem.year,
                posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : doubanItem.images.large,
                backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/original${exactMatch.backdrop_path}` : "",
                mediaType: "movie",
                genreTitle: genreTitle
            };
        }
    } catch (err) {
        console.warn(`    ⚠️ [TMDB] 请求异常: ${err.message}`);
    }

    // 2. 回退机制：如果 TMDB 失败，返回豆瓣原生数据
    console.log(`    ℹ️ [DOUBAN] 使用豆瓣备份数据: ${title}`);
    return {
        id: doubanItem.id, // 使用豆瓣 ID
        type: "douban",
        title: title,
        description: doubanItem.summary || "暂无简介",
        rating: doubanItem.rating.average,
        releaseDate: doubanItem.year,
        posterPath: doubanItem.images.large,
        backdropPath: "",
        mediaType: "movie",
        genreTitle: doubanItem.genres.join(',')
    };
}

async function fetchAndSync(endpoint) {
    const movieMap = new Map(); // 用于去重，防止分页重叠导致数据虚增
    const requestBody = { apikey: DOUBAN_API_KEY };
    const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' };

    console.log(`\n========================================`);
    console.log(`🚀 开始同步分类: ${endpoint}`);
    console.log(`========================================`);

    try {
        const init = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
            params: { start: 0, count: 1 },
            headers: commonHeaders
        });

        const total = init.data.total || 0;
        console.log(`[豆瓣] 数据总量: ${total}`);

        for (let start = 0; start < total; start += 20) {
            console.log(`\n[分页] 正在请求 start=${start}...`);

            const res = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
                params: { start: start, count: 20 },
                headers: commonHeaders
            });

            const subjects = res.data.subjects || [];
            if (subjects.length === 0) break;

            for (const item of subjects) {
                const data = await getAccurateMovieData(item);
                
                // 以数据 ID 作为唯一标识去重
                if (data && !movieMap.has(data.id)) {
                    movieMap.set(data.id, data);
                }
                
                // 适当延迟防止触发 API 频率限制
                await new Promise(r => setTimeout(r, 150)); 
            }
        }
    } catch (e) {
        console.error(`\n❌ [${endpoint}] 流程中断: ${e.message}`);
    }
    
    return Array.from(movieMap.values());
}

async function main() {
    const startTime = Date.now();
    
    // 串行执行任务，保证日志清晰
    const finalResult = {
        in_theaters: await fetchAndSync('in_theaters'),
        coming_soon: await fetchAndSync('coming_soon'),
        top250: await fetchAndSync('top250')
    };

    fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n****************************************`);
    console.log(`🏁 任务完成! 总耗时: ${duration}s`);
    console.log(`📁 数据已保存至: ${FILE_PATH}`);
    console.log(`📊 抓取统计:`);
    console.log(`   - 正在热映: ${finalResult.in_theaters.length}`);
    console.
